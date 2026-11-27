<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

/** Shipped: all important tools for editorial texts – also the default when no profile is given. */
#[AsProfile('tiptap.default', 'Standard', description: 'Alle wichtigen Werkzeuge für redaktionelle Texte.', priority: -40)]
final class DefaultProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['undo', 'redo'],
                ['heading', 'blockStyle'],
                ['bold', 'italic', 'underline', 'strike', 'highlight'],
                ['bulletList', 'orderedList', 'listStyle', 'blockquote'],
                ['align'],
                ['link', 'unlink', 'image', 'table', 'horizontalRule', 'specialChars'],
                ['subscript', 'superscript', 'code', 'clearFormatting'],
                ['source', 'fullscreen'],
            ],
            'blockStyles' => [
                ['label' => 'Einleitung', 'class' => 'lead', 'element' => 'p'],
                ['label' => 'Kleingedruckt', 'class' => 'small', 'element' => 'p'],
            ],
            'listStyles' => [
                ['label' => 'Gegliedert (1.1, 1.2)', 'class' => 'list-outline', 'list' => 'ol'],
                ['label' => 'Häkchen', 'class' => 'list-check', 'list' => 'ul'],
                ['label' => 'Ohne Zeichen', 'class' => 'list-plain', 'list' => 'both'],
            ],
            'linkStyles' => [
                ['label' => 'Als Button', 'class' => 'btn btn--primary'],
            ],
            'image' => [
                'styles' => [
                    ['label' => 'Links umflossen', 'class' => 'img-left'],
                    ['label' => 'Rechts umflossen', 'class' => 'img-right'],
                    ['label' => 'Zentriert', 'class' => 'img-center'],
                    ['label' => 'Volle Breite', 'class' => 'img-full'],
                ],
            ],
        ];
    }
}
