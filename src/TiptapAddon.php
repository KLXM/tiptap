<?php

namespace Klxm\Tiptap;

use Klxm\Tiptap\Media\HtmlEmbed;
use Klxm\Tiptap\Media\Oembed;
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
use Redaxo\Core\Http\Response;
use Redaxo\Core\Security\ContentSecurityPolicy;
use Redaxo\Core\Security\Permission;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\View\Asset;

use function filemtime;
use function htmlspecialchars;
use function is_file;
use function str_contains;
use function str_starts_with;
use function stripos;
use function strrpos;
use function substr_replace;

use const ENT_QUOTES;

/**
 * TipTap editor for REDAXO 6: profiles, field {@see Field\Editor}, frontend via {@see Tiptap}.
 */
final class TiptapAddon extends Addon
{
    public protected(set) array $defaultConfig = [
        // resolve internal links (redaxo://ID) in the frontend output, even without Tiptap::render()
        'resolve_links' => true,
        // URL templates for linked YForm records: table => e.g. redaxo://12?news_id={id}
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
        // the shipped profiles are classes (src/Profile), not in the database
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
        Permission::register(HtmlEmbed::PERMISSION, I18n::msg('tiptap_perm_html_embed'), Permission::OPTIONS);

        if (Core::isBackend()) {
            if (null === Core::getUser()) {
                return;
            }
            // preview of YouTube/Vimeo in the editor (only on click)
            ContentSecurityPolicy::backend()->add('frame-src', ...Oembed::frameHosts());
            Asset::addCssFile($this->assetUrl('tiptap.css'));
            Asset::addJsFile($this->assetUrl('tiptap-loader.js'), [Asset::JS_DEFERED => true]);
            // plugins of addons that boot after this one (they require klxm/tiptap) – collected once all addons booted
            Extension::register('PACKAGES_INCLUDED', static function (): void {
                foreach (Registry::plugins() as $plugin) {
                    if ($plugin->style) {
                        Asset::addCssFile($plugin->style);
                    }
                    if ($plugin->script) {
                        Asset::addJsFile($plugin->script, [Asset::JS_DEFERED => true]);
                    }
                }
            });
            if (str_starts_with(Request::get('page', 'string'), 'tiptap/')) {
                Asset::addCssFile($this->assetUrl('builder.css'));
                Asset::addJsFile($this->assetUrl('builder.js'), [Asset::JS_DEFERED => true]);
            }
        }

        Extension::register('OUTPUT_FILTER', function (ExtensionPoint $ep): string {
            $html = (string) $ep->subject;
            $inject = '';
            // Frontend: load the scripts automatically as soon as an editor is on the page (YForm form, module …)
            if (!Core::isBackend() && (str_contains($html, '<rex-tiptap') || str_contains($html, 'data-tiptap=')) && !str_contains($html, 'tiptap-loader.js')) {
                $inject .= Tiptap::assets();
            }
            // textareas with data-tiptap="profile" (YForm, custom forms) need the profiles on the page
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
            // videos, YouTube/Vimeo placeholders, HTML embeds with consent: their styles and script
            if (!Core::isBackend() && !str_contains($html, 'tiptap-media.js')
                && (str_contains($html, 'rex-oembed') || str_contains($html, 'rex-embed-consent') || str_contains($html, 'rex-ratio-') || str_contains($html, 'rex-video'))) {
                $html = $this->injectMediaAssets($html);
            }

            return $html;
        }, ExtensionLevel::Late);
    }

    /** Styles into the head, script at the end of the body (with the nonce of the response) */
    private function injectMediaAssets(string $html): string
    {
        $css = '<link rel="stylesheet" href="' . htmlspecialchars($this->assetUrl('tiptap-media.css'), ENT_QUOTES) . '">';
        $js = '<script defer nonce="' . htmlspecialchars(Response::getNonce(), ENT_QUOTES) . '" src="' . htmlspecialchars($this->assetUrl('tiptap-media.js'), ENT_QUOTES) . '"></script>';
        $head = stripos($html, '</head>');
        $html = false === $head ? $css . $html : substr_replace($html, $css, $head, 0);
        $body = strrpos($html, '</body>');

        return false === $body ? $html . $js : substr_replace($html, $js, $body, 0);
    }

    /** URL of a file from assets/ with version against stale caches */
    public function assetUrl(string $file): string
    {
        $path = $this->getPath('assets/' . $file);

        return $this->getAssetsUrl($file) . '?v=' . (is_file($path) ? filemtime($path) : '0');
    }
}
