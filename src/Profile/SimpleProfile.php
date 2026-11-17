<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

/** Mitgeliefert: fett, kursiv, Listen und Links – für kurze Texte und Collections. */
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
