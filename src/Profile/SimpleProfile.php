<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

/** Shipped: bold, italic, lists and links – for short texts and collections. */
#[AsProfile('tiptap.simple', 'Einfach', description: 'Fett, kursiv, Listen und Links – für kurze Texte und Collections.', priority: -30)]
final class SimpleProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['bold', 'italic'],
                ['bulletList', 'orderedList'],
                ['link', 'unlink'],
                ['undo', 'redo'],
            ],
            'minHeight' => 100,
            'counter' => false,
        ];
    }
}
