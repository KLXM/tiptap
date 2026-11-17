# Changelog

## 1.0.0-dev

Erste Fassung für REDAXO 6.

- Profile mit Toolbar-Builder (Gruppen, Drag & Drop, Tastatur), Einstellungen ohne Code, Live-Vorschau
- Speicherformat HTML oder Markdown je Profil
- Import/Export von Profilen als JSON
- Feld `Field\Editor` für Module, Collections und Formulare des Cores; Feld `YForm\Editor` für YForm 6;
  `textarea[data-tiptap]` für alles andere
- Linkmap und Medienpool im Link- und Bild-Dialog, Tabellen, Sonderzeichen, Block- und Textformate,
  Ausrichtung als Klassen, Quelltext, Vollbild, Zeichenzähler und -limit
- Frontend: eigenes Bundle, lädt sich bei Bedarf selbst; Profil `guest` für Besucher
- Serverseitige Bereinigung je Profil (`Tiptap::sanitize()`, `Tiptap::render()`), interne Links per OUTPUT_FILTER
- Kontextmenü (Rechtsklick, Kontextmenü-Taste, Umschalt + F10) – für Tabellen eingebaut, für eigene Werkzeuge über `context()`
- Quelltext-Ansicht mit Auszeichnung (CodeMirror 6, nachgeladen): Markdown formatiert, HTML hervorgehoben
- Bilder: Mediamanager-Typ und Bildformat (Klasse) je Profil, Kontextmenü am Bild, Adresse bei der Ausgabe
  aus `data-rex-media` (korrekt im Frontend)
- Links auf YForm-Datensätze (`yform://tabelle/id`), Adresse über Extension Point `RecordUrl` oder Vorlage
  (Einstellungen)
- Schreibbereich weiß, Vollbild als Blatt, Sonderzeichen im festen Raster, Tabellen ohne style-Attribute
- Erweiterungs-API für andere AddOns (`Tiptap::register()`, `RexTiptap.register()`), Ereignisse
