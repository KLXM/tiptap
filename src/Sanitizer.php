<?php

namespace FriendsOfRedaxo\Tiptap;

use Redaxo\Core\Util\Str;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

use function array_diff;
use function array_fill_keys;
use function array_filter;
use function array_merge;
use function array_unique;
use function array_values;
use function explode;
use function implode;
use function in_array;
use function preg_replace;
use function preg_replace_callback;
use function str_contains;
use function strtolower;

/**
 * Bereinigt HTML nach dem, was ein Profil erlaubt: nur die Elemente der Werkzeuge in der Toolbar, nur die Klassen aus
 * Block-/Textformaten und Ausrichtung, keine style-Attribute, keine Skripte.
 *
 * Wichtig für Eingaben aus dem Frontend: das Skript im Browser lässt sich umgehen, maßgeblich ist der Server.
 */
final class Sanitizer
{
    /** Elemente, deren Text bleibt, wenn das Profil sie nicht erlaubt */
    private const array KEEP_CONTENT = [
        'p', 'div', 'span', 'font', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'figure', 'figcaption',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'mark', 'small',
        'sub', 'sup', 'code', 'pre', 'blockquote', 'q', 'cite', 'abbr', 'a', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'label',
    ];

    /** @var array<string, HtmlSanitizerConfig> */
    private static array $configs = [];

    public static function clean(string $html, Profile $profile): string
    {
        $html = Str::sanitizeHtml($html, self::config($profile));
        // Links, deren Adresse nicht erlaubt war, bleiben als Text
        $html = (string) preg_replace('~<a(?:\s+(?:target|rel|title)="[^"]*")*\s*>(.*?)</a>~is', '$1', $html);

        return self::filterClasses($html, $profile);
    }

    /** Allowlist des Profils für den Symfony-Sanitizer */
    public static function config(Profile $profile): HtmlSanitizerConfig
    {
        $key = $profile->name . ':' . md5(serialize($profile->config) . $profile->mode->value);
        if (isset(self::$configs[$key])) {
            return self::$configs[$key];
        }

        $elements = ['p' => [], 'br' => []];
        foreach ($profile->items() as $id) {
            foreach (Registry::item($id)->elements ?? [] as $element => $attributes) {
                $elements[$element] = array_merge($elements[$element] ?? [], $attributes);
            }
        }
        // Überschriften nur in den gewählten Ebenen
        foreach ([1, 2, 3, 4, 5, 6] as $level) {
            if (!in_array($level, $profile->config['headings'], true)) {
                unset($elements['h' . $level]);
            }
        }
        // Markdown-Tabellen und Codeblöcke kennen keinen Unterschied – thead/tbody gehören zur Tabelle
        if (isset($elements['code']) && !isset($elements['pre']) && $profile->hasItem('codeBlock')) {
            $elements['pre'] = [];
        }

        if (isset($elements['img'])) {
            $elements['img'] = [...$elements['img'], 'class', 'data-rex-media', 'data-rex-media-type'];
        }
        if (!$profile->config['link']['targetBlank'] && isset($elements['a'])) {
            $elements['a'] = array_values(array_diff($elements['a'], ['target']));
        }

        $config = new HtmlSanitizerConfig()->withMaxInputLength(-1);
        foreach ($elements as $element => $attributes) {
            $config = $config->allowElement($element, array_values(array_unique($attributes)));
        }
        // Nicht erlaubte Textelemente entfernen, ihren Inhalt aber behalten (sonst verschwindet z. B. eine Überschrift samt Text)
        foreach (self::KEEP_CONTENT as $element) {
            if (!isset($elements[$element])) {
                $config = $config->blockElement($element);
            }
        }

        // Klassen: auf allen Elementen erlaubt, gefiltert wird danach gegen die Liste des Profils
        if (self::classes($profile)) {
            $config = $config->allowAttribute('class', '*');
        }

        $link = $profile->config['link'];
        $schemes = [];
        if ($link['external']) {
            $schemes = ['http', 'https'];
        }
        if ($link['mailto']) {
            $schemes[] = 'mailto';
        }
        if ($link['tel']) {
            $schemes[] = 'tel';
        }
        if ($link['internal']) {
            $schemes[] = 'redaxo';
        }
        if ($link['records']) {
            $schemes[] = 'yform';
        }
        $config = $config->allowLinkSchemes($schemes ?: ['https'])
            ->allowRelativeLinks($link['internal'] || $link['media'])
            ->allowMediaSchemes($profile->config['image']['external'] ? ['http', 'https'] : [])
            ->allowRelativeMedias(true);

        if ($profile->hasItem('link') && $link['targetBlank']) {
            $config = $config->forceAttribute('a', 'rel', 'noopener');
        }

        return self::$configs[$key] = $config;
    }

    /**
     * Erlaubte Klassen des Profils (aus Block-, Textformaten, Ausrichtung und Plugins).
     *
     * @return list<string>
     */
    public static function classes(Profile $profile): array
    {
        $classes = [];
        if ($profile->hasItem('blockStyle')) {
            foreach ($profile->config['blockStyles'] as $style) {
                $classes = array_merge($classes, explode(' ', $style['class']));
            }
        }
        if ($profile->hasItem('inlineStyle')) {
            foreach ($profile->config['inlineStyles'] as $style) {
                $classes = array_merge($classes, explode(' ', $style['class']));
            }
        }
        if ($profile->hasItem('image')) {
            foreach ($profile->config['image']['styles'] as $style) {
                $classes = array_merge($classes, explode(' ', $style['class']));
            }
        }
        if ($profile->hasItem('align', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify')) {
            foreach ($profile->config['align'] as $class) {
                $classes = array_merge($classes, explode(' ', $class));
            }
        }
        foreach (Registry::plugins() as $plugin) {
            foreach ($plugin->items as $item) {
                if ($profile->hasItem($item->id)) {
                    $classes = array_merge($classes, $plugin->classes);
                    break;
                }
            }
        }

        return array_values(array_unique(array_filter($classes)));
    }

    private static function filterClasses(string $html, Profile $profile): string
    {
        if (!str_contains($html, 'class=')) {
            return $html;
        }
        $allowed = array_fill_keys(self::classes($profile), true);

        return (string) preg_replace_callback('/\sclass="([^"]*)"/i', static function (array $m) use ($allowed): string {
            $keep = array_filter(explode(' ', $m[1]), static fn (string $c) => isset($allowed[$c]) || isset($allowed[strtolower($c)]));

            return $keep ? ' class="' . implode(' ', $keep) . '"' : '';
        }, $html);
    }
}
