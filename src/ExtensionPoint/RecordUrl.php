<?php

namespace Klxm\Tiptap\ExtensionPoint;

use Redaxo\Core\ExtensionPoint\ExtensionPoint;

/**
 * URL of a linked YForm record (`yform://table/id`). The subject is the URL from the template under
 * TipTap-Editor → Einstellungen, or null. An addon with its own URLs for records (e.g. fluid, URL addon) returns the
 * correct one here.
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
