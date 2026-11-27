/*
 Source view with highlighting (CodeMirror 6): Markdown looks like formatted text, the syntax characters
 stay visible (# ** > …); HTML with highlighted tags. Loaded only when someone opens the view.
 */

import {EditorState} from '@codemirror/state';
import {EditorView, keymap, drawSelection, highlightActiveLine, placeholder as cmPlaceholder} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {HighlightStyle, Language, LRLanguage, LanguageSupport, defineLanguageFacet, syntaxHighlighting, indentOnInput, bracketMatching} from '@codemirror/language';
// Markdown (CommonMark + GFM) directly from @lezer/markdown – @codemirror/lang-markdown would bring HTML, JavaScript and CSS
import {parser as markdownParser, GFM} from '@lezer/markdown';

const markdownLanguage = new Language(defineLanguageFacet({commentTokens: {block: {open: '<!--', close: '-->'}}}), markdownParser.configure(GFM), [], 'markdown');
// HTML only – without the embedded JavaScript and CSS languages of @codemirror/lang-html
import {parser as htmlParser} from '@lezer/html';

const html = () => new LanguageSupport(LRLanguage.define({name: 'html', parser: htmlParser}));
import {tags} from '@lezer/highlight';

const markdownStyle = HighlightStyle.define([
    {tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', lineHeight: '1.3'},
    {tag: tags.heading2, fontSize: '1.4em', fontWeight: '700', lineHeight: '1.3'},
    {tag: tags.heading3, fontSize: '1.2em', fontWeight: '700'},
    {tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '700'},
    {tag: tags.strong, fontWeight: '700'},
    {tag: tags.emphasis, fontStyle: 'italic'},
    {tag: tags.strikethrough, textDecoration: 'line-through'},
    {tag: tags.link, color: 'var(--_accent)', textDecoration: 'underline'},
    {tag: tags.url, color: 'var(--_muted)'},
    {tag: tags.quote, color: 'var(--_muted)', fontStyle: 'italic'},
    {tag: tags.monospace, fontFamily: 'var(--_mono)', fontSize: '.9em', background: 'var(--_surface)', borderRadius: '3px'},
    // tone down syntax characters (#, *, >, [ ], `)
    {tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--_muted)', fontWeight: '400'},
]);

const htmlStyle = HighlightStyle.define([
    {tag: [tags.tagName, tags.angleBracket], color: 'var(--rex-tiptap-code-tag, #1d5fbf)'},
    {tag: tags.attributeName, color: 'var(--rex-tiptap-code-attr, #8a4baf)'},
    {tag: tags.attributeValue, color: 'var(--rex-tiptap-code-value, #2f7d32)'},
    {tag: tags.comment, color: 'var(--_muted)', fontStyle: 'italic'},
    {tag: tags.content, color: 'var(--_text)'},
]);

/** Page nonce for the styles CodeMirror inserts (Content Security Policy) */
function nonce() {
    return document.querySelector('script[nonce]')?.nonce || document.querySelector('style[nonce]')?.nonce || '';
}

/**
 * Creates the view.
 *
 * @param {{parent: HTMLElement, doc: string, mode: 'markdown'|'html', label: string, placeholder?: string, onChange: (value: string) => void, onSave?: () => void}} options
 */
export function createCodeView({parent, doc, mode, label, placeholder, onChange}) {
    const isMarkdown = 'markdown' === mode;
    const extensions = [
        history(),
        drawSelection(),
        highlightActiveLine(),
        indentOnInput(),
        bracketMatching(),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        isMarkdown ? new LanguageSupport(markdownLanguage) : html(),
        syntaxHighlighting(isMarkdown ? markdownStyle : htmlStyle),
        EditorView.contentAttributes.of({'aria-label': label, 'aria-multiline': 'true', spellcheck: isMarkdown ? 'true' : 'false'}),
        EditorView.updateListener.of(update => {
            if (update.docChanged) {
                onChange(update.state.doc.toString());
            }
        }),
        EditorView.theme({
            '&': {height: '100%', background: 'transparent', color: 'var(--_text)'},
            '&.cm-focused': {outline: 'none'},
            '.cm-scroller': {
                fontFamily: isMarkdown ? 'inherit' : 'var(--_mono)',
                fontSize: isMarkdown ? '15px' : '13px',
                lineHeight: isMarkdown ? '1.6' : '1.55',
            },
            '.cm-content': {padding: '12px 16px', caretColor: 'var(--_text)'},
            '.cm-activeLine': {background: 'color-mix(in srgb, var(--_accent) 6%, transparent)'},
            '.cm-cursor': {borderLeftColor: 'var(--_text)'},
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {background: 'color-mix(in srgb, var(--_accent) 25%, transparent) !important'},
            '.cm-placeholder': {color: 'var(--_muted)'},
        }),
    ];
    if (placeholder) {
        extensions.push(cmPlaceholder(placeholder));
    }
    const n = nonce();
    if (n) {
        extensions.push(EditorView.cspNonce.of(n));
    }

    return new EditorView({
        state: EditorState.create({doc, extensions}),
        parent,
    });
}
