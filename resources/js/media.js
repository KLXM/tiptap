/*
 * Media blocks: local video (media pool), video from YouTube/Vimeo (oEmbed, only the address is stored) and
 * HTML embed (protected code block). All three are "atoms": typing and formatting don't get inside, they can
 * only be selected, moved and deleted as a whole.
 *
 * Storage forms (sanitized and resolved on the server, see Output.php):
 *   <video src="…" data-rex-media="datei.mp4" poster="…" data-rex-poster="bild.jpg" controls … class="…"></video>
 *   <figure data-rex-oembed="https://youtu.be/…" data-rex-title="…" class="…"><a href="…">…</a></figure>
 *   <div data-rex-embed="&lt;iframe …&gt;" data-consent-service="maps" data-rex-label="Anfahrt"></div>
 */

import {Node, mergeAttributes} from '@tiptap/core';
import {t} from './i18n.js';
import {icon} from './icons.js';
import {mediaSrc, picker} from './extensions.js';

/** Aspect ratios: fixed classes, the addon ships the CSS (tiptap-media.css) */
export const RATIOS = [
    ['16x9', '16:9'], ['4x3', '4:3'], ['1x1', '1:1'], ['9x16', '9:16'], ['21x9', '21:9'],
];
const RATIO_CLASSES = RATIOS.map(([k]) => 'rex-ratio-' + k);
/** Sizes (width in the text flow) – so that alignment becomes visible */
export const SIZES = [['75', '75 %'], ['50', '50 %'], ['33', '33 %']];
const SIZE_CLASSES = SIZES.map(([k]) => 'rex-w-' + k);

function tokens(value) {
    return (value ?? '').split(/\s+/).filter(Boolean);
}

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (null === value || undefined === value || false === value) {
            continue;
        }
        if ('className' === key) {
            node.className = value;
        } else if ('text' === key) {
            node.textContent = value;
        } else if (key.startsWith('on')) {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            node.setAttribute(key, true === value ? '' : String(value));
        }
    }
    node.append(...children.filter(Boolean));
    return node;
}

/* ---------- Providers ---------- */

/** Detect YouTube/Vimeo: {provider, id, url} or null */
export function parseVideoUrl(value) {
    const url = (value ?? '').trim();
    let m = /^(?:https?:)?\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
    if (m) {
        return {provider: 'youtube', id: m[1], url};
    }
    m = /^(?:https?:)?\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{5,12})(?:\/([\da-f]{6,20}))?/i.exec(url);
    if (m) {
        return {provider: 'vimeo', id: m[1], hash: m[2] ?? null, url};
    }
    return null;
}

/** Player address (without cookies or with "do not track") */
export function playerUrl(video, autoplay = false) {
    if ('youtube' === video.provider) {
        return 'https://www.youtube-nocookie.com/embed/' + video.id + '?rel=0' + (autoplay ? '&autoplay=1' : '');
    }
    return 'https://player.vimeo.com/video/' + video.id + '?dnt=1' + (video.hash ? '&h=' + video.hash : '') + (autoplay ? '&autoplay=1' : '');
}

const PROVIDER_LABEL = {youtube: 'YouTube', vimeo: 'Vimeo'};

/* ---------- Classes (media formats + aspect ratio) ---------- */

/** Media formats of the profile for images or videos */
export function mediaStyles(config, kind) {
    return (config.image?.styles ?? []).filter(s => !s.media || 'both' === s.media || kind === s.media);
}

function classAttribute(config, kind) {
    const allowed = new Set([...mediaStyles(config, kind).flatMap(s => tokens(s.class)), ...RATIO_CLASSES, ...SIZE_CLASSES, ...Object.values(config.align ?? {}).flatMap(tokens)]);
    return {
        default: null,
        parseHTML: el => tokens(el.getAttribute('class')).filter(c => allowed.has(c)).join(' ') || null,
        renderHTML: attrs => attrs.class ? {class: attrs.class} : {},
    };
}

/** Compose or split a class from format and ratio */
let alignClasses = [];

function splitClass(value) {
    const list = tokens(value);
    const ratio = list.find(c => RATIO_CLASSES.includes(c))?.slice('rex-ratio-'.length) ?? '';
    const size = list.find(c => SIZE_CLASSES.includes(c)) ?? '';
    const align = list.filter(c => alignClasses.includes(c));
    // size goes along with alignment (both concern the position in the text flow)
    return {ratio, align: [size, ...align].filter(Boolean).join(' '), style: list.filter(c => !RATIO_CLASSES.includes(c) && !SIZE_CLASSES.includes(c) && !align.includes(c)).join(' ')};
}

