/* Eingebaute Werkzeuge der Toolbar. Ein Werkzeug: {label, icon, run?, active?, enabled?, menu?, current?} */

import {t} from './i18n.js';
import {blockHasClass, CLASS_NODES, mediaSrc, nodeOfElement} from './extensions.js';

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
            const klass = config.align[side];
            // links ist Standard: Klasse entfernen, wenn schon linksbündig
            const set = blockHasClass(editor, klass) || 'left' === side ? null : klass;
            editor.chain().focus().setBlockClass(Object.values(config.align), set).run();
        },
        active: ({editor, config}) => blockHasClass(editor, config.align[side])
            || ('left' === side && !ALIGN.some(s => blockHasClass(editor, config.align[s]))),
    };
}

/** Bearbeiten einer Tabelle: Menü der Toolbar und Kontextmenü */
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
                            // Absatz/Überschrift: Block erst in das Element umwandeln
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

    bulletList: node('bulletList', 'toggleBulletList'),
    orderedList: node('orderedList', 'toggleOrderedList'),
    blockquote: node('blockquote', 'toggleBlockquote'),
    codeBlock: node('codeBlock', 'toggleCodeBlock'),
    horizontalRule: {label: t('horizontalRule'), icon: 'horizontalRule', run: ({editor}) => chain(editor).setHorizontalRule().run()},

    align: {
        label: t('align'),
        icon: 'align',
        currentIcon: ({editor, config}) => alignKey(ALIGN.find(s => blockHasClass(editor, config.align[s])) ?? 'left'),
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
        enabled: ({config}) => !!(config.backend && window.rex?.pick) || !!config.image.external,
        // Rechtsklick auf ein Bild: bearbeiten, Bildformat, Größe, entfernen
        context: ({editor, config, ui}) => {
            if (!editor.isActive('image')) {
                return null;
            }
            const attrs = editor.getAttributes('image');
            const set = values => editor.chain().focus().updateAttributes('image', values).run();
            const styles = config.image.styles ?? [];
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
    table: {
        label: t('table'),
        icon: 'table',
        active: ({editor}) => editor.isActive('table'),
        menu: ({editor}) => [
            {label: t('tableInsert'), icon: 'plus', enabled: () => !editor.isActive('table'), run: () => editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()},
            {separator: true},
            ...tableEntries(editor),
        ],
        // Rechtsklick in eine Zelle
        context: ({editor}) => editor.isActive('table') ? tableEntries(editor) : null,
    },
    specialChars: {
        label: t('specialChars'),
        icon: 'specialChars',
        grid: true,
        menu: ({editor, config}) => config.specialChars.map(char => {
            // unsichtbare Zeichen mit Namen statt Zeichen
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
