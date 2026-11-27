/* Eigene Erweiterungen: Klassen statt style-Attributen (CSP), Formatvorlagen, Prüfung von Link-Adressen */

import {Extension, Mark, mergeAttributes} from '@tiptap/core';

/** Knotentypen, die Block-Klassen (Blockformat, Ausrichtung) tragen dürfen */
export const CLASS_NODES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'table'];

const ELEMENT_NODE = {p: 'paragraph', blockquote: 'blockquote', ul: 'bulletList', ol: 'orderedList', table: 'table'};

/** Knotentyp + Ebene zu einem Element des Blockformats (p, h2, blockquote …) */
export function nodeOfElement(element) {
    const h = /^h([1-6])$/.exec(element);
    return h ? {type: 'heading', level: Number(h[1])} : {type: ELEMENT_NODE[element] ?? 'paragraph'};
}

function tokens(value) {
    return (value ?? '').split(/\s+/).filter(Boolean);
}

/**
 * Attribut `class` auf Blöcken – nur mit den Klassen, die das Profil kennt; fremde Klassen (z. B. beim Einfügen aus
 * Word) fallen weg.
 */
export const BlockClass = Extension.create({
    name: 'rexBlockClass',

    addOptions() {
        return {allowed: []};
    },

    addGlobalAttributes() {
        const allowed = new Set(this.options.allowed);
        return [{
            types: CLASS_NODES,
            attributes: {
                class: {
                    default: null,
                    parseHTML: el => tokens(el.getAttribute('class')).filter(c => allowed.has(c)).join(' ') || null,
                    renderHTML: attrs => attrs.class ? {class: attrs.class} : {},
                },
            },
        }];
    },

    addCommands() {
        return {
            /**
             * Setzt in den Blöcken der Auswahl eine Klasse aus einer Gruppe (z. B. Ausrichtung) und entfernt die
             * anderen Klassen derselben Gruppe. `klass` null entfernt nur.
             */
            setBlockClass: (group, klass, types = CLASS_NODES) => ({tr, state, dispatch}) => {
                const groupTokens = new Set(group.flatMap(tokens));
                const add = tokens(klass);
                let changed = false;
                const {from, to} = state.selection;
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (!types.includes(node.type.name)) {
                        return true;
                    }
                    const list = tokens(node.attrs.class).filter(c => !groupTokens.has(c));
                    const value = [...list, ...add].join(' ') || null;
                    if (value !== node.attrs.class) {
                        tr.setNodeMarkup(pos, undefined, {...node.attrs, class: value});
                        changed = true;
                    }
                    // Absätze in Listen/Zitaten nicht zusätzlich
                    return !['paragraph', 'heading'].includes(node.type.name);
                });
                if (changed && dispatch) {
                    dispatch(tr);
                }
                return changed;
            },
        };
    },
});

/** Hat ein Block der Auswahl die Klasse? */
export function blockHasClass(editor, klass, types = CLASS_NODES) {
    const wanted = tokens(klass);
    const {$from} = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (types.includes(node.type.name)) {
            const have = tokens(node.attrs.class);
            return wanted.every(c => have.includes(c));
        }
    }
    return false;
}

/** Textformat: `<span class="…">` mit einer Klasse aus dem Profil */
export const InlineStyle = Mark.create({
    name: 'rexInlineStyle',
    excludes: '',

    addOptions() {
        return {allowed: []};
    },

    addAttributes() {
        return {class: {default: null}};
    },

    parseHTML() {
        const allowed = new Set(this.options.allowed);
        return [{
            tag: 'span[class]',
            getAttrs: el => {
                const value = tokens(el.getAttribute('class')).filter(c => allowed.has(c)).join(' ');
                return value ? {class: value} : false;
            },
        }];
    },

    renderHTML({HTMLAttributes}) {
        return ['span', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            toggleInlineStyle: klass => ({editor, commands}) => {
                if (editor.isActive(this.name, {class: klass})) {
                    return commands.unsetMark(this.name);
                }
                return commands.setMark(this.name, {class: klass});
            },
        };
    },
});

/** Nächste Liste um den Cursor (für Zählweise, Format, Start je Ebene) */
export function nearestList(state, names = ['orderedList', 'bulletList']) {
    const {$from} = state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (names.includes(node.type.name)) {
            return {node, pos: $from.before(depth)};
        }
    }
    return null;
}

/** Attribute der nächsten Liste ändern – nur diese Ebene, nicht die äußeren Listen */
export function updateNearestList(editor, attrs, names = ['orderedList', 'bulletList']) {
    const found = nearestList(editor.state, names);
    if (!found) {
        return false;
    }
    const values = 'function' === typeof attrs ? attrs(found.node) : attrs;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(found.pos, undefined, {...found.node.attrs, ...values}));
    editor.commands.focus();
    return true;
}