/** Format + aspect ratio (+ size/alignment) to a class */
function joinClass(style, ratio, align = '') {
    return [...tokens(style), ...(ratio ? ['rex-ratio-' + ratio] : []), ...tokens(align)].join(' ') || null;
}

/** Replace the size in the classes ('' = full width) */
function withSize(value, size) {
    return [...tokens(value).filter(c => !SIZE_CLASSES.includes(c)), ...(size ? ['rex-w-' + size] : [])].join(' ') || null;
}

function sizeOf(value) {
    return tokens(value).find(c => SIZE_CLASSES.includes(c))?.slice('rex-w-'.length) ?? '';
}

function sizeSelect(value) {
    const select = el('select', {className: 'rex-input'},
        el('option', {value: '', text: t('sizeFull')}),
        ...SIZES.map(([k, label]) => el('option', {value: k, text: label})));
    select.value = value;
    return select;
}

const MEDIA_NODES = ['rexVideo', 'rexOembed'];

/** Is a media block selected (alignment then applies to it)? */
export function selectedMedia(editor) {
    const node = editor.state.selection.node;
    return node && MEDIA_NODES.includes(node.type.name) ? node : null;
}

/** Set the alignment of a selected media block (left = no class) */
export function alignMedia(editor, config, side) {
    const node = selectedMedia(editor);
    alignClasses = Object.values(config.align ?? {}).flatMap(tokens);
    const {ratio, style} = splitClass(node.attrs.class);
    const klass = 'left' === side ? '' : (config.align?.[side] ?? '');
    return editor.chain().focus().updateAttributes(node.type.name, {class: withSize(joinClass(style, ratio, klass), sizeOf(node.attrs.class))}).run();
}

export function mediaAlignActive(editor, config, side) {
    const node = selectedMedia(editor);
    const list = tokens(node?.attrs.class);
    const has = s => !!config.align?.[s] && tokens(config.align[s]).every(c => list.includes(c));
    return 'left' === side ? !['center', 'right', 'justify'].some(has) : has(side);
}

/* ---------- Shared rendering in the editor ---------- */

/**
 * Block in the editor: the medium itself (with format, aspect ratio and alignment classes as on the website),
 * the controls as a small bar at the top right – only on hover, on focus or when the block is selected.
 */
function frame(kind, ...children) {
    const label = el('span', {className: 'rex-tiptap-media-label'});
    const bar = el('div', {className: 'rex-tiptap-media-bar'}, icon(kind), label);
    const dom = el('div', {className: 'rex-tiptap-media rex-tiptap-media--' + kind, contenteditable: 'false', 'data-drag-handle': ''}, ...children, bar);
    return {dom, bar, label};
}

/** Classes on the block and alignment (data-align: left/center/right from the profile's classes) */
function applyClasses(dom, kind, value, config) {
    dom.className = 'rex-tiptap-media rex-tiptap-media--' + kind + (value ? ' ' + value : '');
    const list = tokens(value);
    const side = Object.entries(config.align ?? {}).find(([, klass]) => klass && tokens(klass).every(c => list.includes(c)))?.[0];
    if (side && 'left' !== side) {
        dom.dataset.align = side;
    } else {
        delete dom.dataset.align;
    }
}

function smallButton(label, iconName, onclick) {
    return el('button', {type: 'button', className: 'rex-tiptap-media-button', onclick: e => {
        e.preventDefault();
        e.stopPropagation();
        onclick();
    }}, icon(iconName), el('span', {text: label}));
}

/** Select the node and open the dialog (double-click or edit button) */
function editHandler(editor, getPos, open) {
    return () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (null !== pos && undefined !== pos) {
            editor.chain().focus().setNodeSelection(pos).run();
        }
        open();
    };
}

/* ---------- Local video ---------- */

