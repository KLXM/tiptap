<?php

namespace Project\Module;

use Klxm\Tiptap\Tiptap;
use Redaxo\Core\Content\AsModule;
use Redaxo\Core\Content\Module;
use Redaxo\Core\Form\Field\Text;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Security\CsrfToken;

use function Redaxo\Core\View\escape;

/**
 * Example: editor in the frontend for visitors (profile "guest"). The input is sanitized on the server with
 * Tiptap::sanitize() – the script in the browser alone does not protect.
 * Nothing is saved here, only displayed. Copy to src/Module of the project.
 */
#[AsModule('tiptap_gast', 'Gäste-Editor (Beispiel)')]
final class TiptapGastModule extends Module
{
    #[Text('Überschrift')]
    public string $headline = 'Ihre Nachricht';

    public function output(): string
    {
        $csrf = CsrfToken::factory('tiptap_gast');
        $result = '';
        $value = '';
        if ('post' === Request::requestMethod() && null !== Request::post('tiptap_gast', 'string', null)) {
            $value = Tiptap::sanitize(Request::post('tiptap_gast', 'string', ''), 'tiptap.guest');
            $result = $csrf->isValid()
                ? '<div class="tiptap-gast-result"><h3>Bereinigt gespeichert würde:</h3>' . Tiptap::render($value, 'tiptap.guest') . '<pre>' . escape($value) . '</pre></div>'
                : '<p>Das Formular ist abgelaufen, bitte erneut senden.</p>';
        }

        return '<div class="wrap">'
            . Tiptap::assets()
            . '<h2>' . escape($this->headline) . '</h2>'
            . '<form method="post">'
            . $csrf->getHiddenField()
            . '<label for="tiptap-gast">Nachricht</label>'
            . Tiptap::editor('tiptap_gast', $value, 'tiptap.guest', ['id' => 'tiptap-gast'])
            . '<p><button type="submit" class="btn btn--primary">Absenden</button></p>'
            . '</form>'
            . $result
            . '</div>';
    }
}
