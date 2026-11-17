/* Texte des Editors; Sprache aus <html lang>, eigene Texte per RexTiptap.i18n.add('de', {...}) */

const texts = {
    de: {
        toolbar: 'Formatierung',
        undo: 'Rückgängig', redo: 'Wiederholen',
        heading: 'Absatzformat', paragraph: 'Absatz', headingLevel: 'Überschrift %s',
        blockStyle: 'Blockformat', blockStyleNone: 'Ohne Format',
        inlineStyle: 'Textformat', inlineStyleNone: 'Ohne Textformat',
        bold: 'Fett', italic: 'Kursiv', underline: 'Unterstrichen', strike: 'Durchgestrichen', code: 'Code',
        highlight: 'Markieren', subscript: 'Tiefgestellt', superscript: 'Hochgestellt', clearFormatting: 'Formatierung entfernen',
        bulletList: 'Aufzählung', orderedList: 'Nummerierte Liste', blockquote: 'Zitat', codeBlock: 'Codeblock',
        horizontalRule: 'Trennlinie',
        align: 'Ausrichtung', alignLeft: 'Linksbündig', alignCenter: 'Zentriert', alignRight: 'Rechtsbündig', alignJustify: 'Blocksatz',
        link: 'Link', unlink: 'Link entfernen', image: 'Bild', table: 'Tabelle', specialChars: 'Sonderzeichen',
        source: 'Quelltext', sourceHtml: 'HTML-Quelltext', sourceMarkdown: 'Markdown-Quelltext', fullscreen: 'Vollbild',
        fullscreenExit: 'Vollbild verlassen',
        tableInsert: 'Tabelle einfügen', tableRowBefore: 'Zeile davor', tableRowAfter: 'Zeile danach',
        tableColBefore: 'Spalte davor', tableColAfter: 'Spalte danach', tableRowDelete: 'Zeile löschen',
        tableColDelete: 'Spalte löschen', tableHeaderRow: 'Kopfzeile an/aus', tableHeaderCol: 'Kopfspalte an/aus', contextMenu: 'Kontextmenü', tableMerge: 'Zellen verbinden',
        tableSplit: 'Zelle teilen', tableDelete: 'Tabelle löschen',
        linkTitle: 'Link einfügen', linkEdit: 'Link bearbeiten', linkUrl: 'Adresse', linkText: 'Text',
        linkUrlHint: 'https://…, mailto:… oder tel:…', linkArticle: 'Seite wählen', linkMedia: 'Datei wählen',
        linkBlank: 'In neuem Fenster öffnen', linkInvalid: 'Diese Adresse ist hier nicht erlaubt.',
        imageTitle: 'Bild einfügen', imageEdit: 'Bild bearbeiten', imageSrc: 'Bildadresse', imageAlt: 'Alternativtext',
        imageAltHint: 'Beschreibt das Bild für Menschen, die es nicht sehen. Leer lassen, wenn es nur Schmuck ist.',
        imageMedia: 'Aus dem Medienpool', imageTitleAttr: 'Titel (optional)',
        apply: 'Übernehmen', cancel: 'Abbrechen', remove: 'Entfernen', close: 'Schließen',
        characters: '%s Zeichen', charactersOf: '%s von %s Zeichen', words: '%s Wörter',
        editorLabel: 'Editor', sourceLabel: 'Quelltext',
        empty: '',
    },
    en: {
        toolbar: 'Formatting',
        undo: 'Undo', redo: 'Redo',
        heading: 'Paragraph format', paragraph: 'Paragraph', headingLevel: 'Heading %s',
        blockStyle: 'Block style', blockStyleNone: 'No style',
        inlineStyle: 'Text style', inlineStyleNone: 'No text style',
        bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough', code: 'Code',
        highlight: 'Highlight', subscript: 'Subscript', superscript: 'Superscript', clearFormatting: 'Clear formatting',
        bulletList: 'Bullet list', orderedList: 'Numbered list', blockquote: 'Quote', codeBlock: 'Code block',
        horizontalRule: 'Horizontal rule',
        align: 'Alignment', alignLeft: 'Align left', alignCenter: 'Center', alignRight: 'Align right', alignJustify: 'Justify',
        link: 'Link', unlink: 'Remove link', image: 'Image', table: 'Table', specialChars: 'Special characters',
        source: 'Source', sourceHtml: 'HTML source', sourceMarkdown: 'Markdown source', fullscreen: 'Fullscreen',
        fullscreenExit: 'Exit fullscreen',
        tableInsert: 'Insert table', tableRowBefore: 'Row before', tableRowAfter: 'Row after',
        tableColBefore: 'Column before', tableColAfter: 'Column after', tableRowDelete: 'Delete row',
        tableColDelete: 'Delete column', tableHeaderRow: 'Toggle header row', tableHeaderCol: 'Toggle header column', contextMenu: 'Context menu', tableMerge: 'Merge cells',
        tableSplit: 'Split cell', tableDelete: 'Delete table',
        linkTitle: 'Insert link', linkEdit: 'Edit link', linkUrl: 'Address', linkText: 'Text',
        linkUrlHint: 'https://…, mailto:… or tel:…', linkArticle: 'Choose page', linkMedia: 'Choose file',
        linkBlank: 'Open in new window', linkInvalid: 'This address is not allowed here.',
        imageTitle: 'Insert image', imageEdit: 'Edit image', imageSrc: 'Image address', imageAlt: 'Alternative text',
        imageAltHint: 'Describes the image for people who cannot see it. Leave empty for purely decorative images.',
        imageMedia: 'From the media pool', imageTitleAttr: 'Title (optional)',
        apply: 'Apply', cancel: 'Cancel', remove: 'Remove', close: 'Close',
        characters: '%s characters', charactersOf: '%s of %s characters', words: '%s words',
        editorLabel: 'Editor', sourceLabel: 'Source',
        empty: '',
    },
};

function lang() {
    const l = (document.documentElement.lang || navigator.language || 'de').slice(0, 2).toLowerCase();
    return texts[l] ? l : 'en';
}

/** Text zum Schlüssel, `%s` wird der Reihe nach ersetzt */
export function t(key, ...args) {
    let text = texts[lang()][key] ?? texts.en[key] ?? texts.de[key] ?? key;
    for (const arg of args) {
        text = text.replace('%s', String(arg));
    }
    return text;
}

export const i18n = {
    t,
    add(language, entries) {
        texts[language] = {...(texts[language] ?? {}), ...entries};
    },
};