export function rexVideo(config, ui) {
    return Node.create({
        name: 'rexVideo',
        group: 'block',
        atom: true,
        draggable: true,
        selectable: true,

        addAttributes() {
            const flag = name => ({
                default: false,
                parseHTML: el => el.hasAttribute(name),
                renderHTML: attrs => attrs[name] ? {[name]: ''} : {},
            });
            return {
                media: {default: null, parseHTML: el => el.getAttribute('data-rex-media'), renderHTML: a => a.media ? {'data-rex-media': a.media} : {}},
                src: {
                    default: null,
                    parseHTML: el => el.getAttribute('data-rex-media') ? mediaSrc(config, el.getAttribute('data-rex-media')) : (el.getAttribute('src') ?? el.querySelector('source')?.getAttribute('src')),
                    renderHTML: a => a.src ? {src: a.src} : {},
                },
                poster: {default: null, parseHTML: el => el.getAttribute('data-rex-poster'), renderHTML: a => a.poster ? {'data-rex-poster': a.poster, poster: mediaSrc(config, a.poster)} : {}},
                title: {default: null, parseHTML: el => el.getAttribute('title'), renderHTML: a => a.title ? {title: a.title} : {}},
                controls: {...flag('controls'), default: true},
                autoplay: flag('autoplay'),
                muted: flag('muted'),
                loop: flag('loop'),
                playsinline: flag('playsinline'),
                preload: {default: 'metadata', parseHTML: el => el.getAttribute('preload') ?? 'metadata', renderHTML: a => ({preload: a.preload || 'metadata'})},
                class: classAttribute(config, 'video'),
            };
        },

        parseHTML() {
            return [{tag: 'video'}];
        },

        renderHTML({HTMLAttributes}) {
            return ['video', mergeAttributes(HTMLAttributes)];
        },

        addNodeView() {
            return ({node, editor, getPos}) => {
                const video = el('video', {className: 'rex-tiptap-media-video', preload: 'metadata', muted: true, playsinline: true, controls: true});
                const open = editHandler(editor, getPos, () => ui.videoDialog());
                const {dom, bar, label} = frame('video', video);
                bar.append(smallButton(t('edit'), 'edit', open));
                dom.addEventListener('dblclick', open);
                const render = n => {
                    const a = n.attrs;
                    video.src = a.src ?? '';
                    if (a.poster) {
                        video.poster = mediaSrc(config, a.poster);
                    } else {
                        video.removeAttribute('poster');
                    }
                    const flags = ['autoplay', 'loop', 'muted'].filter(f => a[f]).map(f => t('video_' + f));
                    label.textContent = a.media ?? t('video');
                    dom.title = [a.title || a.media || a.src, ...flags].filter(Boolean).join(' · ');
                    applyClasses(dom, 'video', a.class, config);
                };
                render(node);
                return {
                    dom,
                    update: n => n.type.name === 'rexVideo' && (render(n), true),
                    stopEvent: e => e.target instanceof HTMLVideoElement || !!e.target.closest?.('.rex-tiptap-media-button'),
                    ignoreMutation: () => true,
                };
            };
        },
    });
}

/* ---------- YouTube / Vimeo ---------- */

export function rexOembed(config, ui) {
    return Node.create({
        name: 'rexOembed',
        group: 'block',
        atom: true,
        draggable: true,
        selectable: true,

        addAttributes() {
            return {
                url: {default: null, parseHTML: el => el.getAttribute('data-rex-oembed'), renderHTML: a => ({'data-rex-oembed': a.url})},
                title: {default: null, parseHTML: el => el.getAttribute('data-rex-title'), renderHTML: a => a.title ? {'data-rex-title': a.title} : {}},
                class: classAttribute(config, 'video'),
            };
        },

        parseHTML() {
            return [
                {tag: 'figure[data-rex-oembed]'},
                // content from CKEditor 5 (Media Embed)
                {tag: 'figure.media', getAttrs: el => {
                    const url = el.querySelector('oembed[url]')?.getAttribute('url');
                    return url && parseVideoUrl(url) ? {url} : false;
                }},
            ];
        },

        renderHTML({HTMLAttributes, node}) {
            // link as fallback in case the output happens without Tiptap::render()
            return ['figure', mergeAttributes(HTMLAttributes), ['a', {href: node.attrs.url}, node.attrs.title || node.attrs.url]];
        },

        addNodeView() {
            return ({node, editor, getPos}) => {
                let current = node;
                const thumb = el('img', {className: 'rex-tiptap-media-thumb', alt: '', loading: 'lazy'});
                const stage = el('div', {className: 'rex-tiptap-media-stage'}, thumb);
                const open = editHandler(editor, getPos, () => ui.oembedDialog());
                const play = () => {
                    const video = parseVideoUrl(current.attrs.url);
                    if (!video) {
                        return;
                    }
                    stage.replaceChildren(el('iframe', {
                        src: playerUrl(video, true),
                        title: current.attrs.title || PROVIDER_LABEL[video.provider],
                        allow: 'autoplay; fullscreen; picture-in-picture',
                        referrerpolicy: 'strict-origin-when-cross-origin',
                    }));
                };
                const {dom, bar, label} = frame('oembed', stage);
                bar.append(smallButton(t('oembedPreview'), 'play', play), smallButton(t('edit'), 'edit', open));
                dom.addEventListener('dblclick', e => e.target.closest('iframe') || open());
                const render = n => {
                    current = n;
                    const video = parseVideoUrl(n.attrs.url);
                    label.textContent = video ? PROVIDER_LABEL[video.provider] : t('oembed');
                    dom.title = n.attrs.title || n.attrs.url || '';
                    stage.replaceChildren(thumb);
                    thumb.hidden = !video || !config.oembedApi;
                    if (video && config.oembedApi) {
                        thumb.src = config.oembedApi + '&thumb=1&url=' + encodeURIComponent(n.attrs.url);
                    }
                    applyClasses(dom, 'oembed', n.attrs.class, config);
                };
                render(node);
                return {
                    dom,
                    update: n => n.type.name === 'rexOembed' && (n.attrs.url === current.attrs.url && n.attrs.class === current.attrs.class && n.attrs.title === current.attrs.title ? true : (render(n), true)),
                    stopEvent: e => !!e.target.closest?.('.rex-tiptap-media-button, iframe'),
                    ignoreMutation: () => true,
                };
            };
        },
    });
}

