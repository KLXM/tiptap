# Für Entwickler

## Aufbau

| Teil | Datei | Aufgabe |
| --- | --- | --- |
| Lader | `assets/tiptap-loader.js` | klein, wird immer geladen; lädt das Bundle erst, wenn ein Editor erscheint |
| Bundle | `assets/tiptap.js` (ES-Modul) | TipTap, `<rex-tiptap>`, Toolbar, Dialoge, `window.RexTiptap` |
| Nachgeladen | `assets/chunks/` | Quelltext-Ansicht (CodeMirror), erst beim Öffnen |
| Stile | `assets/tiptap.css` | Editor, Menüs, Dialoge; Variablen `--rex-tiptap-*` |
| PHP | `Klxm\Tiptap\*` | Profile, Sanitizer, Ausgabe, Felder |

Quellen der Skripte liegen in `resources/js/`. Gebaut wird mit `npm install && npm run build` (esbuild), das
Ergebnis in `assets/` wird mit eingecheckt.

## PHP-API

```php
use Klxm\Tiptap\Tiptap;

Tiptap::render(?string $value, string|Profile|null $profile = null): string    // Ausgabe
Tiptap::sanitize(?string $value, string|Profile|null $profile = null): string  // vor dem Speichern
Tiptap::editor(string $name, ?string $value, string|Profile|null $profile = null, array $attributes = []): string
Tiptap::assets(bool $withProfiles = false): string                             // Frontend-Skripte/Stile
Tiptap::profile(?string $name): Profile                                        // Profil oder „tiptap.default“
Tiptap::register(Plugin $plugin): void                                         // Erweiterung anmelden
```

Profile gehören am besten als Klasse in den Code, siehe [Profile als PHP-Klassen](04_code.md). Für Sonderfälle
verwalten `Profiles::all()`, `get()`, `save()`, `delete()`, `export()`, `parse()`, `import()` und
`toPhp()` die Profile auch per API, z. B. in einem eigenen Installationsschritt:

```php
use Klxm\Tiptap\Profile;
use Klxm\Tiptap\Profiles;

// in install() des eigenen AddOns – idempotent
if (!Profiles::exists('shop')) {
    Profiles::save(Profile::fromArray([
        'name' => 'shop',
        'label' => 'Shop',
        'mode' => 'html',
        'config' => ['toolbar' => [['bold', 'italic'], ['bulletList'], ['link']]],
    ]));
}
```

## Eigene Werkzeuge (Plugins)

Eine Erweiterung besteht aus zwei Hälften:

1. **PHP:** Anmeldung beim AddOn, damit der Builder das Werkzeug anbietet, der Sanitizer die erzeugten Elemente
   kennt und die Skripte geladen werden.
2. **JavaScript:** die Funktion mit TipTap-Erweiterungen und Toolbar-Eintrag.

### PHP (in `boot()` des eigenen AddOns)

```php
use Klxm\Tiptap\Item;
use Klxm\Tiptap\Plugin;
use Klxm\Tiptap\Tiptap;

if (class_exists(Tiptap::class)) {
    Tiptap::register(new Plugin(
        id: 'myaddon',
        label: 'Mein AddOn',
        script: $this->getAssetsUrl('tiptap-hint.js'),
        style: $this->getAssetsUrl('tiptap-hint.css'),
        items: [
            new Item(
                id: 'myaddon:hint',
                label: 'Hinweisbox',
                icon: 'fa-solid fa-circle-info',      // oder ein Name aus dem eingebauten Satz, oder '<svg …>'
                category: 'insert',                   // oder eine eigene Kategorie
                markdown: false,                      // nicht im Markdown-Modus anbieten
                elements: ['div' => ['class']],       // was das Werkzeug in den Inhalt schreibt
                description: 'Farbige Box für Hinweise',
            ),
        ],
        classes: ['hint', 'hint--warn'],          // erlaubte Klassen für den Sanitizer
    ));
}
```

