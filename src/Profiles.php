<?php

namespace Klxm\Tiptap;

use JsonException;
use Redaxo\Core\Addon\Addon;
use Redaxo\Core\ClassDiscovery;
use Redaxo\Core\Core;
use Redaxo\Core\Database\Sql;
use ReflectionClass;
use RuntimeException;
use Throwable;

use function array_filter;
use function array_is_list;
use function array_key_first;
use function array_map;
use function date;
use function dechex;
use function implode;
use function is_array;
use function is_bool;
use function is_string;
use function json_decode;
use function json_encode;
use function mb_ord;
use function preg_match;
use function preg_replace_callback;
use function realpath;
use function rtrim;
use function str_repeat;
use function str_replace;
use function str_starts_with;
use function strlen;
use function strtoupper;
use function substr;
use function ucwords;

use const JSON_PRETTY_PRINT;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

/**
 * Storage of the profiles in `rex_tiptap_profile`, import and export.
 */
final class Profiles
{
    public const string TABLE = 'rex_tiptap_profile';
    /** Profile used when none is given (shipped as {@see Profile\DefaultProfile}) */
    public const string DEFAULT = 'tiptap.default';
    /** Marker in the export so an import recognizes foreign JSON files */
    public const string EXPORT_FORMAT = 'redaxo-tiptap-profiles';

    /** @var array<string, Profile>|null */
    private static ?array $cache = null;

    /**
     * All profiles. Order of precedence for equal names:
     *
     * 1. classes from the project and addons ({@see AsProfile}) – binding, read-only in the backend
     * 2. profiles from the database (created or customized in the backend)
     * 3. the profiles shipped with the addon (`tiptap.*`, src/Profile)
     *
     * @return array<string, Profile> by name
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
     * The shipped profiles (classes in the addon itself).
     *
     * @return array<string, Profile>
     */
    public static function builtin(): array
    {
        return array_filter(self::discover(), static fn (Profile $p) => $p->builtin);
    }

    /** Is a profile shipped and customized in the database? */
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
     * Profiles from classes of the project and addons (without the shipped ones).
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
                // classes of other packages win over shipped ones with the same name
                $key = ($builtin ? 'builtin:' : '') . $profile->name;
                $profiles[$key] ??= new Profile($profile->name, $profile->label, $profile->mode, $profile->description, $profile->config, $class, $builtin);
            } catch (Throwable) {
                // skip a broken class instead of crippling the editor
            }
        }
        // first classes from the project and addons, then the shipped ones unless replaced
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
     * Where a profile from code comes from: `project` or the name of the addon – based on the location of the class.
     *
     * @param class-string $class
     */
    public static function origin(string $class): string
    {
        $file = (string) new ReflectionClass($class)->getFileName();
        foreach (Addon::getAll() as $addon) {
            $path = rtrim((string) realpath($addon->path), '/') . '/';
            if ('/' !== $path && str_starts_with((string) realpath($file), $path)) {
                return $addon->name;
            }
        }

        return 'project';
    }

    /** Is there a profile with the same name in the database that is shadowed by a profile from code? */
    public static function isShadowed(string $name): bool
    {
        return (self::all()[$name] ?? null)?->isCode() && isset(self::fromDatabase()[$name]);
    }

    public static function get(string $name): ?Profile
    {
        return self::all()[$name] ?? null;
    }

    /** The profile or – if it is missing – the first existing one or the default */
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

    /** Free name: `name`, `name-2`, `name-3` … */
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
     * Reads an export (also a single profile object).
     *
     * @throws RuntimeException on invalid content
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
     * Imports profiles; existing names are overwritten or renamed.
     *
     * @param list<Profile> $profiles
     * @return list<string> saved names
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
     * PHP class for a profile (to be committed to the project).
     *
     * @param string $namespace e.g. `Project\\Tiptap`
     */
    public static function toPhp(Profile $profile, string $namespace = 'Project\\Tiptap', ?string $className = null): string
    {
        // class name without prefix: tiptap.news → NewsProfile
        $short = null === $profile->prefix() ? $profile->name : substr($profile->name, strlen($profile->prefix()) + 1);
        $className ??= str_replace(' ', '', ucwords(str_replace(['-', '_', '.'], ' ', $short))) . 'Profile';
        // only what differs from the defaults – shorter and easier to read
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
            . '#[AsProfile(' . implode(', ', $args) . ")]\n"
            . "final class {$className} extends ProfileDefinition\n{\n"
            . "    #[Override]\n    public function config(): array\n    {\n"
            . '        return ' . self::phpValue($config, 2) . ";\n"
            . "    }\n}\n";
    }

    /**
     * Only the values that differ from the defaults – for groups (link, image, align) per subkey.
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

    /** Short array syntax, lists of values on one line */
    private static function phpValue(mixed $value, int $level = 0): string
    {
        if (is_string($value)) {
            // invisible characters readable: "\u{00A0}"
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
        } catch (Throwable) {
            return null;
        }
    }
}
