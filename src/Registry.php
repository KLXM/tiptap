<?php

namespace Klxm\Tiptap;

use Redaxo\Core\Translation\I18n;

use function array_key_exists;
use function array_values;

/**
 * Alle Werkzeuge: die eingebauten und die der registrierten {@see Plugin}s.
 *
 * @internal
 */
final class Registry
{
    /** @var array<string, Plugin> */
    private static array $plugins = [];

    /** @var array<string, Item>|null */
    private static ?array $items = null;

    public static function addPlugin(Plugin $plugin): void
    {
        self::$plugins[$plugin->id] = $plugin;
        self::$items = null;
    }

    /** @return array<string, Plugin> */
    public static function plugins(): array
    {
        return self::$plugins;
    }

    /** @return array<string, Item> */
    public static function items(): array
    {
        if (null !== self::$items) {
            return self::$items;
        }
        $items = [];
        foreach (self::builtin() as $item) {
            $items[$item->id] = $item;
        }
        foreach (self::$plugins as $plugin) {
            foreach ($plugin->items as $item) {
                $items[$item->id] = $item;
            }
        }

        return self::$items = $items;
    }

    public static function item(string $id): ?Item
    {
        return self::items()[$id] ?? null;
    }

    public static function has(string $id): bool
    {
        return array_key_exists($id, self::items());
    }

    /**
     * Builder-Katalog: Kategorien mit ihren Werkzeugen.
     *
     * @return list<array{id: string, label: string, items: list<array<string, mixed>>}>
     */
    public static function catalog(): array
    {
        $categories = [];
        foreach (self::items() as $item) {
            $categories[$item->category] ??= [
                'id' => $item->category,
                'label' => self::categoryLabel($item->category),
                'items' => [],
            ];
            $categories[$item->category]['items'][] = $item->toArray();
        }

        return array_values($categories);
    }

    private static function categoryLabel(string $category): string
    {
        $key = 'tiptap_category_' . $category;

        return I18n::hasMsg($key) ? I18n::rawMsg($key) : $category;
    }

    /** @return list<Item> */
    private static function builtin(): array
    {
        $m = static fn (string $key): string => I18n::rawMsg('tiptap_item_' . $key);
        $d = static fn (string $key): string => I18n::rawMsg('tiptap_item_' . $key . '_desc');

        return [
            new Item('undo', $m('undo'), 'undo', 'history'),
            new Item('redo', $m('redo'), 'redo', 'history'),

            new Item('heading', $m('heading'), 'heading', 'text', elements: ['h1' => [], 'h2' => [], 'h3' => [], 'h4' => [], 'h5' => [], 'h6' => []], description: $d('heading'), menu: true),
            new Item('blockStyle', $m('blockStyle'), 'blockStyle', 'text', markdown: false, description: $d('blockStyle'), menu: true),
            new Item('inlineStyle', $m('inlineStyle'), 'inlineStyle', 'text', markdown: false, elements: ['span' => []], description: $d('inlineStyle'), menu: true),

            new Item('bold', $m('bold'), 'bold', 'format', elements: ['strong' => []]),
            new Item('italic', $m('italic'), 'italic', 'format', elements: ['em' => []]),
            new Item('underline', $m('underline'), 'underline', 'format', markdown: false, elements: ['u' => []]),
            new Item('strike', $m('strike'), 'strike', 'format', elements: ['s' => []]),
            new Item('code', $m('code'), 'code', 'format', elements: ['code' => []]),
            new Item('highlight', $m('highlight'), 'highlight', 'format', markdown: false, elements: ['mark' => []]),
            new Item('subscript', $m('subscript'), 'subscript', 'format', markdown: false, elements: ['sub' => []]),
            new Item('superscript', $m('superscript'), 'superscript', 'format', markdown: false, elements: ['sup' => []]),
            new Item('clearFormatting', $m('clearFormatting'), 'clearFormatting', 'format'),

            new Item('bulletList', $m('bulletList'), 'bulletList', 'block', elements: ['ul' => [], 'li' => []]),
            new Item('orderedList', $m('orderedList'), 'orderedList', 'block', elements: ['ol' => ['start'], 'li' => []]),
            new Item('listStyle', $m('listStyle'), 'listStyle', 'block', markdown: false, description: $d('listStyle'), menu: true),
            new Item('blockquote', $m('blockquote'), 'blockquote', 'block', elements: ['blockquote' => []]),
            new Item('codeBlock', $m('codeBlock'), 'codeBlock', 'block', elements: ['pre' => [], 'code' => []]),
            new Item('horizontalRule', $m('horizontalRule'), 'horizontalRule', 'block', elements: ['hr' => []]),

            new Item('align', $m('align'), 'align', 'align', markdown: false, description: $d('align'), menu: true),
            new Item('alignLeft', $m('alignLeft'), 'alignLeft', 'align', markdown: false),
            new Item('alignCenter', $m('alignCenter'), 'alignCenter', 'align', markdown: false),
            new Item('alignRight', $m('alignRight'), 'alignRight', 'align', markdown: false),
            new Item('alignJustify', $m('alignJustify'), 'alignJustify', 'align', markdown: false),

            new Item('link', $m('link'), 'link', 'insert', elements: ['a' => ['href', 'target', 'rel', 'title']], description: $d('link')),
            new Item('unlink', $m('unlink'), 'unlink', 'insert'),
            new Item('image', $m('image'), 'image', 'insert', elements: ['img' => ['src', 'alt', 'title', 'width', 'height']], description: $d('image')),
            new Item('video', $m('video'), 'video', 'insert', markdown: false, elements: [
                'video' => ['src', 'data-rex-media', 'poster', 'data-rex-poster', 'title', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload'],
            ], description: $d('video')),
            new Item('oembed', $m('oembed'), 'oembed', 'insert', markdown: false, elements: ['figure' => ['data-rex-oembed', 'data-rex-title']], description: $d('oembed')),
            new Item('htmlEmbed', $m('htmlEmbed'), 'htmlEmbed', 'insert', markdown: false, elements: ['div' => ['data-rex-embed', 'data-rex-sig', 'data-rex-label', 'data-consent-service']], description: $d('htmlEmbed')),
            new Item('table', $m('table'), 'table', 'insert', elements: [
                'table' => [], 'thead' => [], 'tbody' => [], 'tr' => [], 'th' => ['colspan', 'rowspan'], 'td' => ['colspan', 'rowspan'], 'colgroup' => [], 'col' => [],
            ], description: $d('table'), menu: true),
            new Item('specialChars', $m('specialChars'), 'specialChars', 'insert', description: $d('specialChars'), menu: true),

            new Item('source', $m('source'), 'source', 'view', description: $d('source')),
            new Item('fullscreen', $m('fullscreen'), 'fullscreen', 'view'),
        ];
    }
}
