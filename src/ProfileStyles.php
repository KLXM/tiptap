<?php

namespace Klxm\Tiptap;

use Redaxo\Core\ClassDiscovery;
use Redaxo\Core\Translation\Translatable;
use Throwable;
use WeakMap;

use function array_slice;
use function in_array;
use function is_array;
use function preg_match;
use function str_contains;
use function str_ends_with;
use function str_starts_with;
use function substr;
use function usort;

/**
 * Adds the text formats registered with {@see AsStyles} to a profile at runtime.
 *
 * @internal
 */
final class ProfileStyles
{
    public const array KEYS = ['blockStyles', 'inlineStyles', 'listStyles', 'linkStyles'];

    /** @var list<array{AsStyles, StyleDefinition, class-string}>|null */
    private static ?array $definitions = null;

    /** @var WeakMap<Profile, Profile>|null */
    private static ?WeakMap $applied = null;

    /** The profile with the registered formats (the same object if none apply) */
    public static function apply(Profile $profile): Profile
    {
        self::$applied ??= new WeakMap();
        if (isset(self::$applied[$profile])) {
            return self::$applied[$profile];
        }
        $result = $profile;
        if (Mode::Html === $profile->mode) {
            $config = $profile->config;
            $changed = false;
            foreach (self::for($profile) as $definition) {
                try {
                    $styles = $definition->styles();
                } catch (Throwable) {
                    continue;
                }
                foreach (self::KEYS as $key) {
                    $known = [];
                    foreach ($config[$key] as $style) {
                        $known[$style['class'] . '|' . ($style['element'] ?? $style['list'] ?? '')] = true;
                    }
                    foreach (is_array($styles[$key] ?? null) ? $styles[$key] : [] as $style) {
                        $id = is_array($style) ? ($style['class'] ?? '') . '|' . ($style['element'] ?? $style['list'] ?? '') : '';
                        if (is_array($style) && !isset($known[$id])) {
                            $config[$key][] = $style;
                            $known[$id] = $changed = true;
                        }
                    }
                }
            }
            if ($changed) {
                $normalized = Profile::normalize($config, $profile->mode);
                foreach (self::KEYS as $key) {
                    $config[$key] = array_slice($normalized[$key], 0, 50);
                }
                $result = new Profile($profile->name, $profile->label, $profile->mode, $profile->description, $config, $profile->class, $profile->builtin);
            }
        }
        self::$applied[$profile] = $result;
        self::$applied[$result] = $result;

        return $result;
    }

    /**
     * Style classes that apply to a profile.
     *
     * @return list<StyleDefinition>
     */
    public static function for(Profile $profile): array
    {
        $out = [];
        foreach (self::definitions() as [$attr, $definition]) {
            if (self::matches($attr->profiles, $profile->name) && $definition->applies($profile)) {
                $out[] = $definition;
            }
        }

        return $out;
    }

    /**
     * Names of the style classes that apply to a profile, for the backend.
     *
     * @return array<string, string> key => name
     */
    public static function names(Profile $profile): array
    {
        $out = [];
        foreach (self::definitions() as [$attr, $definition]) {
            if (Mode::Html === $profile->mode && self::matches($attr->profiles, $profile->name) && $definition->applies($profile)) {
                $out[$attr->key] = Translatable::text($attr->name);
            }
        }

        return $out;
    }

    /** @param list<string> $patterns */
    private static function matches(array $patterns, string $name): bool
    {
        if ([] === $patterns || in_array($name, $patterns, true)) {
            return true;
        }
        foreach ($patterns as $pattern) {
            if (str_ends_with($pattern, '.*') && str_starts_with($name, substr($pattern, 0, -1))) {
                return true;
            }
        }

        return false;
    }

    /** @return list<array{AsStyles, StyleDefinition, class-string}> */
    private static function definitions(): array
    {
        if (null !== self::$definitions) {
            return self::$definitions;
        }
        $byKey = [];
        foreach (ClassDiscovery::getInstance()->discoverByAttribute(AsStyles::class, StyleDefinition::class) as $class => $attr) {
            if (!preg_match(Profile::NAME_PATTERN, $attr->key) || !str_contains($attr->key, '.')) {
                continue;
            }
            // the project wins over addons with the same key
            $project = 'project' === Profiles::origin($class);
            if (isset($byKey[$attr->key]) && (!$project || $byKey[$attr->key][3])) {
                continue;
            }
            try {
                $byKey[$attr->key] = [$attr, new $class(), $class, $project];
            } catch (Throwable) {
                // skip a broken class instead of crippling the editor
            }
        }
        $found = [];
        foreach ($byKey as [$attr, $definition, $class]) {
            $found[] = [$attr, $definition, $class];
        }
        usort($found, static fn (array $a, array $b): int => [$a[0]->priority, $a[0]->key] <=> [$b[0]->priority, $b[0]->key]);

        return self::$definitions = $found;
    }
}
