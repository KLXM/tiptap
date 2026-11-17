<?php

namespace Klxm\Tiptap;

use Override;
use Redaxo\Core\Addon\Addon;
use Redaxo\Core\Addon\OwnedSchema;
use Redaxo\Core\Backend\MainPage;
use Redaxo\Core\Backend\Page;
use Redaxo\Core\Core;
use Redaxo\Core\Database\Column;
use Redaxo\Core\Database\Index;
use Redaxo\Core\Database\Table;
use Redaxo\Core\ExtensionPoint\Extension;
use Redaxo\Core\ExtensionPoint\ExtensionLevel;
use Redaxo\Core\ExtensionPoint\ExtensionPoint;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\View\Asset;

use function filemtime;
use function is_file;
use function str_contains;
use function str_starts_with;
use function strrpos;
use function substr_replace;

/**
 * TipTap-Editor für REDAXO 6: Profile, Feld {@see Field\Editor}, Frontend über {@see Tiptap}.
 */
final class TiptapAddon extends Addon
{
    public protected(set) array $defaultConfig = [
        // interne Links (redaxo://ID) in der Frontend-Ausgabe auflösen, auch ohne Tiptap::render()
        'resolve_links' => true,
        // Adress-Vorlagen für verlinkte YForm-Datensätze: Tabelle => z. B. redaxo://12?news_id={id}
        'record_urls' => [],
    ];

    #[Override]
    public function install(): void
    {
        Table::get(Profiles::TABLE)
            ->ensurePrimaryIdColumn()
            ->ensureColumn(new Column('name', 'varchar(64)'))
            ->ensureColumn(new Column('label', 'varchar(191)'))
            ->ensureColumn(new Column('description', 'text', true))
            ->ensureColumn(new Column('mode', 'varchar(20)', false, 'html'))
            ->ensureColumn(new Column('config', 'mediumtext'))
            ->ensureColumn(new Column('prio', 'int(10) unsigned', false, '0'))
            ->ensureColumn(new Column('createdate', 'datetime'))
            ->ensureColumn(new Column('createuser', 'varchar(255)'))
            ->ensureColumn(new Column('updatedate', 'datetime'))
            ->ensureColumn(new Column('updateuser', 'varchar(255)'))
            ->ensureIndex(new Index('name', ['name'], Index::UNIQUE))
            ->ensure();
        // die mitgelieferten Profile sind Klassen (src/Profile), nicht in der Datenbank
    }

    #[Override]
    public function getOwnedSchema(): OwnedSchema
    {
        return new OwnedSchema(tables: [Profiles::TABLE]);
    }

    #[Override]
    public function getPages(): iterable
    {
        $main = new MainPage('addons', 'tiptap', I18n::msg('tiptap_title'));
        $main->setIcon('rex-icon fa-solid fa-pen-nib');
        $main->setRequiredPermissions('admin');
        $main->addSubpage(new Page('profiles', I18n::msg('tiptap_profiles')));
        $main->addSubpage(new Page('demo', I18n::msg('tiptap_demo')));
        $main->addSubpage(new Page('settings', I18n::msg('tiptap_settings')));
        $main->addSubpage(new Page('docs', I18n::msg('tiptap_docs')));

        yield $main;
    }

    #[Override]
    public function boot(): void
    {
        if (Core::isBackend()) {
            if (null === Core::getUser()) {
                return;
            }
            Asset::addCssFile($this->assetUrl('tiptap.css'));
            Asset::addJsFile($this->assetUrl('tiptap-loader.js'), [Asset::JS_DEFERED => true]);
            foreach (Registry::plugins() as $plugin) {
                if ($plugin->style) {
                    Asset::addCssFile($plugin->style);
                }
                if ($plugin->script) {
                    Asset::addJsFile($plugin->script, [Asset::JS_DEFERED => true]);
                }
            }
            if (str_starts_with(Request::get('page', 'string'), 'tiptap/')) {
                Asset::addCssFile($this->assetUrl('builder.css'));
                Asset::addJsFile($this->assetUrl('builder.js'), [Asset::JS_DEFERED => true]);
            }
        }

        Extension::register('OUTPUT_FILTER', function (ExtensionPoint $ep): string {
            $html = (string) $ep->subject;
            $inject = '';
            // Frontend: Skripte von selbst nachladen, sobald ein Editor auf der Seite steht (YForm-Formular, Modul …)
            if (!Core::isBackend() && (str_contains($html, '<rex-tiptap') || str_contains($html, 'data-tiptap=')) && !str_contains($html, 'tiptap-loader.js')) {
                $inject .= Tiptap::assets();
            }
            // Textareas mit data-tiptap="profil" (YForm, eigene Formulare) brauchen die Profile auf der Seite
            if (str_contains($html, 'data-tiptap=') && !str_contains($html, 'id="rex-tiptap-profiles"')) {
                $inject .= Tiptap::profilesScript();
            }
            if ('' !== $inject) {
                $pos = strrpos($html, '</body>');
                $html = false === $pos ? $html . $inject : substr_replace($html, $inject, $pos, 0);
            }
            if (!Core::isBackend() && $this->getConfig('resolve_links')) {
                $html = Output::resolve($html);
            }

            return $html;
        }, ExtensionLevel::Late);
    }

    /** Adresse einer Datei aus assets/ mit Version gegen veraltete Caches */
    public function assetUrl(string $file): string
    {
        $path = $this->getPath('assets/' . $file);

        return $this->getAssetsUrl($file) . '?v=' . (is_file($path) ? filemtime($path) : '0');
    }
}