### JavaScript (`assets/tiptap-hint.js`)

Das Skript wird normal (`defer`) geladen. `RexTiptap.register()` darf sofort aufgerufen werden: Bis das
Editor-Bundle da ist, sammelt der Lader die Anmeldungen. TipTap selbst kommt aus `RexTiptap.tiptap`. Bitte **kein
eigenes TipTap bündeln**, sonst gibt es zwei ProseMirror-Instanzen, die nicht zusammenpassen.

```js
RexTiptap.ready(({tiptap}) => {
    const {Node, mergeAttributes} = tiptap;

    const Hint = Node.create({
        name: 'hint',
        group: 'block',
        content: 'paragraph+',
        defining: true,
        parseHTML: () => [{tag: 'div.hint'}],
        renderHTML: ({HTMLAttributes}) => ['div', mergeAttributes(HTMLAttributes, {class: 'hint'}), 0],
        addCommands() {
            return {
                toggleHint: () => ({commands}) => commands.toggleWrap(this.name),
            };
        },
    });

    RexTiptap.register({
        id: 'myaddon',
        // nur laden, wenn das Profil das Werkzeug enthält
        extensions: ({has}) => (has('myaddon:hint') ? [Hint] : []),
        items: {
            'myaddon:hint': {
                label: 'Hinweisbox',
                icon: 'fa-solid fa-circle-info',
                run: ({editor}) => editor.chain().focus().toggleHint().run(),
                active: ({editor}) => editor.isActive('hint'),
                // optional: enabled: ctx => bool, menu: ctx => [{label, icon, run, active, enabled, radio, separator}]
                // optional: context: ctx => [...] – Einträge fürs Kontextmenü (Rechtsklick), null = keine
                context: ({editor}) => editor.isActive('hint') ? [{label: 'Hinweis entfernen', icon: 'trash', run: () => editor.chain().focus().lift('hint').run()}] : null,
            },
        },
        i18n: {de: {}, en: {}},
    });
});
```

`RexTiptap.ready()` wartet, bis das Bundle geladen ist. Für Erweiterungen ohne eigene TipTap-Klassen genügt der
direkte Aufruf von `RexTiptap.register()`.

### Kontextmenü

Gibt ein Werkzeug über `context(ctx)` Einträge zurück, zeigt der Rechtsklick ein eigenes Menü statt dem des
Browsers. Die Einträge mehrerer Werkzeuge werden durch Trenner getrennt. Liefert kein Werkzeug etwas, bleibt das
Menü des Browsers. Die eingebaute Tabelle nutzt das für Zeilen, Spalten und Zellen.

### Werkzeug-Kontext

Die Funktionen `run`, `active`, `enabled`, `menu`, `context` und `current` bekommen `{editor, config, ui, has}`:

- `editor`: die TipTap-Instanz.
- `config`: die Einstellungen des Profils, inklusive `mode`, `backend`, `mediaUrl`, `link` …
- `ui`: die Editor-Instanz mit `linkDialog()`, `imageDialog()`, `openDialog(title, fields, onApply)`,
  `toggleSource()`, `toggleFullscreen()` und `value()`.
- `has(id)`: ob das Profil ein Werkzeug enthält.

### Markdown

Soll ein eigener Knoten auch in Markdown-Profilen funktionieren, braucht die TipTap-Erweiterung
`renderMarkdown` bzw. `parseMarkdown` (siehe TipTap-Doku zu `@tiptap/markdown`). Im PHP-Item dann
`markdown: true` setzen. Für Markdown-Profile kennt der Sanitizer nur Markdown-Elemente.

## JavaScript-API

