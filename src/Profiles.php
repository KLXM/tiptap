<?php

namespace Klxm\Tiptap;

use JsonException;
use Redaxo\Core\Core;
use Redaxo\Core\Database\Sql;
use RuntimeException;

use function array_is_list;
use function array_key_first;
use function array_map;
use function date;
use function is_array;
use function is_string;
use function json_decode;
use function json_encode;

use const JSON_PRETTY_PRINT;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

/**
 * Ablage der Profile in `rex_tiptap_profile`, Import und Export.
 */
final class Profiles
{
    public const string TABLE = 'rex_tiptap_profile';
    /** Kennung im Export, damit ein Import fremde JSON-Dateien erkennt */
    public const string EXPORT_FORMAT = 'redaxo-tiptap-profiles';

    /** @var array<string, Profile>|null */
    private static ?array $cache = null;

    /** @return array<string, Profile> nach Name */
    public static function all(): array
    {
        if (null !== self::$cache) {
            return self::$cache;
        }
        $profiles = [];
        foreach (Sql::factory()->getArray('SELECT * FROM ' . self::TABLE . ' ORDER BY prio, label') as $row) {
            $profile = self::fromRow($row);
            if ($profile) {
                $profiles[$profile->name] = $profile;
            }
        }

        return self::$cache = $profiles;
    }

    public static function get(string $name): ?Profile
    {
        return self::all()[$name] ?? null;
    }

    /** Das Profil oder – wenn es fehlt – das erste vorhandene bzw. die Voreinstellung */
    public static function getOrDefault(?string $name): Profile
    {
        return (null !== $name ? self::get($name) : null)
            ?? self::get('default')
            ?? (self::all() ? self::all()[array_key_first(self::all())] : new Profile('default', 'Standard'));
    }

    public static function exists(string $name): bool
    {
        return null !== self::get($name);
    }

