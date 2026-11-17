<?php

namespace Project\Module;

use Klxm\Tiptap\Field\Editor;
use Redaxo\Core\Form\Field\Text;

/** Eintrag der Collection von {@see TiptapBeispielModule} */
final class TiptapBeispielItem
{
    #[Text('Titel')]
    public string $title = '';

    #[Editor('Text', profile: 'tiptap.simple')]
    public string $text = '';
}
