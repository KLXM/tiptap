<?php

namespace Klxm\Tiptap;

/**
 * A toolbar tool as offered by the profile builder.
 *
 * The functionality itself lives in the script (`RexTiptap.register()`); this only holds what PHP needs to know: label
 * and icon for the builder, whether it works in Markdown mode and which elements/attributes it adds to the content –
 * from this {@see Sanitizer} builds the allowlist of a profile.
 */
final readonly class Item
{
    public function __construct(
        /** Unique, for third-party tools prefixed with the addon, e.g. `myaddon:hint` */
        public string $id,
        public string $label,
        /** Icon: name from the built-in set (`bold`, `link` …), Font Awesome classes (`fa-solid fa-star`) or `<svg …>` */
        public string $icon,
        /** Group in the builder: text, format, block, align, insert, history, view or custom */
        public string $category = 'insert',
        /** Can be stored losslessly as Markdown */
        public bool $markdown = true,
        /** @var array<string, list<string>> Element => allowed attributes the tool creates, e.g. `['mark' => []]` */
        public array $elements = [],
        /** Short description in the builder */
        public string $description = '',
        /** Opens a menu instead of acting directly (only for the display in the builder) */
        public bool $menu = false,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'icon' => $this->icon,
            'category' => $this->category,
            'markdown' => $this->markdown,
            'description' => $this->description,
            'menu' => $this->menu,
        ];
    }
}