/* ---------- HTML-Embed ---------- */

export function rexHtmlEmbed(config, ui) {
    return Node.create({
        name: 'rexHtmlEmbed',
        group: 'block',
        atom: true,
        draggable: true,
        selectable: true,

        addAttributes() {
            return {
                html: {default: '', parseHTML: el => el.getAttribute('data-rex-embed') ?? '', renderHTML: a => ({'data-rex-embed': a.html ?? ''})},
                label: {default: null, parseHTML: el => el.getAttribute('data-rex-label'), renderHTML: a => a.label ? {'data-rex-label': a.label} : {}},
                service: {default: null, parseHTML: el => el.getAttribute('data-consent-service'), renderHTML: a => a.service ? {'data-consent-service': a.service} : {}},
                // server signature: only signed embeds are output (permission "HTML embeds")
                sig: {default: null, parseHTML: el => el.getAttribute('data-rex-sig'), renderHTML: a => a.sig ? {'data-rex-sig': a.sig} : {}},
            };
        },

        parseHTML() {
            return [{tag: 'div[data-rex-embed]'}];
        },

        renderHTML({HTMLAttributes}) {
            return ['div', mergeAttributes(HTMLAttributes)];
        },

        addNodeView() {
            return ({node, editor, getPos}) => {
                const code = el('pre', {className: 'rex-tiptap-media-code'});
                const info = el('small', {className: 'rex-tiptap-media-info'});
                const canEdit = !!config.htmlEmbed;
                const open = editHandler(editor, getPos, () => ui.htmlEmbedDialog());
                const {dom, bar, label} = frame('htmlEmbed', code, info);
                if (canEdit) {
                    bar.append(smallButton(t('edit'), 'edit', open));
                    dom.addEventListener('dblclick', open);
                }
                const render = n => {
                    const html = n.attrs.html ?? '';
                    label.textContent = n.attrs.label || t('htmlEmbed');
                    code.textContent = html.length > 600 ? html.slice(0, 600) + ' …' : html;
                    info.textContent = [
                        n.attrs.label ? t('htmlEmbed') : '',
                        n.attrs.service ? t('embedService') + ': ' + n.attrs.service : '',
                        /<script/i.test(html) ? t('embedHasScript') : '',
                        n.attrs.sig ? '' : t('embedUnsigned'),
                        canEdit ? '' : t('embedNoPermission'),
                    ].filter(Boolean).join(' · ');
                    info.hidden = !info.textContent;
                };
                render(node);
                return {
                    dom,
                    update: n => n.type.name === 'rexHtmlEmbed' && (render(n), true),
                    stopEvent: e => !!e.target.closest?.('.rex-tiptap-media-button'),
                    ignoreMutation: () => true,
                };
            };
        },
    });
}

/* ---------- Dialogs (editor methods, see editor.js) ---------- */

