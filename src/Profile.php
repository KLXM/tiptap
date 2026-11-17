<?php

namespace Klxm\Tiptap;

use InvalidArgumentException;

use function array_filter;
use function array_intersect;
use function array_key_exists;
use function array_map;
use function array_slice;
use function array_unique;
use function array_values;
use function explode;
use function implode;
use function in_array;
use function is_array;
use function is_bool;
use function is_int;
use function is_numeric;
use function is_string;
use function max;
use function min;
use function mb_substr;
use function preg_match;
use function preg_replace;
use function sort;
use function strpos;
use function strtolower;
use function substr;
use function trim;

/**
 * Ein Editor-Profil: Speicherformat, Toolbar und Einstellungen.
 *
 * Die Einstellungen werden beim Anlegen normalisiert – was hier steht, ist gültig und vollständig; so kann ein Import
 * aus einer fremden Installation nichts Unerwartetes einschleusen.
 */
final readonly class Profile
{
    /** Name mit optionaler Paket-Kennung, z. B. `default`, `project.news`, `fluid.text` */
    public const string NAME_PATTERN = '/^[a-z0-9][a-z0-9_-]{0,63}(\.[a-z0-9][a-z0-9_-]{0,63})?$/';

    /** Voreinstellungen eines leeren Profils */
    public const array DEFAULTS = [
        'toolbar' => [['undo', 'redo'], ['heading'], ['bold', 'italic'], ['bulletList', 'orderedList'], ['link']],
        'headings' => [2, 3, 4],
        'blockStyles' => [],
        'inlineStyles' => [],
        // Zählweisen nummerierter Listen (HTML-Attribut type), Listenformate (Klassen), Linkformate (Klassen)
        'listTypes' => ['1', 'a', 'A', 'i', 'I'],
        'listStyles' => [],
        'linkStyles' => [],
        'align' => ['left' => 'text-left', 'center' => 'text-center', 'right' => 'text-right', 'justify' => 'text-justify'],
        'link' => ['internal' => true, 'media' => true, 'external' => true, 'mailto' => true, 'tel' => true, 'targetBlank' => true, 'records' => []],
        'image' => ['types' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'], 'external' => false, 'mediaTypes' => [], 'mediaType' => '', 'styles' => []],
        'specialChars' => ['–', '—', '…', '„', '“', '‚', '‘', '«', '»', '€', '©', '®', '™', '§', '°', '±', '×', '÷', '½', '→', '←', '✓', "\u{00A0}", "\u{00AD}"],
        'minHeight' => 180,
        'maxHeight' => 0,
        'placeholder' => '',
        'maxLength' => 0,
        'counter' => true,
        'stickyToolbar' => true,
        'contentClass' => '',
        'pasteText' => false,
    ];

    public function __construct(
        public string $name,
        public string $label,
        public Mode $mode = Mode::Html,
        public string $description = '',
        /** @var array<string, mixed> normalisiert, siehe {@see self::DEFAULTS} */
        public array $config = self::DEFAULTS,
        /** @var class-string<ProfileDefinition>|null Klasse, wenn das Profil aus Code kommt ({@see AsProfile}) */
        public ?string $class = null,
    ) {
        if (!preg_match(self::NAME_PATTERN, $name)) {
            throw new InvalidArgumentException('Invalid profile name "' . $name . '".');
        }
    }

    /**
     * Aus einem Array, wie es der Builder schickt oder der Export schreibt.
     *
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
        $mode = Mode::tryFrom(is_string($data['mode'] ?? null) ? $data['mode'] : '') ?? Mode::Html;
        $label = is_string($data['label'] ?? null) && '' !== trim($data['label']) ? trim($data['label']) : $name;

        return new self(
            $name,
            mb_substr($label, 0, 191),
            $mode,
            is_string($data['description'] ?? null) ? mb_substr(trim($data['description']), 0, 1000) : '',
            self::normalize(is_array($data['config'] ?? null) ? $data['config'] : [], $mode),
        );
    }

    /**
     * Export-Format (ohne Datenbank-IDs).
     *
     * @return array{name: string, label: string, description: string, mode: string, config: array<string, mixed>}
     */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'label' => $this->label,
            'description' => $this->description,
            'mode' => $this->mode->value,
            'config' => $this->config,
        ];
    }

    public function withName(string $name, ?string $label = null): self
    {
        return new self($name, $label ?? $this->label, $this->mode, $this->description, $this->config);
    }

    /** Paket-Kennung aus dem Namen (`fluid` bei `fluid.text`), null ohne Kennung */
    public function prefix(): ?string
    {
        $pos = strpos($this->name, '.');

        return false === $pos ? null : substr($this->name, 0, $pos);
    }

    /** Kommt das Profil aus einer PHP-Klasse (schreibgeschützt im Backend)? */
    public function isCode(): bool
    {
        return null !== $this->class;
    }

    /**
     * Alle Werkzeug-IDs der Toolbar.
     *
     * @return list<string>
     */
    public function items(): array
    {
        $ids = [];
        foreach ($this->config['toolbar'] as $group) {
            foreach ($group as $id) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    public function hasItem(string ...$ids): bool
    {
        return [] !== array_filter($ids, fn (string $id) => in_array($id, $this->items(), true));
    }

    /**
     * Konfiguration für das Skript (data-config des Elements).
     *
     * @return array<string, mixed>
     */
    public function clientConfig(): array
    {
        return ['name' => $this->name, 'mode' => $this->mode->value] + $this->config;
    }

    /**
     * Bringt Einstellungen in eine gültige, vollständige Form.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function normalize(array $config, Mode $mode = Mode::Html): array
    {
        $d = self::DEFAULTS;
        $out = [];

        // Toolbar: Gruppen aus Werkzeug-IDs; im Markdown-Modus nur, was sich als Markdown speichern lässt
        $toolbar = [];
        foreach (is_array($config['toolbar'] ?? null) ? $config['toolbar'] : $d['toolbar'] as $group) {
            if (!is_array($group)) {
                continue;
            }
            $ids = [];
            foreach ($group as $id) {
                if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_:-]{1,64}$/', $id) || in_array($id, $ids, true)) {
                    continue;
                }
                if (Mode::Markdown === $mode && false === Registry::item($id)?->markdown) {
                    continue;
                }
                $ids[] = $id;
            }
            if ($ids) {
                $toolbar[] = $ids;
            }
        }
        $out['toolbar'] = array_slice($toolbar, 0, 20);

        $headings = array_values(array_unique(array_filter(
            array_map(static fn ($h) => is_numeric($h) ? (int) $h : 0, is_array($config['headings'] ?? null) ? $config['headings'] : $d['headings']),
            static fn (int $h) => $h >= 1 && $h <= 6,
        )));
        sort($headings);
        $out['headings'] = $headings ?: $d['headings'];

        $out['blockStyles'] = Mode::Markdown === $mode ? [] : self::styles($config['blockStyles'] ?? [], true);
        $out['inlineStyles'] = Mode::Markdown === $mode ? [] : self::styles($config['inlineStyles'] ?? [], false);

        $types = is_array($config['listTypes'] ?? null) ? $config['listTypes'] : $d['listTypes'];
        $out['listTypes'] = Mode::Markdown === $mode ? ['1'] : (array_values(array_intersect($d['listTypes'], array_map('strval', $types))) ?: ['1']);
        $out['listStyles'] = [];
        if (Mode::Html === $mode) {
            foreach (is_array($config['listStyles'] ?? null) ? $config['listStyles'] : [] as $raw) {
                $style = is_array($raw) ? self::styles([$raw], false)[0] ?? null : null;
                if (null !== $style) {
                    $list = $raw['list'] ?? 'both';
                    $style['list'] = in_array($list, ['ol', 'ul', 'both'], true) ? $list : 'both';
                    $out['listStyles'][] = $style;
                }
            }
        }
        $out['linkStyles'] = Mode::Markdown === $mode ? [] : self::styles($config['linkStyles'] ?? [], false);

        $align = is_array($config['align'] ?? null) ? $config['align'] : [];
        foreach ($d['align'] as $key => $default) {
            $class = self::classList(is_string($align[$key] ?? null) ? $align[$key] : $default);
            $out['align'][$key] = '' === $class ? $default : $class;
        }

        $link = is_array($config['link'] ?? null) ? $config['link'] : [];
        foreach ($d['link'] as $key => $default) {
            if ('records' !== $key) {
                $out['link'][$key] = (bool) ($link[$key] ?? $default);
            }
        }
        // YForm-Tabellen, deren Datensätze sich verlinken lassen
        $out['link']['records'] = self::names($link['records'] ?? []);
        $image = is_array($config['image'] ?? null) ? $config['image'] : [];
        $mediaTypes = self::names($image['mediaTypes'] ?? []);
        $mediaType = is_string($image['mediaType'] ?? null) && in_array($image['mediaType'], $mediaTypes, true) ? $image['mediaType'] : '';
        $out['image'] = [
            'types' => self::extensions($image['types'] ?? null) ?: $d['image']['types'],
            'external' => (bool) ($image['external'] ?? $d['image']['external']),
            // Mediamanager-Typen zur Auswahl im Bild-Dialog, Voreinstellung ('' = Originaldatei)
            'mediaTypes' => $mediaTypes,
            'mediaType' => $mediaType,
            // Bildformate: Klassen am <img> (z. B. links umflossen, volle Breite)
            'styles' => self::styles($image['styles'] ?? [], false),
        ];

        $chars = is_array($config['specialChars'] ?? null) ? $config['specialChars'] : $d['specialChars'];
        $out['specialChars'] = array_values(array_unique(array_filter(
            array_map(static fn ($c) => is_string($c) ? mb_substr($c, 0, 4) : '', $chars),
            static fn (string $c) => '' !== $c,
        ))) ?: $d['specialChars'];

        $out['minHeight'] = self::int($config['minHeight'] ?? null, $d['minHeight'], 60, 2000);
        $out['maxHeight'] = self::int($config['maxHeight'] ?? null, $d['maxHeight'], 0, 4000);
        $out['maxLength'] = self::int($config['maxLength'] ?? null, $d['maxLength'], 0, 1_000_000);
        $out['placeholder'] = is_string($config['placeholder'] ?? null) ? mb_substr(trim($config['placeholder']), 0, 191) : '';
        $out['contentClass'] = self::classList(is_string($config['contentClass'] ?? null) ? $config['contentClass'] : '');
        foreach (['counter', 'stickyToolbar', 'pasteText'] as $key) {
            $out[$key] = array_key_exists($key, $config) ? (bool) $config[$key] : $d[$key];
        }

        return $out;
    }

    /** @return list<array{label: string, class: string, element?: string, list?: string}> */
    private static function styles(mixed $styles, bool $block): array
    {
        if (!is_array($styles)) {
            return [];
        }
        $out = [];
        foreach ($styles as $style) {
            if (!is_array($style)) {
                continue;
            }
            $class = self::classList(is_string($style['class'] ?? null) ? $style['class'] : '');
            $label = is_string($style['label'] ?? null) ? mb_substr(trim($style['label']), 0, 80) : '';
            if ('' === $class) {
                continue;
            }
            $entry = ['label' => '' === $label ? $class : $label, 'class' => $class];
            if ($block) {
                // Blockformate gelten für Absätze oder bestimmte Elemente
                $element = is_string($style['element'] ?? null) ? $style['element'] : 'p';
                $entry['element'] = in_array($element, ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'table'], true) ? $element : 'p';
            }
            $out[] = $entry;
        }

        return array_slice($out, 0, 50);
    }

    /** Klassennamen (durch Leerzeichen getrennt) auf sichere Zeichen beschränken */
    public static function classList(string $classes): string
    {
        $list = array_filter(
            explode(' ', (string) preg_replace('/\s+/', ' ', trim($classes))),
            static fn (string $c) => 1 === preg_match('/^-?[_a-zA-Z][_a-zA-Z0-9-]{0,63}$/', $c),
        );

        return implode(' ', array_values(array_unique($list)));
    }

    /**
     * Liste von Namen (Tabellen, Mediamanager-Typen): nur sichere Zeichen.
     *
     * @return list<string>
     */
    private static function names(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        return array_slice(array_values(array_unique(array_filter($value, static fn ($v) => is_string($v) && 1 === preg_match('/^[a-zA-Z0-9_.-]{1,100}$/', $v)))), 0, 100);
    }

    /** @return list<string> */
    private static function extensions(mixed $value): array
    {
        $list = is_array($value) ? $value : explode(',', is_string($value) ? $value : '');

        return array_values(array_unique(array_filter(
            array_map(static fn ($e) => is_string($e) ? (string) preg_replace('/[^a-z0-9]/', '', strtolower($e)) : '', $list),
            static fn (string $e) => '' !== $e,
        )));
    }

    private static function int(mixed $value, int $default, int $min, int $max): int
    {
        if (!is_int($value) && !is_numeric($value)) {
            return $default;
        }

        return max($min, min($max, (int) $value));
    }
}
