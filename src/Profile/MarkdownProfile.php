<?php

namespace Klxm\Tiptap\Profile;

use Klxm\Tiptap\AsProfile;
use Klxm\Tiptap\Mode;
use Klxm\Tiptap\ProfileDefinition;
use Override;
use Redaxo\Core\Translation\Translatable;

/** Shipped: stores Markdown instead of HTML. */
#[AsProfile('tiptap.markdown', 'Markdown', mode: Mode::Markdown, description: new Translatable('tiptap_profile_markdown_desc'), priority: -20)]
final class MarkdownProfile extends ProfileDefinition
{
    #[Override]
    public function config(): array
    {
        return [
            'toolbar' => [
                ['undo', 'redo'],
                ['heading'],
                ['bold', 'italic', 'strike', 'code'],
                ['bulletList', 'orderedList', 'blockquote', 'codeBlock'],
                ['link', 'image', 'table', 'horizontalRule'],
                ['source', 'fullscreen'],
            ],
        ];
    }
}
