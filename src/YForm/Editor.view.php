<?php

use FriendsOfRedaxo\Tiptap\YForm\Editor;
use Yakamara\YForm\Form\FieldContext;

use function Redaxo\Core\View\escape;

return static function (Editor $field, FieldContext $context): void {
    echo '<textarea ', $field->controlAttributes($context, ['rows' => $field->rows]), '>',
    escape((string) $context->value), '</textarea>';
};
