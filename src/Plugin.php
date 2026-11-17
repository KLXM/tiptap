<?php

namespace FriendsOfRedaxo\Tiptap;

/**
 * Erweiterung aus einem anderen AddOn: Skript und Stile, die mit dem Editor geladen werden, und die Werkzeuge, die
 * der Profil-Builder anbietet.
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
        /** Adresse des Skripts, das `RexTiptap.register({...})` aufruft */
        public ?string $script = null,
        /** Adresse zusätzlicher Stile (Editor und Ausgabe) */
        public ?string $style = null,
        /** @var list<Item> */
        public array $items = [],
        /** Auch im Frontend laden (Tiptap::assets()) */
        public bool $frontend = true,
        /** @var list<string> Zusätzliche Klassen, die der Sanitizer bei Profilen mit diesem Plugin erlaubt */
        public array $classes = [],
    ) {}
}
