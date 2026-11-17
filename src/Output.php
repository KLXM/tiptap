<?php

namespace FriendsOfRedaxo\Tiptap;

use Redaxo\Core\Content\Article;
use Redaxo\Core\Util\Markdown\Markdown;

use function htmlspecialchars;
use function preg_replace_callback;
use function str_contains;
use function trim;

use const ENT_QUOTES;

/**
 * Ausgabe gespeicherter Inhalte: Markdown wird zu HTML, alles wird nach dem Profil bereinigt und interne Links
 * (`redaxo://ID`) bekommen die aktuelle Adresse des Artikels.
 */
final class Output
{
    public static function render(?string $value, Profile $profile): string
    {
        $value = trim((string) $value);
        if ('' === $value) {
            return '';
        }

        $html = Mode::Markdown === $profile->mode
            ? Markdown::factory()->parse($value, false, false, Sanitizer::config($profile))
            : Sanitizer::clean($value, $profile);

        return self::resolveLinks($html);
    }

    /**
     * Ersetzt `redaxo://ID` (optional `redaxo://ID-SPRACHE` und `#anker`) in href durch die Adresse des Artikels.
     * Kann auch auf beliebiges HTML angewendet werden, z. B. im OUTPUT_FILTER.
     */
    public static function resolveLinks(string $html): string
    {
        if (!str_contains($html, 'redaxo://')) {
            return $html;
        }

        return (string) preg_replace_callback('~(href=["\'])redaxo://(\d+)(?:-(\d+))?(#[^"\']*)?(["\'])~i', static function (array $m): string {
            $article = Article::get((int) $m[2], isset($m[3]) && '' !== $m[3] ? (int) $m[3] : null);
            $url = $article?->isOnline() ? $article->getUrl() : '#';

            return $m[1] . htmlspecialchars($url . ($m[4] ?? ''), ENT_QUOTES) . $m[5];
        }, $html);
    }
}
