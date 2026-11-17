/* Editor-Instanz: TipTap + Toolbar + Dialoge, gebunden an eine Textarea */

import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import {CharacterCount, Placeholder} from '@tiptap/extensions';
import {TableKit} from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';

import {t} from './i18n.js';
import {icon} from './icons.js';
import {allowedUrl, BlockClass, InlineStyle, normalizeUrl} from './extensions.js';
import {registry} from './registry.js';

let uid = 0;

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

export class RexTiptapEditor {
    constructor(root, textarea, config) {
        this.root = root;
        this.textarea = textarea;
        this.config = config;
        this.id = 'rex-tiptap-' + (++uid);
        this.sourceMode = false;
        this.fullscreen = false;
        this.buttons = [];
        this.openMenu = null;
        this.items = registry.resolveItems(config);
        this.build();
        this.createEditor();
    }

    get markdown() {
        return 'markdown' === this.config.mode;
    }

    has(id) {
        return this.items.some(item => item.id === id);
    }

    /* ---------- Aufbau ---------- */

    build() {
        const {root, textarea, config} = this;
        root.classList.add('rex-tiptap');
        root.dataset.mode = config.mode;
        if (config.stickyToolbar) {
            root.classList.add('rex-tiptap--sticky');
        }
        root.style.setProperty('--rex-tiptap-min-height', config.minHeight + 'px');
        if (config.maxHeight > 0) {
            root.style.setProperty('--rex-tiptap-max-height', config.maxHeight + 'px');
        }

        this.toolbar = el('div', {className: 'rex-tiptap-toolbar', role: 'toolbar', 'aria-label': t('toolbar'), 'aria-controls': this.id});
        this.toolbar.addEventListener('keydown', e => this.toolbarKeydown(e));
        for (const group of config.toolbar) {
            const items = group.map(id => this.items.find(item => item.id === id)).filter(Boolean);
            if (!items.length) {
                continue;
            }
            const groupEl = el('div', {className: 'rex-tiptap-group', role: 'group'});
            for (const item of items) {
                groupEl.append(this.button(item));
            }
            this.toolbar.append(groupEl);
        }

        this.content = el('div', {className: 'rex-tiptap-content' + (config.contentClass ? ' ' + config.contentClass : '')});
        this.body = el('div', {className: 'rex-tiptap-body'}, this.content);
        textarea.classList.add('rex-tiptap-source');
        textarea.setAttribute('aria-label', this.markdown ? t('sourceMarkdown') : t('sourceHtml'));
        textarea.hidden = true;
        this.body.append(textarea);

        this.counter = el('span', {className: 'rex-tiptap-counter', 'aria-live': 'polite'});
        // Speicherformat nur im Backend anzeigen – Besucher interessiert es nicht
        this.footer = el('div', {className: 'rex-tiptap-footer'},
            config.backend ? el('span', {className: 'rex-tiptap-mode', text: this.markdown ? 'Markdown' : 'HTML'}) : el('span'),
            config.counter || config.maxLength ? this.counter : null,
        );
        const footer = config.backend || config.counter || config.maxLength ? this.footer : null;

        root.replaceChildren(...[this.toolbar.childElementCount ? this.toolbar : null, this.body, footer].filter(Boolean));

        this.onDocClick = e => {
            if (this.openMenu && !this.openMenu.wrap.contains(e.target)) {
                this.closeMenu(false);
            }
        };
        document.addEventListener('mousedown', this.onDocClick);
        this.onKey = e => {
            if ('Escape' === e.key && this.fullscreen && !this.openMenu && !this.dialog?.open) {
                this.toggleFullscreen();
            }
        };
        document.addEventListener('keydown', this.onKey);
    }

