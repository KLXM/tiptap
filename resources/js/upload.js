/*
 * Dateien per Ziehen oder Einfügen (auch Screenshots aus der Zwischenablage): landen im Medienpool (UploadApi) und
 * dann als Bild bzw. Video im Text. Während des Hochladens steht an der Stelle ein Platzhalter mit Fortschritt.
 * Ohne Upload-Recht (Frontend, Gäste, Profil ohne Upload) wird die Datei nur abgefangen – der Browser soll sie nicht
 * öffnen – und ein Hinweis erscheint.
 */

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';
import {t} from './i18n.js';
import {mediaSrc} from './extensions.js';

const key = new PluginKey('rexUpload');

/** Position eines Platzhalters (nach Änderungen im Text verschoben) oder null */
function placeholderPos(state, id) {
    const found = key.getState(state)?.find(null, null, spec => spec.id === id) ?? [];
    return found.length ? found[0].from : null;
}

export function rexUpload(ui) {
    return Extension.create({
        name: 'rexUpload',
        addProseMirrorPlugins() {
            return [new Plugin({
                key,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, set) {
                        set = set.map(tr.mapping, tr.doc);
                        const action = tr.getMeta(key);
                        if (action?.add) {
                            set = set.add(tr.doc, [Decoration.widget(action.add.pos, action.add.dom, {id: action.add.id, side: -1})]);
                        }
                        if (action?.remove) {
                            set = set.remove(set.find(null, null, spec => spec.id === action.remove));
                        }
                        return set;
                    },
                },
                props: {
                    decorations: state => key.getState(state),
                    handleDrop(view, event, slice, moved) {
                        const files = [...(event.dataTransfer?.files ?? [])];
                        if (moved || !files.length) {
                            return false;
                        }
                        event.preventDefault();
                        const pos = view.posAtCoords({left: event.clientX, top: event.clientY})?.pos ?? view.state.selection.from;
                        ui.uploadFiles(files, pos);
                        return true;
                    },
                    handlePaste(view, event) {
                        const files = [...(event.clipboardData?.files ?? [])];
                        // Text in der Zwischenablage hat Vorrang (Word legt oft zusätzlich ein Bild der Auswahl ab)
                        if (!files.length || (event.clipboardData.getData('text/plain') ?? '').trim()) {
                            return false;
                        }
                        event.preventDefault();
                        ui.uploadFiles(files, view.state.selection.from);
                        return true;
                    },
                },
            })];
        },
    });
}

function send(url, file, profile, onProgress) {
    return new Promise((resolve, reject) => {
        const body = new FormData();
        body.append('file', file, file.name || 'upload');
        body.append('profile', profile);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.withCredentials = true;
        xhr.upload.addEventListener('progress', e => e.lengthComputable && onProgress(Math.round(e.loaded / e.total * 100)));
        xhr.addEventListener('load', () => {
            let data = null;
            try {
                data = JSON.parse(xhr.responseText);
            } catch {
                data = null;
            }
            if (data?.ok) {
                resolve(data);
            } else {
                reject(new Error(data?.error || t('uploadError')));
            }
        });
        xhr.addEventListener('error', () => reject(new Error(t('uploadError'))));
        xhr.send(body);
    });
}

/** Methoden des Editors (siehe editor.js) */
export const uploadMethods = {
    async uploadFiles(files, pos) {
        const {editor, config} = this;
        if (!config.uploadApi) {
            this.note(t('uploadNotHere'));
            return;
        }
        const images = this.has('image') ? (config.image?.types ?? []) : [];
        const videos = this.has('video') ? (config.video?.types ?? []) : [];
        for (let file of files) {
            // Screenshots aus der Zwischenablage heißen „image.png“ – sprechender Name mit Zeitpunkt
            if (/^image\.(png|jpe?g|gif|webp)$/i.test(file.name ?? '')) {
                const d = new Date();
                const pad = n => String(n).padStart(2, '0');
                const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
                file = new File([file], 'screenshot-' + stamp + '.' + file.name.split('.').pop().toLowerCase(), {type: file.type});
            }
            const ext = (/\.([a-z0-9]+)$/i.exec(file.name ?? '')?.[1] ?? '').toLowerCase();
            if (!ext || ![...images, ...videos].includes(ext)) {
                this.note(t('uploadType').replace('%s', ext || file.type || '?'));
                continue;
            }
            const id = {};
            const dom = document.createElement('span');
            dom.className = 'rex-tiptap-upload';
            dom.setAttribute('role', 'status');
            dom.textContent = t('uploadProgress').replace('%s', '0');
            editor.view.dispatch(editor.state.tr.setMeta(key, {add: {id, pos, dom}}));
            try {
                const data = await send(config.uploadApi, file, config.name, p => {
                    dom.textContent = t('uploadProgress').replace('%s', String(p));
                });
                const at = placeholderPos(editor.state, id) ?? pos;
                editor.view.dispatch(editor.state.tr.setMeta(key, {remove: id}));
                const type = config.image?.mediaType || '';
                const node = 'video' === data.kind
                    ? {type: 'rexVideo', attrs: {media: data.file, src: mediaSrc(config, data.file), controls: true}}
                    : {type: 'image', attrs: {src: mediaSrc(config, data.file, type), media: data.file, mediaType: type || null}};
                editor.chain().focus().insertContentAt(at, node).run();
                // ohne Alternativtext im Medienpool: Hinweis mit Knopf zum Bild-Dialog
                if ('image' === data.kind && null === data.alt) {
                    this.note(t('uploadAltMissing'), t('uploadAltAction'), () => {
                        let found = null;
                        editor.state.doc.descendants((n, p) => {
                            if (null === found && 'image' === n.type.name && n.attrs.media === data.file) {
                                found = p;
                            }
                        });
                        if (null !== found) {
                            editor.chain().focus().setNodeSelection(found).run();
                            this.imageDialog();
                        }
                    });
                }
            } catch (e) {
                editor.view.dispatch(editor.state.tr.setMeta(key, {remove: id}));
                this.note(e.message);
            }
        }
    },
};
