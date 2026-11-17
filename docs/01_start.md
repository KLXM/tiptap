# Einstieg

Der TipTap-Editor bringt einen modernen WYSIWYG- und Markdown-Editor nach REDAXO 6. Er basiert auf
[TipTap](https://tiptap.dev) (ProseMirror) und ist so gebaut, dass Admins ihn **ohne Code** einrichten und
Entwickler ihn **mit eigenen Werkzeugen** erweitern können.

## Was das AddOn kann

- **Profile** mit Toolbar-Builder: Werkzeuge per Klick oder Drag & Drop in Gruppen anordnen, Menüs
  (Absatzformat, Ausrichtung, Tabelle, Sonderzeichen) inklusive, Live-Vorschau.
- **Speicherformat je Profil:** HTML oder Markdown. Im Markdown-Modus bietet der Builder nur Werkzeuge an,
  die sich verlustfrei als Markdown speichern lassen.
- **REDAXO-Anbindung:** interne Links über die Linkmap (`redaxo://ID`), Dateien und Bilder aus dem Medienpool.
- **Collections und Repeater:** Der Editor ist ein Web Component (`<rex-tiptap>`). Er startet von selbst, wenn
  ein Eintrag hinzukommt, und überlebt das Verschieben.
- **Frontend:** derselbe Editor auf der Website, z. B. in fluid oder für Gäste in minimaler Form. Die Eingaben
  werden auf dem Server nach dem Profil bereinigt.
- **Import/Export** von Profilen als JSON.
- **Content-Security-Policy:** keine `style`-Attribute, keine Inline-Skripte. Ausrichtung und Formate sind Klassen.
- **Erweiterbar:** andere AddOns melden Werkzeuge, TipTap-Erweiterungen, Symbole und Texte an.

## Schnellstart

1. Unter **TipTap-Editor → Profile** gibt es vier Profile: `default`, `simple`, `markdown` und `guest`.
2. Profil öffnen, Werkzeuge zusammenstellen, speichern.
3. Im Modul das Feld verwenden:

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

Unter **Ausprobieren** lässt sich jedes Profil testen. Dort sieht man auch, was gespeichert und was ausgegeben wird.

## Bedienung im Editor

| Aktion | Tastatur |
| --- | --- |
| Fett, kursiv, unterstrichen | Strg/⌘ + B, I, U |
| Link | Werkzeug „Link“ |
| Überschrift per Markdown-Kürzel | `## ` am Zeilenanfang |
| Liste | `- ` oder `1. ` am Zeilenanfang |
| Zitat | `> ` am Zeilenanfang |
| Zeilenumbruch ohne neuen Absatz | Umschalt + Enter |
| Tabelle bearbeiten (Zeilen, Spalten, Zellen) | Rechtsklick in eine Zelle, Kontextmenü-Taste oder Umschalt + F10 |
| Menü des Browsers in Tabellen (z. B. Rechtschreibung) | Umschalt + Rechtsklick |
| In der Toolbar bewegen | ← → Pos1 Ende |
| Menü schließen, Vollbild verlassen | Esc |
