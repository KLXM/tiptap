<?php

namespace Klxm\Tiptap;

use JsonException;
use Redaxo\Core\ClassDiscovery;
use Redaxo\Core\Core;
use Redaxo\Core\Database\Sql;
use RuntimeException;

use function array_is_list;
use function array_filter;
use function dechex;
use function mb_ord;
use function preg_match;
use function preg_replace_callback;
use function strtoupper;
use function array_key_first;
use function implode;
use function is_bool;
use function realpath;
use function rtrim;
use function str_repeat;
use function str_starts_with;
use function strlen;
use function substr;
use function str_replace;
use function ucwords;
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
    /** Profil ohne Angabe (mitgeliefert als {@see Profile\DefaultProfile}) */
    public const string DEFAULT = 'tiptap.default';
    /** Kennung im Export, damit ein Import fremde JSON-Dateien erkennt */
    public const string EXPORT_FORMAT = 'redaxo-tiptap-profiles';

    /** @var array<string, Profile>|null */
    private static ?array $cache = null;

    /**
     * Alle Profile. Reihenfolge des Vorrangs bei gleichem Namen:
     *
     * 1. Klassen aus Projekt und AddOns ({@see AsProfile}) – verbindlich, im Backend schreibgeschützt
     * 2. Profile aus der Datenbank (im Backend angelegt oder angepasst)
     * 3. die mitgelieferten Profile des AddOns (`tiptap.*`, src/Profile)
     *
     * @return array<string, Profile> nach Name
     */
    public static function all(): array
    {
        if (null !== self::$cache) {
            return self::$cache;
        }
        $code = self::fromCode();
        $database = self::fromDatabase();
        $profiles = $code;
        foreach (self::builtin() as $name => $profile) {
            $profiles[$name] ??= $database[$name] ?? $profile;
        }
        foreach ($database as $name => $profile) {
            $profiles[$name] ??= $profile;
        }

        return self::$cache = $profiles;
    }

    /**
     * Die mitgelieferten Profile (Klassen im AddOn selbst).
     *
     * @return array<string, Profile>
     */
    public static function builtin(): array
    {
        return array_filter(self::discover(), static fn (Profile $p) => $p->builtin);
    }

    /** Ist ein Profil mitgeliefert und in der Datenbank angepasst? */
    public static function isCustomized(string $name): bool
    {
        return isset(self::builtin()[$name]) && isset(self::fromDatabase()[$name]);
    }

    /** @return array<string, Profile> */
    public static function fromDatabase(): array
    {
        $profiles = [];
        foreach (Sql::factory()->getArray('SELECT * FROM ' . self::TABLE . ' ORDER BY prio, label') as $row) {
            $profile = self::fromRow($row);
            if ($profile) {
                $profiles[$profile->name] = $profile;
            }
        }

        return $profiles;
    }

    /**
     * Profile aus Klassen von Projekt und AddOns (ohne die mitgelieferten).
     *
     * @return array<string, Profile>
     */
    public static function fromCode(): array
    {
        return array_filter(self::discover(), static fn (Profile $p) => !$p->builtin);
    }

    /** @return array<string, Profile> */
    private static function discover(): array
    {
        static $discovered = null;
        if (null !== $discovered) {
            return $discovered;
        }
        $found = [];
        foreach (ClassDiscovery::getInstance()->discoverByAttribute(AsProfile::class, ProfileDefinition::class) as $class => $attr) {
            $found[] = [$attr, $class];
        }
        usort($found, static fn (array $a, array $b) => [$a[0]->priority, $a[0]->name] <=> [$b[0]->priority, $b[0]->name]);

        $profiles = [];
        foreach ($found as [$attr, $class]) {
            try {
                $profile = Profile::fromArray([
                    'name' => $attr->name,
                    'label' => $attr->label,
                    'description' => $attr->description,
                    'mode' => $attr->mode->value,
                    'config' => new $class()->config(),
                ]);
                $builtin = 'tiptap' === self::origin($class);
                // Klassen anderer Pakete gewinnen gegen gleichnamige mitgelieferte
                $key = ($builtin ? 'builtin:' : '') . $profile->name;
                $profiles[$key] ??= new Profile($profile->name, $profile->label, $profile->mode, $profile->description, $profile->config, $class, $builtin);
            } catch (\Throwable) {
                // fehlerhafte Klasse überspringen statt den Editor lahmzulegen
            }
        }
        // zuerst Klassen aus Projekt und AddOns, dann die mitgelieferten, soweit nicht ersetzt
        $result = [];
        foreach ([false, true] as $builtin) {
            foreach ($profiles as $profile) {
                if ($builtin === $profile->builtin) {
                    $result[$profile->name] ??= $profile;
                }
            }
        }

        return $discovered = $result;
    }

    /**
     * Woher ein Profil aus Code kommt: `project` oder der Name des AddOns – anhand des Speicherorts der Klasse.
     *
     * @param class-string $class
     */
    public static function origin(string $class): string
    {
        $file = (string) new \ReflectionClass($class)->getFileName();
        foreach (\Redaxo\Core\Addon\Addon::getAll() as $addon) {
            $path = rtrim((string) realpath($addon->path), '/') . '/';
            if ('/' !== $path && str_starts_with((string) realpath($file), $path)) {
                return $addon->name;
            }
        }

        return 'project';
    }

    /** Gibt es ein gleichnamiges Profil in der Datenbank, das ein Profil aus Code überdeckt? */
    public static function isShadowed(string $name): bool
    {
        return (self::all()[$name] ?? null)?->isCode() && isset(self::fromDatabase()[$name]);
    }

    public static function get(string $name): ?Profile
    {
        return self::all()[$name] ?? null;
    }

    /** Das Profil oder – wenn es fehlt – das erste vorhandene bzw. die Voreinstellung */
    public static function getOrDefault(?string $name): Profile
    {
        return (null !== $name ? self::get($name) : null)
            ?? self::get(self::DEFAULT)
            ?? (self::all() ? self::all()[array_key_first(self::all())] : new Profile(self::DEFAULT, 'Standard'));
    }

    public static function exists(string $name): bool
    {
        return null !== self::get($name);
    }

    public static function save(Profile $profile, ?string $previousName = null): void
    {
        if (self::get($profile->name)?->isCode() || (null !== $previousName && self::get($previousName)?->isCode())) {
            throw new RuntimeException('Profile "' . $profile->name . '" is defined in code (' . self::get($profile->name)?->class . ') and can not be changed here.');
        }
        $user = Core::getUser()->login ?? 'console';
        $now = date('Y-m-d H:i:s');
        $config = json_encode($profile->config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $rows = self::fromDatabase();
        $existing = null !== $previousName && isset($rows[$previousName]) ? $previousName : (isset($rows[$profile->name]) ? $profile->name : null);

        $sql = Sql::factory()->setTable(self::TABLE);
        $sql->setValue('name', $profile->name);
        $sql->setValue('label', $profile->label);
        $sql->setValue('description', $profile->description);
        $sql->setValue('mode', $profile->mode->value);
        $sql->setValue('config', $config);
        $sql->setValue('updatedate', $now);
        $sql->setValue('updateuser', $user);
        if (null !== $existing) {
            if ($existing !== $profile->name && isset($rows[$profile->name])) {
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
        if (self::get($name)?->isCode()) {
            throw new RuntimeException('Profile "' . $name . '" is defined in code and can not be deleted here.');
        }
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

    /**
     * PHP-Klasse für ein Profil (zum Einchecken ins Projekt).
     *
     * @param string $namespace z. B. `Project\\Tiptap`
     */
    public static function toPhp(Profile $profile, string $namespace = 'Project\\Tiptap', ?string $className = null): string
    {
        // Klassenname ohne Kennung: tiptap.news → NewsProfile
        $short = null === $profile->prefix() ? $profile->name : substr($profile->name, strlen($profile->prefix()) + 1);
        $className ??= str_replace(' ', '', ucwords(str_replace(['-', '_', '.'], ' ', $short))) . 'Profile';
        // nur, was von den Voreinstellungen abweicht – kürzer und besser zu lesen
        $config = self::diff($profile->config, Profile::normalize([], $profile->mode));
        $config = ['toolbar' => $profile->config['toolbar']] + $config;
        $args = [self::phpValue($profile->name), self::phpValue($profile->label)];
        if (Mode::Html !== $profile->mode) {
            $args[] = 'mode: Mode::' . $profile->mode->name;
        }
        if ('' !== $profile->description) {
            $args[] = 'description: ' . self::phpValue($profile->description);
        }

        return "<?php\n\nnamespace {$namespace};\n\n"
            . "use Klxm\\Tiptap\\AsProfile;\n"
            . (Mode::Html !== $profile->mode ? "use Klxm\\Tiptap\\Mode;\n" : '')
            . "use Klxm\\Tiptap\\ProfileDefinition;\nuse Override;\n\n"
            . "#[AsProfile(" . implode(', ', $args) . ")]\n"
            . "final class {$className} extends ProfileDefinition\n{\n"
            . "    #[Override]\n    public function config(): array\n    {\n"
            . '        return ' . self::phpValue($config, 2) . ";\n"
            . "    }\n}\n";
    }

    /**
     * Nur die Werte, die von den Voreinstellungen abweichen – bei Gruppen (link, image, align) je Unterschlüssel.
     *
     * @param array<string, mixed> $values
     * @param array<string, mixed> $defaults
     * @return array<string, mixed>
     */
    private static function diff(array $values, array $defaults): array
    {
        $out = [];
        foreach ($values as $key => $value) {
            $default = $defaults[$key] ?? null;
            if (is_array($value) && is_array($default) && !array_is_list($value) && !array_is_list($default)) {
                $sub = self::diff($value, $default);
                if ([] !== $sub) {
                    $out[$key] = $sub;
                }
            } elseif ($default !== $value) {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    /** Kurze Array-Schreibweise, Listen von Werten in einer Zeile */
    private static function phpValue(mixed $value, int $level = 0): string
    {
        if (is_string($value)) {
            // unsichtbare Zeichen lesbar: "\u{00A0}"
            if (preg_match('/[\x{00A0}\x{00AD}\x{200B}]/u', $value)) {
                return '"' . preg_replace_callback('/[\x{00A0}\x{00AD}\x{200B}]/u', static fn (array $m) => '\\u{' . strtoupper(dechex(mb_ord($m[0]))) . '}', str_replace(['\\', '"', '$'], ['\\\\', '\\"', '\\$'], $value)) . '"';
            }

            return "'" . str_replace(['\\', "'"], ['\\\\', "\\'"], $value) . "'";
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (null === $value) {
            return 'null';
        }
        if (!is_array($value)) {
            return (string) $value;
        }
        if ([] === $value) {
            return '[]';
        }
        $list = array_is_list($value);
        $scalars = $list && [] === array_filter($value, static fn ($v) => is_array($v));
        if ($scalars) {
            return '[' . implode(', ', array_map(static fn ($v) => self::phpValue($v), $value)) . ']';
        }
        $pad = str_repeat('    ', $level + 1);
        $lines = [];
        foreach ($value as $k => $v) {
            $lines[] = $pad . ($list ? '' : self::phpValue($k) . ' => ') . self::phpValue($v, $level + 1) . ',';
        }

        return "[\n" . implode("\n", $lines) . "\n" . str_repeat('    ', $level) . ']';
    }

    /** @param list<string> $names neue Reihenfolge */
    public static function sort(array $names): void
    {
        foreach ($names as $i => $name) {
            Sql::factory()->setQuery('UPDATE ' . self::TABLE . ' SET prio = ? WHERE name = ?', [$i + 1, $name]);
        }
        self::$cache = null;
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
