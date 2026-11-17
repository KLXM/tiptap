<?php

use FriendsOfRedaxo\Tiptap\TiptapAddon;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\Util\Markdown\Markdown;
use Redaxo\Core\View\Component\Section;
use Redaxo\Core\View\Html;

use function Redaxo\Core\View\escape;

$addon = TiptapAddon::instance();
$files = glob($addon->getPath('docs/*.md')) ?: [];
sort($files);
$docs = [];
foreach ($files as $file) {
    $key = basename($file, '.md');
    $first = strtok((string) file_get_contents($file), "\n");
    $docs[$key] = ['file' => $file, 'title' => trim(ltrim((string) $first, '# '))];
}
$current = Request::get('doc', 'string', array_key_first($docs) ?? '');
if (!isset($docs[$current])) {
    $current = array_key_first($docs);
}

$nav = '<nav class="tt-docs-nav" aria-label="' . escape(I18n::msg('tiptap_docs')) . '">';
foreach ($docs as $key => $doc) {
    $nav .= '<a class="rex-button" data-size="sm"' . ($key === $current ? ' data-variant="primary" aria-current="page"' : '')
        . ' href="' . Url::currentBackendPage(['doc' => $key]) . '">' . escape($doc['title']) . '</a>';
}
$nav .= '</nav>';

$content = '';
if (null !== $current) {
    [$toc, $content] = Markdown::factory()->parseWithToc((string) file_get_contents($docs[$current]['file']), 2, 3, false);
    $content = '<div class="rex-docs-content tt-docs">' . str_replace('<table>', '<table class="rex-table">', $content) . '</div>';
}

echo new Section(title: I18n::msg('tiptap_docs'), body: Html::raw($nav . $content))->render();