    button(item) {
        const ctx = this.ctx();
        const label = item.currentLabel?.(ctx) ?? item.label;
        const btn = el('button', {
            type: 'button',
            className: 'rex-tiptap-button' + (item.wide ? ' rex-tiptap-button--wide' : ''),
            tabindex: this.buttons.length ? '-1' : '0',
            title: label + (item.shortcut ? ' (' + item.shortcut.replace('Mod', /Mac/.test(navigator.platform) ? '⌘' : 'Strg') + ')' : ''),
            'aria-label': label,
            'data-item': item.id,
        }, icon(item.icon));
        if (item.wide) {
            btn.append(el('span', {className: 'rex-tiptap-button-text'}));
        }
        let wrap = btn;
        if (item.menu) {
            btn.setAttribute('aria-haspopup', 'menu');
            btn.setAttribute('aria-expanded', 'false');
            btn.append(icon('chevron'));
            btn.classList.add('rex-tiptap-button--menu');
            wrap = el('div', {className: 'rex-tiptap-menu-wrap'}, btn);
            btn.addEventListener('click', () => this.toggleMenu(item, btn, wrap));
        } else {
            btn.addEventListener('click', () => {
                if (!btn.disabled) {
                    item.run?.(this.ctx());
                    this.update();
                }
            });
        }
        // Fokus im Editor halten (Auswahl bleibt sichtbar)
        btn.addEventListener('mousedown', e => e.preventDefault());
        this.buttons.push({item, btn});
        return wrap;
    }

    ctx() {
        return {editor: this.editor, config: this.config, ui: this, has: id => this.has(id)};
    }

    /* ---------- TipTap ---------- */

