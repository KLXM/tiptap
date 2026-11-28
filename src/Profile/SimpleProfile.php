<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsTiptapProfile;
use Klxm\Tiptap\ProfileDefinition;
use Override;
use Redaxo\Core\Translation\Translatable;

/** Shipped: bold, italic, lists and links – for short texts and collections. */
#[AsTiptapProfile('tiptap.simple', new Translatable('tiptap_profile_simple'), description: new Translatable('tiptap_profile_simple_desc'), priority: -30)]
final class SimpleProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['bold', 'italic'],
                ['bulletList', 'orderedList'],
                ['link', 'unlink'],
                ['undo', 'redo'],
            ],
            'minHeight' => 100,
            'counter' => false,
        ];
    }
}
