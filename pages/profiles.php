<?php

use FriendsOfRedaxo\Tiptap\Mode;
use FriendsOfRedaxo\Tiptap\Profile;
use FriendsOfRedaxo\Tiptap\Profiles;
use FriendsOfRedaxo\Tiptap\Registry;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;
use Redaxo\Core\Security\CsrfToken;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\View\Component\Section;
use Redaxo\Core\View\Html;
use Redaxo\Core\View\Message;

use function Redaxo\Core\View\escape;

$func = Request::request('func', 'string', '');
$name = Request::request('name', 'string', '');
$csrf = CsrfToken::factory('tiptap_profiles');
$message = '';

$json = static fn (mixed $value): string => json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// ---------- Export (Download) ----------
if ('export' === $func || 'export_all' === $func) {
    $profiles = 'export' === $func ? array_filter([Profiles::get($name)]) : array_values(Profiles::all());
    if ($profiles) {
        $file = 'export' === $func ? 'tiptap-profile-' . $name . '.json' : 'tiptap-profiles-' . date('Y-m-d') . '.json';
        Response::cleanOutputBuffers();
        Response::setHeader('Content-Disposition', 'attachment; filename="' . $file . '"');
        Response::sendContent(Profiles::export($profiles), 'application/json; charset=utf-8');
        exit;
    }
}

// ---------- Aktionen (POST) ----------
if ('post' === Request::requestMethod() && $func) {
    if (!$csrf->isValid()) {
        $message = Message::error(I18n::msg('csrf_token_invalid'));
        $func = 'save' === $func ? 'edit' : '';
    } else {
        try {
            switch ($func) {
                case 'save':
                    $config = json_decode(Request::post('config', 'string', '{}'), true, 64, JSON_THROW_ON_ERROR);
                    $profile = Profile::fromArray([
                        'name' => Request::post('profile_name', 'string', ''),
                        'label' => Request::post('label', 'string', ''),
                        'description' => Request::post('description', 'string', ''),
                        'mode' => Request::post('mode', 'string', 'html'),
                        'config' => is_array($config) ? $config : [],
                    ]);
                    $previous = Request::post('previous', 'string', '');
                    if ($profile->name !== $previous && Profiles::exists($profile->name)) {
                        throw new RuntimeException(I18n::msg('tiptap_profile_exists', $profile->name));
                    }
                    Profiles::save($profile, '' === $previous ? null : $previous);
                    $message = Message::success(I18n::msg('tiptap_profile_saved', $profile->label));
                    $name = $profile->name;
                    $func = Request::post('apply', 'bool', false) ? 'edit' : '';
                    break;

                case 'delete':
                    Profiles::delete($name);
                    $message = Message::success(I18n::msg('tiptap_profile_deleted', $name));
                    $func = '';
                    break;

                case 'duplicate':
                    $source = Profiles::get($name) ?? throw new RuntimeException(I18n::msg('tiptap_profile_not_found'));
                    $copy = $source->withName(Profiles::freeName($source->name . '-copy'), $source->label . ' ' . I18n::msg('tiptap_copy_suffix'));
                    Profiles::save($copy);
                    $message = Message::success(I18n::msg('tiptap_profile_duplicated', $copy->label));
                    $name = $copy->name;
                    $func = 'edit';
                    break;

                case 'import':
                    $content = Request::post('import_json', 'string', '');
                    $upload = Request::files('import_file', 'array', []);
                    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK && is_uploaded_file($upload['tmp_name'])) {
                        $content = (string) file_get_contents($upload['tmp_name']);
                    }
                    if ('' === trim($content)) {
                        throw new RuntimeException(I18n::msg('tiptap_import_empty'));
                    }
                    try {
                        $parsed = Profiles::parse($content);
                    } catch (Throwable $e) {
                        throw new RuntimeException(I18n::msg('tiptap_import_invalid', $e->getMessage()), 0, $e);
                    }
                    $names = Profiles::import($parsed, Request::post('overwrite', 'bool', false));
                    $message = Message::success(I18n::msg('tiptap_import_done', implode(', ', $names)));
                    $func = '';
                    break;

                case 'sort':
                    Profiles::sort(array_values(array_filter(explode(',', Request::post('order', 'string', '')))));
                    $func = '';
                    break;
            }
        } catch (Throwable $e) {
            $message = Message::error(escape($e->getMessage()));
            if ('save' === $func) {
                $func = 'edit';
            }
        }
    }
}

echo $message;

