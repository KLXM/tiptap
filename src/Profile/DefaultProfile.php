<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;
use Redaxo\Core\Translation\I18n;
use Redaxo\Core\Translation\Translatable;

/** Shipped: all important tools for editorial texts – also the default when no profile is given. */
#[AsProfile('tiptap.default', new Translatable('tiptap_profile_default'), description: new Translatable('tiptap_profile_default_desc'), priority: -40)]
final class DefaultProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['undo', 'redo'],
                ['heading', 'blockStyle'],
                ['bold', 'italic', 'underline', 'strike', 'highlight'],
                ['bulletList', 'orderedList', 'listStyle', 'blockquote'],
                ['align'],
                ['link', 'unlink', 'image', 'table', 'horizontalRule', 'specialChars'],
                ['subscript', 'superscript', 'code', 'clearFormatting'],
                ['source', 'fullscreen'],
            ],
            'blockStyles' => [
                ['label' => I18n::rawMsg('tiptap_style_lead'), 'class' => 'lead', 'element' => 'p'],
                ['label' => I18n::rawMsg('tiptap_style_small'), 'class' => 'small', 'element' => 'p'],
            ],
            'listStyles' => [
                ['label' => I18n::rawMsg('tiptap_style_outline'), 'class' => 'list-outline', 'list' => 'ol'],
                ['label' => I18n::rawMsg('tiptap_style_check'), 'class' => 'list-check', 'list' => 'ul'],
                ['label' => I18n::rawMsg('tiptap_style_plain'), 'class' => 'list-plain', 'list' => 'both'],
            ],
            'linkStyles' => [
                ['label' => I18n::rawMsg('tiptap_style_button'), 'class' => 'btn btn--primary'],
            ],
            'image' => [
                'styles' => [
                    ['label' => I18n::rawMsg('tiptap_style_img_left'), 'class' => 'img-left'],
                    ['label' => I18n::rawMsg('tiptap_style_img_right'), 'class' => 'img-right'],
                    ['label' => I18n::rawMsg('tiptap_style_img_center'), 'class' => 'img-center'],
                    ['label' => I18n::rawMsg('tiptap_style_img_full'), 'class' => 'img-full'],
                ],
            ],
        ];
    }
}