function ratioSelect(value, withOriginal) {
    const select = el('select', {className: 'rex-input'},
        withOriginal ? el('option', {value: '', text: t('ratioOriginal')}) : null,
        ...RATIOS.map(([k, label]) => el('option', {value: k, text: label})));
    select.value = value || (withOriginal ? '' : '16x9');
    return select;
}

function styleSelect(config, kind, value) {
    const styles = mediaStyles(config, kind);
    if (!styles.length) {
        return null;
    }
    const select = el('select', {className: 'rex-input'},
        el('option', {value: '', text: t('imageStyleNone')}),
        ...styles.map(s => el('option', {value: s.class, text: s.label})));
    select.value = value ?? '';
    return select;
}

function check(label, checked) {
    const input = el('input', {type: 'checkbox'});
    input.checked = !!checked;
    return {input, node: el('label', {className: 'rex-tiptap-check'}, input, el('span', {text: label}))};
}

/** Insert or replace a node (if one is selected, it is updated) */
function upsert(editor, name, attrs, selection) {
    const chain = editor.chain().focus();
    if (selection?.node?.type.name === name) {
        return chain.setNodeSelection(selection.from).updateAttributes(name, attrs).run();
    }
    return chain.insertContentAt({from: selection.from, to: selection.to}, {type: name, attrs}).run();
}