/** Link mit Linkformat (Klasse aus dem Profil, z. B. „Als Button“) */
export function rexLink(Link, allowedClasses) {
    const allowed = new Set(allowedClasses);
    return Link.extend({
        addAttributes() {
            return {
                ...this.parent?.(),
                class: {
                    default: null,
                    parseHTML: el => tokens(el.getAttribute('class')).filter(c => allowed.has(c)).join(' ') || null,
                    renderHTML: attrs => attrs.class ? {class: attrs.class} : {},
                },
            };
        },
    });
}

/** Adresse eines Medienpool-Bildes (optional über einen Mediamanager-Typ), ab der Website-Wurzel */
export function mediaSrc(config, file, type = '') {
    return type
        ? config.mediaManagerUrl.replace('__TYPE__', encodeURIComponent(type)).replace('__FILE__', encodeURIComponent(file))
        : config.mediaUrl + encodeURIComponent(file);
}

/**
 * Bild mit Verweis auf den Medienpool (`data-rex-media`, `data-rex-media-type`) und Bildformat (Klasse) – die
 * Ausgabe setzt daraus die richtige Adresse. Alte relative Adressen (`../media/…`) werden beim Laden korrigiert.
 */
export function rexImage(Image, config) {
    const allowed = new Set((config.image?.styles ?? []).flatMap(s => tokens(s.class)));
    const oldMedia = src => /^(?:\.\.\/)+media\/(.+)$/.exec(src ?? '');
    return Image.extend({
        addAttributes() {
            return {
                ...this.parent?.(),
                src: {
                    default: null,
                    parseHTML: el => {
                        const media = el.getAttribute('data-rex-media');
                        if (media) {
                            return mediaSrc(config, media, el.getAttribute('data-rex-media-type') ?? '');
                        }
                        const old = oldMedia(el.getAttribute('src'));
                        return old ? config.mediaUrl + old[1] : el.getAttribute('src');
                    },
                },
                media: {
                    default: null,
                    parseHTML: el => {
                        const old = oldMedia(el.getAttribute('src'));
                        return el.getAttribute('data-rex-media') ?? (old ? decodeURIComponent(old[1]) : null);
                    },
                    renderHTML: attrs => attrs.media ? {'data-rex-media': attrs.media} : {},
                },
                mediaType: {
                    default: null,
                    parseHTML: el => el.getAttribute('data-rex-media-type'),
                    renderHTML: attrs => attrs.mediaType && attrs.media ? {'data-rex-media-type': attrs.mediaType} : {},
                },
                class: {
                    default: null,
                    parseHTML: el => tokens(el.getAttribute('class')).filter(c => allowed.has(c)).join(' ') || null,
                    renderHTML: attrs => attrs.class ? {class: attrs.class} : {},
                },
            };
        },
    }).configure({inline: false, allowBase64: false});
}

/** Prüft eine Link-Adresse gegen die Einstellungen des Profils */
export function allowedUrl(url, link) {
    const value = String(url ?? '').trim();
    if (!value || /^\s*(javascript|data|vbscript):/i.test(value)) {
        return false;
    }
    if (value.startsWith('#')) {
        return true;
    }
    if (/^redaxo:\/\/\d+(-\d+)?(#[\w-]*)?$/.test(value)) {
        return !!link.internal;
    }
    if (/^yform:\/\/[\w.-]+\/\d+(#[\w-]*)?$/.test(value)) {
        return !!link.records?.length;
    }
    if (/^mailto:/i.test(value)) {
        return !!link.mailto;
    }
    if (/^tel:/i.test(value)) {
        return !!link.tel;
    }
    if (/^(https?:)?\/\//i.test(value)) {
        return !!link.external;
    }
    // further schemes of the profile (link.schemes), resolved by the project or an addon on output
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();
    if (scheme) {
        return (link.schemes ?? []).includes(scheme);
    }
    // relative Adresse: Dateien aus dem Medienpool oder interne Pfade
    return !!(link.media || link.internal);
}

/** Ergänzt fehlendes https:// bei „www.example.org“ */
export function normalizeUrl(url) {
    const value = String(url ?? '').trim();
    if (/^www\./i.test(value)) {
        return 'https://' + value;
    }
    if (/^[^\s/:@]+@[^\s/:@]+\.[a-z]{2,}$/i.test(value)) {
        return 'mailto:' + value;
    }
    return value;
}
