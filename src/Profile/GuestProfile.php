<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

/** Mitgeliefert: minimal für Eingaben von Besuchern im Frontend. */
#[AsProfile('tiptap.guest', 'Gäste (Frontend)', description: 'Minimal für Eingaben von Besuchern: fett, kursiv, Listen, externe Links.', priority: -10)]
final class GuestProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['bold', 'italic'],
                ['bulletList', 'orderedList'],
                ['link'],
            ],
            'link' => [
                'internal' => false,
                'media' => false,
                'mailto' => false,
                'tel' => false,
                'targetBlank' => false,
            ],
            'minHeight' => 120,
            'maxLength' => 2000,
            'pasteText' => true,
            'stickyToolbar' => false,
        ];
    }
}
