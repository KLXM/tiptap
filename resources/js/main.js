/*
 REDAXO TipTap – Einstieg des Bundles (assets/tiptap.js, ES-Modul).

 Wird von tiptap-loader.js nachgeladen, sobald ein Editor auf der Seite steht. Stellt `window.RexTiptap` bereit und
 definiert das Element <rex-tiptap>.
 */

import * as core from '@tiptap/core';
import {RexTiptapEditor} from './editor.js';
import {registry} from './registry.js';
import {icon, addIcon} from './icons.js';
import {i18n} from './i18n.js';
import * as helpers from './extensions.js';

const instances = new WeakMap();

function profiles() {
    const node = document.getElementById('rex-tiptap-profiles');
    if (!node) {
        return {};
    }
    try {
        return JSON.parse(node.textContent);
    } catch {
        return {};
    }
}

class RexTiptapElement extends HTMLElement {
    connectedCallback() {
        if (instances.has(this)) {
            return;
        }
        if (!this.querySelector('textarea')) {
            // Inhalt wird noch geparst bzw. gleich eingefügt (upgradeTextareas)
            if ('loading' === document.readyState) {
                document.addEventListener('DOMContentLoaded', () => this.connectedCallback(), {once: true});
            } else {
                queueMicrotask(() => {
                    if (this.isConnected && !instances.has(this) && this.querySelector('textarea')) {
                        this.init();
                    }
                });
            }
            return;
        }
        this.init();
    }

    disconnectedCallback() {
        // Verschieben (z. B. Collection sortieren) löst disconnect + connect aus – nur wirklich entfernte aufräumen
        queueMicrotask(() => {
            if (!this.isConnected) {
                this.destroy();
            }
        });
    }

    init() {
        const textarea = this.querySelector('textarea');
        let config;
        try {
            config = this.dataset.config ? JSON.parse(this.dataset.config) : profiles()[this.getAttribute('profile') ?? 'tiptap.default'];
        } catch (e) {
            console.error('rex-tiptap: config', e);
        }
        if (!config) {
            console.warn('rex-tiptap: Profil nicht gefunden', this.getAttribute('profile'));
            return;
        }
        try {
            instances.set(this, new RexTiptapEditor(this, textarea, config));
        } catch (e) {
            // Ohne Editor bleibt die Textarea benutzbar
            console.error('rex-tiptap', e);
            textarea.hidden = false;
        }
    }

    destroy() {
        instances.get(this)?.destroy();
        instances.delete(this);
    }

    /** Die Instanz (Editor, Toolbar …) */
    get instance() {
        return instances.get(this) ?? null;
    }

    get editor() {
        return this.instance?.editor ?? null;
    }

    get value() {
        return this.instance?.value() ?? this.querySelector('textarea')?.value ?? '';
    }

    set value(value) {
        if (this.instance) {
            this.instance.setValue(value);
        } else if (this.querySelector('textarea')) {
            this.querySelector('textarea').value = value;
        }
    }
}

/** Textareas mit data-tiptap="profil" in <rex-tiptap> einpacken (YForm, eigene Formulare) */
function upgradeTextareas(root = document) {
    const list = root.matches?.('textarea[data-tiptap]') ? [root] : [...(root.querySelectorAll?.('textarea[data-tiptap]') ?? [])];
    for (const textarea of list) {
        if (textarea.closest('rex-tiptap') || textarea.closest('template')) {
            continue;
        }
        const element = document.createElement('rex-tiptap');
        element.setAttribute('profile', textarea.dataset.tiptap || 'tiptap.default');
        if (textarea.id) {
            element.dataset.labelFor = textarea.id;
        }
        if (textarea.required) {
            // versteckte Pflichtfelder blockieren das Absenden ohne sichtbare Meldung – der Editor prüft selbst
            textarea.required = false;
            textarea.setAttribute('data-tiptap-required', '');
        }
        textarea.before(element);
        element.append(textarea);
    }
}

const api = window.RexTiptap ?? {};
const queued = api.__queue ?? [];

Object.assign(api, {
    version: '1.0.0',
    register: plugin => registry.register(plugin),
    items: registry,
    icon,
    icons: {add: addIcon, get: icon},
    i18n,
    helpers,
    /** TipTap selbst – Erweiterungen anderer AddOns nutzen diese Klassen statt eines eigenen Bundles */
    tiptap: core,
    Editor: RexTiptapEditor,
    /** Instanz zu <rex-tiptap>, Textarea oder Element darin */
    get(element) {
        return element?.closest?.('rex-tiptap')?.instance ?? null;
    },
    upgrade: upgradeTextareas,
});
window.RexTiptap = api;

for (const plugin of queued) {
    registry.register(plugin);
}
queued.length = 0;

if (!customElements.get('rex-tiptap')) {
    customElements.define('rex-tiptap', RexTiptapElement);
}

upgradeTextareas(document);
new MutationObserver(mutations => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (1 === node.nodeType) {
                upgradeTextareas(node);
            }
        }
    }
}).observe(document.documentElement, {childList: true, subtree: true});

for (const cb of api.__ready ?? []) {
    cb(api);
}
api.__ready = [];
document.dispatchEvent(new CustomEvent('rex-tiptap:loaded', {detail: api}));
