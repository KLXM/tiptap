<?php

use Klxm\Tiptap\Mode;
use Klxm\Tiptap\Profiles;
use Klxm\Tiptap\Tiptap;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Security\CsrfToken;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\View\Component\Section;
use Redaxo\Core\View\Html;
use Redaxo\Core\View\Message;

use function Redaxo\Core\View\escape;

$csrf = CsrfToken::factory('tiptap_demo');
$profile = Tiptap::profile(Request::request('profile', 'string', Profiles::DEFAULT));
$value = null;
if ('post' === Request::requestMethod()) {
    if ($csrf->isValid()) {
        $value = Request::post('content', 'string', '');
    } else {
        echo Message::error(I18n::msg('csrf_token_invalid'));
    }
}
$value ??= Mode::Markdown === $profile->mode
    ? '## ' . I18n::msg('tiptap_demo_heading') . "\n\n" . I18n::msg('tiptap_demo_text_md') . "\n\n- Linkmap: [REDAXO](https://redaxo.org)\n- **fett** und *kursiv*\n"
    : '<h2>' . I18n::msg('tiptap_demo_heading') . '</h2><p>' . I18n::rawMsg('tiptap_demo_text') . '</p><ul><li><strong>fett</strong>, <em>kursiv</em></li><li><a href="https://redaxo.org">redaxo.org</a></li></ul>';

$options = '';
foreach (Profiles::all() as $p) {
    $options .= '<option value="' . escape($p->name) . '"' . ($p->name === $profile->name ? ' selected' : '') . '>' . escape($p->label) . ' (' . $p->mode->value . ')</option>';
}

$form = '<form method="post" action="' . Url::currentBackendPage() . '">'
    . $csrf->getHiddenField()
    . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-demo-profile">' . I18n::msg('tiptap_profile') . '</label>'
    . '<select class="rex-input" id="tt-demo-profile" name="profile" data-tiptap-reload>' . $options . '</select></div>'
    . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-demo-content">' . I18n::msg('tiptap_demo_content') . '</label>'
    . Tiptap::editor('content', $value, $profile, ['id' => 'tt-demo-content'])
    . '</div>'
    . '<div class="rex-form-actions"><button class="rex-button" data-variant="primary" type="submit">' . I18n::msg('tiptap_demo_submit') . '</button></div>'
    . '</form>';

echo new Section(title: I18n::msg('tiptap_demo'), body: Html::raw('<p>' . I18n::msg('tiptap_demo_intro') . '</p>' . $form))->render();

if ('post' === Request::requestMethod() && $csrf->isValid()) {
    $stored = Tiptap::sanitize($value, $profile);
    $rendered = Tiptap::render($stored, $profile);
    echo '<div class="tt-demo-output">'
        . new Section(title: I18n::msg('tiptap_demo_stored'), body: Html::raw('<pre class="rex-code"><code>' . escape($stored) . '</code></pre>'))->render()
        . new Section(title: I18n::msg('tiptap_demo_rendered'), body: Html::raw('<div class="rex-tiptap-prose">' . $rendered . '</div><details><summary>HTML</summary><pre class="rex-code"><code>' . escape($rendered) . '</code></pre></details>'))->render()
        . '</div>';
}