    extensions() {
        const {config} = this;
        const has = id => this.has(id);
        const any = (...ids) => ids.some(has);
        const extensions = [
            StarterKit.configure({
                heading: has('heading') || config.blockStyles.some(s => /^h[1-6]$/.test(s.element ?? '')) ? {levels: config.headings} : false,
                bold: has('bold') ? {} : false,
                italic: has('italic') ? {} : false,
                underline: has('underline') ? {} : false,
                strike: has('strike') ? {} : false,
                code: has('code') ? {} : false,
                blockquote: has('blockquote') || config.blockStyles.some(s => 'blockquote' === s.element) ? {} : false,
                codeBlock: has('codeBlock') ? {} : false,
                horizontalRule: has('horizontalRule') ? {} : false,
                bulletList: has('bulletList') ? {} : false,
                orderedList: has('orderedList') ? {} : false,
                listItem: any('bulletList', 'orderedList') ? {} : false,
                listKeymap: any('bulletList', 'orderedList') ? {} : false,
                link: any('link', 'unlink') ? {
                    openOnClick: false,
                    autolink: !!config.link.external,
                    linkOnPaste: true,
                    defaultProtocol: 'https',
                    HTMLAttributes: {target: null, rel: null},
                    isAllowedUri: url => allowedUrl(url, config.link),
                } : false,
                trailingNode: false,
            }),
            CharacterCount.configure({limit: config.maxLength > 0 ? config.maxLength : null}),
        ];
        if (config.placeholder) {
            extensions.push(Placeholder.configure({placeholder: config.placeholder}));
        }
        if (has('highlight')) {
            extensions.push(Highlight);
        }
        if (has('subscript')) {
            extensions.push(Subscript);
        }
        if (has('superscript')) {
            extensions.push(Superscript);
        }
        if (has('image')) {
            extensions.push(Image.configure({inline: false, allowBase64: false}));
        }
        if (has('table')) {
            extensions.push(TableKit.configure({table: {resizable: false}}));
        }
        const blockClasses = [
            ...(has('blockStyle') ? config.blockStyles.flatMap(s => s.class.split(' ')) : []),
            ...(any('align', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify') ? Object.values(config.align).flatMap(c => c.split(' ')) : []),
        ];
        if (blockClasses.length && !this.markdown) {
            extensions.push(BlockClass.configure({allowed: blockClasses}));
        }
        if (has('inlineStyle') && !this.markdown) {
            extensions.push(InlineStyle.configure({allowed: config.inlineStyles.flatMap(s => s.class.split(' '))}));
        }
        if (this.markdown) {
            extensions.push(Markdown);
        }
        extensions.push(...registry.pluginExtensions(this.ctx()));
        return extensions;
    }

    createEditor() {
        const {config, textarea} = this;
        const detail = {config, extensions: this.extensions(), instance: this};
        this.root.dispatchEvent(new CustomEvent('rex-tiptap:configure', {bubbles: true, detail}));

        this.editor = new Editor({
            element: this.content,
            extensions: detail.extensions,
            content: textarea.value,
            contentType: this.markdown ? 'markdown' : 'html',
            injectCSS: false,
            editable: !textarea.disabled && !textarea.readOnly,
            editorProps: {
                attributes: {
                    id: this.id,
                    class: 'rex-tiptap-prose',
                    role: 'textbox',
                    'aria-multiline': 'true',
                    spellcheck: 'true',
                },
                // Einfügen als reiner Text (z. B. für Gäste)
                ...(config.pasteText ? {
                    handlePaste: (view, event) => {
                        const text = event.clipboardData?.getData('text/plain');
                        if (null === text || undefined === text) {
                            return false;
                        }
                        event.preventDefault();
                        this.editor.commands.insertContent(text.split(/\r?\n\r?\n/).map(p => ({type: 'paragraph', content: p ? [{type: 'text', text: p.replace(/\r?\n/g, ' ')}] : []})));
                        return true;
                    },
                } : {}),
            },
            onUpdate: () => this.sync(),
            onSelectionUpdate: () => this.update(),
            onTransaction: () => this.update(),
            onFocus: () => this.root.classList.add('is-focused'),
            onBlur: () => this.root.classList.remove('is-focused'),
        });

        this.labelEditor();
        this.handleForm();
        // Wert normalisieren erst bei der ersten Änderung – sonst gilt das Formular sofort als geändert
        this.update();
        this.root.dispatchEvent(new CustomEvent('rex-tiptap:ready', {bubbles: true, detail: {editor: this.editor, instance: this}}));
    }

    labelEditor() {
        const id = this.root.dataset.labelFor || this.textarea.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        const dom = this.editor.view.dom;
        if (label) {
            label.id ||= this.id + '-label';
            dom.setAttribute('aria-labelledby', label.id);
            this.onLabelClick = e => {
                e.preventDefault();
                this.focus();
            };
            label.addEventListener('click', this.onLabelClick);
            this.label = label;
        } else {
            dom.setAttribute('aria-label', this.textarea.getAttribute('aria-label') || t('editorLabel'));
        }
        const describedBy = this.textarea.getAttribute('aria-describedby');
        if (describedBy) {
            dom.setAttribute('aria-describedby', describedBy);
        }
    }

    handleForm() {
        const form = this.textarea.form;
        if (!form) {
            return;
        }
        this.onSubmit = e => {
            if (this.sourceMode) {
                this.textarea.value = this.textarea.value.trim();
            } else {
                this.sync(true);
            }
            if (this.textarea.hasAttribute('data-tiptap-required') && '' === this.value().trim()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.root.classList.add('is-invalid');
                this.editor.view.dom.setAttribute('aria-invalid', 'true');
                this.focus();
            }
        };
        form.addEventListener('submit', this.onSubmit, true);
        this.form = form;
    }

    /** Aktueller Wert (HTML oder Markdown), leer bei leerem Editor */
    value() {
        if (this.sourceMode) {
            return this.textarea.value;
        }
        if (this.editor.isEmpty) {
            return '';
        }
        if (this.markdown) {
            // leere Absätze am Anfang/Ende schreibt der Serializer als &nbsp;
            return this.editor.getMarkdown().replace(/^(?:\s*&nbsp;\s*\n)+/, '').replace(/(?:\n\s*&nbsp;\s*)+$/, '').trim();
        }
        return this.editor.getHTML();
    }

    sync(silent = false) {
        const value = this.value();
        if (value === this.textarea.value) {
            return;
        }
        this.textarea.value = value;
        this.root.classList.remove('is-invalid');
        this.editor.view.dom.removeAttribute('aria-invalid');
        if (!silent) {
            this.textarea.dispatchEvent(new Event('input', {bubbles: true}));
            this.textarea.dispatchEvent(new Event('change', {bubbles: true}));
            this.root.dispatchEvent(new CustomEvent('rex-tiptap:change', {bubbles: true, detail: {value, instance: this}}));
        }
    }

    setValue(value) {
        this.textarea.value = value ?? '';
        this.editor.commands.setContent(this.textarea.value, {contentType: this.markdown ? 'markdown' : 'html', emitUpdate: false});
        this.update();
    }

    focus() {
        if (this.sourceMode) {
            this.textarea.focus();
        } else {
            this.editor.commands.focus();
        }
    }

    /* ---------- Zustand der Toolbar ---------- */

    update() {
        if (!this.editor || this.updating) {
            return;
        }
        this.updating = true;
        requestAnimationFrame(() => {
            this.updating = false;
            if (!this.editor || this.editor.isDestroyed) {
                return;
            }
            const ctx = this.ctx();
            const editable = this.editor.isEditable;
            for (const {item, btn} of this.buttons) {
                let enabled = editable && (this.sourceMode ? !!item.always : (item.enabled ? !!safe(() => item.enabled(ctx)) : true));
                if (!editable && item.always && 'fullscreen' === item.id) {
                    enabled = true;
                }
                btn.disabled = !enabled;
                if (item.active && !item.menu) {
                    btn.setAttribute('aria-pressed', String(!!safe(() => item.active(ctx))));
                } else if (item.active && item.menu) {
                    btn.classList.toggle('is-active', !!safe(() => item.active(ctx)));
                }
                if (item.currentIcon) {
                    const name = item.currentIcon(ctx);
                    if (btn.dataset.icon !== name) {
                        btn.dataset.icon = name;
                        btn.firstElementChild.replaceWith(icon(name));
                    }
                }
                if (item.currentLabel) {
                    btn.setAttribute('aria-label', item.currentLabel(ctx));
                    btn.title = item.currentLabel(ctx);
                }
                if (item.current) {
                    btn.querySelector('.rex-tiptap-button-text').textContent = safe(() => item.current(ctx)) ?? '';
                }
            }
            this.updateCounter();
        });
    }

    updateCounter() {
        if (!this.counter.isConnected) {
            return;
        }
        const storage = this.editor.storage.characterCount;
        const chars = this.sourceMode ? this.textarea.value.length : storage.characters();
        const words = this.sourceMode ? (this.textarea.value.trim().match(/\S+/g) ?? []).length : storage.words();
        const max = this.config.maxLength;
        this.counter.textContent = (max > 0 ? t('charactersOf', chars, max) : t('characters', chars)) + ' · ' + t('words', words);
        this.counter.classList.toggle('is-limit', max > 0 && chars >= max);
    }

    /* ---------- Tastatur in der Toolbar (roving tabindex) ---------- */

    toolbarKeydown(e) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.target.closest('[role="menu"]')) {
            return;
        }
        const list = this.buttons.map(b => b.btn).filter(b => !b.disabled);
        const index = list.indexOf(document.activeElement);
        if (index < 0) {
            return;
        }
        e.preventDefault();
        const next = {
            ArrowLeft: (index - 1 + list.length) % list.length,
            ArrowRight: (index + 1) % list.length,
            Home: 0,
            End: list.length - 1,
        }[e.key];
        this.buttons.forEach(b => b.btn.setAttribute('tabindex', '-1'));
        list[next].setAttribute('tabindex', '0');
        list[next].focus();
    }

