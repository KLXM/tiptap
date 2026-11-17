<?php

namespace FriendsOfRedaxo\Tiptap;

use FriendsOfRedaxo\Tiptap\ExtensionPoint\RecordUrl;
use Redaxo\Core\Content\Article;
use Redaxo\Core\ExtensionPoint\Extension;
use Redaxo\Core\Security\User;
use Throwable;
use Yakamara\YForm\Data\Query as RecordQuery;
use Yakamara\YForm\Field\Password;
use Yakamara\YForm\Field\Text;
use Yakamara\YForm\Field\Textarea;
use Yakamara\YForm\Permission\Access;
use Yakamara\YForm\Table\Table;
use Yakamara\YForm\Table\Tables;

use function addcslashes;
use function class_exists;
use function http_build_query;
use function is_array;
use function is_string;
use function parse_str;
use function preg_match;
use function preg_split;
use function str_contains;
use function str_replace;
use function trim;

/**
 * Links auf YForm-Datensätze: `yform://tabelle/id` im Inhalt, Adresse erst bei der Ausgabe – über den Extension
 * Point {@see RecordUrl} oder die Vorlage der Tabelle (Einstellungen), z. B. `redaxo://12?news_id={id}`.
 */
final class RecordLinks
{
    public static function available(): bool
    {
        return class_exists(Tables::class);
    }

    /** @return array<string, string> Tabellenname => Bezeichnung */
    public static function tables(?User $user = null): array
    {
        if (!self::available()) {
            return [];
        }
        $tables = [];
        foreach (Tables::all() as $table) {
            if (null === $user || Access::canView($table, $user)) {
                $tables[$table->name] = $table->label();
            }
        }

        return $tables;
    }

    /**
     * Datensätze einer Tabelle für die Auswahl im Link-Dialog.
     *
     * @return list<array{id: int, label: string}>
     */
    public static function search(string $tableName, string $query, User $user, int $limit = 20): array
    {
        if (!self::available()) {
            return [];
        }
        $table = Tables::find($tableName);
        if (!$table instanceof Table || !Access::canView($table, $user)) {
            return [];
        }
        /** @var RecordQuery $q */
        $q = $table::query()->orderBy('id', 'DESC')->limit($limit);
        $query = trim($query);
        if ('' !== $query) {
            $columns = self::textColumns($table);
            foreach (preg_split('/\s+/u', $query) ?: [] as $word) {
                $like = '%' . addcslashes($word, '%_\\') . '%';
                $id = preg_match('/^\d+$/', $word) ? (int) $word : null;
                $q->whereAny(static function (RecordQuery $any) use ($columns, $like, $id): void {
                    foreach ($columns as $column) {
                        $any->whereLike($column, $like);
                    }
                    if (null !== $id) {
                        $any->where('id', $id);
                    }
                });
            }
        }
        $list = [];
        foreach ($q->find() as $record) {
            $list[] = ['id' => (int) $record->id, 'label' => $table->recordLabel($record)];
        }

        return $list;
    }

    /** Bezeichnung eines Datensatzes (für den Link-Dialog) */
    public static function label(string $tableName, int $id): ?string
    {
        if (!self::available()) {
            return null;
        }
        try {
            $table = Tables::find($tableName);
            $record = $table ? $table::find($id) : null;

            return $table && $record ? $table->recordLabel($record) : null;
        } catch (Throwable) {
            return null;
        }
    }

    /** Adresse des Datensatzes für die Ausgabe, '#' wenn keine bekannt ist */
    public static function url(string $table, int $id): string
    {
        $templates = TiptapAddon::instance()->getConfig('record_urls', []);
        $template = is_array($templates) && is_string($templates[$table] ?? null) ? trim($templates[$table]) : '';
        $url = '' === $template ? null : self::fromTemplate($template, $id);

        return Extension::dispatch(new RecordUrl($table, $id, $url)) ?? '#';
    }

    /** `redaxo://12?news_id={id}` → Adresse des Artikels mit Parameter, sonst `{id}` ersetzen */
    private static function fromTemplate(string $template, int $id): string
    {
        $template = str_replace('{id}', (string) $id, $template);
        if (!preg_match('~^redaxo://(\d+)(?:-(\d+))?(?:\?([^#]*))?(#.*)?$~', $template, $m)) {
            return $template;
        }
        $article = Article::get((int) $m[1], isset($m[2]) && '' !== $m[2] ? (int) $m[2] : null);
        if (!$article?->isOnline()) {
            return '#';
        }
        $params = [];
        if (isset($m[3]) && '' !== $m[3]) {
            parse_str($m[3], $params);
        }

        return $article->getUrl($params) . ($m[4] ?? '');
    }

    /** @return list<string> */
    private static function textColumns(Table $table): array
    {
        $columns = [];
        foreach ($table->storedFields() as $field) {
            if ($field instanceof Password || (!$field instanceof Text && !$field instanceof Textarea)) {
                continue;
            }
            foreach ($field->columns() as $column) {
                $columns[] = $column->name;
            }
        }

        return $columns;
    }
}
