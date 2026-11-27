<?php

namespace Klxm\Tiptap\Field;

use Attribute;
use Klxm\Tiptap\Tiptap;
use Override;
use Redaxo\Core\Form\BoundField;
use Redaxo\Core\Form\Field\Field;
use Redaxo\Core\Form\InvalidValueException;
use Redaxo\Core\Form\ValueType;
use Redaxo\Core\Translation\Translatable;
use Redaxo\Core\Util\Type;
use Redaxo\Core\View\Renderable;

use function mb_strlen;
use function strip_tags;
use function trim;

/**
 * Formularfeld mit TipTap-Editor – in Modulen, Collections, Formularen des Cores.
 *
 *     #[Editor('Text', profile: 'tiptap.simple')]
 *     public string $text = '';
 *
 * Gespeichert wird HTML oder Markdown (je nach Profil), beim Speichern nach dem Profil bereinigt.
 */
#[Attribute(Attribute::TARGET_PROPERTY)]
final class Editor extends Field
{
    public function __construct(
        string|Renderable $label,
        string|Renderable|null $note = null,
        bool $required = false,
        ?string $key = null,
        /** Name des Profils (TipTap-Editor → Profile); fehlt es, gilt „tiptap.default“ */
        public readonly ?string $profile = null,
    ) {
        parent::__construct($label, $note, $required, $key);
    }

    #[Override]
    public function supports(ValueType $type): bool
    {
        return $type->isAnyOf('string');
    }

    #[Override]
    public function fromRaw(string|array|null $raw, ValueType $type): ?string
    {
        $value = parent::fromRaw($raw, $type);
        if (null === $value) {
            return null;
        }
        $profile = Tiptap::profile($this->profile);
        $value = Tiptap::sanitize(Type::string($value), $profile);
        // leerer Editor liefert <p></p>
        if ('' === trim(strip_tags($value, '<img><hr><table>'))) {
            $value = '';
        }
        $max = $profile->config['maxLength'];
        if ($max > 0 && mb_strlen(strip_tags($value)) > $max) {
            throw new InvalidValueException(new Translatable('form_max_length', $max));
        }

        return '' === $value && $type->nullable ? null : $value;
    }

    #[Override]
    public function widget(BoundField $field): EditorWidget
    {
        return new EditorWidget($field->inputName, Type::string($field->raw), Tiptap::profile($this->profile), $field->id, $this->required, $field->disabled);
    }
}
