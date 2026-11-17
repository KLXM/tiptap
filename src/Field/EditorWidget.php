<?php

namespace FriendsOfRedaxo\Tiptap\Field;

use FriendsOfRedaxo\Tiptap\Profile;
use FriendsOfRedaxo\Tiptap\Tiptap;
use Redaxo\Core\Form\Widget\Widget;
use Redaxo\Core\View\Html;
use Redaxo\Core\View\HtmlAttributes;

use function Redaxo\Core\View\escape;

/** `<rex-tiptap>` mit der Textarea, die den Wert trägt (ohne Skript bleibt sie benutzbar) */
final class EditorWidget implements Widget
{
    public function __construct(
        public string $name,
        public ?string $value,
        public Profile $profile,
        public ?string $id = null,
        public bool $required = false,
        public bool $disabled = false,
        public HtmlAttributes $attributes = new HtmlAttributes(),
    ) {}

    public function labelTarget(): ?string
    {
        return $this->id;
    }

    public function render(): Html
    {
        $element = new HtmlAttributes([
            'data-config' => Tiptap::configJson($this->profile),
            'data-label-for' => $this->id,
        ]);
        $textarea = $this->attributes->with([
            'class' => ['rex-input', 'rex-tiptap-source'],
            'name' => $this->name,
            'id' => $this->id,
            'rows' => 8,
            'disabled' => $this->disabled,
            'data-tiptap-required' => $this->required,
        ]);

        return Html::raw('<rex-tiptap ' . $element . '><textarea ' . $textarea . '>' . escape((string) $this->value) . '</textarea></rex-tiptap>');
    }
}
