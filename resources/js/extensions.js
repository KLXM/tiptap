/* Custom extensions: classes instead of style attributes (CSP), styles, validation of link addresses */

import {Extension, Mark, mergeAttributes} from '@tiptap/core';

/** Node types that may carry block classes (block format, alignment) */
export const CLASS_NODES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'table'];

const ELEMENT_NODE = {p: 'paragraph', blockquote: 'blockquote', ul: 'bulletList', ol: 'orderedList', table: 'table'};

/** Node type + level for an element of the block format (p, h2, blockquote …); `heading` = any heading, level null */
export function nodeOfElement(element) {
    if ('heading' === element) {
        return {type: 'heading', level: null};
    }
    const h = /^h([1-6])$/.exec(element);
    return h ? {type: 'heading', level: Number(h[1])} : {type: ELEMENT_NODE[element] ?? 'paragraph'};
}

function tokens(value) {
    return (value ?? '').split(/\s+/).filter(Boolean);
}

/**
 * Attribute `class` on blocks – only with the classes the profile knows; foreign classes (e.g. when pasting from
 * Word) are dropped.
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
             * Sets a class from a group (e.g. alignment) on the blocks of the selection and removes the
             * other classes of the same group. `klass` null only removes.
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
                    // not additionally on paragraphs in lists/quotes
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

/** Does a block of the selection have the class? */
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

/** Text format: `<span class="…">` with a class from the profile */
export const InlineStyle = Mark.create({
    name: 'rexInlineStyle',
    excludes: '',

    addOptions() {
        return {allowed: []};
    },

    addAttributes() {
        // filter here as well: TipTap reads the attribute itself and would overwrite the value of getAttrs
        const allowed = new Set(this.options.allowed);
        return {class: {default: null, parseHTML: el => tokens(el.getAttribute('class')).filter(c => allowed.has(c)).join(' ') || null}};
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

/** Nearest list around the cursor (for numbering type, format, start per level) */
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

/** Change attributes of the nearest list – only this level, not the outer lists */
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

/** Link with link format (class from the profile, e.g. "as button") */
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

/** Address of a media pool image (optionally via a media manager type), from the website root */
export function mediaSrc(config, file, type = '') {
    return type
        ? config.mediaManagerUrl.replace('__TYPE__', encodeURIComponent(type)).replace('__FILE__', encodeURIComponent(file))
        : config.mediaUrl + encodeURIComponent(file);
}

/**
 * Image with reference to the media pool (`data-rex-media`, `data-rex-media-type`) and image format (class) – the
 * output builds the correct address from it. Old relative addresses (`../media/…`) are corrected on load.
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

/** Validates a link address against the profile settings */
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
    // relative address: files from the media pool or internal paths
    return !!(link.media || link.internal);
}

/** Adds missing https:// for "www.example.org" */
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

/** Picker for pages and media: of a website interface (RexTiptap.pick, e.g. fluid) or of the backend (rex.pick) */
export function picker(config) {
    return window.RexTiptap?.pick ?? (config.backend ? window.rex?.pick : null) ?? null;
}
