# TipTap-Editor für REDAXO 6

WYSIWYG- und Markdown-Editor auf Basis von [TipTap](https://tiptap.dev) (ProseMirror) für REDAXO 6 – im Backend,
in Collections und im Frontend.

- **Profile ohne Code:** Toolbar-Builder mit Gruppen, Menüs und Symbolen, Live-Vorschau, Import/Export als JSON
- **HTML oder Markdown** je Profil
- **REDAXO-Anbindung:** Linkmap (`redaxo://ID`), Medienpool für Links und Bilder
- **Collections/Repeater:** Web Component `<rex-tiptap>`, startet bei neuen Einträgen von selbst, übersteht Sortieren
- **Frontend und Gäste:** eigenes Bundle ohne Backend-Abhängigkeit, serverseitige Bereinigung je Profil
- **CSP-fest:** keine `style`-Attribute, keine Inline-Skripte – Ausrichtung und Formate als Klassen
- **Erweiterbar:** eigene Werkzeuge, TipTap-Erweiterungen, Symbole und Texte aus anderen AddOns
- **Barrierearm:** Toolbar mit Pfeiltasten (roving tabindex), Menüs mit ARIA-Rollen, Dialoge als `<dialog>`

## Installation

```bash
composer require friendsofredaxo/tiptap
php bin/console migrate
```

`migrate` legt die Tabelle `rex_tiptap_profile` und die Profile `default`, `simple`, `markdown` und `guest` an.

## Kurz

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
Beliebige Textarea: `<textarea data-tiptap="simple">`  
Frontend: `echo Tiptap::editor('nachricht', $value, 'guest');` und beim Absenden `Tiptap::sanitize(…, 'guest')`.

## Doku

Im Backend unter **TipTap-Editor → Doku** oder in [`docs/`](docs/):
[Einstieg](docs/01_start.md) · [Verwendung](docs/02_usage.md) · [Profile](docs/03_profiles.md) ·
[Für Entwickler](docs/04_developer.md) · [Sicherheit](docs/05_security.md)

## Entwicklung

```bash
npm install
npm run build   # oder: npm run watch
```

Quellen in `resources/js/`, das Ergebnis in `assets/` wird eingecheckt (Composer-Nutzer brauchen kein npm).

## Lizenz

MIT. Enthält TipTap/ProseMirror (MIT), marked (MIT), linkifyjs (MIT) und Lucide-Symbole (ISC).
