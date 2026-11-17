<?php

namespace FriendsOfRedaxo\Tiptap;

/**
 * Ein Werkzeug der Toolbar, wie es der Profil-Builder anbietet.
 *
 * Die Funktion selbst steckt im Skript (`RexTiptap.register()`), hier steht nur, was PHP wissen muss: Beschriftung und
 * Symbol für den Builder, ob es im Markdown-Modus taugt und welche Elemente/Attribute es in den Inhalt bringt –
 * daraus baut {@see Sanitizer} die Allowlist eines Profils.
 */
final readonly class Item
{
    public function __construct(
        /** Eindeutig, bei fremden Werkzeugen mit Präfix des AddOns, z. B. `myaddon:hint` */
        public string $id,
        public string $label,
        /** Symbol: Name aus dem eingebauten Satz (`bold`, `link` …), Font-Awesome-Klassen (`fa-solid fa-star`) oder `<svg …>` */
        public string $icon,
        /** Gruppe im Builder: text, format, block, align, insert, history, view oder eigene */
        public string $category = 'insert',
        /** Lässt sich verlustfrei als Markdown speichern */
        public bool $markdown = true,
        /** @var array<string, list<string>> Element => erlaubte Attribute, die das Werkzeug erzeugt, z. B. `['mark' => []]` */
        public array $elements = [],
        /** Kurzbeschreibung im Builder */
        public string $description = '',
        /** Öffnet ein Menü statt direkt zu wirken (nur für die Darstellung im Builder) */
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
