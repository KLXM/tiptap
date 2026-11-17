# Profile

Ein Profil legt fest, wie der Editor aussieht und was er speichern darf. Profile werden im Backend unter
**TipTap-Editor → Profile** gepflegt. Code ist dafür nicht nötig.

## Toolbar-Builder

- **Gruppen:** Die Toolbar besteht aus Gruppen, zwischen denen ein Trenner steht. Ein Klick auf eine Gruppe
  markiert sie.
- **Werkzeuge hinzufügen:** Ein Klick auf ein Werkzeug in der Liste fügt es in die markierte Gruppe ein. Werkzeuge
  lassen sich auch in eine Gruppe ziehen.
- **Werkzeuge umsortieren:** Bereits verwendete Werkzeuge sind markiert. Ein erneuter Klick verschiebt sie.
- **Mit der Tastatur:** Werkzeug fokussieren, dann **Alt + ←/→** verschiebt es, auch über Gruppengrenzen,
  **Entf** entfernt es.
- **Vorlagen:** „Minimal“, „Standard“ und „Alles“ ersetzen die Toolbar auf einen Schlag.

Die Vorschau zeigt den Editor sofort mit allen Änderungen. Unter „Gespeicherter Wert“ steht, was in der
Datenbank landen würde.

### Werkzeuge

| Bereich | Werkzeuge |
| --- | --- |
| Verlauf | Rückgängig, Wiederholen |
| Absatz & Formate | Absatzformat (Menü), Blockformat (Menü), Textformat (Menü) |
| Zeichen | Fett, Kursiv, Unterstrichen, Durchgestrichen, Code, Markieren, Tief-/Hochgestellt, Formatierung entfernen |
| Blöcke | Aufzählung, Nummerierte Liste, Listenformat (Menü), Zitat, Codeblock, Trennlinie |
| Ausrichtung | Menü oder einzelne Knöpfe |
| Einfügen | Link, Link entfernen, Bild, Tabelle (Menü), Sonderzeichen (Menü) |
| Ansicht | Quelltext, Vollbild |

Werkzeuge anderer AddOns erscheinen in eigenen Bereichen.

## Einstellungen

- **Überschriften:** welche Ebenen das Absatzformat anbietet.
- **Blockformate:** Bezeichnung, CSS-Klasse und Element (`<p>`, `<h2>`, `<blockquote>`, `<ul>` …). Ein Format
  für `<h2>` macht den Block zur Überschrift und setzt die Klasse.
- **Textformate:** Bezeichnung und Klasse für `<span class="…">` um markierten Text.
- **Listen:**
  - **Zählweisen** nummerierter Listen: 1, a, A, i, I. Sie stehen als HTML-Attribut `type` an `<ol>` und brauchen
    kein CSS.
  - **Listenformate:** Bezeichnung, Klasse und ob sie für nummerierte Listen, Aufzählungen oder beide gelten.
    Vorlagen mit CSS liegen im Builder, etwa „Gegliedert (1.1, 1.2)“, „Häkchen“ und „Ohne Zeichen“.
  - Die Auswahl gilt je Ebene: Rechtsklick in die Liste oder das Werkzeug „Listenformat“. Dort gibt es auch
    „Beginnt bei …“.
  - Eine gegliederte Nummerierung zählt mit CSS-Countern. `type` und `start` wirken dann nicht.
- **Linkformate:** Klassen für Links, z. B. „Als Button“ mit `btn btn--primary`. Auswahl im Link-Dialog, in der
  Link-Leiste und per Rechtsklick.
- **Ausrichtung:** Klassen für links, zentriert, rechts und Blocksatz. Voreinstellung `text-left` usw.
- **Links:** intern (Linkmap), Medienpool, extern, E-Mail, Telefon, Option „Neues Fenster“.
- **Bilder:**
  - Erlaubte Dateitypen aus dem Medienpool und externe Adressen.
  - **Mediamanager-Typen zur Auswahl** mit Voreinstellung: Der Bild-Dialog bietet die Größe an, die Ausgabe
    baut die Adresse über den Mediamanager.
  - **Bildformate:** Bezeichnung und Klasse, z. B. `img-left` für „links umflossen“. Auswahl im Bild-Dialog und per
    Rechtsklick aufs Bild. Für die Website braucht es CSS zu diesen Klassen. Im Editor bringt das AddOn Regeln für
    `img-left`, `img-right`, `img-center` und `img-full` mit.
- **Datensätze verlinken (YForm):** Tabellen, die der Link-Dialog anbietet. Wohin ein Link führt, steht unter
  **Einstellungen**.
- **Sonderzeichen:** Liste, durch Leerzeichen getrennt. `NBSP` steht für das geschützte Leerzeichen, `SHY` für
  das weiche Trennzeichen.
- **Editor:**
  - Mindest- und Maximalhöhe.
  - Platzhalter.
  - Zeichenlimit.
  - Zähler.
  - Klebende Toolbar.
  - Klasse des Inhaltsbereichs.
  - Einfügen nur als Text.

Alle Klassen gelten als Allowlist. Was nicht im Profil steht, entfernt der Editor beim Einfügen und der Server beim
Speichern.

## Markdown oder HTML

Das Speicherformat wählt man je Profil:

- **HTML** kann alles: Klassen, Ausrichtung, Unterstreichen, Hoch- und Tiefstellen, Markieren.
- **Markdown** speichert reinen Text mit Markdown-Syntax (CommonMark plus Tabellen). Werkzeuge ohne
  Markdown-Entsprechung fallen weg, Block- und Textformate ebenso.

Die Quelltext-Ansicht zeigt je nach Format HTML oder Markdown. Das Format eines Profils mit bestehenden Inhalten
sollte man nicht nachträglich wechseln: Vorhandene Werte werden nicht umgewandelt.

## Import und Export

- **Exportieren** am Profil oder **Alle exportieren** lädt eine JSON-Datei herunter.
- **Importieren** nimmt eine Datei oder eingefügtes JSON. Erkannt werden Sammlungen, einzelne Profile und Listen.
  Gleichnamige Profile werden überschrieben oder als `name-2` angelegt.

Beim Import werden alle Werte geprüft und normalisiert. Unbekannte Werkzeuge bleiben erhalten. Sie wirken, sobald
das zugehörige AddOn installiert ist.

```json
{
    "format": "redaxo-tiptap-profiles",
    "version": 1,
    "profiles": [
        {
            "name": "news",
            "label": "Meldungen",
            "description": "",
            "mode": "html",
            "config": {
                "toolbar": [["bold", "italic"], ["link", "unlink"]],
                "headings": [2, 3],
                "blockStyles": [{"label": "Einleitung", "class": "lead", "element": "p"}],
                "inlineStyles": [],
                "align": {"left": "text-left", "center": "text-center", "right": "text-right", "justify": "text-justify"},
                "link": {"internal": true, "media": true, "external": true, "mailto": true, "tel": true, "targetBlank": true},
                "image": {"types": ["jpg", "png", "webp"], "external": false},
                "minHeight": 180,
                "maxHeight": 0,
                "maxLength": 0,
                "placeholder": "",
                "counter": true,
                "stickyToolbar": true,
                "contentClass": "",
                "pasteText": false
            }
        }
    ]
}
```

Fehlende Werte ergänzt das AddOn mit den Voreinstellungen. Ein Export muss also nicht vollständig sein.