    /* ---------- Menüs ---------- */

    toggleMenu(item, btn, wrap) {
        if (this.openMenu?.btn === btn) {
            this.closeMenu(true);
            return;
        }
        this.closeMenu(false);
        const ctx = this.ctx();
        const entries = item.menu(ctx);
        const menu = el('div', {className: 'rex-tiptap-menu' + (item.grid ? ' rex-tiptap-menu--grid' : ''), role: 'menu', 'aria-label': item.label});
        for (const entry of entries) {
            if (entry.separator) {
                menu.append(el('div', {className: 'rex-tiptap-menu-separator', role: 'separator'}));
                continue;
            }
            const active = !!safe(() => entry.active?.());
            const enabled = entry.enabled ? !!safe(() => entry.enabled()) : true;
            const mi = el('button', {
                type: 'button',
                role: entry.radio ? 'menuitemradio' : 'menuitem',
                className: 'rex-tiptap-menu-item' + (entry.className ? ' ' + entry.className : '') + (entry.danger ? ' is-danger' : ''),
                tabindex: '-1',
                title: entry.title ?? null,
                'aria-checked': entry.radio ? String(active) : null,
                disabled: !enabled,
            });
            if (entry.icon) {
                mi.append(icon(entry.icon));
            }
            const text = el('span', {className: 'rex-tiptap-menu-label', text: entry.label});
            if (entry.preview) {
                // Vorschau der Formatvorlage mit ihrer Klasse
                text.className += ' ' + entry.preview;
            }
            mi.append(text);
            if (entry.radio) {
                mi.append(el('span', {className: 'rex-tiptap-menu-check'}, active ? icon('check') : ''));
            }
            mi.addEventListener('mousedown', e => e.preventDefault());
            mi.addEventListener('click', () => {
                this.closeMenu(false);
                entry.run();
                this.update();
            });
            menu.append(mi);
        }
        menu.addEventListener('keydown', e => this.menuKeydown(e, menu));
        wrap.append(menu);
        btn.setAttribute('aria-expanded', 'true');
        this.openMenu = {btn, menu, wrap};
        this.positionMenu(menu, btn);
        (menu.querySelector('[aria-checked="true"]:not(:disabled)') ?? menu.querySelector('button:not(:disabled)'))?.focus();
    }