export const mediaDialogs = {
    videoDialog() {
        const {editor, config} = this;
        alignClasses = Object.values(config.align ?? {}).flatMap(tokens);
        const selection = editor.state.selection;
        const attrs = selection.node?.type.name === 'rexVideo' ? selection.node.attrs : {controls: true};
        const pick = picker(config);
        let media = attrs.media ?? null;
        let poster = attrs.poster ?? null;

        const src = el('input', {type: 'text', className: 'rex-input', value: media ?? attrs.src ?? '', readonly: true, spellcheck: 'false'});
        const posterInput = el('input', {type: 'text', className: 'rex-input', value: poster ?? '', readonly: true, spellcheck: 'false'});
        const title = el('input', {type: 'text', className: 'rex-input', value: attrs.title ?? ''});
        const preview = el('video', {className: 'rex-tiptap-image-preview', controls: true, preload: 'metadata', hidden: !attrs.src, src: attrs.src || null});
        const {ratio, align: alignValue, style: styleValue} = splitClass(attrs.class);
        const style = styleSelect(config, 'video', styleValue);
        const ratioField = ratioSelect(ratio, true);
        const sizeField = sizeSelect(sizeOf(attrs.class));
        const controls = check(t('video_controls'), attrs.controls);
        const autoplay = check(t('video_autoplay'), attrs.autoplay);
        const loop = check(t('video_loop'), attrs.loop);
        const muted = check(t('video_muted'), attrs.muted);
        // autoplay only works muted – otherwise the browser blocks it
        const syncMuted = () => {
            if (autoplay.input.checked) {
                muted.input.checked = true;
            }
            muted.input.disabled = autoplay.input.checked;
        };
        autoplay.input.addEventListener('change', syncMuted);
        syncMuted();
        // video editor (optional): without a custom choice the poster comes from there on output (not stored)
        const ve = config.videoEditor ?? null;
        let autoPoster = null;
        const status = el('small', {className: 'rex-tiptap-hint', role: 'status'});
        const veCall = async (action, extra = {}) => {
            const body = new FormData();
            body.append('action', action);
            body.append('file', media);
            for (const [k, v] of Object.entries(extra)) {
                body.append(k, String(v));
            }
            const data = await (await fetch(ve.api, {method: 'POST', body, credentials: 'same-origin'})).json();
            if (!data?.ok) {
                throw new Error(data?.error || 'video_editor');
            }
            return data;
        };
        const loadAutoPoster = async () => {
            autoPoster = null;
            if (ve?.api && media && !poster) {
                try {
                    autoPoster = (await veCall('info')).poster?.src ?? null;
                } catch {
                    autoPoster = null;
                }
            }
            showPoster();
        };
        const showPoster = () => {
            const url = poster ? mediaSrc(config, poster) : autoPoster;
            if (url) {
                preview.poster = url;
            } else {
                preview.removeAttribute('poster');
            }
            posterInput.placeholder = !poster && ve ? (autoPoster ? t('videoPosterAuto') : t('videoPosterAutoNone')) : '';
        };
        const refresh = () => {
            preview.src = media ? mediaSrc(config, media) : '';
            preview.hidden = !media;
            showPoster();
            if (captureButton) {
                captureButton.disabled = !media;
            }
            if (editLink) {
                editLink.hidden = !media;
                editLink.href = media ? ve.edit.replace('__FILE__', encodeURIComponent(media)) : '#';
            }
        };
        const capture = async () => {
            captureButton.disabled = true;
            status.textContent = t('videoPosterCapturing');
            try {
                const data = await veCall('poster', {time: preview.currentTime.toFixed(3)});
                // release the custom poster again: the still frame applies automatically (also after later changes)
                poster = null;
                posterInput.value = '';
                autoPoster = data.poster?.src ?? autoPoster;
                status.textContent = t('videoPosterCaptured');
                showPoster();
            } catch (e) {
                status.textContent = e.message;
            } finally {
                captureButton.disabled = !media;
            }
        };
        const captureButton = ve?.api ? el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: capture}, icon('image'), el('span', {text: t('videoPosterCapture')})) : null;
        const editLink = ve?.edit ? el('a', {className: 'rex-tiptap-dialog-button', target: '_blank', rel: 'noopener', hidden: true}, icon('external'), el('span', {text: t('videoEditInEditor')})) : null;

        const chooseVideo = async () => {
            const [item] = await window.rex.pick('media', {types: config.video?.types ?? ['mp4', 'webm']}) ?? [];
            if (item) {
                media = item.value;
                src.value = media;
                refresh();
                loadAutoPoster();
            }
        };
        const choosePoster = async () => {
            const [item] = await window.rex.pick('media', {types: config.image?.types ?? ['jpg', 'jpeg', 'png', 'webp']}) ?? [];
            if (item) {
                poster = item.value;
                posterInput.value = poster;
                refresh();
            }
        };
        const clearPoster = el('button', {type: 'button', className: 'rex-tiptap-dialog-button', text: t('remove'), onclick: () => {
            poster = null;
            posterInput.value = '';
            refresh();
            loadAutoPoster();
        }});

        const fields = [];
        if (pick) {
            fields.push(el('div', {className: 'rex-tiptap-pickers'},
                el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: chooseVideo}, icon('media'), el('span', {text: t('videoMedia')}))));
        }
        fields.push(this.field(t('videoFile'), src), preview);
        if (captureButton || editLink) {
            fields.push(el('div', {className: 'rex-tiptap-pickers'}, captureButton, editLink, status));
        }
        fields.push(el('div', {className: 'rex-tiptap-field-row'},
            this.field(t('videoPoster'), posterInput),
            pick ? el('div', {className: 'rex-tiptap-pickers rex-tiptap-pickers--end'},
                el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: choosePoster}, icon('image'), el('span', {text: t('videoPosterChoose')})), clearPoster) : null));
        fields.push(el('div', {className: 'rex-tiptap-field-row'},
            style ? this.field(t('mediaStyle'), style) : null,
            this.field(t('ratio'), ratioField, t('ratioHintVideo')),
            this.field(t('size'), sizeField)));
        fields.push(el('div', {className: 'rex-tiptap-checks'}, controls.node, autoplay.node, loop.node, muted.node));
        fields.push(this.field(t('videoTitle'), title, t('videoTitleHint')));

        this.openDialog(attrs.src ? t('videoEdit') : t('videoInsert'), fields, () => {
            if (!media) {
                return t('videoFile') + '?';
            }
            upsert(editor, 'rexVideo', {
                media,
                src: mediaSrc(config, media),
                poster,
                title: title.value.trim() || null,
                controls: controls.input.checked || !autoplay.input.checked,
                autoplay: autoplay.input.checked,
                muted: muted.input.checked || autoplay.input.checked,
                loop: loop.input.checked,
                playsinline: autoplay.input.checked,
                class: withSize(joinClass(style?.value, ratioField.value, alignValue), sizeField.value),
            }, selection);
        });
        refresh();
        loadAutoPoster();
        if (!attrs.src && pick) {
            chooseVideo();
        }
    },

    oembedDialog(initialUrl = '') {
        const {editor, config} = this;
        alignClasses = Object.values(config.align ?? {}).flatMap(tokens);
        const selection = editor.state.selection;
        const attrs = selection.node?.type.name === 'rexOembed' ? selection.node.attrs : {};
        const providers = config.embed?.providers ?? ['youtube', 'vimeo'];
        const url = el('input', {type: 'url', className: 'rex-input', value: attrs.url ?? initialUrl, placeholder: 'https://www.youtube.com/watch?v=…', spellcheck: 'false'});
        const title = el('input', {type: 'text', className: 'rex-input', value: attrs.title ?? ''});
        const {ratio, align: alignValue, style: styleValue} = splitClass(attrs.class);
        const style = styleSelect(config, 'video', styleValue);
        const ratioField = ratioSelect(ratio || '16x9', false);
        const sizeField = sizeSelect(sizeOf(attrs.class));
        const thumb = el('img', {className: 'rex-tiptap-image-preview', alt: '', hidden: true});
        const fetchMeta = async () => {
            const video = parseVideoUrl(url.value);
            thumb.hidden = !video || !config.oembedApi;
            if (!video || !config.oembedApi) {
                return;
            }
            thumb.src = config.oembedApi + '&thumb=1&url=' + encodeURIComponent(url.value.trim());
            if (!title.value.trim()) {
                try {
                    const meta = await (await fetch(config.oembedApi + '&url=' + encodeURIComponent(url.value.trim()), {credentials: 'same-origin'})).json();
                    if (meta?.title && !title.value.trim()) {
                        title.value = meta.title;
                    }
                } catch {
                    // continue without title
                }
            }
        };
        url.addEventListener('change', fetchMeta);
        const fields = [
            this.field(t('oembedUrl'), url, providers.map(p => PROVIDER_LABEL[p] ?? p).join(', ')),
            thumb,
            this.field(t('oembedTitle'), title, t('oembedTitleHint')),
            el('div', {className: 'rex-tiptap-field-row'},
                style ? this.field(t('mediaStyle'), style) : null,
                this.field(t('ratio'), ratioField),
                this.field(t('size'), sizeField)),
        ];
        this.openDialog(attrs.url ? t('oembedEdit') : t('oembedInsert'), fields, () => {
            const video = parseVideoUrl(url.value);
            if (!video || !providers.includes(video.provider)) {
                return t('oembedInvalid');
            }
            upsert(editor, 'rexOembed', {
                url: url.value.trim(),
                title: title.value.trim() || null,
                class: withSize(joinClass(style?.value, ratioField.value, alignValue), sizeField.value),
            }, selection);
        });
        if (url.value) {
            fetchMeta();
        }
    },

    async htmlEmbedDialog() {
        const {editor, config} = this;
        if (!config.htmlEmbed) {
            return;
        }
        const selection = editor.state.selection;
        const attrs = selection.node?.type.name === 'rexHtmlEmbed' ? selection.node.attrs : {};
        let html = attrs.html ?? '';
        const label = el('input', {type: 'text', className: 'rex-input', value: attrs.label ?? ''});
        const service = el('input', {type: 'text', className: 'rex-input', value: attrs.service ?? '', placeholder: 'google_maps', spellcheck: 'false', pattern: '[a-z0-9_-]*'});
        const host = el('div', {className: 'rex-tiptap-code rex-tiptap-code--dialog'});
        const fallback = el('textarea', {className: 'rex-input rex-tiptap-embed-textarea', rows: '10', spellcheck: 'false'});
        fallback.value = html;
        fallback.addEventListener('input', () => {
            html = fallback.value;
            warn();
        });
        const warning = el('p', {className: 'rex-tiptap-dialog-warning', role: 'status', hidden: true});
        const warn = () => {
            const issues = [];
            if (/\son[a-z]+\s*=/i.test(html)) {
                issues.push(t('embedWarnHandler'));
            }
            if (/javascript:/i.test(html)) {
                issues.push(t('embedWarnJs'));
            }
            if (/\sstyle\s*=/i.test(html)) {
                issues.push(t('embedWarnStyle'));
            }
            warning.textContent = issues.join(' ');
            warning.hidden = !issues.length;
        };
        warn();
        const codeField = el('div', {className: 'rex-tiptap-field'}, el('span', {className: 'rex-tiptap-field-label', text: t('embedCode')}), host, warning);
        const fields = [
            codeField,
            el('div', {className: 'rex-tiptap-field-row'},
                this.field(t('embedLabel'), label, t('embedLabelHint')),
                this.field(t('embedService'), service, t('embedServiceHint'))),
        ];
        const dialog = this.openDialog(attrs.html ? t('embedEdit') : t('embedInsert'), fields, async () => {
            if (!html.trim()) {
                return t('embedCode') + '?';
            }
            const key = service.value.trim().toLowerCase();
            if (key && !/^[a-z0-9_-]{1,64}$/.test(key)) {
                return t('embedServiceInvalid');
            }
            // have the server sign it – without a signature Tiptap::render() doesn't output the code
            let sig = null;
            try {
                const body = new FormData();
                body.append('html', html.trim());
                body.append('service', key);
                const response = await fetch(config.embedSignApi, {method: 'POST', body, credentials: 'same-origin'});
                sig = response.ok ? (await response.json()).sig : null;
            } catch {
                sig = null;
            }
            if (!sig) {
                return t('embedSignFailed');
            }
            upsert(editor, 'rexHtmlEmbed', {html: html.trim(), label: label.value.trim() || null, service: key || null, sig}, selection);
        });
        dialog.classList.add('rex-tiptap-dialog--wide');
        try {
            const {createCodeView} = await import('./code.js');
            const view = createCodeView({parent: host, doc: html, mode: 'html', label: t('embedCode'), onChange: value => {
                html = value;
                warn();
            }});
            dialog.addEventListener('close', () => view.destroy());
            view.focus();
        } catch {
            host.replaceWith(fallback);
            fallback.focus();
        }
    },

    /** Pasted YouTube/Vimeo address alone on a line → video */
    pasteVideoUrl(text) {
        if (!this.has('oembed') || !text || /\s/.test(text.trim())) {
            return false;
        }
        const video = parseVideoUrl(text);
        if (!video || !(this.config.embed?.providers ?? ['youtube', 'vimeo']).includes(video.provider)) {
            return false;
        }
        const {$from} = this.editor.state.selection;
        if ($from.parent.textContent.trim() !== '') {
            return false;
        }
        this.editor.chain().focus().insertContent({type: 'rexOembed', attrs: {url: text.trim(), class: 'rex-ratio-16x9'}}).run();
        return true;
    },
};

