<?php

namespace Klxm\Tiptap;

use Klxm\Tiptap\Media\EmbedSignApi;
use Klxm\Tiptap\Media\HtmlEmbed;
use Klxm\Tiptap\Media\MediaInfoApi;
use Klxm\Tiptap\Media\OembedApi;
use Klxm\Tiptap\Media\UploadApi;
use Klxm\VideoEditor\VideoEditor;
use Redaxo\Core\Core;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\Http\Response;
use Redaxo\Core\Language\Language;
use Redaxo\Core\Security\BackendLogin;
use Redaxo\Core\View\HtmlAttributes;

use function class_exists;
use function in_array;
use function json_encode;
use function mb_substr;
use function preg_match;
use function Redaxo\Core\View\escape;
use function substr;

use const JSON_HEX_AMP;
use const JSON_HEX_APOS;
use const JSON_HEX_QUOT;
use const JSON_HEX_TAG;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

/**
 * Public API of the addon.
 *
 *     // Output in a module/template (Markdown → HTML, sanitized, internal links resolved)
 *     echo Tiptap::render($this->text, 'tiptap.default');
 *
 *     // Frontend form (e.g. for guests)
 *     echo Tiptap::assets();
 *     echo Tiptap::editor('comment', $value, 'tiptap.guest');
 *     $clean = Tiptap::sanitize(Request::post('comment', 'string'), 'tiptap.guest');
 */
final class Tiptap
{
    private const int JSON_ATTR = JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP;

    /** Frontend assets already output */
    private static bool $assetsDone = false;

    /** Registers an extension of another addon – in its boot() */
    public static function register(Plugin $plugin): void
    {
        Registry::addPlugin($plugin);
    }

    /** The profile with the text formats of other addons ({@see AsTiptapStyles}) – for editor, sanitizer and output */
    public static function profile(string|Profile|null $profile = null): Profile
    {
        return ProfileStyles::apply($profile instanceof Profile ? $profile : Profiles::getOrDefault($profile));
    }

    /** Outputs stored content: HTML sanitized, Markdown converted, `redaxo://ID` resolved */
    public static function render(?string $value, string|Profile|null $profile = null): string
    {
        return Output::render($value, self::profile($profile));
    }

    /**
     * Sanitizes input before it is saved (frontend!). HTML profiles: only allowed elements/classes;
     * Markdown profiles: unchanged (sanitized on output), truncated to maxLength.
     */
    public static function sanitize(?string $value, string|Profile|null $profile = null): string
    {
        $profile = self::profile($profile);
        $value = (string) $value;
        if (Mode::Markdown === $profile->mode) {
            $max = $profile->config['maxLength'];

            return $max > 0 ? mb_substr($value, 0, $max * 2) : $value;
        }

        return Sanitizer::clean(HtmlEmbed::strip($value), $profile);
    }

    /**
     * Editor element with textarea – for custom forms in the frontend or backend.
     *
     * @param array<literal-string, string|int|bool|null> $attributes Additional attributes of the textarea
     */
    public static function editor(string $name, ?string $value, string|Profile|null $profile = null, array $attributes = []): string
    {
        $profile = self::profile($profile);

        return '<rex-tiptap ' . new HtmlAttributes(['data-config' => self::configJson($profile)]) . '>'
            . '<textarea ' . new HtmlAttributes(['class' => ['rex-input', 'rex-tiptap-source'], 'name' => $name] + $attributes) . '>'
            . escape((string) $value) . '</textarea></rex-tiptap>';
    }

    /**
     * Address of a plugin file for the website: addons register their plugin in boot(), where getAssetsUrl() is still
     * relative (`./assets/…`) – below a nice URL like /seite/unterseite that would miss, so it starts at the site root.
     */
    public static function pluginUrl(string $url): string
    {
        return preg_match('~^\./(?=assets/)~', $url) ? Output::basePath() . substr($url, 2) : $url;
    }

    /** Settings of a profile as JSON for `data-config` */
    public static function configJson(Profile $profile): string
    {
        return json_encode(self::clientConfig($profile), self::JSON_ATTR);
    }

