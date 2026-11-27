<?php

namespace Klxm\Tiptap;

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
 * Sanitizes HTML according to what a profile allows: only the elements of the tools in the toolbar, only the classes
 * of block/text formats and alignment, no style attributes, no scripts.
 *
 * Important for input from the frontend: the script in the browser can be bypassed, the server is authoritative.
 */
final class Sanitizer
{
    /** Elements whose text is kept if the profile does not allow them */
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
        // links whose URL was not allowed remain as text
        $html = (string) preg_replace('~<a(?:\s+(?:target|rel|title)="[^"]*")*\s*>(.*?)</a>~is', '$1', $html);

        return self::filterClasses($html, $profile);
    }

    /** Allowlist of the profile for the Symfony sanitizer */
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
        // headings only in the selected levels
        foreach ([1, 2, 3, 4, 5, 6] as $level) {
            if (!in_array($level, $profile->config['headings'], true)) {
                unset($elements['h' . $level]);
            }
        }
        // Markdown tables and code blocks know no difference – thead/tbody belong to the table
        if (isset($elements['code']) && !isset($elements['pre']) && $profile->hasItem('codeBlock')) {
            $elements['pre'] = [];
        }

        if (isset($elements['ol'])) {
            $elements['ol'] = [...$elements['ol'], 'type'];
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
        // Remove disallowed text elements but keep their content (otherwise e.g. a heading would vanish with its text)
        foreach (self::KEEP_CONTENT as $element) {
            if (!isset($elements[$element])) {
                $config = $config->blockElement($element);
            }
        }

        // Classes: allowed on all elements, filtered afterwards against the profile's list
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
        $schemes = [...$schemes, ...$link['schemes']];
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
     * Allowed classes of the profile (from block and text formats, alignment and plugins).
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
        if ($profile->hasItem('bulletList', 'orderedList')) {
            foreach ($profile->config['listStyles'] as $style) {
                $classes = array_merge($classes, explode(' ', $style['class']));
            }
        }
        if ($profile->hasItem('link')) {
            foreach ($profile->config['linkStyles'] as $style) {
                $classes = array_merge($classes, explode(' ', $style['class']));
            }
        }
        if ($profile->hasItem('image', 'video', 'oembed')) {
            foreach ($profile->config['image']['styles'] as $style) {
                $classes = array_merge($classes, explode(' ', $style['class']));
            }
        }
        if ($profile->hasItem('video', 'oembed')) {
            $classes = array_merge($classes, Profile::RATIO_CLASSES, Profile::SIZE_CLASSES);
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
