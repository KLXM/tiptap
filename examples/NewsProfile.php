<?php

namespace Project\Tiptap;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

/**
 * Beispiel: Editor-Profil als PHP-Klasse – versioniert mit dem Projekt, kein Abgleich der Datenbank zwischen Stage
 * und Live. In src/Tiptap des Projekts legen; Verwendung: #[Editor('Text', profile: 'tiptap.news')].
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
