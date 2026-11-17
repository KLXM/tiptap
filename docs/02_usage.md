# Verwendung

## In Modulen, Collections und Formularen des Cores

Das Feld `Editor` ist ein Feld-Attribut wie `Text` oder `Textarea`. Es funktioniert überall, wo der Core
Formulare aus Eigenschaften baut: Module, Einträge einer `Collection`, eigene Formulare.

```php
use Klxm\Tiptap\Field\Editor;
use Redaxo\Core\Form\Field\Collection;

#[Editor('Text', profile: 'tiptap.default')]
public string $text = '';

/** @var list<Abschnitt> */
#[Collection('Abschnitte', item: Abschnitt::class)]
public array $items = [];

// in der Klasse Abschnitt:
#[Editor('Text', profile: 'tiptap.simple', note: 'Kurz halten')]
public string $text = '';
```

Parameter: `label`, `note`, `required`, `key` wie bei den anderen Feldern, dazu `profile`. Fehlt das Profil, gilt
`tiptap.default`. Beim Speichern wird der Wert nach dem Profil bereinigt. Ein leerer Editor speichert einen leeren String.

Vollständige Beispiele liegen in `examples/` des AddOns:

- `TiptapBeispielModule.php` mit `TiptapBeispielItem.php`: Text und Collection.
- `TiptapGastModule.php`: Frontend-Formular für Gäste.

## Ausgabe

```php
echo Tiptap::render($this->text, 'tiptap.default');
```

`render()` wandelt Markdown in HTML um und bereinigt nach dem Profil. Interne Links (`redaxo://ID`) bekommen die
aktuelle Adresse, Links auf Offline-Artikel werden zu `#`.

Auch ohne `render()` löst das AddOn interne Links im Frontend per `OUTPUT_FILTER` auf. Die Einstellung dafür
heißt `resolve_links` und ist voreingestellt aktiv.

## Bilder

Bilder aus dem Medienpool werden mit einem Verweis auf die Datei gespeichert:

```html
<img src="/index.php?rex_media_type=rex_media_medium&rex_media_file=bild.jpg" alt="…"
     data-rex-media="bild.jpg" data-rex-media-type="rex_media_medium" class="img-right">
```

Die Ausgabe (`Tiptap::render()` bzw. der `OUTPUT_FILTER` im Frontend) setzt daraus die Adresse über
`MediaManager::getUrl()` oder den Medienpool und entfernt die `data-`Attribute. Damit stimmt die Adresse im
Frontend, auch nach einem Umzug in einen Unterordner. Alte relative Adressen aus dem Backend (`../media/…`)
werden dabei korrigiert.

## Datensätze verlinken (YForm)

Im Link-Dialog öffnet **Datensatz wählen** eine Suche in den Tabellen, die das Profil freigibt. Gespeichert wird
`yform://tabelle/ID`. Die Adresse entsteht erst bei der Ausgabe:

1. über den Extension Point `Klxm\Tiptap\ExtensionPoint\RecordUrl`, für AddOns mit eigenen Adressen
   je Datensatz:

   ```php
   Extension::register(RecordUrl::class, static fn (RecordUrl $ep): ?string
       => 'rex_yf_news' === $ep->table ? MyRoutes::news($ep->id) : $ep->subject);
   ```

2. oder über die Vorlage unter **TipTap-Editor → Einstellungen**, z. B. `redaxo://12?news_id={id}`. Daraus wird
   die Adresse von Artikel 12 mit dem Parameter.

Ohne beides wird der Link zu `#`.

## YForm 6

Für Tabellen und Formulare von YForm 6 gibt es ein eigenes Feld:

```php
use Klxm\Tiptap\YForm\Editor;

yield Editor::new('text')->label('Text')->profile('tiptap.simple');
// große Inhalte (mediumtext):
yield Editor::new('body')->label('Inhalt')->profile('tiptap.default')->large();
```

Das Feld bereinigt Eingaben nach dem Profil. In Listen und Suchen zeigt es reinen Text.

Alternativ reicht an jedem Textarea das Attribut `data-tiptap`:

```php
yield Textarea::new('text')->attributes(['data-tiptap' => 'tiptap.simple']);
```

Hier bereinigt das AddOn **nicht** von selbst. Für Eingaben aus dem Frontend deshalb das Feld `Editor` nehmen oder
selbst `Tiptap::sanitize()` aufrufen.

## Beliebige Textareas

Jede `<textarea data-tiptap="profilname">` wird zum Editor, im Backend wie im Frontend. Das gilt auch für
Textareas, die erst später auf der Seite erscheinen. Die Einstellungen der Profile hängt das AddOn bei Bedarf als
JSON an die Seite an.

## Frontend

```php
use Klxm\Tiptap\Tiptap;

echo Tiptap::editor('nachricht', $value, 'tiptap.guest', ['id' => 'nachricht']);

// beim Absenden – immer auf dem Server bereinigen:
$clean = Tiptap::sanitize(Request::post('nachricht', 'string', ''), 'tiptap.guest');
```

Die Skripte lädt das AddOn im Frontend von selbst, sobald ein Editor auf der Seite steht. Mit
`echo Tiptap::assets();` lassen sie sich auch gezielt im `<head>` ausgeben, mit Nonce der Antwort.

Im Frontend gibt es weder Linkmap noch Medienpool. Interne Links und Dateien sind dort abgeschaltet, Bilder nur
mit „Externe Bildadressen erlauben“. Das Profil `tiptap.guest` ist für Besucher gedacht:

- Fett, kursiv, Listen und externe Links.
- Höchstens 2000 Zeichen.
- Einfügen nur als reiner Text.

### Aussehen anpassen

Der Editor nutzt die Farben des REDAXO-Backends und im Frontend eigene Voreinstellungen. Beides lässt sich über
CSS-Variablen ändern:

```css
.rex-tiptap {
    --rex-tiptap-accent: #0b7285;
    --rex-tiptap-radius: 10px;
    --rex-tiptap-border: #ccc;
    --rex-tiptap-bg: #fff;
}
```

Weitere Variablen: `--rex-tiptap-surface`, `-raised`, `-text`, `-muted`, `-border-soft`, `-accent-subtle`,
`-hover`, `-focus`, `-danger`, `-sticky-top` (Abstand der klebenden Toolbar).

Mit „Klasse des Inhaltsbereichs“ im Profil bekommt der Schreibbereich eine eigene Klasse, z. B. die der
Frontend-Typografie. So sieht der Text im Editor aus wie auf der Website.