```js
RexTiptap.get(element)          // Instanz zu <rex-tiptap>, Textarea oder einem Element darin
el.editor                       // TipTap-Editor eines <rex-tiptap>
el.value / el.value = '…'       // Wert lesen/setzen
RexTiptap.upgrade(root)         // textarea[data-tiptap] in root sofort umwandeln (macht der Observer selbst)
RexTiptap.icon(name)            // Symbol als Element
RexTiptap.icons.add(name, node) // eigenes Symbol (Lucide-Format: [['path', {d: '…'}], …])
RexTiptap.i18n.add('de', {…})   // Texte ergänzen/überschreiben
RexTiptap.tiptap                // @tiptap/core (Node, Mark, Extension, mergeAttributes …)
RexTiptap.helpers               // allowedUrl(), normalizeUrl(), BlockClass, InlineStyle …
```

### Ereignisse (am `<rex-tiptap>`, sie steigen auf)

| Ereignis | `detail` | Wann |
| --- | --- | --- |
| `rex-tiptap:configure` | `{config, extensions, instance}` | vor dem Start; `extensions` darf verändert werden |
| `rex-tiptap:ready` | `{editor, instance}` | Editor läuft |
| `rex-tiptap:change` | `{value, instance}` | Inhalt geändert (die Textarea feuert zusätzlich `input` und `change`) |
| `rex-tiptap:loaded` | API | am `document`, wenn das Bundle geladen ist |

```js
document.addEventListener('rex-tiptap:configure', e => {
    if ('tiptap.news' === e.detail.config.name) {
        e.detail.extensions.push(MyExtension);
    }
});
```

## Inline-Modus: direkt auf der Seite

Für Bearbeiten im Kontext (z. B. fluid): Der Editor läuft auf einem Element der Seite statt in seinem eigenen Kasten.
Das Element behält seine Klassen – es gilt die Typografie der Website –, die Werkzeugleiste schwebt darüber, solange
der Text, die Leiste, ein Menü oder ein Dialog den Fokus hat. Quelltext und Vollbild entfallen.

```js
const instance = RexTiptap.inline(element, 'tiptap.news', {
    value: '<p>…</p>',      // Ausgangswert, sonst der Inhalt des Elements
    label: 'Text',          // Name für Screenreader
    layer: document.body,   // wohin Leiste und Link-Leiste kommen
});
element.addEventListener('rex-tiptap:change', e => save(e.detail.value));
instance.destroy();         // das Element zeigt danach den aktuellen Wert
```

Das Profil ist ein Name (aus `<script id="rex-tiptap-profiles">`, siehe `Tiptap::assets(true)`) oder die
Client-Konfiguration eines Profils (`Tiptap::clientConfig()`). Profile kommen dabei wie immer auch als Klasse
(`#[AsProfile]`). `RexTiptap.get(element)` liefert die Instanz, `RexTiptap.Inline` die Klasse zum Erweitern.

**Auswahl von Seiten und Medien:** Die Dialoge nutzen `RexTiptap.pick(type, options)`, sonst im Backend `rex.pick()`.
Eine Oberfläche auf der Website setzt eine eigene Auswahl mit derselben Antwort (`[{value, label}]`), z. B. fluid:
`RexTiptap.pick = (type, options) => FrontendPicker.pick(type, options);`

**Shadow DOM:** Editoren funktionieren auch im Shadow DOM einer Oberfläche (Fokus und Klicks über `getRootNode()` bzw.
`composedPath()`). Die Oberfläche lädt dann `tiptap.css` in ihren Shadow Root und ruft `RexTiptap.upgrade(root)` für
neu eingefügte `textarea[data-tiptap]` auf – der Observer des AddOns sieht nur das Dokument.

## Element `<rex-tiptap>`

```html
<rex-tiptap data-config='{"mode":"html","toolbar":[["bold","italic"]], …}'>
    <textarea name="text">…</textarea>
</rex-tiptap>

<!-- oder mit Profilname (Einstellungen aus <script id="rex-tiptap-profiles">) -->
<rex-tiptap profile="simple"><textarea name="text"></textarea></rex-tiptap>
```

Die Textarea trägt immer den Wert. Ohne JavaScript bleibt sie benutzbar. Das Element räumt sich beim Entfernen
selbst auf. Beim Verschieben im DOM, etwa beim Sortieren einer Collection, bleibt es erhalten.

