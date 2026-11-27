# Changelog

## Unveröffentlicht

- **Inline-Modus** `RexTiptap.inline(element, profil, {value, label, layer})`: Editor direkt auf einem Element der Seite
  (Bearbeiten im Kontext, z. B. fluid), schwebende Werkzeugleiste und Link-Leiste; Änderungen als `rex-tiptap:change`
  am Element, `destroy()` zeigt den Wert wieder im Element. Klasse `RexTiptap.Inline` zum Erweitern.
- Profil-Option `link.schemes`: weitere Link-Schemata (z. B. `media://`), die das Projekt oder ein AddOn selbst
  auflöst – im Editor und im Sanitizer erlaubt.
- Fix: Skripte und Stile von Plugins anderer AddOns fehlten im Backend, wenn das AddOn nach TipTap startet (es setzt
  TipTap voraus) – gesammelt wird jetzt bei `PACKAGES_INCLUDED`.
- Seiten- und Medienauswahl auch auf der Website: `RexTiptap.pick` (z. B. fluid), sonst wie bisher `rex.pick()` im Backend.
- Editoren funktionieren im Shadow DOM (Fokus über `getRootNode()`, Klicks über `composedPath()`).
- `RexTiptapEditor`: Aufbau in `buildToolbar()`, `layout()`, `listen()` und `placeBubble()` geteilt – überschreibbar.

## 1.0.0-beta.1 – 2026-11-18

Erste Fassung für REDAXO 6.

- Videos aus dem Medienpool, YouTube/Vimeo per Adresse (oEmbed, 2-Klick-Platzhalter, Vorschau im Editor) und
  HTML-Embeds (geschützter Block, signiert, Nonce, optional mit Einwilligung); Medienformate für Bilder und Videos,
  Seitenverhältnisse
- Mit video_editor: Poster automatisch (ohne Speichern), Standbild im Video-Dialog aufnehmen, Web-Fassungen als
  `<source>`, Untertitel als `<track>`, Hintergrundvideos in kleiner Fassung
- Alternativtext von Bildern aus dem Medienpool (klxm_meta, je Sprache, dekorativ = alt=""); im Bild-Dialog
  überschreibbar oder als dekorativ markierbar
- Einfügen von außen (Website, Word, Mail) wird bereinigt: keine Klassen, Stile, IDs, data-/on-Attribute, keine
  Bilder, Videos, iframes, Skripte, Formular- und Bedienelemente, keine leeren Listen/Absätze; Links nur http(s),
  mailto, tel, relativ. Kopieren innerhalb von tiptap bleibt unverändert
- Dateien per Ziehen/Einfügen (auch Screenshots) landen im Medienpool und als Bild/Video im Text: Platzhalter mit
  Fortschritt, Prüfung von Recht, Kategorie und Dateityp auf dem Server, Hinweis bei fehlendem Alternativtext;
  Profil-Einstellungen „Hochladen“ und „Medienkategorie für Uploads“. Ohne Upload-Recht wird die Datei nur abgefangen
- Toolbar-Builder sieht aus wie die echte Toolbar; Entfernen und Verschieben erscheinen beim Überfahren

- Profile mit Toolbar-Builder (Gruppen, Drag & Drop, Tastatur), Einstellungen ohne Code, Live-Vorschau
- Speicherformat HTML oder Markdown je Profil
- Import/Export von Profilen als JSON
- Feld `Field\Editor` für Module, Collections und Formulare des Cores; Feld `YForm\Editor` für YForm 6;
  `textarea[data-tiptap]` für alles andere
- Linkmap und Medienpool im Link- und Bild-Dialog, Tabellen, Sonderzeichen, Block- und Textformate,
  Ausrichtung als Klassen, Quelltext, Vollbild, Zeichenzähler und -limit
- Frontend: eigenes Bundle, lädt sich bei Bedarf selbst; Profil `tiptap.guest` für Besucher
- Serverseitige Bereinigung je Profil (`Tiptap::sanitize()`, `Tiptap::render()`), interne Links per OUTPUT_FILTER
- Kontextmenü (Rechtsklick, Kontextmenü-Taste, Umschalt + F10) – für Tabellen eingebaut, für eigene Werkzeuge über `context()`
- Quelltext-Ansicht mit Auszeichnung (CodeMirror 6, nachgeladen): Markdown formatiert, HTML hervorgehoben
- Bilder: Mediamanager-Typ und Bildformat (Klasse) je Profil, Kontextmenü am Bild, Adresse bei der Ausgabe
  aus `data-rex-media` (korrekt im Frontend)
- Links auf YForm-Datensätze (`yform://tabelle/id`), Adresse über Extension Point `RecordUrl` oder Vorlage
  (Einstellungen)
- Schreibbereich weiß, Vollbild als Blatt, Sonderzeichen im festen Raster, Tabellen ohne style-Attribute
- Link-Leiste (Bubble) mit lesbarem Ziel (Seite, Datensatz, Datei …), Bearbeiten, Öffnen, Entfernen
- Kontextmenüs für Links, Listen, Überschriften, Zitate, Codeblöcke und Trennlinien; Vorschau im Builder wie
  der echte Editor (Datensätze, Mediamanager)
- Listen: Zählweise je Ebene (1, a, A, i, I über `type`), Startnummer, Listenformate (Klassen) mit Vorlagen
- Linkformate (z. B. „Als Button“) in Link-Dialog, Link-Leiste und Kontextmenü
- Profile als PHP-Klassen (`#[AsProfile]`, `ProfileDefinition`), Namen mit Kennung (`tiptap.news`); die mitgelieferten Profile sind selbst Klassen (`tiptap.default`, `tiptap.simple`,
  `tiptap.markdown`, `tiptap.guest`; im Backend anpass- und zurücksetzbar). Vorrang: Klasse aus Projekt/AddOn vor
  Datenbank vor mitgeliefert: per ClassDiscovery gefunden, Vorrang vor der
  Datenbank, im Backend schreibgeschützt; „Als PHP-Klasse“ erzeugt den Code (nur Abweichungen von den
  Voreinstellungen)
- Erweiterungs-API für andere AddOns (`Tiptap::register()`, `RexTiptap.register()`), Ereignisse