    positionMenu(menu, btn) {
        // nicht über den rechten Rand hinaus
        const rect = btn.getBoundingClientRect();
        const width = menu.offsetWidth;
        if (rect.left + width > document.documentElement.clientWidth - 8) {
            menu.classList.add('is-end');
        }
    }

    menuKeydown(e, menu) {
        const list = [...menu.querySelectorAll('button:not(:disabled)')];
        const index = list.indexOf(document.activeElement);
        const grid = menu.classList.contains('rex-tiptap-menu--grid');
        const step = grid ? 6 : 1;
        const moves = {ArrowDown: step, ArrowUp: -step, ...(grid ? {ArrowRight: 1, ArrowLeft: -1} : {})};
        if (e.key in moves) {
            e.preventDefault();
            list[(index + moves[e.key] + list.length) % list.length]?.focus();
        } else if ('Home' === e.key) {
            e.preventDefault();
            list[0]?.focus();
        } else if ('End' === e.key) {
            e.preventDefault();
            list.at(-1)?.focus();
        } else if ('Escape' === e.key) {
            e.preventDefault();
            e.stopPropagation();
            this.closeMenu(true);
        } else if ('Tab' === e.key) {
            this.closeMenu(false);
        }
    }

    closeMenu(focusButton) {
        if (!this.openMenu) {
            return;
        }
        const {btn, menu} = this.openMenu;
        menu.remove();
        btn.setAttribute('aria-expanded', 'false');
        this.openMenu = null;
        if (focusButton) {
            btn.focus();
        }
    }

    /* ---------- Quelltext und Vollbild ---------- */

    toggleSource() {
        this.closeMenu(false);
        if (this.sourceMode) {
            this.editor.commands.setContent(this.textarea.value, {contentType: this.markdown ? 'markdown' : 'html', emitUpdate: true});
            this.textarea.hidden = true;
            this.content.hidden = false;
            this.sourceMode = false;
            this.sync();
            this.editor.commands.focus();
        } else {
            this.sync(true);
            this.textarea.value = this.markdown ? this.textarea.value : formatHtml(this.textarea.value);
            this.content.hidden = true;
            this.textarea.hidden = false;
            this.sourceMode = true;
            this.onSourceInput ??= () => this.updateCounter();
            this.textarea.addEventListener('input', this.onSourceInput);
            this.textarea.focus();
        }
        this.root.classList.toggle('is-source', this.sourceMode);
        this.update();
    }

    toggleFullscreen() {
        this.fullscreen = !this.fullscreen;
        this.root.classList.toggle('is-fullscreen', this.fullscreen);
        document.documentElement.classList.toggle('rex-tiptap-has-fullscreen', this.fullscreen);
        this.update();
        this.focus();
    }

    /* ---------- Dialoge ---------- */

