<?php

namespace Klxm\Tiptap;

use Redaxo\Core\Content\Article;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\MediaManager\MediaManager;
use Redaxo\Core\MediaPool\Media;
use Redaxo\Core\Util\Markdown\Markdown;
use Throwable;

use function htmlspecialchars;
use function html_entity_decode;
use function parse_url;
use function preg_match;
use function preg_replace;
use function preg_replace_callback;
use function rawurldecode;
use function str_contains;
use function trim;

use const ENT_QUOTES;
use const PHP_URL_PATH;

/**
 * Ausgabe gespeicherter Inhalte: Markdown wird zu HTML, alles wird nach dem Profil bereinigt; interne Links
 * (`redaxo://ID`), Datensätze (`yform://tabelle/id`) und Bilder aus dem Medienpool bekommen ihre aktuelle Adresse.
 */
final class Output
{
    public static function render(?string $value, Profile $profile): string
    {
        $value = trim((string) $value);
        if ('' === $value) {
            return '';
        }

        $html = Mode::Markdown === $profile->mode
            ? Markdown::factory()->parse($value, false, false, Sanitizer::config($profile))
            : Sanitizer::clean($value, $profile);

        return self::resolve($html);
    }

    /** Links und Bilder auflösen – auch auf beliebiges HTML anwendbar, z. B. im OUTPUT_FILTER */
    public static function resolve(string $html): string
    {
        return self::resolveMedia(self::resolveLinks($html));
    }

    /**
     * Ersetzt in href `redaxo://ID` (optional `redaxo://ID-SPRACHE`, `#anker`) durch die Adresse des Artikels und
     * `yform://tabelle/ID` durch die Adresse des Datensatzes.
     */
    public static function resolveLinks(string $html): string
    {
        if (str_contains($html, 'redaxo://')) {
            $html = (string) preg_replace_callback('~(href=["\'])redaxo://(\d+)(?:-(\d+))?(#[^"\']*)?(["\'])~i', static function (array $m): string {
                $article = Article::get((int) $m[2], isset($m[3]) && '' !== $m[3] ? (int) $m[3] : null);
                $url = $article?->isOnline() ? $article->getUrl() : '#';

                return $m[1] . htmlspecialchars($url . ($m[4] ?? ''), ENT_QUOTES) . $m[5];
            }, $html);
        }
        if (str_contains($html, 'yform://')) {
            $html = (string) preg_replace_callback('~(href=["\'])yform://([a-zA-Z0-9_.-]+)/(\d+)(#[^"\']*)?(["\'])~i', static function (array $m): string {
                $url = RecordLinks::url($m[2], (int) $m[3]);

                return $m[1] . htmlspecialchars($url . ('#' !== $url ? ($m[4] ?? '') : ''), ENT_QUOTES) . $m[5];
            }, $html);
        }

        return $html;
    }

    /**
     * Bilder aus dem Medienpool (`data-rex-media`, optional `data-rex-media-type`): Adresse über den Mediamanager bzw.
     * den Medienpool – so stimmt sie im Frontend, auch nach einem Umzug. Alte relative Adressen (`../media/…`) aus dem
     * Backend werden korrigiert.
     */
    public static function resolveMedia(string $html): string
    {
        if (!str_contains($html, '<img')) {
            return $html;
        }

        return (string) preg_replace_callback('~<img\b([^>]*)>~i', static function (array $m): string {
            $attrs = $m[1];
            if (preg_match('~\sdata-rex-media="([^"]+)"~', $attrs, $file)) {
                $name = html_entity_decode($file[1], ENT_QUOTES);
                $type = preg_match('~\sdata-rex-media-type="([^"]+)"~', $attrs, $t) ? html_entity_decode($t[1], ENT_QUOTES) : '';
                $src = self::mediaUrl($name, $type);
                $attrs = (string) preg_replace('~\s(src|data-rex-media|data-rex-media-type)="[^"]*"~', '', $attrs);

                return '<img src="' . htmlspecialchars($src, ENT_QUOTES) . '"' . $attrs . '>';
            }
            if (preg_match('~\ssrc="(?:\.\./)+media/([^"]+)"~', $attrs, $old)) {
                $src = self::mediaUrl(rawurldecode(html_entity_decode($old[1], ENT_QUOTES)), '');

                return '<img' . (string) preg_replace('~\ssrc="[^"]*"~', ' src="' . htmlspecialchars($src, ENT_QUOTES) . '"', $attrs) . '>';
            }

            return $m[0];
        }, $html);
    }

    public static function mediaUrl(string $file, string $type = ''): string
    {
        try {
            if ('' !== $type) {
                return MediaManager::getUrl($type, Media::get($file) ?? $file);
            }

            return Media::get($file)?->getUrl() ?? Url::media($file);
        } catch (Throwable) {
            return Url::media($file);
        }
    }

    /** Pfad der Website-Wurzel (`/` oder `/unterordner/`) – gleich im Backend und im Frontend */
    public static function basePath(): string
    {
        try {
            $path = (string) parse_url(Url::absoluteBase(), PHP_URL_PATH);
        } catch (Throwable) {
            $path = '/';
        }

        return '/' . trim($path, '/') . ('/' === '/' . trim($path, '/') ? '' : '/');
    }
}