// ---------- Bearbeiten / Neu ----------
if ('edit' === $func || 'add' === $func) {
    $profile = 'add' === $func ? null : Profiles::get($name);
    if ('edit' === $func && null === $profile && 'post' !== Request::requestMethod()) {
        echo Message::error(I18n::msg('tiptap_profile_not_found'));
        return;
    }
    // nach einem Fehler beim Speichern die Eingaben behalten
    if ('post' === Request::requestMethod() && 'edit' === $func && Request::post('profile_name', 'string', '')) {
        $posted = json_decode(Request::post('config', 'string', '{}'), true) ?: [];
        $profile = new Profile(
            preg_match(Profile::NAME_PATTERN, Request::post('profile_name', 'string', '')) ? Request::post('profile_name', 'string', '') : 'profile',
            Request::post('label', 'string', ''),
            Mode::tryFrom(Request::post('mode', 'string', '')) ?? Mode::Html,
            Request::post('description', 'string', ''),
            Profile::normalize($posted),
        );
    }
    $profile ??= new Profile(Profiles::freeName('profile'), '', Mode::Html, '', Profile::DEFAULTS);
    $previous = 'add' === $func ? '' : (Request::post('previous', 'string', '') ?: $profile->name);

    $modes = '';
    foreach ([Mode::Html, Mode::Markdown] as $mode) {
        $modes .= '<label><input type="radio" name="mode" value="' . $mode->value . '"' . ($mode === $profile->mode ? ' checked' : '') . '>'
            . '<span><strong>' . I18n::msg('tiptap_mode_' . $mode->value) . '</strong><small>' . I18n::msg('tiptap_mode_' . $mode->value . '_desc') . '</small></span></label>';
    }

    $usage = '<pre class="rex-code"><code>'
        . escape("// Modul / Collection / Formular des Cores\n#[\\FriendsOfRedaxo\\Tiptap\\Field\\Editor('Text', profile: '" . $profile->name . "')]\npublic string \$text = '';\n\n"
            . "// Ausgabe\necho \\FriendsOfRedaxo\\Tiptap\\Tiptap::render(\$this->text, '" . $profile->name . "');\n\n"
            . "// YForm 6 / eigenes Formular: Attribut an der Textarea\ndata-tiptap=\"" . $profile->name . "\"")
        . '</code></pre>';

    $body = '<div class="tt-form-row">'
        . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-label">' . I18n::msg('tiptap_profile_label') . '</label>'
        . '<input class="rex-input" id="tt-label" name="label" required maxlength="191" value="' . escape($profile->label) . '"></div>'
        . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-name">' . I18n::msg('tiptap_profile_name') . '</label>'
        . '<input class="rex-input" id="tt-name" name="profile_name" required maxlength="64" pattern="[a-z0-9][a-z0-9_\-]*" value="' . escape($profile->name) . '" aria-describedby="tt-name-hint">'
        . '<p id="tt-name-hint" class="rex-field-note">' . I18n::msg('tiptap_profile_name_hint') . '</p></div>'
        . '</div>'
        . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-desc">' . I18n::msg('tiptap_profile_description') . '</label>'
        . '<input class="rex-input" id="tt-desc" name="description" maxlength="1000" value="' . escape($profile->description) . '"></div>'
        . '<fieldset class="rex-field" data-layout="vertical"><legend class="rex-field-label">' . I18n::msg('tiptap_mode') . '</legend><div class="tt-mode-switch">' . $modes . '</div></fieldset>';

    $builder = '<div class="tt-b" data-tiptap-builder data-output="#tt-config"'
        . ' data-catalog="' . escape($json(Registry::catalog())) . '"'
        . ' data-media-url="' . escape(Url::media()) . '"></div>'
        . '<textarea id="tt-config" name="config" hidden>' . escape($json($profile->config)) . '</textarea>';

    $buttons = '<div class="rex-form-actions">'
        . '<button class="rex-button" data-variant="primary" type="submit">' . I18n::msg('tiptap_save') . '</button> '
        . '<button class="rex-button" type="submit" name="apply" value="1">' . I18n::msg('tiptap_apply') . '</button> '
        . '<a class="rex-button" data-variant="link" href="' . Url::currentBackendPage() . '">' . I18n::msg('tiptap_cancel') . '</a>'
        . '</div>';

    echo '<form method="post" action="' . Url::currentBackendPage() . '">'
        . $csrf->getHiddenField()
        . '<input type="hidden" name="func" value="save">'
        . '<input type="hidden" name="previous" value="' . escape($previous) . '">'
        . new Section(title: 'add' === $func ? I18n::msg('tiptap_profile_add') : I18n::msg('tiptap_profile_edit', $profile->label), body: Html::raw($body))->render()
        . $builder
        . new Section(title: I18n::msg('tiptap_usage'), body: Html::raw($usage), collapsible: true, collapsed: 'add' === $func)->render()
        . $buttons
        . '</form>';

    return;
}

