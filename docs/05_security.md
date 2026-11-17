# Sicherheit

## Bereinigen auf dem Server

Der Editor im Browser lässt nur zu, was das Profil erlaubt. Darauf darf man sich aber nicht verlassen: Ein Formular
lässt sich auch ohne Editor absenden. Maßgeblich ist der Server.

Der Server bereinigt in diesen Fällen von selbst:

- Das Feld `Editor` (Core) und das YForm-Feld `Editor` bereinigen beim Speichern.
- `Tiptap::sanitize($value, $profile)` macht dasselbe für eigene Formulare. **Für Eingaben aus dem Frontend ist
  das Pflicht.**
- `Tiptap::render()` bereinigt bei der Ausgabe noch einmal. Das schützt auch alte oder importierte Inhalte.

Grundlage ist der `HtmlSanitizer` von Symfony mit einer Allowlist je Profil:

- **Elemente:** nur die der Werkzeuge in der Toolbar, Überschriften nur in den gewählten Ebenen.
- **Attribute:** nur die nötigen (`href`, `src`, `alt` …), nie `style` und nie Event-Handler.
- **Klassen:** nur die aus Block- und Textformaten, Ausrichtung und angemeldeten Plugins.
- **Links:**
  - Nur die erlaubten Schemata: `https`, `http`, `mailto`, `tel`, `redaxo`.
  - `javascript:` und `data:` fallen immer weg.
  - Ein Link mit unzulässiger Adresse bleibt als Text stehen.
- **Bilder:** relative Adressen (Medienpool), externe nur mit Freigabe im Profil.
- **Nicht erlaubte Textelemente** wie `<h1>` in einem Gäste-Profil verlieren ihr Tag, der Text bleibt.
- **Skripte, Styles, iframes und Formulare** werden samt Inhalt entfernt.

Für Markdown-Profile wird der gespeicherte Text bei der Ausgabe in HTML umgewandelt und dann genauso bereinigt.

## Content-Security-Policy

Das Backend von REDAXO 6 sendet eine strenge CSP mit Nonce. Der Editor hält sie ein:

- **Skripte:** nur aus Dateien, keine Inline-Handler, keine dynamischen Inline-Skripte.
- **Stile:**
  - Keine `style`-Attribute im Inhalt. Ausrichtung und Formate sind Klassen.
  - TipTap darf kein eigenes `<style>` einfügen (`injectCSS: false`), die Grundstile stehen in `tiptap.css`.
- **Profile im Seitenquelltext:** Sie stehen in `<script type="application/json">`. Das wird nicht ausgeführt und
  braucht keine Nonce.
- **Frontend:** `Tiptap::assets()` setzt die Nonce der Antwort an die Skripte.

## Gäste

Für Besucher eignet sich ein Profil wie `guest`:

- Wenige Werkzeuge.
- Keine internen Links und keine Dateien.
- Zeichenlimit.
- Einfügen nur als reiner Text.

Zusätzlich gehört in jedes öffentliche Formular:

- CSRF-Schutz (`CsrfToken`).
- Spamschutz.
- Bei Bedarf eine Freigabe vor der Veröffentlichung.

Das AddOn speichert selbst keine Gäste-Eingaben.

Die Einstellungen aller Profile, also nur Toolbar und Optionen, stehen im Frontend im Seitenquelltext, sobald dort
eine `textarea[data-tiptap]` vorkommt. Sie enthalten keine Geheimnisse.