/** Right-click entries for the media blocks */
export function mediaContext(name, ui) {
    const {editor, config} = ui;
    const node = editor.state.selection.node;
    if (node?.type.name !== name) {
        return null;
    }
    const kind = 'rexHtmlEmbed' === name ? null : 'video';
    const set = attrs => editor.chain().focus().updateAttributes(name, attrs).run();
    alignClasses = Object.values(config.align ?? {}).flatMap(tokens);
    const {ratio, style, align} = splitClass(node.attrs.class);
    const entries = [];
    if ('rexVideo' === name) {
        entries.push({label: t('videoEdit'), icon: 'edit', run: () => ui.videoDialog()});
    } else if ('rexOembed' === name) {
        entries.push({label: t('oembedEdit'), icon: 'edit', run: () => ui.oembedDialog()});
    } else if (config.htmlEmbed) {
        entries.push({label: t('embedEdit'), icon: 'edit', run: () => ui.htmlEmbedDialog()});
    }
    if (kind) {
        const styles = mediaStyles(config, kind);
        if (styles.length) {
            entries.push({separator: true},
                {label: t('imageStyleNone'), radio: true, active: () => !style, run: () => set({class: joinClass('', ratio, align)})},
                ...styles.map(s => ({label: s.label, radio: true, active: () => style === s.class, run: () => set({class: joinClass(s.class, ratio, align)})})));
        }
        const size = sizeOf(node.attrs.class);
        entries.push({separator: true},
            {label: t('sizeFull'), radio: true, active: () => !size, run: () => set({class: withSize(node.attrs.class, '')})},
            ...SIZES.map(([k, label]) => ({label: t('size') + ' ' + label, radio: true, active: () => size === k, run: () => set({class: withSize(node.attrs.class, k)})})));
        const sides = ['left', 'center', 'right'].filter(side => config.align?.[side]);
        if (sides.length) {
            entries.push({separator: true}, ...sides.map(side => ({
                label: t('align' + side[0].toUpperCase() + side.slice(1)),
                icon: 'align' + side[0].toUpperCase() + side.slice(1),
                radio: true,
                active: () => mediaAlignActive(editor, config, side),
                run: () => alignMedia(editor, config, side),
            })));
        }
        entries.push({separator: true},
            ...('rexVideo' === name ? [{label: t('ratioOriginal'), radio: true, active: () => !ratio, run: () => set({class: joinClass(style, '', align)})}] : []),
            ...RATIOS.map(([k, label]) => ({label, radio: true, active: () => ratio === k, run: () => set({class: joinClass(style, k, align)})})));
    }
    entries.push({separator: true}, {label: t('remove'), icon: 'trash', danger: true, run: () => editor.chain().focus().deleteSelection().run()});
    return entries;
}
