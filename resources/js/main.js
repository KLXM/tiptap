/*
 REDAXO TipTap – bundle entry point (assets/tiptap.js, ES module).

 Loaded by tiptap-loader.js as soon as an editor is on the page. Provides `window.RexTiptap` and
 defines the <rex-tiptap> element.
 */

import * as core from '@tiptap/core';
import {RexTiptapEditor} from './editor.js';
import {RexTiptapInline} from './inline.js';
import {registry} from './registry.js';
import {icon, addIcon} from './icons.js';
import {i18n} from './i18n.js';
import * as helpers from './extensions.js';

const instances = new WeakMap();
const inlineInstances = new WeakMap();

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
            // content is still being parsed or about to be inserted (upgradeTextareas)
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
        // moving (e.g. sorting a collection) triggers disconnect + connect – only clean up those really removed
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
            // without an editor the textarea stays usable
            console.error('rex-tiptap', e);
            textarea.hidden = false;
        }
    }

    destroy() {
        instances.get(this)?.destroy();
        instances.delete(this);
    }

    /** The instance (editor, toolbar …) */
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

/** Wrap textareas with data-tiptap="profile" in <rex-tiptap> (YForm, custom forms) */
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
            // hidden required fields block submitting without a visible message – the editor validates itself
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
    /** TipTap itself – extensions of other addons use these classes instead of their own bundle */
    tiptap: core,
    Editor: RexTiptapEditor,
    /**
     * Inline mode: editor on an element of the page (editing in context) with a floating toolbar.
     * `profile`: name (from <script id="rex-tiptap-profiles">) or the client config of a profile (Tiptap::clientConfig()).
     * Changes arrive as `rex-tiptap:change` at the element; `destroy()` shows the value in the element again.
     */
    inline(element, profile, options = {}) {
        const config = 'string' === typeof profile ? profiles()[profile] : profile;
        if (!config) {
            console.warn('rex-tiptap: Profil nicht gefunden', profile);
            return null;
        }
        inlineInstances.get(element)?.destroy();
        const instance = new RexTiptapInline(element, config, options);
        inlineInstances.set(element, instance);
        const destroy = instance.destroy.bind(instance);
        instance.destroy = () => {
            inlineInstances.delete(element);
            destroy();
        };
        return instance;
    },
    Inline: RexTiptapInline,
    /** Instance for <rex-tiptap>, a textarea or an element inside */
    get(element) {
        return element?.closest?.('rex-tiptap')?.instance ?? inlineInstances.get(element) ?? null;
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
