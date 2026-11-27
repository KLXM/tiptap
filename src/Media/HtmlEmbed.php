<?php

namespace Klxm\Tiptap\Media;

use Klxm\Tiptap\Output;
use Klxm\Tiptap\TiptapAddon;
use Redaxo\Core\Core;
use Redaxo\Core\Http\Response;
use Redaxo\Core\Security\User;

use function bin2hex;
use function hash_equals;
use function hash_hmac;
use function html_entity_decode;
use function htmlspecialchars;
use function is_string;
use function preg_match;
use function preg_replace;
use function preg_replace_callback;
use function random_bytes;
use function str_contains;
use function str_replace;
use function strlen;
use function strtolower;
use function trim;

use const ENT_HTML5;
use const ENT_QUOTES;

/**
 * HTML embeds: protected code block in the editor, stored escaped in the attribute
 * `<div data-rex-embed="…" data-rex-sig="…" data-consent-service="…"></div>`.
 *
 * Only code with a valid signature is output. Only users with the permission `tiptap[html_embed]` may sign (admins
 * always) – so nobody without the permission can inject scripts via the source view, an import or a form; if signed
 * code is changed afterwards, the signature is invalid.
 *
 * On output, `<script>` and `<style>` get the nonce of the response ({@see Response::getNonce()}), matching a
 * Content Security Policy with nonce. With a service (`data-consent-service`) the code is only inserted after consent
 * or a click (tiptap-media.js, interface to consent_kit).
 */
final class HtmlEmbed
{
    public const string PERMISSION = 'tiptap[html_embed]';

    /** Size of the code (characters) */
    public const int MAX_LENGTH = 100_000;

    public static function allowed(?User $user): bool
    {
        return null !== $user && $user->hasPerm(self::PERMISSION);
    }

    /** Normalizes line endings the way the browser delivers them in the attribute */
    public static function normalize(string $html): string
    {
        return trim(str_replace(["\r\n", "\r"], "\n", $html));
    }

    public static function service(string $service): string
    {
        $service = strtolower(trim($service));

        return 1 === preg_match('/^[a-z0-9_-]{1,64}$/', $service) ? $service : '';
    }

    public static function sign(string $html, string $service): string
    {
        return hash_hmac('sha256', self::service($service) . "\n" . self::normalize($html), self::secret());
    }

    public static function verify(string $html, string $service, string $sig): bool
    {
        return '' !== $sig && strlen($html) <= self::MAX_LENGTH && hash_equals(self::sign($html, $service), $sig);
    }

    /** Replaces signed embeds in the (sanitized) HTML with their code, removes all others */
    public static function resolve(string $html): string
    {
        if (!str_contains($html, 'data-rex-embed=')) {
            return $html;
        }

        return (string) preg_replace_callback('~<div\b([^>]*\sdata-rex-embed="[^"]*"[^>]*)>\s*</div>~i', static function (array $m): string {
            $attr = static fn (string $name): string => preg_match('~\s' . $name . '="([^"]*)"~', $m[1], $v) ? html_entity_decode($v[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '';
            $code = self::normalize($attr('data-rex-embed'));
            $service = self::service($attr('data-consent-service'));
            if ('' === $code || !self::verify($code, $service, $attr('data-rex-sig'))) {
                return '';
            }

            return self::render($code, $service, $attr('data-rex-label'));
        }, $html);
    }

    /** Outputs code: nonce on scripts/styles, with a service as template behind a placeholder */
    public static function render(string $code, string $service = '', string $label = ''): string
    {
        $code = self::withNonce($code);
        if ('' === $service) {
            return $code;
        }
        $name = '' !== trim($label) ? trim($label) : $service;

        return '<div class="rex-embed-consent" data-consent-service="' . htmlspecialchars($service, ENT_QUOTES) . '">'
            . '<template>' . $code . '</template>'
            . '<div class="rex-embed-placeholder">'
            . '<p>' . htmlspecialchars(Output::text('tiptap_embed_consent_text', $name), ENT_QUOTES) . '</p>'
            . '<button type="button" class="rex-embed-load">' . htmlspecialchars(Output::text('tiptap_embed_consent_load'), ENT_QUOTES) . '</button>'
            . '</div></div>';
    }

    /** Nonce of the current response on `<script>` and `<style>` (existing ones are replaced) */
    public static function withNonce(string $code): string
    {
        $nonce = htmlspecialchars(Response::getNonce(), ENT_QUOTES);
        $code = (string) preg_replace('~(<(?:script|style)\b[^>]*?)\snonce=(?:"[^"]*"|\'[^\']*\'|[^\s>]+)~i', '$1', $code);

        return (string) preg_replace('~<(script|style)\b~i', '<$1 nonce="' . $nonce . '"', $code);
    }

    /** Key for the signatures – per installation, created on first use */
    private static function secret(): string
    {
        $addon = TiptapAddon::instance();
        $secret = $addon->getConfig('embed_secret');
        if (!is_string($secret) || strlen($secret) < 32) {
            $secret = bin2hex(random_bytes(32));
            $addon->setConfig('embed_secret', $secret);
        }

        return $secret;
    }

    /** For Tiptap::sanitize(): removes embeds from input without permission (e.g. frontend forms) */
    public static function strip(string $html): string
    {
        if (!str_contains($html, 'data-rex-embed') || self::allowed(Core::getUser())) {
            return $html;
        }

        return (string) preg_replace('~<div\b[^>]*\sdata-rex-embed=(?:"[^"]*"|\'[^\']*\')[^>]*>\s*</div>~i', '', $html);
    }
}
