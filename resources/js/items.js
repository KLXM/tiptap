/* Built-in toolbar tools. A tool: {label, icon, run?, active?, enabled?, menu?, current?} */

import {t} from './i18n.js';
import {blockHasClass, CLASS_NODES, mediaSrc, nearestList, nodeOfElement, picker, updateNearestList} from './extensions.js';
import {alignMedia, mediaAlignActive, mediaContext, selectedMedia} from './media.js';

const chain = editor => editor.chain().focus();

function mark(name, command) {
    return {
        label: t(name),
        icon: name,
        run: ({editor}) => chain(editor)[command]().run(),
        active: ({editor}) => editor.isActive(markName(name)),
        enabled: ({editor}) => editor.can().chain().focus()[command]().run(),
    };
}

function markName(name) {
    return {strike: 'strike', code: 'code'}[name] ?? name;
}

function node(name, command) {
    return {
        label: t(name),
        icon: name,
        run: ({editor}) => chain(editor)[command]().run(),
        active: ({editor}) => editor.isActive(name),
        enabled: ({editor}) => editor.can().chain().focus()[command]().run(),
    };
}

const ALIGN = ['left', 'center', 'right', 'justify'];
const alignKey = side => 'align' + side[0].toUpperCase() + side.slice(1);

function alignItem(side) {
    return {
        label: t(alignKey(side)),
        icon: alignKey(side),
        run: ({editor, config}) => {
            // selected video / YouTube: alignment on the block
            if (selectedMedia(editor)) {
                alignMedia(editor, config, side);
                return;
            }
            const klass = config.align[side];
            // left is the default: remove the class if already left-aligned
            const set = blockHasClass(editor, klass) || 'left' === side ? null : klass;
            editor.chain().focus().setBlockClass(Object.values(config.align), set).run();
        },
        active: ({editor, config}) => selectedMedia(editor) ? mediaAlignActive(editor, config, side) : (blockHasClass(editor, config.align[side])
            || ('left' === side && !ALIGN.some(s => blockHasClass(editor, config.align[s])))),
    };
}

/** Link formats (e.g. "as button") for the link at the cursor */
function linkStyleEntries(editor, config) {
    const styles = config.linkStyles ?? [];
    if (!styles.length) {
        return [];
    }
    const current = editor.getAttributes('link').class ?? null;
    const set = value => editor.chain().focus().extendMarkRange('link').updateAttributes('link', {class: value}).run();
    return [
        {label: t('linkStyleNone'), radio: true, active: () => !current, run: () => set(null)},
        ...styles.map(s => ({label: s.label, radio: true, active: () => current === s.class, run: () => set(current === s.class ? null : s.class)})),
        {separator: true},
    ];
}

const LIST_TYPES = {'1': '1, 2, 3', a: 'a, b, c', A: 'A, B, C', i: 'i, ii, iii', I: 'I, II, III'};

/** Numbering type, list format and start of the list containing the cursor (this level only) */
function listFormatEntries({editor, config, ui}) {
    const found = nearestList(editor.state);
    if (!found) {
        return [];
    }
    const ordered = 'orderedList' === found.node.type.name;
    const attrs = found.node.attrs;
    const entries = [];
    const types = config.listTypes ?? ['1'];
    if (ordered && types.length > 1) {
        entries.push(...types.map(type => ({
            label: LIST_TYPES[type] ?? type,
            radio: true,
            active: () => (attrs.type ?? '1') === type,
            run: () => updateNearestList(editor, {type: '1' === type ? null : type}, ['orderedList']),
        })), {separator: true});
    }
    const kind = ordered ? 'ol' : 'ul';
    const styles = (config.listStyles ?? []).filter(s => 'both' === s.list || kind === s.list);
    if (styles.length) {
        const all = (config.listStyles ?? []).flatMap(s => s.class.split(' '));
        const current = (attrs.class ?? '').split(/\s+/).filter(Boolean);
        const without = () => current.filter(c => !all.includes(c));
        entries.push(
            {label: t('listStyleNone'), radio: true, active: () => !styles.some(s => s.class.split(' ').every(c => current.includes(c))), run: () => updateNearestList(editor, {class: without().join(' ') || null})},
            ...styles.map(s => ({
                label: s.label,
                radio: true,
                active: () => s.class.split(' ').every(c => current.includes(c)),
                run: () => updateNearestList(editor, {class: [...without(), ...s.class.split(' ')].join(' ')}),
            })),
            {separator: true},
        );
    }
    if (ordered) {
        entries.push({label: t('listStart') + (attrs.start > 1 ? ' (' + attrs.start + ')' : ''), icon: 'orderedList', run: () => ui.listStartDialog()});
    }
    return entries;
}

