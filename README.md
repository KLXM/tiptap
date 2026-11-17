# TipTap editor for REDAXO 6

An addon by [KLXM Crossmedia](https://klxm.de).

WYSIWYG and Markdown editor based on [TipTap](https://tiptap.dev) (ProseMirror) for REDAXO 6 – in the backend, in
collections and in the frontend.

- **Profiles as PHP classes** (`#[AsProfile]`): versioned with the project, no database sync between stage and live
- **Profiles without code:** toolbar builder with groups, menus and icons, live preview, JSON import/export
- **HTML or Markdown** per profile
- **REDAXO integration:** linkmap (`redaxo://ID`), media pool for links and images
- **Collections/repeaters:** web component `<rex-tiptap>`, starts on new items by itself, survives reordering
- **Frontend and guests:** standalone bundle, server-side sanitizing per profile
- **CSP-safe:** no `style` attributes, no inline scripts – alignment and styles are classes
- **Extensible:** custom tools, TipTap extensions, icons and texts from other addons

## Installation

```bash
composer require klxm/tiptap
php bin/console migrate
```

## Quick start

```php
use Klxm\Tiptap\Field\Editor;
use Klxm\Tiptap\Tiptap;

#[Editor('Text', profile: 'tiptap.default')]
public string $text = '';

public function output(): string
{
    return Tiptap::render($this->text, 'tiptap.default');
}
```

YForm 6: `yield \Klxm\Tiptap\YForm\Editor::new('text')->profile('tiptap.simple');`  
Any textarea: `<textarea data-tiptap="simple">`  
Frontend: `echo Tiptap::editor('message', $value, 'tiptap.guest');` and on submit `Tiptap::sanitize(…, 'tiptap.guest')`.

The documentation (German) is in the backend under **TipTap editor → Docs** and in [`docs/`](docs/).

## Development

```bash
npm install
npm run build
```

## License

MIT. Bundles TipTap/ProseMirror (MIT), CodeMirror/Lezer (MIT), marked (MIT), linkifyjs (MIT) and Lucide icons (ISC).
