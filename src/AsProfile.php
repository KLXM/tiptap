<?php

namespace Klxm\Tiptap;

use Attribute;
use Redaxo\Core\Translation\Translatable;

/**
 * Registers an editor profile as a PHP class – versioned with the project instead of in the database.
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
 * The class is found by the core's ClassDiscovery (project, addons). A profile from code takes precedence over a
 * database profile with the same name and is read-only in the backend.
 */
#[Attribute(Attribute::TARGET_CLASS)]
final readonly class AsProfile
{
    public function __construct(
        /** Name (key) with the prefix `tiptap.`, as in `#[Editor('Text', profile: 'tiptap.news')]` */
        public string $name,
        public string|Translatable $label = '',
        public Mode $mode = Mode::Html,
        public string|Translatable $description = '',
        /** Position in the profile list (lower first) */
        public int $priority = 0,
    ) {}
}
