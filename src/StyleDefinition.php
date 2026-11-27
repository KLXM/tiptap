<?php

namespace Klxm\Tiptap;

/**
 * Base class for text formats from code, see {@see AsTiptapStyles}.
 *
 * `styles()` returns the format keys of a profile config: `blockStyles`, `inlineStyles`, `listStyles`, `linkStyles`
 * (same structure as in {@see Profile::DEFAULTS}). A format only shows where the profile has the tool for it
 * (`blockStyle`, `inlineStyle`, lists, `link`) – the toolbar stays the profile's decision.
 */
abstract class StyleDefinition
{
    /**
     * Formats by key: `blockStyles`, `inlineStyles`, `listStyles`, `linkStyles` – each a list of
     * `['label' => …, 'class' => …]` (block formats also `element`, list formats also `list`).
     *
     * @return array<string, mixed>
     */
    abstract public function styles(): array;

    /** Decides at runtime whether the formats apply to a profile (after the names in {@see AsTiptapStyles}) */
    public function applies(Profile $profile): bool
    {
        return true;
    }
}
