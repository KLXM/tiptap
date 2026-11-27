<?php

namespace Klxm\Tiptap;

use Attribute;
use Redaxo\Core\Translation\Translatable;

/**
 * Registers text formats of an addon or the project for existing profiles – e.g. a link format of a consent addon or
 * the text colors of a theme.
 *
 *     #[AsStyles('consent_kit.links', 'Consent Kit', profiles: ['tiptap.default', 'tiptap.simple'])]
 *     final class ConsentStyles extends StyleDefinition
 *     {
 *         public function styles(): array
 *         {
 *             return ['linkStyles' => [['label' => 'Cookie-Einstellungen', 'class' => 'consent-settings']]];
 *         }
 *     }
 *
 * Analogous to `#[AsModule]` of the core. The class is found by the core's ClassDiscovery (project, addons). The formats are added to the profile at runtime
 * (editor, sanitizer, output) and are never stored with it; the profile's own formats come first. A class in the
 * project replaces one of an addon with the same key.
 */
#[Attribute(Attribute::TARGET_CLASS)]
final readonly class AsStyles
{
    public function __construct(
        /** Key with the addon's prefix like fluid elements (`fluid.hinweis`): `consent_kit.links`; one class per key */
        public string $key,
        /** Name shown in the backend (profile overview) */
        public string|Translatable $name,
        /** @var list<string> Profile names, `prefix.*` for all with a prefix; empty for all HTML profiles */
        public array $profiles = [],
        /** Order among several style classes (lower first) */
        public int $priority = 0,
    ) {}
}
