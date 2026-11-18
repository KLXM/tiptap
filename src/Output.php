<?php

namespace Klxm\Tiptap;

use Redaxo\Core\Content\Article;
use Redaxo\Core\Core;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\MediaManager\MediaManager;
use Redaxo\Core\MediaPool\Media;
use Klxm\Tiptap\Media\HtmlEmbed;
use Klxm\Tiptap\Media\Oembed;
use Klxm\Meta\Alt;
use Klxm\VideoEditor\VideoEditor;
use Redaxo\Core\Language\Language;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\Util\Markdown\Markdown;
use Throwable;

use function class_exists;
use function htmlspecialchars;
use function html_entity_decode;
use function parse_url;
use function preg_match;
use function preg_replace;
use function preg_replace_callback;
use function rawurldecode;
use function rawurlencode;
use function str_contains;
use function str_starts_with;
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

        if (Mode::Html === $profile->mode && $profile->hasItem('htmlEmbed')) {
            $html = HtmlEmbed::resolve($html);
        }

        return self::resolve($html, (bool) ($profile->config['embed']['consent'] ?? true));
    }

    /**
     * Links, Bilder, Videos und YouTube/Vimeo auflösen – auch auf beliebiges HTML anwendbar, z. B. im OUTPUT_FILTER.
     * HTML-Embeds nur über {@see self::render()} (Profil mit Werkzeug htmlEmbed, signierter Code).
     *
     * @param bool $twoClick YouTube/Vimeo erst nach Klick laden (Platzhalter mit Vorschaubild)
     */
    public static function resolve(string $html, bool $twoClick = true): string
    {
        return self::resolveOembed(self::resolveMedia(self::resolveLinks($html)), $twoClick);
    }

    /**
     * `<figure data-rex-oembed="…">` (YouTube/Vimeo) → Platzhalter mit Vorschaubild und „Video laden“ bzw. direkt der
     * Player. Schnittstelle zu Einwilligungs-Tools: `data-consent-service`, `data-consent-src`, `[data-consent-load]`,
     * `[data-consent-allow]` (siehe tiptap-media.js).
     */
    public static function resolveOembed(string $html, bool $twoClick = true): string
    {
        if (!str_contains($html, 'data-rex-oembed=')) {
            return $html;
        }

        return (string) preg_replace_callback('~<figure\b([^>]*\sdata-rex-oembed="([^"]*)"[^>]*)>.*?</figure>~is', static function (array $m) use ($twoClick): string {
            $url = html_entity_decode($m[2], ENT_QUOTES);
            $video = Oembed::parse($url);
            if (null === $video) {
                return '';
            }
            $meta = Oembed::meta($url) ?? ['title' => '', 'thumbnail' => false];
            $title = preg_match('~\sdata-rex-title="([^"]*)"~', $m[1], $t) ? html_entity_decode($t[1], ENT_QUOTES) : '';
            $title = '' !== $title ? $title : ('' !== $meta['title'] ? $meta['title'] : Oembed::PROVIDERS[$video['provider']]);
            $class = preg_match('~\sclass="([^"]*)"~', $m[1], $c) ? $c[1] : '';
            if (!str_contains($class, 'rex-ratio-')) {
                $class .= ' rex-ratio-16x9';
            }
            $e = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES);
            $figure = '<figure class="rex-oembed ' . $e(trim($class)) . '">';
            if (!$twoClick) {
                return $figure . '<iframe src="' . $e(Oembed::playerUrl($video)) . '" title="' . $e($title) . '" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></figure>';
            }
            $provider = Oembed::PROVIDERS[$video['provider']];
            $thumb = $meta['thumbnail'] ? '<img class="rex-oembed-thumb" src="' . $e(self::basePath() . 'index.php?rex-api-call=tiptap_oembed&thumb=1&url=' . rawurlencode($url)) . '" alt="" loading="lazy">' : '';

            return $figure
                . '<div class="rex-oembed-frame" data-consent-service="' . $video['provider'] . '" data-consent-src="' . $e(Oembed::playerUrl($video, true)) . '" data-consent-title="' . $e($title) . '">'
                . $thumb
                . '<button type="button" class="rex-oembed-play" data-consent-load><span class="rex-oembed-play-icon" aria-hidden="true"></span><span class="rex-oembed-play-label">' . $e(self::text('tiptap_oembed_load', $title)) . '</span></button>'
                . '<p class="rex-oembed-note">' . $e(self::text('tiptap_oembed_note', $provider)) . ' <a href="' . $e(Oembed::watchUrl($video)) . '" target="_blank" rel="noopener">' . $e(self::text('tiptap_oembed_watch', $provider)) . '</a></p>'
                . '</div></figure>';
        }, $html);
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
        if (str_contains($html, '<video')) {
            $html = self::resolveVideo($html);
        }
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
                // ohne eigenen Alternativtext: aus dem Medienpool (klxm_meta), dekorative Bilder alt=""
                if (!preg_match('~\salt\b(?!-)~', $attrs)) {
                    $attrs = ' alt="' . htmlspecialchars(Alt::attribute($name), ENT_QUOTES) . '"' . $attrs;
                } else {
                    // leeres alt (dekorativ) schreibt die Bereinigung ohne Wert
                    $attrs = (string) preg_replace('~\salt(?=[\s/>]|$)(?!=)~', ' alt=""', $attrs);
                }

                return '<img src="' . htmlspecialchars($src, ENT_QUOTES) . '"' . $attrs . '>';
            }
            if (preg_match('~\ssrc="(?:\.\./)+media/([^"]+)"~', $attrs, $old)) {
                $src = self::mediaUrl(rawurldecode(html_entity_decode($old[1], ENT_QUOTES)), '');

                return '<img' . (string) preg_replace('~\ssrc="[^"]*"~', ' src="' . htmlspecialchars($src, ENT_QUOTES) . '"', $attrs) . '>';
            }

            return $m[0];
        }, $html);
    }

    /**
     * Videos aus dem Medienpool: `data-rex-media` → Adresse, `data-rex-poster` → poster.
     *
     * Mit dem AddOn video_editor zusätzlich: Poster aus dem Video-Editor, wenn keins gewählt ist (wird nicht
     * gespeichert – ein neues Standbild erscheint überall), Web-Fassungen als `<source>` (Hintergrundvideo: die
     * kleineren) und Untertitel als `<track>` (Sprache der Seite eingeschaltet).
     */
    public static function resolveVideo(string $html): string
    {
        return (string) preg_replace_callback('~<video\b([^>]*)>(.*?)</video>~is', static function (array $m): string {
            $attrs = $m[1];
            $inner = $m[2];
            $file = preg_match('~\sdata-rex-media="([^"]+)"~', $attrs, $f) ? html_entity_decode($f[1], ENT_QUOTES) : null;
            $editor = null !== $file && class_exists(VideoEditor::class);
            if (null !== $file) {
                $attrs = (string) preg_replace('~\s(src|data-rex-media)="[^"]*"~', '', $attrs);
                $sources = $editor ? VideoEditor::sources($file, self::isBackground($attrs)) : [];
                if ($sources) {
                    // mehrere Fassungen: der Browser nimmt die erste passende <source>
                    $inner = '';
                    foreach ($sources as $source) {
                        $inner .= '<source src="' . htmlspecialchars($source['url'], ENT_QUOTES) . '" type="' . htmlspecialchars($source['type'], ENT_QUOTES) . '"'
                            . ('' !== $source['media'] ? ' media="' . htmlspecialchars($source['media'], ENT_QUOTES) . '"' : '') . '>';
                    }
                } else {
                    $attrs = ' src="' . htmlspecialchars(self::mediaUrl($file), ENT_QUOTES) . '"' . $attrs;
                }
            }
            if (preg_match('~\sdata-rex-poster="([^"]+)"~', $attrs, $poster)) {
                $url = self::mediaUrl(html_entity_decode($poster[1], ENT_QUOTES));
                $attrs = (string) preg_replace('~\s(poster|data-rex-poster)="[^"]*"~', '', $attrs) . ' poster="' . htmlspecialchars($url, ENT_QUOTES) . '"';
            } elseif (preg_match('~\sposter="([^"]*)"~', $attrs, $poster) && !preg_match('~^(/|https://)~', html_entity_decode($poster[1], ENT_QUOTES))) {
                $attrs = (string) preg_replace('~\sposter="[^"]*"~', '', $attrs);
            }
            if ($editor && !str_contains($attrs, ' poster=') && null !== ($auto = VideoEditor::poster($file))) {
                $attrs .= ' poster="' . htmlspecialchars($auto->getUrl() . '?v=' . $auto->updateDate, ENT_QUOTES) . '"';
            }
            if ($editor && !self::isBackground($attrs) && !str_contains($inner, '<track')) {
                $lang = self::languageCode();
                $on = false;
                foreach (VideoEditor::tracks($file) as $track) {
                    $default = !$on && 'chapters' !== $track['kind'] && $track['lang'] === $lang;
                    $on = $on || $default;
                    $inner .= '<track kind="' . htmlspecialchars($track['kind'], ENT_QUOTES) . '" src="' . htmlspecialchars($track['url'], ENT_QUOTES)
                        . '" srclang="' . htmlspecialchars($track['lang'], ENT_QUOTES) . '" label="' . htmlspecialchars($track['label'], ENT_QUOTES) . '"' . ($default ? ' default' : '') . '>';
                }
            }

            return '<video' . $attrs . '>' . $inner . '</video>';
        }, $html);
    }

    /** Hintergrundvideo: automatisch, stumm, in Schleife */
    private static function isBackground(string $attrs): bool
    {
        return 1 === preg_match('~\sautoplay\b~', $attrs) && 1 === preg_match('~\sloop\b~', $attrs) && 1 === preg_match('~\smuted\b~', $attrs);
    }

    private static function languageCode(): ?string
    {
        try {
            return Core::isBackend() ? null : Language::getCurrent()->code;
        } catch (Throwable) {
            return null;
        }
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

    /**
     * Text für die Website in der Sprache der Seite (clang-Code de, en … → de_de, en_gb), sonst Backend-Sprache.
     */
    public static function text(string $key, string|int ...$replacements): string
    {
        if (!Core::isBackend()) {
            try {
                $code = Language::getCurrent()->code;
                foreach (I18n::getLocales() as $locale) {
                    if ($locale === $code || str_starts_with($locale, $code . '_')) {
                        return I18n::rawMsgInLocale($key, $locale, ...$replacements);
                    }
                }
            } catch (Throwable) {
                // Backend-Sprache
            }
        }

        return I18n::rawMsg($key, ...$replacements);
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