    /** @return array<string, mixed> */
    public static function clientConfig(Profile $profile): array
    {
        $config = $profile->clientConfig();
        // on the website a logged-in backend user (editing in context, e.g. fluid) has the same tools as in the backend
        $user = Core::isBackend() ? Core::getUser() : BackendLogin::createUser();
        $config['backend'] = null !== $user;
        // URLs from the website root: correct in the backend as well as in the frontend
        $base = Output::basePath();
        $config['mediaUrl'] = $base . 'media/';
        $config['mediaManagerUrl'] = $base . 'index.php?rex_media_type=__TYPE__&rex_media_file=__FILE__';
        if (null === $user) {
            // Without login there is no record search; link types stay as the profile says – existing links must not
            // get lost while editing, and the server cleans input after the profile anyway (Tiptap::sanitize())
            $config['link']['records'] = [];
        } else {
            $tables = RecordLinks::tables($user);
            $config['recordTables'] = [];
            foreach ($config['link']['records'] as $name) {
                if (isset($tables[$name])) {
                    $config['recordTables'][] = ['name' => $name, 'label' => $tables[$name]];
                }
            }
            $config['recordApi'] = Url::backendController(RecordSearchApi::getUrlParams());
            // Files to the media pool by drag & drop/paste (the server checks the permission for the target category again)
            if ($config['upload']['enabled'] && $user->getComplexPerm('media')->hasMediaPerm()) {
                $config['uploadApi'] = Url::backendController(UploadApi::getUrlParams());
            }
            // Alt text from the media pool (klxm_meta) in the language of the content
            $config['mediaInfoApi'] = Url::backendController(MediaInfoApi::getUrlParams());
            $config['language'] = Language::getCurrentId();
            // Title/thumbnail of YouTube/Vimeo, approval of HTML embeds (permission tiptap[html_embed])
            $config['oembedApi'] = Url::backendController(OembedApi::getUrlParams());
            // Video editor (optional): still as poster, editing in the media pool
            if (class_exists(VideoEditor::class)) {
                $config['videoEditor'] = ['api' => VideoEditor::apiUrl(), 'edit' => VideoEditor::editUrlTemplate()];
            }
            if (HtmlEmbed::allowed($user)) {
                $config['htmlEmbed'] = true;
                $config['embedSignApi'] = Url::backendController(EmbedSignApi::getUrlParams());
            }
        }

        return $config;
    }

    /**
     * Scripts and styles for the frontend (once per page). In the backend the addon loads them itself.
     *
     * @param bool $withProfiles Include the settings of all profiles – needed for `<textarea data-tiptap="name">`
     */
    public static function assets(bool $withProfiles = false): string
    {
        if (self::$assetsDone) {
            return '';
        }
        self::$assetsDone = true;
        $addon = TiptapAddon::instance();
        $nonce = escape(Response::getNonce());

        $html = '<link rel="stylesheet" href="' . escape($addon->assetUrl('tiptap.css')) . '">';
        $html .= '<script defer nonce="' . $nonce . '" src="' . escape($addon->assetUrl('tiptap-loader.js')) . '"></script>';
        foreach (Registry::plugins() as $plugin) {
            if (!$plugin->frontend) {
                continue;
            }
            if ($plugin->style) {
                $html .= '<link rel="stylesheet" href="' . escape(self::pluginUrl($plugin->style)) . '">';
            }
            if ($plugin->script) {
                $html .= '<script defer nonce="' . $nonce . '" src="' . escape(self::pluginUrl($plugin->script)) . '"></script>';
            }
        }
        if ($withProfiles) {
            $html .= self::profilesScript();
        }

        return $html;
    }

    /**
     * All profiles as a JSON block (for `textarea[data-tiptap]`, e.g. in YForm forms).
     *
     * @param list<string>|null $names Only these profiles
     */
    public static function profilesScript(?array $names = null): string
    {
        $profiles = [];
        foreach (Profiles::all() as $profile) {
            if (null === $names || in_array($profile->name, $names, true)) {
                $profiles[$profile->name] = self::clientConfig(ProfileStyles::apply($profile));
            }
        }

        // type=application/json is not executed, the CSP does not apply here
        return '<script type="application/json" id="rex-tiptap-profiles">' . json_encode($profiles, self::JSON_ATTR) . '</script>';
    }
}
