<?php

namespace Project\Tiptap;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

/**
 * Example: editor profile as a PHP class – versioned with the project, no syncing of the database between stage
 * and live. Put it into src/Tiptap of the project; usage: #[Editor('Text', profile: 'tiptap.news')].
 */
#[AsProfile('tiptap.news', 'Meldungen', description: 'Kurztexte für Meldungen – fett, kursiv, Listen, Links auf Seiten und Datensätze.')]
final class NewsProfile extends ProfileDefinition
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
            'link' => ['records' => ['rex_yf_news']],
            'linkStyles' => [
                ['label' => 'Als Button', 'class' => 'btn btn--primary'],
            ],
            'minHeight' => 120,
            'maxLength' => 1500,
        ];
    }
}
