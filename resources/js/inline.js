/*
 REDAXO TipTap – inline mode: the editor runs on an element of the page (editing in context, e.g. fluid) instead of in
 its own box. The element keeps its classes, so the typography of the website applies; the toolbar floats above it.

 const instance = RexTiptap.inline(element, 'tiptap.simple', {value: '<p>…</p>', label: 'Text'});
 element.addEventListener('rex-tiptap:change', e => save(e.detail.value));
 instance.destroy();   // element shows the current value again
 */

import {el, RexTiptapEditor} from './editor.js';
import {t} from './i18n.js';
import {icon} from './icons.js';

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
            this.buildMore();
            this.float.append(this.toolbar);
        }
        this.layer.append(this.float);
    }

    /**
     * The floating toolbar stays on one line: groups that don't fit move into a panel behind „⋯“ (see fit()).
     * The buttons are moved, not copied – they keep their state and their menus.
     */
    buildMore() {
        this.groups = [...this.toolbar.children];
        const btn = el('button', {
            type: 'button',
            className: 'rex-tiptap-button rex-tiptap-more-button',
            tabindex: '-1',
            title: t('more'),
            'aria-label': t('more'),
            'aria-haspopup': 'true',
            'aria-expanded': 'false',
        }, icon('more'));
        this.morePanel = el('div', {className: 'rex-tiptap-more-panel', role: 'group', 'aria-label': t('more'), hidden: true});
        this.more = el('div', {className: 'rex-tiptap-group rex-tiptap-more', role: 'group', hidden: true}, btn, this.morePanel);
        this.moreButton = btn;
        btn.addEventListener('mousedown', e => e.preventDefault());
        // keyboard (detail 0): focus moves into the panel; with the mouse it stays in the text
        btn.addEventListener('click', e => this.toggleMore(this.morePanel.hidden, 0 === e.detail));
        // a tool in the panel was used (menu entries and dialogs included): close it; a menu button keeps it open
        this.morePanel.addEventListener('click', e => {
            const target = e.target.closest('button');
            if (target && !target.hasAttribute('aria-haspopup')) {
                setTimeout(() => this.toggleMore(false), 0);
            }
        });
        this.morePanel.addEventListener('keydown', e => {
            if ('Escape' === e.key && !this.openMenu) {
                e.stopPropagation();
                this.toggleMore(false);
                btn.focus();
            }
        });
        this.toolbar.append(this.more);
        this.buttons.push({item: {id: 'more', label: t('more'), always: true}, btn});
    }

    toggleMore(open, focus = false) {
        if (!this.more) {
            return;
        }
        if (!open) {
            this.closeMenu(false);
        }
        this.morePanel.hidden = !open;
        this.moreButton.setAttribute('aria-expanded', String(open));
        if (open) {
            // open to the left if the panel would leave the window
            this.morePanel.classList.remove('is-start');
            const rect = this.morePanel.getBoundingClientRect();
            if (rect.left < 8) {
                this.morePanel.classList.add('is-start');
            }
            if (focus) {
                this.morePanel.querySelector('button:not(:disabled)')?.focus();
            }
        }
    }

    /** Moves groups from the end into the panel until the toolbar fits into the window on one line */
    fit() {
        if (!this.more || !this.morePanel.hidden || this.openMenu) {
            return;
        }
        const max = Math.min(innerWidth - 16, parseFloat(getComputedStyle(this.float).maxWidth) || Infinity);
        if (max === this.fitted) {
            return;
        }
        this.fitted = max;
        for (const group of this.groups) {
            this.toolbar.insertBefore(group, this.more);
        }
        this.more.hidden = true;
        if (this.toolbar.scrollWidth <= max) {
            return;
        }
        this.more.hidden = false;
        const inBar = [...this.groups];
        while (this.toolbar.scrollWidth > max && inBar.length > 1) {
            this.morePanel.prepend(inBar.pop());
        }
    }

    listen() {
        super.listen();
        // toolbar only while the text or the toolbar has the focus (menus, dialogs and the link bar count as well)
        this.onFocusChange = () => setTimeout(() => this.place(), 0);
        this.onViewport = () => this.place();
        this.root.addEventListener('focusin', this.onFocusChange);
        this.root.addEventListener('focusout', this.onFocusChange);
        this.float.addEventListener('focusout', this.onFocusChange);
        // the overflow panel closes on a click outside the toolbar
        this.onOutside = e => {
            if (this.more && !this.morePanel.hidden && !e.composedPath().includes(this.float)) {
                this.toggleMore(false);
            }
        };
        document.addEventListener('mousedown', this.onOutside);
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
        return this.editor.isFocused || inside(focused) || !!this.openMenu || !!this.dialog?.open || (this.more && !this.morePanel.hidden);
    }

    /** Above the element, kept in the window while the element is visible; below it if there is no room above */
    place() {
        const float = this.float;
        if (!float.isConnected || !this.active) {
            float.hidden = true;
            this.toggleMore(false);
            return;
        }
        float.hidden = false;
        this.fit();
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
        document.removeEventListener('mousedown', this.onOutside);
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

