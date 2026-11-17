# Profile als PHP-Klassen

Profile lassen sich wie Module und YForm-Tabellen in REDAXO 6 als **PHP-Klassen** anlegen. Sie liegen dann im
Projekt, werden mit Git versioniert und mit dem Code ausgeliefert. Es braucht keine Konfiguration auf Stage oder
Live und keinen Abgleich der Datenbank. Eine Änderung am Profil ist ein Diff in einer Datei.

```php
<?php

namespace Project\Tiptap;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;

#[AsProfile('news', 'Meldungen', description: 'Kurztexte für Meldungen')]
final class NewsProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['bold', 'italic'],
                ['bulletList', 'orderedList'],
                ['link', 'unlink'],
                ['undo', 'redo'],
            ],
            'link' => ['records' => ['rex_yf_news']],
            'linkStyles' => [
                ['label' => 'Als Button', 'class' => 'btn btn--primary'],
            ],
            'maxLength' => 1500,
        ];
    }
}
```

Verwendet wird es wie jedes andere Profil:

- im Modul mit `#[Editor('Text', profile: 'news')]`,
- in YForm mit `Editor::new('text')->profile('news')`,
- an einer Textarea mit `data-tiptap="news"`.

## So funktioniert es

- **Finden:** Die `ClassDiscovery` des Cores findet die Klasse über das Attribut `#[AsProfile]`, wie bei
  `#[AsModule]`. Erlaubt sind alle Orte, die REDAXO durchsucht: das Projekt (`src/`) und AddOns. Ein AddOn oder ein
  fluid-Kit kann also eigene Profile mitbringen.
- **Inhalt:** `config()` liefert dieselbe Struktur wie der JSON-Export, siehe [Profile](03_profiles.md). Fehlende
  Werte ergänzt das AddOn mit den Voreinstellungen. Es genügt also, was abweicht. Ungültige Werte werden beim
  Laden normalisiert, wie beim Import.
- **Attribut:**
  - `name` ist der Schlüssel, `label` die Bezeichnung.
  - `mode` ist `Mode::Html` (Voreinstellung) oder `Mode::Markdown`.
  - `description` ist eine Beschreibung.
  - `priority` bestimmt die Reihenfolge in der Liste, kleinere Werte zuerst.
- **Vorrang:** Ein Profil aus Code gewinnt gegen ein gleichnamiges Profil aus der Datenbank. Die Liste weist darauf
  hin („überdeckt“). So lässt sich ein bisher im Backend gepflegtes Profil Schritt für Schritt in Code überführen.
- **Cache:** Neue oder umbenannte Klassen findet REDAXO nach `bin/console cache:clear`, wie bei Modulen. Änderungen
  an `config()` wirken sofort.

## Im Backend

Profile aus Code sind in der Liste mit **Code** markiert. Sie lassen sich nicht im Backend speichern oder löschen,
der Builder bleibt aber nutzbar:

1. Profil öffnen. Der Hinweis oben nennt die Klasse.
2. Werkzeuge und Einstellungen zusammenklicken. Die Vorschau zeigt alles sofort.
3. **Als PHP-Klasse** erzeugt den neuen Code. Kopieren, die Datei ersetzen, committen.

Für Profile aus der Datenbank gibt es dieselbe Schaltfläche neben „Speichern“. In der Liste lädt das PHP-Symbol
die Klasse als Datei herunter. Typischer Ablauf:

1. Lokal ein Profil im Backend zusammenklicken.
2. **Als PHP-Klasse** exportieren und unter `src/Tiptap/` ins Projekt legen. Den Namespace bei Bedarf anpassen.
3. Committen und deployen. Auf Stage und Live ist das Profil ohne weiteren Schritt da.
4. Das Profil in der lokalen Datenbank kann bleiben (es wird überdeckt) oder gelöscht werden.

Der erzeugte Code enthält nur, was von den Voreinstellungen abweicht. Dadurch bleibt er kurz und Diffs sind gut
lesbar. Unsichtbare Zeichen wie das geschützte Leerzeichen stehen lesbar als `"\u{A0}"` darin.

## Aus einem AddOn

Ein AddOn legt die Klasse einfach in seinen `src/`-Ordner. Die ClassDiscovery durchsucht alle installierten AddOns.
Einen Installationsschritt in der Datenbank braucht es nicht:

```php
namespace MyAddon\Tiptap;

#[AsProfile('shop', 'Shop', priority: 10)]
final class ShopProfile extends ProfileDefinition
{
    public function config(): array
    {
        return ['toolbar' => [['bold', 'italic'], ['bulletList'], ['link']]];
    }
}
```
