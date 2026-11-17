<?php

namespace Project\Module;

use Klxm\Tiptap\Field\Editor;
use Klxm\Tiptap\Tiptap;
use Redaxo\Core\Content\AsModule;
use Redaxo\Core\Content\Module;
use Redaxo\Core\Form\Field\Collection;
use Redaxo\Core\Form\Field\Text;

use function Redaxo\Core\View\escape;

/**
 * Beispiel: Fließtext mit dem Profil „default“ und eine Collection, deren Einträge den Editor mit dem Profil „simple“
 * haben. In src/Module des Projekts kopieren.
 */
#[AsModule('tiptap_beispiel', 'Text mit Editor (Beispiel)')]
final class TiptapBeispielModule extends Module
{
    #[Text('Überschrift', maxLength: 120)]
    public string $headline = '';

    #[Editor('Text', profile: 'tiptap.default')]
    public string $text = '';

    /** @var list<TiptapBeispielItem> */
    #[Collection('Abschnitte', item: TiptapBeispielItem::class)]
    public array $items = [];

    public function output(): string
    {
        $html = '' !== $this->headline ? '<h2>' . escape($this->headline) . '</h2>' : '';
        $html .= Tiptap::render($this->text, 'tiptap.default');
        foreach ($this->items as $item) {
            $html .= '<section><h3>' . escape($item->title) . '</h3>' . Tiptap::render($item->text, 'tiptap.simple') . '</section>';
        }

        return '<div class="wrap">' . $html . '</div>';
    }
}
