<?php

namespace Klxm\Tiptap;

use Attribute;

/**
 * Meldet ein Editor-Profil als PHP-Klasse an – versioniert mit dem Projekt statt in der Datenbank.
 *
 *     #[AsProfile('tiptap.news', 'Meldungen', mode: Mode::Html)]
 *     final class NewsProfile extends ProfileDefinition
 *     {
 *         public function config(): array
 *         {
 *             return ['toolbar' => [['bold', 'italic'], ['link']]];
 *         }
 *     }
 *
 * Gefunden wird die Klasse von der ClassDiscovery des Cores (Projekt, AddOns). Ein Profil aus Code hat Vorrang vor
 * einem gleichnamigen Profil aus der Datenbank und ist im Backend schreibgeschützt.
 */
#[Attribute(Attribute::TARGET_CLASS)]
final readonly class AsProfile
{
    public function __construct(
        /** Name (Schlüssel) mit der Kennung `tiptap.`, wie in `#[Editor('Text', profile: 'tiptap.news')]` */
        public string $name,
        public string $label = '',
        public Mode $mode = Mode::Html,
        public string $description = '',
        /** Reihenfolge in der Profilliste (kleiner zuerst) */
        public int $priority = 0,
    ) {}
}