/** Right-click in a list: indent, outdent, change type, remove */
function listContext(ctx) {
    const {editor, has} = ctx;
    const bullet = editor.isActive('bulletList');
    const ordered = editor.isActive('orderedList');
    if (!bullet && !ordered) {
        return null;
    }
    const c = () => editor.chain().focus();
    return [
        ...listFormatEntries(ctx),
        {label: t('listIndent'), icon: 'indent', enabled: () => editor.can().sinkListItem('listItem'), run: () => c().sinkListItem('listItem').run()},
        {label: t('listOutdent'), icon: 'outdent', enabled: () => editor.can().liftListItem('listItem'), run: () => c().liftListItem('listItem').run()},
        {separator: true},
        ...(bullet && has('orderedList') ? [{label: t('listToOrdered'), icon: 'orderedList', run: () => c().toggleOrderedList().run()}] : []),
        ...(ordered && has('bulletList') ? [{label: t('listToBullet'), icon: 'bulletList', run: () => c().toggleBulletList().run()}] : []),
        {label: t('listRemove'), icon: 'paragraph', run: () => c()[bullet ? 'toggleBulletList' : 'toggleOrderedList']().run()},
    ];
}

/** Editing a table: toolbar menu and context menu */
function tableEntries(editor) {
    const c = () => editor.chain().focus();
    const can = () => editor.can().chain().focus();
    return [
        {label: t('tableRowBefore'), icon: 'rowBefore', enabled: () => can().addRowBefore().run(), run: () => c().addRowBefore().run()},
        {label: t('tableRowAfter'), icon: 'rowAfter', enabled: () => can().addRowAfter().run(), run: () => c().addRowAfter().run()},
        {label: t('tableRowDelete'), icon: 'rows', enabled: () => can().deleteRow().run(), run: () => c().deleteRow().run()},
        {separator: true},
        {label: t('tableColBefore'), icon: 'colBefore', enabled: () => can().addColumnBefore().run(), run: () => c().addColumnBefore().run()},
        {label: t('tableColAfter'), icon: 'colAfter', enabled: () => can().addColumnAfter().run(), run: () => c().addColumnAfter().run()},
        {label: t('tableColDelete'), icon: 'columns', enabled: () => can().deleteColumn().run(), run: () => c().deleteColumn().run()},
        {separator: true},
        {label: t('tableHeaderRow'), icon: 'table', enabled: () => can().toggleHeaderRow().run(), run: () => c().toggleHeaderRow().run()},
        {label: t('tableHeaderCol'), icon: 'columns', enabled: () => can().toggleHeaderColumn().run(), run: () => c().toggleHeaderColumn().run()},
        {label: t('tableMerge'), icon: 'merge', enabled: () => can().mergeCells().run(), run: () => c().mergeCells().run()},
        {label: t('tableSplit'), icon: 'split', enabled: () => can().splitCell().run(), run: () => c().splitCell().run()},
        {separator: true},
        {label: t('tableDelete'), icon: 'trash', danger: true, enabled: () => can().deleteTable().run(), run: () => c().deleteTable().run()},
    ];
}

