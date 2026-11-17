# TipTap editor for REDAXO 6

WYSIWYG and Markdown editor based on [TipTap](https://tiptap.dev) (ProseMirror) for REDAXO 6 – in the backend, in
collections and in the frontend.

- **Profiles without code:** toolbar builder with groups, menus and icons, live preview, JSON import/export
- **HTML or Markdown** per profile
- **REDAXO integration:** linkmap (`redaxo://ID`), media pool for links and images
- **Collections/repeaters:** web component `<rex-tiptap>`, starts on new items by itself, survives reordering
- **Frontend and guests:** standalone bundle, server-side sanitizing per profile
- **CSP-safe:** no `style` attributes, no inline scripts – alignment and styles are classes
- **Extensible:** custom tools, TipTap extensions, icons and texts from other addons

## Installation

```bash
composer require friendsofredaxo/tiptap
php bin/console migrate
```

## Quick start

```php
use FriendsOfRedaxo\Tiptap\Field\Editor;
use FriendsOfRedaxo\Tiptap\Tiptap;

#[Editor('Text', profile: 'default')]
public string $text = '';

public function output(): string
{
    return Tiptap::render($this->text, 'default');
}
```

YForm 6: `yield \FriendsOfRedaxo\Tiptap\YForm\Editor::new('text')->profile('simple');`  
Any textarea: `<textarea data-tiptap="simple">`  
Frontend: `echo Tiptap::editor('message', $value, 'guest');` and on submit `Tiptap::sanitize(…, 'guest')`.

The documentation (German) is in the backend under **TipTap editor → Docs** and in [`docs/`](docs/).

## Development

```bash
npm install
npm run build
```

## License

MIT. Bundles TipTap/ProseMirror (MIT), marked (MIT), linkifyjs (MIT) and Lucide icons (ISC).