## fluid und andere Frontends

Für die Integration in fluid sind vorgesehen:

- **Klasse des Inhaltsbereichs** im Profil: Damit gelten im Editor die Typografie-Stile des Frontends.
- **Blockformate und Textformate** als Klassenvertrag. Ein Kit kann seine Formate als Profil importieren oder per
  `Profiles::save()` anlegen.
- **`Tiptap::register()`** für Kit-eigene Werkzeuge, z. B. Hinweisboxen oder Buttons.
- **CSS-Variablen** `--rex-tiptap-*` für die Farben des Kits.

## Medien-Blöcke: Speicherformen und Einwilligung

Die Werkzeuge `video`, `oembed` und `htmlEmbed` speichern:

```html
<video src="…" data-rex-media="film.mp4" poster="…" data-rex-poster="bild.jpg" controls class="… rex-ratio-16x9"></video>
<figure data-rex-oembed="https://youtu.be/ID" data-rex-title="…" class="rex-ratio-16x9"><a href="…">…</a></figure>
<div data-rex-embed="(maskierter Code)" data-rex-sig="…" data-consent-service="google_maps" data-rex-label="Anfahrt"></div>
```

`Tiptap::render()` löst sie auf:

- **Video:** Adressen aus dem Medienpool. Mit dem AddOn video_editor zusätzlich: Poster aus dem Video-Editor, wenn
  keins gewählt ist (wird nicht gespeichert), Web-Fassungen als `<source>` (Hintergrundvideo – autoplay, muted, loop –
  nur die kleineren), Untertitel als `<track>` mit der Sprache der Seite eingeschaltet. Im Video-Dialog lässt sich das
  aktuelle Bild als Poster aufnehmen (Recht `video_editor[]`).
- **YouTube/Vimeo:** 2-Klick-Platzhalter oder – mit Profil-Einstellung „2-Klick-Lösung“ aus – direkt der Player
  (`youtube-nocookie.com` bzw. Vimeo mit `dnt=1`). Titel und Vorschaubild holt der Server über oEmbed und legt sie im
  Datenordner ab (`?rex-api-call=tiptap_oembed`).
- **HTML-Embed:** nur mit gültiger Signatur (Recht `tiptap[html_embed]`, Admins immer) und nur in Profilen mit dem
  Werkzeug `htmlEmbed`. `<script>`/`<style>` bekommen `Response::getNonce()`. Ein vollständiger HTML-Cache der Seite
  friert den Nonce ein. Der OUTPUT_FILTER gibt HTML-Embeds bewusst nie aus.

Seitenverhältnisse sind feste Klassen (`rex-ratio-16x9`, `-4x3`, `-1x1`, `-9x16`, `-21x9`); Stile und Skript fürs
Frontend (`tiptap-media.css`, `tiptap-media.js`) setzt der OUTPUT_FILTER bei Bedarf selbst ein.

### Schnittstelle zu Einwilligungs-Tools (z. B. consent_kit)

Anbieterneutral, funktioniert mit und ohne Einwilligungs-Tool:

| Teil | Vertrag |
|---|---|
| Platzhalter | `[data-consent-service="youtube"][data-consent-src="…"][data-consent-title="…"]`, darin `[data-consent-load]` |
| HTML-Embed mit Dienst | `.rex-embed-consent[data-consent-service] > template` (Code), Knopf „Inhalt laden“ |
| Zustand | `data-consent-state="blocked\|loaded"` |
| JS | `window.ConsentKit` (Alias `cmsConsent`): `has(key)`, `accept(key)`; Ereignisse `consentkit:ready`, `consentkit:change` (`detail.accepted`) |

Ist ein Dienst schon erlaubt, lädt der Inhalt sofort; mit Einwilligungs-Tool bietet der Platzhalter „… immer
erlauben“ an (`accept()`), und eine spätere Einwilligung lädt alle Platzhalter des Dienstes.
