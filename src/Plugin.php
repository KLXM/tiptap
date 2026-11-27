<?php

namespace Klxm\Tiptap;

/**
 * Extension from another addon: script and styles loaded with the editor, and the tools offered by the profile
 * builder.
 *
 *     Tiptap::register(new Plugin(
 *         id: 'myaddon',
 *         label: 'Mein AddOn',
 *         script: $this->getAssetsUrl('tiptap-hint.js'),
 *         items: [new Item('myaddon:hint', 'Hinweisbox', 'fa-solid fa-circle-info', elements: ['div' => ['class']])],
 *     ));
 */
final readonly class Plugin
{
    public function __construct(
        public string $id,
        public string $label,
        /** URL of the script that calls `RexTiptap.register({...})` */
        public ?string $script = null,
        /** URL of additional styles (editor and output) */
        public ?string $style = null,
        /** @var list<Item> */
        public array $items = [],
        /** Also load in the frontend (Tiptap::assets()) */
        public bool $frontend = true,
        /** @var list<string> Additional classes the sanitizer allows for profiles with this plugin */
        public array $classes = [],
    ) {}
}