    openDialog(title, fields, onApply, extraButtons = []) {
        this.dialog?.remove();
        const form = el('form', {className: 'rex-tiptap-dialog-form', method: 'dialog'});
        const error = el('p', {className: 'rex-tiptap-dialog-error', role: 'alert', hidden: true});
        const titleId = this.id + '-dialog-title';
        const dialog = el('dialog', {className: 'rex-tiptap-dialog', 'aria-labelledby': titleId},
            form);
        form.append(
            el('h2', {className: 'rex-tiptap-dialog-title', id: titleId, text: title}),
            ...fields,
            error,
            el('div', {className: 'rex-tiptap-dialog-actions'},
                ...extraButtons,
                el('span', {className: 'rex-tiptap-dialog-spacer'}),
                el('button', {type: 'button', className: 'rex-tiptap-dialog-button', text: t('cancel'), onclick: () => dialog.close()}),
                el('button', {type: 'submit', className: 'rex-tiptap-dialog-button is-primary', text: t('apply')}),
            ),
        );
        form.addEventListener('submit', e => {
            e.preventDefault();
            const message = onApply();
            if ('string' === typeof message) {
                error.textContent = message;
                error.hidden = false;
                return;
            }
            dialog.close();
        });
        dialog.addEventListener('close', () => {
            dialog.remove();
            this.dialog = null;
            if (!this.editor.isDestroyed) {
                this.editor.commands.focus();
            }
        });
        // im Vollbild/Overlay oben liegen: an den Body hängen
        document.body.append(dialog);
        this.dialog = dialog;
        dialog.showModal();
        dialog.querySelector('input:not([type="checkbox"]), textarea')?.focus();
        return dialog;
    }

    field(label, input, hint) {
        const id = this.id + '-f' + (++uid);
        input.id = id;
        const children = [el('label', {for: id, text: label}), input];
        if (hint) {
            const hintId = id + '-hint';
            input.setAttribute('aria-describedby', hintId);
            children.push(el('small', {id: hintId, text: hint}));
        }
        return el('div', {className: 'rex-tiptap-field'}, ...children);
    }