// ---------- Import ----------
if ('import_form' === $func) {
    $body = '<form method="post" enctype="multipart/form-data" action="' . Url::currentBackendPage() . '">'
        . $csrf->getHiddenField()
        . '<input type="hidden" name="func" value="import">'
        . '<p>' . I18n::msg('tiptap_import_intro') . '</p>'
        . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-import-file">' . I18n::msg('tiptap_import_file') . '</label>'
        . '<input class="rex-input" type="file" id="tt-import-file" name="import_file" accept=".json,application/json"></div>'
        . '<div class="rex-field" data-layout="vertical"><label class="rex-field-label" for="tt-import-json">' . I18n::msg('tiptap_import_paste') . '</label>'
        . '<textarea class="rex-input" id="tt-import-json" name="import_json" rows="8" spellcheck="false"></textarea></div>'
        . '<label class="tt-b-check"><input type="checkbox" name="overwrite" value="1"> <span>' . I18n::msg('tiptap_import_overwrite') . '</span></label>'
        . '<div class="rex-form-actions"><button class="rex-button" data-variant="primary" type="submit">' . I18n::msg('tiptap_import') . '</button> '
        . '<a class="rex-button" data-variant="link" href="' . Url::currentBackendPage() . '">' . I18n::msg('tiptap_cancel') . '</a></div>'
        . '</form>';
    echo new Section(title: I18n::msg('tiptap_import'), body: Html::raw($body))->render();

    return;
}

// ---------- Liste ----------
$rows = '';
foreach (Profiles::all() as $profile) {
    $edit = Url::currentBackendPage(['func' => 'edit', 'name' => $profile->name]);
    $post = static fn (string $action, string $label, string $icon, string $variant = '', string $confirm = '') => '<form method="post" action="' . Url::currentBackendPage() . '">'
        . $csrf->getHiddenField()
        . '<input type="hidden" name="func" value="' . $action . '"><input type="hidden" name="name" value="' . escape($profile->name) . '">'
        . '<button type="submit" class="rex-button" data-size="sm"' . ('' !== $confirm ? ' data-confirm="' . escape($confirm) . '"' : '') . ($variant ? ' data-variant="' . $variant . '"' : '') . ' title="' . escape($label) . '" aria-label="' . escape($label . ': ' . $profile->label) . '">'
        . '<i class="rex-icon fa-solid ' . $icon . '" aria-hidden="true"></i></button></form>';

    $rows .= '<tr data-name="' . escape($profile->name) . '">'
        . '<td><a href="' . $edit . '"><strong>' . escape($profile->label) . '</strong></a><br><code>' . escape($profile->name) . '</code>'
        . ('' !== $profile->description ? '<br><small class="rex-u-text-muted">' . escape($profile->description) . '</small>' : '') . '</td>'
        . '<td><span class="tt-profile-mode" data-mode="' . $profile->mode->value . '">' . ($profile->mode === Mode::Markdown ? 'Markdown' : 'HTML') . '</span></td>'
        . '<td><div class="tt-toolbar-mini" data-tiptap-mini="' . escape($json($profile->config['toolbar'])) . '"></div></td>'
        . '<td><div class="tt-actions">'
        . '<a class="rex-button" data-size="sm" href="' . $edit . '" title="' . I18n::msg('tiptap_edit') . '" aria-label="' . escape(I18n::msg('tiptap_edit') . ': ' . $profile->label) . '"><i class="rex-icon fa-solid fa-pen" aria-hidden="true"></i></a>'
        . $post('duplicate', I18n::msg('tiptap_duplicate'), 'fa-copy')
        . '<a class="rex-button" data-size="sm" href="' . Url::currentBackendPage(['func' => 'export', 'name' => $profile->name]) . '" title="' . I18n::msg('tiptap_export') . '" aria-label="' . escape(I18n::msg('tiptap_export') . ': ' . $profile->label) . '"><i class="rex-icon fa-solid fa-download" aria-hidden="true"></i></a>'
        . $post('delete', I18n::msg('tiptap_delete'), 'fa-trash', 'danger', I18n::msg('tiptap_delete_confirm', $profile->label))
        . '</div></td></tr>';
}

$table = '<table class="rex-table"><thead><tr>'
    . '<th>' . I18n::msg('tiptap_profile') . '</th><th>' . I18n::msg('tiptap_mode') . '</th><th>' . I18n::msg('tiptap_toolbar') . '</th><th>' . I18n::msg('tiptap_actions') . '</th>'
    . '</tr></thead><tbody>' . ($rows ?: '<tr><td colspan="4">' . I18n::msg('tiptap_no_profiles') . '</td></tr>') . '</tbody></table>';

$options = '<a class="rex-button" data-variant="primary" data-size="sm" href="' . Url::currentBackendPage(['func' => 'add']) . '"><i class="rex-icon fa-solid fa-plus" aria-hidden="true"></i> ' . I18n::msg('tiptap_profile_add') . '</a> '
    . '<a class="rex-button" data-size="sm" href="' . Url::currentBackendPage(['func' => 'import_form']) . '"><i class="rex-icon fa-solid fa-upload" aria-hidden="true"></i> ' . I18n::msg('tiptap_import') . '</a> '
    . '<a class="rex-button" data-size="sm" href="' . Url::currentBackendPage(['func' => 'export_all']) . '"><i class="rex-icon fa-solid fa-download" aria-hidden="true"></i> ' . I18n::msg('tiptap_export_all') . '</a>';

echo new Section(title: I18n::msg('tiptap_profiles'), content: Html::raw($table), options: Html::raw($options))->render();