    public static function save(Profile $profile, ?string $previousName = null): void
    {
        $user = Core::getUser()->login ?? 'console';
        $now = date('Y-m-d H:i:s');
        $config = json_encode($profile->config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $existing = null !== $previousName && self::exists($previousName) ? $previousName : (self::exists($profile->name) ? $profile->name : null);

        $sql = Sql::factory()->setTable(self::TABLE);
        $sql->setValue('name', $profile->name);
        $sql->setValue('label', $profile->label);
        $sql->setValue('description', $profile->description);
        $sql->setValue('mode', $profile->mode->value);
        $sql->setValue('config', $config);
        $sql->setValue('updatedate', $now);
        $sql->setValue('updateuser', $user);
        if (null !== $existing) {
            if ($existing !== $profile->name && self::exists($profile->name)) {
                throw new RuntimeException('Profile "' . $profile->name . '" already exists.');
            }
            $sql->setWhere(['name' => $existing]);
            $sql->update();
        } else {
            $sql->setValue('prio', self::nextPrio());
            $sql->setValue('createdate', $now);
            $sql->setValue('createuser', $user);
            $sql->insert();
        }
        self::$cache = null;
    }

    public static function delete(string $name): void
    {
        Sql::factory()->setQuery('DELETE FROM ' . self::TABLE . ' WHERE name = ?', [$name]);
        self::$cache = null;
    }

    /** Freier Name: `name`, `name-2`, `name-3` … */
    public static function freeName(string $name): string
    {
        $base = $name;
        for ($i = 2; self::exists($name); ++$i) {
            $name = $base . '-' . $i;
        }

        return $name;
    }

    /** @param list<Profile> $profiles */
    public static function export(array $profiles): string
    {
        return json_encode([
            'format' => self::EXPORT_FORMAT,
            'version' => 1,
            'exported' => date('c'),
            'profiles' => array_map(static fn (Profile $p) => $p->toArray(), $profiles),
        ], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Liest einen Export (auch ein einzelnes Profil-Objekt).
     *
     * @throws RuntimeException bei ungültigem Inhalt
     * @return list<Profile>
     */
    public static function parse(string $json): array
    {
        try {
            $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('JSON: ' . $e->getMessage(), 0, $e);
        }
        if (!is_array($data)) {
            throw new RuntimeException('JSON: object expected');
        }
        $list = match (true) {
            isset($data['profiles']) && is_array($data['profiles']) => $data['profiles'],
            isset($data['name']) => [$data],
            array_is_list($data) => $data,
            default => throw new RuntimeException('No profiles found.'),
        };
        $profiles = [];
        foreach ($list as $entry) {
            if (!is_array($entry) || !is_string($entry['name'] ?? null)) {
                throw new RuntimeException('Profile without name.');
            }
            $profiles[] = Profile::fromArray($entry);
        }

        return $profiles;
    }

    /**
     * Importiert Profile; vorhandene Namen werden überschrieben oder umbenannt.
     *
     * @param list<Profile> $profiles
     * @return list<string> gespeicherte Namen
     */
    public static function import(array $profiles, bool $overwrite): array
    {
        $names = [];
        foreach ($profiles as $profile) {
            if (!$overwrite && self::exists($profile->name)) {
                $profile = $profile->withName(self::freeName($profile->name));
            }
            self::save($profile);
            $names[] = $profile->name;
        }

        return $names;
    }

    /** @param list<string> $names neue Reihenfolge */
    public static function sort(array $names): void
    {
        foreach ($names as $i => $name) {
            Sql::factory()->setQuery('UPDATE ' . self::TABLE . ' SET prio = ? WHERE name = ?', [$i + 1, $name]);
        }
        self::$cache = null;
    }

    /** Legt fehlende Standardprofile an (beim migrate) */
    public static function installDefaults(): void
    {
        self::$cache = null;
        foreach (self::defaults() as $profile) {
            if (!self::exists($profile->name)) {
                self::save($profile);
            }
        }
    }

    /** @return list<Profile> */
    public static function defaults(): array
    {
        return [
            Profile::fromArray([
                'name' => 'default',
                'label' => 'Standard',
                'description' => 'Alle wichtigen Werkzeuge für redaktionelle Texte.',
                'mode' => 'html',
                'config' => [
                    'toolbar' => [
                        ['undo', 'redo'],
                        ['heading', 'blockStyle'],
                        ['bold', 'italic', 'underline', 'strike', 'highlight'],
                        ['bulletList', 'orderedList', 'blockquote'],
                        ['align'],
                        ['link', 'unlink', 'image', 'table', 'horizontalRule', 'specialChars'],
                        ['subscript', 'superscript', 'code', 'clearFormatting'],
                        ['source', 'fullscreen'],
                    ],
                    'blockStyles' => [['label' => 'Einleitung', 'class' => 'lead', 'element' => 'p'], ['label' => 'Kleingedruckt', 'class' => 'small', 'element' => 'p']],
                    'listStyles' => [
                        ['label' => 'Gegliedert (1.1, 1.2)', 'class' => 'list-outline', 'list' => 'ol'],
                        ['label' => 'Häkchen', 'class' => 'list-check', 'list' => 'ul'],
                        ['label' => 'Ohne Zeichen', 'class' => 'list-plain', 'list' => 'both'],
                    ],
                    'linkStyles' => [['label' => 'Als Button', 'class' => 'btn btn--primary']],
                    'image' => ['styles' => [
                        ['label' => 'Links umflossen', 'class' => 'img-left'],
                        ['label' => 'Rechts umflossen', 'class' => 'img-right'],
                        ['label' => 'Zentriert', 'class' => 'img-center'],
                        ['label' => 'Volle Breite', 'class' => 'img-full'],
                    ]],
                ],
            ]),
            Profile::fromArray([
                'name' => 'simple',
                'label' => 'Einfach',
                'description' => 'Fett, kursiv, Listen und Links – für kurze Texte und Collections.',
                'mode' => 'html',
                'config' => [
                    'toolbar' => [['bold', 'italic'], ['bulletList', 'orderedList'], ['link', 'unlink'], ['undo', 'redo']],
                    'minHeight' => 100,
                    'counter' => false,
                ],
            ]),
            Profile::fromArray([
                'name' => 'markdown',
                'label' => 'Markdown',
                'description' => 'Speichert Markdown statt HTML.',
                'mode' => 'markdown',
                'config' => [
                    'toolbar' => [
                        ['undo', 'redo'],
                        ['heading'],
                        ['bold', 'italic', 'strike', 'code'],
                        ['bulletList', 'orderedList', 'blockquote', 'codeBlock'],
                        ['link', 'image', 'table', 'horizontalRule'],
                        ['source', 'fullscreen'],
                    ],
                ],
            ]),
            Profile::fromArray([
                'name' => 'guest',
                'label' => 'Gäste (Frontend)',
                'description' => 'Minimal für Eingaben von Besuchern: fett, kursiv, Listen, externe Links.',
                'mode' => 'html',
                'config' => [
                    'toolbar' => [['bold', 'italic'], ['bulletList', 'orderedList'], ['link']],
                    'link' => ['internal' => false, 'media' => false, 'external' => true, 'mailto' => false, 'tel' => false, 'targetBlank' => false],
                    'minHeight' => 120,
                    'maxLength' => 2000,
                    'pasteText' => true,
                    'stickyToolbar' => false,
                ],
            ]),
        ];
    }

    private static function nextPrio(): int
    {
        return (int) Sql::factory()->getArray('SELECT COALESCE(MAX(prio), 0) + 1 AS p FROM ' . self::TABLE)[0]['p'];
    }

    /** @param array<string, mixed> $row */
    private static function fromRow(array $row): ?Profile
    {
        try {
            $config = json_decode((string) $row['config'], true, 64, JSON_THROW_ON_ERROR);

            return Profile::fromArray([
                'name' => $row['name'],
                'label' => $row['label'],
                'description' => $row['description'] ?? '',
                'mode' => $row['mode'],
                'config' => is_array($config) ? $config : [],
            ]);
        } catch (\Throwable) {
            return null;
        }
    }
}
