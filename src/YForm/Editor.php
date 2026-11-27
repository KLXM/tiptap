<?php

namespace Klxm\Tiptap\YForm;

use Klxm\Tiptap\Profiles;
use Klxm\Tiptap\Tiptap;
use Override;
use Yakamara\YForm\Data\Record;
use Yakamara\YForm\Field\Textarea;

use function html_entity_decode;
use function mb_strlen;
use function mb_substr;
use function preg_replace;
use function strip_tags;
use function trim;

use const ENT_HTML5;
use const ENT_QUOTES;

/**
 * YForm-6-Feld mit TipTap-Editor (Tabellen und Formulare, Backend und Frontend).
 *
 *     yield Editor::new('text')->label('Text')->profile('tiptap.simple');
 *
 * Speichert HTML oder Markdown je nach Profil, bereinigt die Eingabe auf dem Server.
 */
class Editor extends Textarea
{
    public protected(set) string $profile = Profiles::DEFAULT;

    #[Override]
    protected function init(): void
    {
        parent::init();
        $this->attributes(['data-tiptap' => $this->profile]);
    }

    /** Name des Editor-Profils */
    public function profile(string $profile): static
    {
        $this->profile = $profile;
        $this->attributes(['data-tiptap' => $profile]);

        return $this;
    }

    #[Override]
    public function fromInput(mixed $input): mixed
    {
        $value = parent::fromInput($input);
        if (null === $value) {
            return null;
        }
        $value = Tiptap::sanitize((string) $value, $this->profile);

        return '' === trim(strip_tags($value, '<img><hr><table>')) ? null : $value;
    }

    #[Override]
    public function textValue(mixed $value): string
    {
        return self::plain((string) $value);
    }

    #[Override]
    public function listValue(mixed $value, Record $record): string
    {
        $text = self::plain((string) $value);

        return \Redaxo\Core\View\escape(mb_strlen($text) > 80 ? mb_substr($text, 0, 80) . '…' : $text);
    }

    private static function plain(string $html): string
    {
        $html = (string) preg_replace('~</(p|h[1-6]|li|blockquote|tr)>~i', '$0 ', $html);

        return trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5)));
    }
}
