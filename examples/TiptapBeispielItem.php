<?php

namespace Project\Module;

use Klxm\Tiptap\Field\Editor;
use Redaxo\Core\Form\Field\Text;

/** Entry of the collection of {@see TiptapBeispielModule} */
final class TiptapBeispielItem
{
    #[Text('Titel')]
    public string $title = '';

    #[Editor('Text', profile: 'tiptap.simple')]
    public string $text = '';
}
