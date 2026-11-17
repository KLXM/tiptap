# Verwendung

## In Modulen, Collections und Formularen des Cores

Das Feld `Editor` ist ein Feld-Attribut wie `Text` oder `Textarea`. Es funktioniert überall, wo der Core
Formulare aus Eigenschaften baut: Module, Einträge einer `Collection`, eigene Formulare.

```php
use FriendsOfRedaxo\Tiptap\Field\Editor;
use Redaxo\Core\Form\Field\Collection;

#[Editor('Text', profile: 'default')]
public string $text = '';

/** @var list<Abschnitt> */
#[Collection('Abschnitte', item: Abschnitt::class)]
public array $items = [];

// in der Klasse Abschnitt:
#[Editor('Text', profile: 'simple', note: 'Kurz halten')]
public string $text = '';
```

Parameter: `label`, `note`, `required`, `key` wie bei den anderen Feldern, dazu `profile`. Fehlt das Profil, gilt
`default`. Beim Speichern wird der Wert nach dem Profil bereinigt. Ein leerer Editor speichert einen leeren String.

Vollständige Beispiele liegen in `examples/` des AddOns:

- `TiptapBeispielModule.php` mit `TiptapBeispielItem.php`: Text und Collection.
- `TiptapGastModule.php`: Frontend-Formular für Gäste.

## Ausgabe

```php
echo Tiptap::render($this->text, 'default');
```

`render()` wandelt Markdown in HTML um und bereinigt nach dem Profil. Interne Links (`redaxo://ID`) bekommen die
aktuelle Adresse, Links auf Offline-Artikel werden zu `#`.

Auch ohne `render()` löst das AddOn interne Links im Frontend per `OUTPUT_FILTER` auf. Die Einstellung dafür
heißt `resolve_links` und ist voreingestellt aktiv.

## YForm 6

Für Tabellen und Formulare von YForm 6 gibt es ein eigenes Feld:

```php
use FriendsOfRedaxo\Tiptap\YForm\Editor;

yield Editor::new('text')->label('Text')->profile('simple');
// große Inhalte (mediumtext):
yield Editor::new('body')->label('Inhalt')->profile('default')->large();
```

Das Feld bereinigt Eingaben nach dem Profil. In Listen und Suchen zeigt es reinen Text.

Alternativ reicht an jedem Textarea das Attribut `data-tiptap`:

```php
yield Textarea::new('text')->attributes(['data-tiptap' => 'simple']);
```

Hier bereinigt das AddOn **nicht** von selbst. Für Eingaben aus dem Frontend deshalb das Feld `Editor` nehmen oder
selbst `Tiptap::sanitize()` aufrufen.

## Beliebige Textareas

Jede `<textarea data-tiptap="profilname">` wird zum Editor, im Backend wie im Frontend. Das gilt auch für
Textareas, die erst später auf der Seite erscheinen. Die Einstellungen der Profile hängt das AddOn bei Bedarf als
JSON an die Seite an.

## Frontend

```php
use FriendsOfRedaxo\Tiptap\Tiptap;

echo Tiptap::editor('nachricht', $value, 'guest', ['id' => 'nachricht']);

// beim Absenden – immer auf dem Server bereinigen:
$clean = Tiptap::sanitize(Request::post('nachricht', 'string', ''), 'guest');
```

Die Skripte lädt das AddOn im Frontend von selbst, sobald ein Editor auf der Seite steht. Mit
`echo Tiptap::assets();` lassen sie sich auch gezielt im `<head>` ausgeben, mit Nonce der Antwort.

Im Frontend gibt es weder Linkmap noch Medienpool. Interne Links und Dateien sind dort abgeschaltet, Bilder nur
mit „Externe Bildadressen erlauben“. Das Profil `guest` ist für Besucher gedacht:

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