    linkDialog() {
        const {editor, config} = this;
        const link = config.link;
        const attrs = editor.getAttributes('link');
        const editing = editor.isActive('link');
        const empty = editor.state.selection.empty && !editing;

        const url = el('input', {type: 'text', className: 'rex-input', value: attrs.href ?? '', placeholder: link.external ? 'https://' : '', autocomplete: 'off', spellcheck: 'false'});
        const text = el('input', {type: 'text', className: 'rex-input'});
        const blank = el('input', {type: 'checkbox'});
        blank.checked = '_blank' === attrs.target;

        const fields = [this.field(t('linkUrl'), url, [link.external && 'https://…', link.mailto && 'mailto:…', link.tel && 'tel:…'].filter(Boolean).join(', ') || null)];
        if (empty) {
            fields.push(this.field(t('linkText'), text));
        }
        if (link.targetBlank) {
            fields.push(el('label', {className: 'rex-tiptap-check'}, blank, el('span', {text: t('linkBlank')})));
        }

        const pickers = [];
        const pick = window.rex?.pick;
        if (config.backend && pick && link.internal) {
            pickers.push(el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: async () => {
                const items = await pick('article', {});
                const [item] = items ?? [];
                if (item) {
                    url.value = 'redaxo://' + item.value;
                    if (empty && !text.value) {
                        text.value = String(item.label ?? '').replace(/\s*\[\d+\]$/, '');
                    }
                }
            }}, icon('article'), el('span', {text: t('linkArticle')})));
        }
        if (config.backend && pick && link.media) {
            pickers.push(el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: async () => {
                const items = await pick('media', {});
                const [item] = items ?? [];
                if (item) {
                    url.value = config.mediaUrl + encodeURIComponent(item.value);
                    if (empty && !text.value) {
                        text.value = item.value;
                    }
                }
            }}, icon('media'), el('span', {text: t('linkMedia')})));
        }
        if (pickers.length) {
            fields.splice(1, 0, el('div', {className: 'rex-tiptap-pickers'}, ...pickers));
        }

        const extra = editing ? [el('button', {type: 'button', className: 'rex-tiptap-dialog-button is-danger', text: t('remove'), onclick: () => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            this.dialog?.close();
        }})] : [];

        this.openDialog(editing ? t('linkEdit') : t('linkTitle'), fields, () => {
            const href = normalizeUrl(url.value);
            if (!href) {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                return;
            }
            if (!allowedUrl(href, link)) {
                return t('linkInvalid');
            }
            const markAttrs = {href, target: link.targetBlank && blank.checked ? '_blank' : null, rel: link.targetBlank && blank.checked ? 'noopener' : null};
            const c = editor.chain().focus();
            if (empty) {
                c.insertContent({type: 'text', text: text.value || href, marks: [{type: 'link', attrs: markAttrs}]}).run();
            } else {
                c.extendMarkRange('link').setLink(markAttrs).run();
            }
        }, extra);
    }

    imageDialog() {
        const {editor, config} = this;
        const attrs = editor.isActive('image') ? editor.getAttributes('image') : {};
        const src = el('input', {type: 'text', className: 'rex-input', value: attrs.src ?? '', readonly: !config.image.external, spellcheck: 'false'});
        const alt = el('input', {type: 'text', className: 'rex-input', value: attrs.alt ?? ''});
        const title = el('input', {type: 'text', className: 'rex-input', value: attrs.title ?? ''});
        const preview = el('img', {className: 'rex-tiptap-image-preview', alt: '', hidden: !attrs.src, src: attrs.src || null});

        const choose = async () => {
            const items = await window.rex.pick('media', {types: config.image.types});
            const [item] = items ?? [];
            if (item) {
                src.value = config.mediaUrl + encodeURIComponent(item.value);
                preview.src = src.value;
                preview.hidden = false;
                alt.focus();
            }
        };
        const fields = [];
        if (config.backend && window.rex?.pick) {
            fields.push(el('div', {className: 'rex-tiptap-pickers'},
                el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: choose}, icon('media'), el('span', {text: t('imageMedia')}))));
        }
        fields.push(this.field(t('imageSrc'), src), preview, this.field(t('imageAlt'), alt, t('imageAltHint')), this.field(t('imageTitleAttr'), title));

        this.openDialog(attrs.src ? t('imageEdit') : t('imageTitle'), fields, () => {
            const value = src.value.trim();
            if (!value) {
                return t('imageSrc') + '?';
            }
            if (/^(https?:)?\/\//i.test(value) && !config.image.external) {
                return t('linkInvalid');
            }
            editor.chain().focus().setImage({src: value, alt: alt.value.trim(), title: title.value.trim() || null}).run();
        });
        if (!attrs.src && config.backend && window.rex?.pick) {
            choose();
        }
    }

    /* ---------- Aufräumen ---------- */

    destroy() {
        this.closeMenu(false);
        this.dialog?.close();
        document.removeEventListener('mousedown', this.onDocClick);
        document.removeEventListener('keydown', this.onKey);
        this.form?.removeEventListener('submit', this.onSubmit, true);
        this.label?.removeEventListener('click', this.onLabelClick);
        if (this.fullscreen) {
            document.documentElement.classList.remove('rex-tiptap-has-fullscreen');
        }
        if (!this.sourceMode) {
            this.sync(true);
        }
        this.editor?.destroy();
        this.editor = null;
        this.textarea.hidden = false;
        this.root.replaceChildren(this.textarea);
    }
}

function safe(fn) {
    try {
        return fn();
    } catch {
        return undefined;
    }
}

/** HTML für die Quelltext-Ansicht: Blöcke auf eigene Zeilen */
function formatHtml(html) {
    return html
        .replace(/(<\/(p|h[1-6]|blockquote|ul|ol|li|table|thead|tbody|tr|pre)>)(?!\n)/g, '$1\n')
        .replace(/(<(ul|ol|table|thead|tbody|tr|blockquote)(\s[^>]*)?>)(?!\n)/g, '$1\n')
        .replace(/(<hr\s*\/?>|<br\s*\/?>(?=<))/g, '$1\n')
        .trim();
}
