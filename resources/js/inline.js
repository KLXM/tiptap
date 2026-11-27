/*
 REDAXO TipTap – inline mode: the editor runs on an element of the page (editing in context, e.g. fluid) instead of in
 its own box. The element keeps its classes, so the typography of the website applies; the toolbar floats above it.

 const instance = RexTiptap.inline(element, 'tiptap.simple', {value: '<p>…</p>', label: 'Text'});
 element.addEventListener('rex-tiptap:change', e => save(e.detail.value));
 instance.destroy();   // element shows the current value again
 */

import {el, RexTiptapEditor} from './editor.js';

/** Tools that need the box of the normal editor */
const BOX_ONLY = ['source', 'fullscreen'];

export class RexTiptapInline extends RexTiptapEditor {
    /**
     * @param {HTMLElement} host element on the page, its content is replaced by the editor
     * @param {object} config client config of a profile
     * @param {{value?: string, label?: string, layer?: HTMLElement}} options value (default: content of the element),
     *     accessible name, element for the floating toolbar and the link bar (default: document.body)
     */
    constructor(host, config, options = {}) {
        const textarea = document.createElement('textarea');
        textarea.value = options.value ?? host.innerHTML;
        textarea.setAttribute('aria-label', options.label ?? '');
        const toolbar = config.toolbar.map(group => group.filter(id => !BOX_ONLY.includes(id))).filter(group => group.length);
        pending = options;
        super(host, textarea, {...config, toolbar, stickyToolbar: false, counter: false});
    }

    layout() {
        const {root, config} = this;
        this.options = pending ?? {};
        pending = null;
        this.layer = this.options.layer ?? document.body;
        root.classList.add('rex-tiptap-inline');
        root.dataset.mode = config.mode;
        this.content = root;
        this.body = root;
        this.counter = el('span');
        root.replaceChildren();
        this.float = el('div', {className: 'rex-tiptap rex-tiptap-float', hidden: true});
        if (this.toolbar.childElementCount) {
            this.float.append(this.toolbar);
        }
        this.layer.append(this.float);
    }

    listen() {
        super.listen();
        // toolbar only while the text or the toolbar has the focus (menus, dialogs and the link bar count as well)
        this.onFocusChange = () => setTimeout(() => this.place(), 0);
        this.onViewport = () => this.place();
        this.root.addEventListener('focusin', this.onFocusChange);
        this.root.addEventListener('focusout', this.onFocusChange);
        this.float.addEventListener('focusout', this.onFocusChange);
        addEventListener('scroll', this.onViewport, {passive: true, capture: true});
        addEventListener('resize', this.onViewport, {passive: true});
    }

    createEditor() {
        super.createEditor();
        this.editor.view.dom.classList.add('rex-tiptap-inline-prose');
        if (this.options.label) {
            this.editor.view.dom.setAttribute('aria-label', this.options.label);
        }
        this.editor.on('focus', () => this.place());
        this.editor.on('blur', () => setTimeout(() => this.place(), 0));
    }

    buildLinkBubble() {
        super.buildLinkBubble();
        if (this.bubble) {
            this.bubble.classList.add('rex-tiptap-bubble--fixed');
            this.layer.append(this.bubble);
        }
    }

    placeBubble(bubble, coords) {
        const width = bubble.offsetWidth;
        bubble.style.left = Math.max(8, Math.min(coords.left, innerWidth - width - 8)) + 'px';
        bubble.style.top = (coords.bottom + 6) + 'px';
    }

    /** Is the editor in use: focus in the text, the toolbar, an open menu or a dialog? */
    get active() {
        if (!this.editor || this.editor.isDestroyed) {
            return false;
        }
        const inside = node => node && (this.float.contains(node) || this.root.contains(node) || this.bubble?.contains(node));
        const focused = this.float.getRootNode().activeElement ?? document.activeElement;
        return this.editor.isFocused || inside(focused) || !!this.openMenu || !!this.dialog?.open;
    }

    /** Above the element, kept in the window while the element is visible; below it if there is no room above */
    place() {
        const float = this.float;
        if (!float.isConnected || !this.active) {
            float.hidden = true;
            return;
        }
        float.hidden = false;
        const rect = this.root.getBoundingClientRect();
        const height = float.offsetHeight;
        const width = float.offsetWidth;
        let top = rect.top - height - 8;
        if (top < 8) {
            top = rect.bottom - height < 8 ? rect.bottom + 8 : 8;
        }
        float.style.top = Math.max(8, Math.min(top, innerHeight - height - 8)) + 'px';
        float.style.left = Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + 'px';
    }

    update() {
        super.update();
        requestAnimationFrame(() => this.place());
    }

    destroy() {
        const value = this.editor ? this.value() : this.textarea.value;
        removeEventListener('scroll', this.onViewport, {capture: true});
        removeEventListener('resize', this.onViewport);
        this.root.removeEventListener('focusin', this.onFocusChange);
        this.root.removeEventListener('focusout', this.onFocusChange);
        super.destroy();
        this.float.remove();
        this.bubble?.remove();
        this.root.classList.remove('rex-tiptap-inline', 'rex-tiptap');
        delete this.root.dataset.mode;
        if (this.markdown) {
            this.root.textContent = value;
        } else {
            this.root.innerHTML = value;
        }
    }
}

let pending = null;

