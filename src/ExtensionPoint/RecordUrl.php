<?php

namespace FriendsOfRedaxo\Tiptap\ExtensionPoint;

use Redaxo\Core\ExtensionPoint\ExtensionPoint;

/**
 * Adresse eines verlinkten YForm-Datensatzes (`yform://tabelle/id`). Subject ist die Adresse aus der Vorlage unter
 * TipTap-Editor → Einstellungen oder null. Ein AddOn mit eigenen Adressen für Datensätze (z. B. fluid, URL-AddOn)
 * liefert hier die richtige.
 *
 *     Extension::register(RecordUrl::class, static fn (RecordUrl $ep): ?string => MyRouter::url($ep->table, $ep->id) ?? $ep->subject);
 *
 * @extends ExtensionPoint<string|null>
 */
final class RecordUrl extends ExtensionPoint
{
    public function __construct(
        public readonly string $table,
        public readonly int $id,
        ?string $url,
    ) {
        parent::__construct(self::class, $url);
    }
}
