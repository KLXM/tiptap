/* Symbole der Toolbar: Lucide (ISC), eingebettet – funktioniert ohne Font Awesome, also auch im Frontend */

import {
    LetterB, Italic, Underline, Strikethrough, Code, Highlighter, Subscript, Superscript, RemoveFormatting,
    List, ListOrdered, TextQuote, SquareCode, Minus, TextAlignStart, TextAlignCenter, TextAlignEnd, TextAlignJustify,
    Link, Unlink, Image, Table, Omega, CodeXml, Maximize, Minimize, Undo2, Redo2, LetterH, Pilcrow, Paintbrush,
    ChevronDown, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, ExternalLink, FileText, FolderOpen,
    Globe, Mail, Phone, Trash, Check, X, BetweenHorizontalStart, BetweenHorizontalEnd, BetweenVerticalStart,
    BetweenVerticalEnd, TableCellsMerge, TableCellsSplit, Columns3, Rows3, Plus, Puzzle, Database, Pencil, ListIndentIncrease, ListIndentDecrease, ListTree, Palette,
} from 'lucide';

const icons = {
    bold: LetterB, italic: Italic, underline: Underline, strike: Strikethrough, code: Code, highlight: Highlighter,
    subscript: Subscript, superscript: Superscript, clearFormatting: RemoveFormatting,
    bulletList: List, orderedList: ListOrdered, blockquote: TextQuote, codeBlock: SquareCode, horizontalRule: Minus,
    align: TextAlignStart, alignLeft: TextAlignStart, alignCenter: TextAlignCenter, alignRight: TextAlignEnd,
    alignJustify: TextAlignJustify,
    link: Link, unlink: Unlink, image: Image, table: Table, specialChars: Omega,
    source: CodeXml, fullscreen: Maximize, fullscreenExit: Minimize,
    undo: Undo2, redo: Redo2, heading: LetterH, paragraph: Pilcrow, blockStyle: Pilcrow, inlineStyle: Paintbrush,
    chevron: ChevronDown, h1: Heading1, h2: Heading2, h3: Heading3, h4: Heading4, h5: Heading5, h6: Heading6,
    external: ExternalLink, article: FileText, media: FolderOpen, globe: Globe, mail: Mail, phone: Phone,
    trash: Trash, check: Check, close: X, plus: Plus, plugin: Puzzle, record: Database, edit: Pencil, indent: ListIndentIncrease, outdent: ListIndentDecrease, listStyle: ListTree, linkStyle: Palette,
    rowBefore: BetweenHorizontalStart, rowAfter: BetweenHorizontalEnd, colBefore: BetweenVerticalStart,
    colAfter: BetweenVerticalEnd, merge: TableCellsMerge, split: TableCellsSplit, columns: Columns3, rows: Rows3,
};

const SVG = 'http://www.w3.org/2000/svg';

function build(node) {
    const svg = document.createElementNS(SVG, 'svg');
    for (const [k, v] of Object.entries({viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'rex-tiptap-icon'})) {
        svg.setAttribute(k, v);
    }
    for (const [tag, attrs] of node) {
        const child = document.createElementNS(SVG, tag);
        for (const [k, v] of Object.entries(attrs)) {
            child.setAttribute(k, v);
        }
        svg.append(child);
    }
    return svg;
}

/**
 * Symbol als Element: Name aus dem Satz oben, Font-Awesome-Klassen („fa-…“) oder ein SVG-String.
 */
export function icon(name) {
    if (Array.isArray(name)) {
        return build(name);
    }
    if (typeof name === 'string' && name.trim().startsWith('<svg')) {
        const tpl = document.createElement('template');
        tpl.innerHTML = name.trim();
        const svg = tpl.content.firstElementChild;
        svg?.setAttribute('aria-hidden', 'true');
        svg?.classList.add('rex-tiptap-icon');
        return svg ?? build(Puzzle);
    }
    if (typeof name === 'string' && /(^|\s)fa-/.test(name)) {
        const i = document.createElement('i');
        i.className = 'rex-tiptap-icon ' + name;
        i.setAttribute('aria-hidden', 'true');
        return i;
    }
    return build(icons[name] ?? Puzzle);
}

/** Eigene Symbole ergänzen: `RexTiptap.icons.add('hint', [['circle', {cx: 12, cy: 12, r: 10}]])` */
export function addIcon(name, node) {
    icons[name] = node;
}
