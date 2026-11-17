<?php

use Klxm\Tiptap\RecordLinks;
use Klxm\Tiptap\TiptapAddon;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Security\CsrfToken;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\View\Component\Section;
use Redaxo\Core\View\Html;
use Redaxo\Core\View\Message;

use function Redaxo\Core\View\escape;

$addon = TiptapAddon::instance();
$csrf = CsrfToken::factory('tiptap_settings');
$tables = RecordLinks::tables();

if ('post' === Request::requestMethod()) {
    if (!$csrf->isValid()) {
        echo Message::error(I18n::msg('csrf_token_invalid'));
    } else {
        $urls = [];
        foreach (Request::post('record_urls', 'array', []) as $table => $url) {
            if (isset($tables[$table]) && is_string($url) && '' !== trim($url)) {
                $urls[$table] = mb_substr(trim($url), 0, 500);
            }
        }
        $addon->setConfig('record_urls', $urls);
        $addon->setConfig('resolve_links', Request::post('resolve_links', 'bool', false));
        echo Message::success(I18n::msg('tiptap_settings_saved'));
    }
}

$urls = (array) $addon->getConfig('record_urls', []);

$body = '<label class="tt-b-check"><input type="checkbox" name="resolve_links" value="1"' . ($addon->getConfig('resolve_links') ? ' checked' : '') . '> <span>'
    . I18n::msg('tiptap_settings_resolve') . '</span></label>'
    . '<p class="rex-field-note">' . I18n::msg('tiptap_settings_resolve_note') . '</p>';

$records = '<p>' . I18n::rawMsg('tiptap_settings_records_intro') . '</p>';
if (!$tables) {
    $records .= '<p class="rex-u-text-muted">' . I18n::msg('tiptap_settings_no_yform') . '</p>';
} else {
    $records .= '<table class="rex-table"><thead><tr><th>' . I18n::msg('tiptap_settings_table') . '</th><th>' . I18n::msg('tiptap_settings_url') . '</th></tr></thead><tbody>';
    foreach ($tables as $name => $label) {
        $id = 'tt-url-' . preg_replace('/[^a-z0-9_-]/i', '', $name);
        $records .= '<tr><td><label for="' . $id . '"><strong>' . escape($label) . '</strong><br><code>' . escape($name) . '</code></label></td>'
            . '<td><input class="rex-input" id="' . $id . '" name="record_urls[' . escape($name) . ']" value="' . escape((string) ($urls[$name] ?? '')) . '" placeholder="redaxo://12?id={id}" spellcheck="false"></td></tr>';
    }
    $records .= '</tbody></table>';
}

echo '<form method="post" action="' . Url::currentBackendPage() . '">'
    . $csrf->getHiddenField()
    . new Section(title: I18n::msg('tiptap_settings_output'), body: Html::raw($body))->render()
    . new Section(title: I18n::msg('tiptap_settings_records'), body: Html::raw($records))->render()
    . '<div class="rex-form-actions"><button class="rex-button" data-variant="primary" type="submit">' . I18n::msg('tiptap_save') . '</button></div>'
    . '</form>';