export const builtinItems = {
    undo: {label: t('undo'), icon: 'undo', run: ({editor}) => chain(editor).undo().run(), enabled: ({editor}) => editor.can().undo()},
    redo: {label: t('redo'), icon: 'redo', run: ({editor}) => chain(editor).redo().run(), enabled: ({editor}) => editor.can().redo()},

    heading: {
        label: t('heading'),
        icon: 'heading',
        wide: true,
        current: ({editor, config}) => {
            for (const level of config.headings) {
                if (editor.isActive('heading', {level})) {
                    return t('headingLevel', level);
                }
            }
            return t('paragraph');
        },
        // right-click in a heading: change level
        context: ctx => ctx.editor.isActive('heading') ? builtinItems.heading.menu(ctx) : null,
        menu: ({editor, config}) => [
            {label: t('paragraph'), icon: 'paragraph', radio: true, active: () => editor.isActive('paragraph'), run: () => chain(editor).setParagraph().run()},
            ...config.headings.map(level => ({
                label: t('headingLevel', level),
                icon: 'h' + level,
                radio: true,
                className: 'rex-tiptap-menu-h' + level,
                active: () => editor.isActive('heading', {level}),
                run: () => chain(editor).setHeading({level}).run(),
            })),
        ],
    },

    blockStyle: {
        label: t('blockStyle'),
        icon: 'blockStyle',
        enabled: ({config}) => config.blockStyles.length > 0,
        menu: ({editor, config}) => {
            const all = config.blockStyles.map(s => s.class);
            return [
                {label: t('blockStyleNone'), radio: true, active: () => !all.some(c => blockHasClass(editor, c)), run: () => editor.chain().focus().setBlockClass(all, null).run()},
                ...config.blockStyles.map(style => {
                    const target = nodeOfElement(style.element ?? 'p');
                    const types = [target.type];
                    return {
                        label: style.label,
                        preview: style.class,
                        radio: true,
                        active: () => blockHasClass(editor, style.class, types),
                        run: () => {
                            const c = editor.chain().focus();
                            // paragraph/heading: convert the block into the element first
                            if ('paragraph' === target.type) {
                                c.setParagraph();
                            } else if ('heading' === target.type) {
                                c.setHeading({level: target.level});
                            }
                            const on = blockHasClass(editor, style.class, types);
                            c.setBlockClass(all, on ? null : style.class, types).run();
                        },
                    };
                }),
            ];
        },
    },

    inlineStyle: {
        label: t('inlineStyle'),
        icon: 'inlineStyle',
        enabled: ({config}) => config.inlineStyles.length > 0,
        menu: ({editor, config}) => [
            {label: t('inlineStyleNone'), radio: true, active: () => !editor.isActive('rexInlineStyle'), run: () => chain(editor).unsetMark('rexInlineStyle').run()},
            ...config.inlineStyles.map(style => ({
                label: style.label,
                preview: style.class,
                radio: true,
                active: () => editor.isActive('rexInlineStyle', {class: style.class}),
                run: () => chain(editor).toggleInlineStyle(style.class).run(),
            })),
        ],
    },

    bold: mark('bold', 'toggleBold'),
    italic: mark('italic', 'toggleItalic'),
    underline: mark('underline', 'toggleUnderline'),
    strike: mark('strike', 'toggleStrike'),
    code: mark('code', 'toggleCode'),
    highlight: mark('highlight', 'toggleHighlight'),
    subscript: mark('subscript', 'toggleSubscript'),
    superscript: mark('superscript', 'toggleSuperscript'),
    clearFormatting: {
        label: t('clearFormatting'),
        icon: 'clearFormatting',
        run: ({editor, config}) => {
            const c = chain(editor).unsetAllMarks();
            if (editor.extensionManager.extensions.some(e => 'rexBlockClass' === e.name)) {
                c.setBlockClass([...Object.values(config.align), ...config.blockStyles.map(s => s.class)], null);
            }
            c.run();
        },
    },

    listStyle: {
        label: t('listStyle'),
        icon: 'listStyle',
        enabled: ({editor}) => !!nearestList(editor.state),
        menu: ctx => listFormatEntries(ctx),
    },
    bulletList: {...node('bulletList', 'toggleBulletList'), context: listContext},
    orderedList: {...node('orderedList', 'toggleOrderedList'), context: listContext},
    blockquote: {...node('blockquote', 'toggleBlockquote'), context: ({editor}) => editor.isActive('blockquote') ? [
        {label: t('quoteRemove'), icon: 'blockquote', run: () => chain(editor).lift('blockquote').run()},
    ] : null},
    codeBlock: {...node('codeBlock', 'toggleCodeBlock'), context: ({editor}) => editor.isActive('codeBlock') ? [
        {label: t('codeBlockRemove'), icon: 'paragraph', run: () => chain(editor).setParagraph().run()},
    ] : null},
    horizontalRule: {
        label: t('horizontalRule'),
        icon: 'horizontalRule',
        run: ({editor}) => chain(editor).setHorizontalRule().run(),
        context: ({editor}) => editor.isActive('horizontalRule') ? [
            {label: t('hrRemove'), icon: 'trash', danger: true, run: () => chain(editor).deleteSelection().run()},
        ] : null,
    },

    align: {
        label: t('align'),
        icon: 'align',
        currentIcon: ({editor, config}) => alignKey(ALIGN.find(s => (selectedMedia(editor) ? mediaAlignActive(editor, config, s) && 'left' !== s : blockHasClass(editor, config.align[s]))) ?? 'left'),
        menu: ctx => ALIGN.map(side => ({...alignItem(side), radio: true, active: () => alignItem(side).active(ctx), run: () => alignItem(side).run(ctx)})),
    },
    alignLeft: alignItem('left'),
    alignCenter: alignItem('center'),
    alignRight: alignItem('right'),
    alignJustify: alignItem('justify'),

    link: {
        label: t('link'),
        icon: 'link',
        run: ({ui}) => ui.linkDialog(),
        active: ({editor}) => editor.isActive('link'),
        shortcut: 'Mod-k',
        // right-click on a link
        context: ({editor, config, ui}) => editor.isActive('link') ? [
            ...linkStyleEntries(editor, config),
            {label: t('linkEdit'), icon: 'edit', run: () => ui.linkDialog()},
            {label: t('linkOpen'), icon: 'external', enabled: () => !!ui.bubbleOpen?.href, run: () => ui.bubbleOpen?.href && window.open(ui.bubbleOpen.href, '_blank', 'noopener')},
            {label: t('unlink'), icon: 'unlink', run: () => editor.chain().focus().extendMarkRange('link').unsetLink().run()},
        ] : null,
    },
    unlink: {
        label: t('unlink'),
        icon: 'unlink',
        run: ({editor}) => chain(editor).extendMarkRange('link').unsetLink().run(),
        enabled: ({editor}) => editor.isActive('link'),
    },
    image: {
        label: t('image'),
        icon: 'image',
        run: ({ui}) => ui.imageDialog(),
        active: ({editor}) => editor.isActive('image'),
        enabled: ({config}) => !!picker(config) || !!config.image.external,
        // right-click on an image: edit, image format, size, remove
        context: ({editor, config, ui}) => {
            if (!editor.isActive('image')) {
                return null;
            }
            const attrs = editor.getAttributes('image');
            const set = values => editor.chain().focus().updateAttributes('image', values).run();
            const styles = (config.image.styles ?? []).filter(s => 'video' !== s.media);
            const types = attrs.media ? (config.image.mediaTypes ?? []) : [];
            return [
                {label: t('imageEdit'), icon: 'image', run: () => ui.imageDialog()},
                ...(styles.length ? [{separator: true},
                    {label: t('imageStyleNone'), radio: true, active: () => !attrs.class, run: () => set({class: null})},
                    ...styles.map(s => ({label: s.label, radio: true, active: () => attrs.class === s.class, run: () => set({class: s.class})}))] : []),
                ...(types.length ? [{separator: true},
                    {label: t('imageOriginal'), radio: true, active: () => !attrs.mediaType, run: () => set({mediaType: null, src: mediaSrc(config, attrs.media)})},
                    ...types.map(name => ({label: name, radio: true, active: () => attrs.mediaType === name, run: () => set({mediaType: name, src: mediaSrc(config, attrs.media, name)})}))] : []),
                {separator: true},
                {label: t('imageRemove'), icon: 'trash', danger: true, run: () => editor.chain().focus().deleteSelection().run()},
            ];
        },
    },
    video: {
        label: t('video'),
        icon: 'video',
        run: ({ui}) => ui.videoDialog(),
        active: ({editor}) => editor.isActive('rexVideo'),
        enabled: ({config}) => !!picker(config),
        context: ({ui}) => mediaContext('rexVideo', ui),
    },
    oembed: {
        label: t('oembed'),
        icon: 'oembed',
        run: ({ui}) => ui.oembedDialog(),
        active: ({editor}) => editor.isActive('rexOembed'),
        context: ({ui}) => mediaContext('rexOembed', ui),
    },
    htmlEmbed: {
        label: t('htmlEmbed'),
        icon: 'htmlEmbed',
        run: ({ui}) => ui.htmlEmbedDialog(),
        active: ({editor}) => editor.isActive('rexHtmlEmbed'),
        enabled: ({config}) => !!config.htmlEmbed,
        context: ({ui}) => mediaContext('rexHtmlEmbed', ui),
    },
    table: {
        label: t('table'),
        icon: 'table',
        active: ({editor}) => editor.isActive('table'),
        menu: ({editor}) => [
            {label: t('tableInsert'), icon: 'plus', enabled: () => !editor.isActive('table'), run: () => editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()},
            {separator: true},
            ...tableEntries(editor),
        ],
        // right-click in a cell
        context: ({editor}) => editor.isActive('table') ? tableEntries(editor) : null,
    },
    specialChars: {
        label: t('specialChars'),
        icon: 'specialChars',
        grid: true,
        menu: ({editor, config}) => config.specialChars.map(char => {
            // invisible characters with names instead of characters
            const name = {'\u00A0': 'nbsp', '\u00AD': 'shy'}[char];
            return {
                label: name ?? char,
                className: name ? 'is-text' : null,
                title: {'\u00A0': 'geschütztes Leerzeichen / non-breaking space', '\u00AD': 'weiches Trennzeichen / soft hyphen'}[char] ?? char,
                run: () => chain(editor).insertContent(char).run(),
            };
        }),
    },

    source: {
        label: t('source'),
        icon: 'source',
        always: true,
        run: ({ui}) => ui.toggleSource(),
        active: ({ui}) => ui.sourceMode,
    },
    fullscreen: {
        label: t('fullscreen'),
        icon: 'fullscreen',
        always: true,
        currentIcon: ({ui}) => ui.fullscreen ? 'fullscreenExit' : 'fullscreen',
        currentLabel: ({ui}) => ui.fullscreen ? t('fullscreenExit') : t('fullscreen'),
        run: ({ui}) => ui.toggleFullscreen(),
        active: ({ui}) => ui.fullscreen,
    },
};

export {CLASS_NODES};
