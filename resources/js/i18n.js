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
        tableColDelete: 'Spalte löschen', tableHeaderRow: 'Kopfzeile an/aus', tableHeaderCol: 'Kopfspalte an/aus', contextMenu: 'Kontextmenü', contextHint: 'Umschalt + Rechtsklick: Menü des Browsers',
        listIndent: 'Einrücken', listOutdent: 'Ausrücken', listToOrdered: 'In nummerierte Liste umwandeln', listToBullet: 'In Aufzählung umwandeln', listRemove: 'Liste aufheben', listStyle: 'Listenformat', listStyleNone: 'Standard', listStart: 'Beginnt bei …', listStartLabel: 'Erste Nummer', linkStyleNone: 'Normaler Link', linkStyle: 'Darstellung', linkFormat: 'Linkformat',
        quoteRemove: 'Zitat aufheben', codeBlockRemove: 'In Absatz umwandeln', hrRemove: 'Trennlinie entfernen', tableMerge: 'Zellen verbinden',
        tableSplit: 'Zelle teilen', tableDelete: 'Tabelle löschen',
        linkTitle: 'Link einfügen', linkEdit: 'Link bearbeiten', linkUrl: 'Adresse', linkText: 'Text',
        linkUrlHint: 'https://…, mailto:… oder tel:…', linkArticle: 'Seite wählen', linkMedia: 'Datei wählen',
        linkBlank: 'In neuem Fenster öffnen', linkOpen: 'Link öffnen', linkPage: 'Seite', linkMail: 'E-Mail', linkPhone: 'Telefon', linkFile: 'Datei', linkInvalid: 'Diese Adresse ist hier nicht erlaubt.',
        imageTitle: 'Bild einfügen', imageEdit: 'Bild bearbeiten', imageSrc: 'Bildadresse', imageAlt: 'Alternativtext',
        imageAltHint: 'Beschreibt das Bild für Menschen, die es nicht sehen. Leer lassen, wenn es nur Schmuck ist.',
        imageMedia: 'Aus dem Medienpool', imageTitleAttr: 'Titel (optional)',
        imageSize: 'Größe (Mediamanager-Typ)', imageOriginal: 'Originaldatei', imageStyle: 'Bildformat', imageStyleNone: 'Ohne Format', imageRemove: 'Bild entfernen',
        linkRecord: 'Datensatz wählen', recordTable: 'Tabelle', recordSearch: 'Suchen …', recordResults: 'Datensätze', recordNone: 'Keine Datensätze gefunden.', recordError: 'Datensätze konnten nicht geladen werden.',
        apply: 'Übernehmen', cancel: 'Abbrechen', remove: 'Entfernen', close: 'Schließen',
        edit: 'Bearbeiten',
        video: 'Video', videoInsert: 'Video einfügen', videoEdit: 'Video bearbeiten', videoMedia: 'Video aus dem Medienpool', videoFile: 'Videodatei',
        videoPoster: 'Vorschaubild', videoPosterChoose: 'Bild wählen', videoPosterAuto: 'automatisch: Standbild aus dem Video-Editor', videoPosterAutoNone: 'keins – Standbild im Video-Editor wählen oder hier aufnehmen', videoPosterCapture: 'Aktuelles Bild als Vorschaubild', videoPosterCapturing: 'Standbild wird erstellt …', videoPosterCaptured: 'Standbild übernommen – gilt automatisch.', videoEditInEditor: 'Im Video-Editor bearbeiten', videoTitle: 'Titel (optional)', videoTitleHint: 'Beschreibt das Video für Screenreader.',
        video_controls: 'Steuerelemente', video_autoplay: 'Automatisch abspielen (stumm)', video_loop: 'Endlosschleife', video_muted: 'Stumm',
        mediaStyle: 'Format', ratio: 'Seitenverhältnis', ratioOriginal: 'Original', ratioHintVideo: 'Ein anderes Verhältnis als das des Videos schneidet zu.',
        oembed: 'YouTube / Vimeo', oembedInsert: 'Video einbetten', oembedEdit: 'Eingebettetes Video bearbeiten', oembedUrl: 'Adresse des Videos',
        oembedTitle: 'Titel', oembedTitleHint: 'Wird automatisch geholt; für Screenreader und den Platzhalter.', oembedInvalid: 'Keine gültige Adresse von YouTube oder Vimeo.',
        oembedPreview: 'Vorschau abspielen',
        htmlEmbed: 'HTML-Embed', embedInsert: 'HTML-Code einbetten', embedEdit: 'HTML-Code bearbeiten', embedCode: 'HTML-Code',
        embedLabel: 'Bezeichnung', embedLabelHint: 'Nur zur Orientierung im Editor, z. B. „Anfahrt“.',
        embedService: 'Dienst (Einwilligung)', embedServiceHint: 'Optional, z. B. google_maps: Der Code läuft erst nach Zustimmung.', embedServiceInvalid: 'Dienst: nur a–z, 0–9, _ und -.',
        embedHasScript: 'enthält Skript', embedUnsigned: 'nicht freigegeben – wird nicht ausgegeben', embedSignFailed: 'Der Code konnte nicht freigegeben werden (Recht „HTML-Embeds“?).', embedNoPermission: 'Bearbeiten nur mit Recht „HTML-Embeds“',
        embedWarnHandler: 'on…-Attribute (z. B. onclick) werden durch die Content-Security-Policy blockiert.',
        embedWarnJs: 'javascript:-Adressen werden blockiert.', embedWarnStyle: 'style-Attribute können durch die Content-Security-Policy blockiert werden.',
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
        tableColDelete: 'Delete column', tableHeaderRow: 'Toggle header row', tableHeaderCol: 'Toggle header column', contextMenu: 'Context menu', contextHint: 'Shift + right click: browser menu',
        listIndent: 'Indent', listOutdent: 'Outdent', listToOrdered: 'Convert to numbered list', listToBullet: 'Convert to bullet list', listRemove: 'Remove list', listStyle: 'List style', listStyleNone: 'Default', listStart: 'Start at …', listStartLabel: 'First number', linkStyleNone: 'Plain link', linkStyle: 'Appearance', linkFormat: 'Link style',
        quoteRemove: 'Remove quote', codeBlockRemove: 'Convert to paragraph', hrRemove: 'Remove horizontal rule', tableMerge: 'Merge cells',
        tableSplit: 'Split cell', tableDelete: 'Delete table',
        linkTitle: 'Insert link', linkEdit: 'Edit link', linkUrl: 'Address', linkText: 'Text',
        linkUrlHint: 'https://…, mailto:… or tel:…', linkArticle: 'Choose page', linkMedia: 'Choose file',
        linkBlank: 'Open in new window', linkOpen: 'Open link', linkPage: 'Page', linkMail: 'E-mail', linkPhone: 'Phone', linkFile: 'File', linkInvalid: 'This address is not allowed here.',
        imageTitle: 'Insert image', imageEdit: 'Edit image', imageSrc: 'Image address', imageAlt: 'Alternative text',
        imageAltHint: 'Describes the image for people who cannot see it. Leave empty for purely decorative images.',
        imageMedia: 'From the media pool', imageTitleAttr: 'Title (optional)',
        imageSize: 'Size (media manager type)', imageOriginal: 'Original file', imageStyle: 'Image style', imageStyleNone: 'No style', imageRemove: 'Remove image',
        linkRecord: 'Choose record', recordTable: 'Table', recordSearch: 'Search …', recordResults: 'Records', recordNone: 'No records found.', recordError: 'Records could not be loaded.',
        apply: 'Apply', cancel: 'Cancel', remove: 'Remove', close: 'Close',
        edit: 'Edit',
        video: 'Video', videoInsert: 'Insert video', videoEdit: 'Edit video', videoMedia: 'Video from the media pool', videoFile: 'Video file',
        videoPoster: 'Poster image', videoPosterChoose: 'Choose image', videoPosterAuto: 'automatic: still from the video editor', videoPosterAutoNone: 'none – pick a still in the video editor or capture it here', videoPosterCapture: 'Use current frame as poster', videoPosterCapturing: 'Capturing still …', videoPosterCaptured: 'Still captured – applies automatically.', videoEditInEditor: 'Edit in the video editor', videoTitle: 'Title (optional)', videoTitleHint: 'Describes the video for screen readers.',
        video_controls: 'Controls', video_autoplay: 'Autoplay (muted)', video_loop: 'Loop', video_muted: 'Muted',
        mediaStyle: 'Style', ratio: 'Aspect ratio', ratioOriginal: 'Original', ratioHintVideo: 'A ratio different from the video crops it.',
        oembed: 'YouTube / Vimeo', oembedInsert: 'Embed video', oembedEdit: 'Edit embedded video', oembedUrl: 'Video address',
        oembedTitle: 'Title', oembedTitleHint: 'Fetched automatically; for screen readers and the placeholder.', oembedInvalid: 'Not a valid YouTube or Vimeo address.',
        oembedPreview: 'Play preview',
        htmlEmbed: 'HTML embed', embedInsert: 'Embed HTML code', embedEdit: 'Edit HTML code', embedCode: 'HTML code',
        embedLabel: 'Label', embedLabelHint: 'Only for orientation in the editor, e.g. “Directions”.',
        embedService: 'Service (consent)', embedServiceHint: 'Optional, e.g. google_maps: the code only runs after consent.', embedServiceInvalid: 'Service: only a–z, 0–9, _ and -.',
        embedHasScript: 'contains script', embedUnsigned: 'not approved – will not be output', embedSignFailed: 'The code could not be approved (“HTML embeds” permission?).', embedNoPermission: 'Editing requires the “HTML embeds” permission',
        embedWarnHandler: 'on… attributes (e.g. onclick) are blocked by the Content Security Policy.',
        embedWarnJs: 'javascript: addresses are blocked.', embedWarnStyle: 'style attributes may be blocked by the Content Security Policy.',
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
