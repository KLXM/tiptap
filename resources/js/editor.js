/* Editor-Instanz: TipTap + Toolbar + Dialoge, gebunden an eine Textarea */

import {Editor, mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import {CharacterCount, Placeholder} from '@tiptap/extensions';
import {Table, TableKit} from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';

import {t} from './i18n.js';
import {icon} from './icons.js';
import {allowedUrl, BlockClass, InlineStyle, mediaSrc, nearestList, normalizeUrl, rexImage, rexLink, updateNearestList} from './extensions.js';
import Link from '@tiptap/extension-link';
import {registry} from './registry.js';
import {mediaDialogs, rexHtmlEmbed, rexOembed, rexVideo} from './media.js';
import {closeHistory} from '@tiptap/pm/history';
import {cleanPastedHtml, fitHeadings, hrefFor, htmlIsPlain, isInternalPaste, looksLikeMarkdown, pasteTip, rememberCopy, rexAutoLink, showNote} from './smart.js';
import {rexUpload, uploadMethods} from './upload.js';

let uid = 0;

export function el(tag, props = {}, ...children) {
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

/** Focused element – also inside a shadow root (document.activeElement is only its host there) */
function activeElement(node) {
    const root = node?.getRootNode?.();
    return (root && 'activeElement' in root ? root.activeElement : null) ?? document.activeElement;
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
        this.buildToolbar();
        this.layout();
        this.listen();
    }

    buildToolbar() {
        const {config} = this;
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
    }

    /** Box around toolbar, content and footer; the inline mode (inline.js) keeps the host element instead */
    layout() {
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
    }

    listen() {
        this.onDocClick = e => {
            if (this.openMenu && !e.composedPath().includes(this.openMenu.wrap)) {
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
                // Link separat (mit Linkformaten), siehe unten
                link: false,
                trailingNode: false,
            }),
            CharacterCount.configure({limit: config.maxLength > 0 ? config.maxLength : null}),
        ];
        if (any('link', 'unlink')) {
            extensions.push(rexLink(Link, (config.linkStyles ?? []).flatMap(s => s.class.split(' '))).configure({
                openOnClick: false,
                autolink: !!config.link.external,
                linkOnPaste: true,
                defaultProtocol: 'https',
                HTMLAttributes: {target: null, rel: null},
                isAllowedUri: url => allowedUrl(url, config.link),
            }));
        }
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
            extensions.push(rexImage(Image, config));
        }
        // Medien-Blöcke; vorhandene Inhalte bleiben erhalten, auch wenn das Werkzeug nicht (mehr) in der Toolbar ist
        if (!this.markdown) {
            extensions.push(rexVideo(config, this), rexOembed(config, this), rexHtmlEmbed(config, this));
        }
        if (has('table')) {
            // Tabelle ohne style-Attribute (min-width, colgroup) – sonst greift die Content-Security-Policy
            extensions.push(TableKit.configure({table: false}), Table.extend({
                renderHTML({HTMLAttributes}) {
                    return ['table', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ['tbody', 0]];
                },
            }).configure({resizable: false}));
        }
        const blockClasses = [
            ...(has('blockStyle') ? config.blockStyles.flatMap(s => s.class.split(' ')) : []),
            ...(any('align', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify') ? Object.values(config.align).flatMap(c => c.split(' ')) : []),
            ...(any('bulletList', 'orderedList') ? (config.listStyles ?? []).flatMap(s => s.class.split(' ')) : []),
        ];
        if (blockClasses.length && !this.markdown) {
            extensions.push(BlockClass.configure({allowed: blockClasses}));
        }
        if (has('inlineStyle') && !this.markdown) {
            extensions.push(InlineStyle.configure({allowed: config.inlineStyles.flatMap(s => s.class.split(' '))}));
        }
        // Markdown: Speicherformat der Markdown-Profile; in HTML-Profilen nur zum Umwandeln beim Einfügen
        extensions.push(Markdown);
        if (any('link', 'unlink')) {
            extensions.push(rexAutoLink(config));
        }
        // Dateien per Ziehen/Einfügen → Medienpool (immer abfangen, damit der Browser die Datei nicht öffnet)
        extensions.push(rexUpload(this));
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
                // Fremdes HTML (andere Website, Word, Mail) bereinigen; Kopieren innerhalb von tiptap bleibt unverändert
                handleDOMEvents: {
                    copy: view => rememberCopy(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, '\n\n')),
                    cut: view => rememberCopy(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, '\n\n')),
                    paste: (view, event) => {
                        this.pasteInternal = isInternalPaste(event.clipboardData?.getData('text/plain'));
                        return false;
                    },
                },
                transformPastedHTML: html => {
                    if (this.pasteInternal) {
                        return html;
                    }
                    // Bilder/Videos fremder Seiten werden nie übernommen – sagen, warum sie fehlen
                    if (/<(img|video|picture|iframe)\b/i.test(html)) {
                        setTimeout(() => this.note(t('pasteMediaRemoved')), 0);
                    }
                    return cleanPastedHtml(html);
                },
                // Einfügen: reiner Text (Profil-Einstellung), Adresse von YouTube/Vimeo → Video, Markdown → Formatierung
                handlePaste: (view, event) => {
                    const text = event.clipboardData?.getData('text/plain');
                    if (null === text || undefined === text) {
                        return false;
                    }
                    if (config.pasteText) {
                        event.preventDefault();
                        this.insertPlain(text);
                        return true;
                    }
                    if (this.pasteVideoUrl(text) || this.pasteMarkdown(text, event.clipboardData.getData('text/html'))) {
                        event.preventDefault();
                        return true;
                    }
                    return false;
                },
            },
            onUpdate: () => this.sync(),
            onSelectionUpdate: () => this.update(),
            onTransaction: () => this.update(),
            onFocus: () => {
                this.root.classList.add('is-focused');
                this.update();
            },
            onBlur: () => {
                this.root.classList.remove('is-focused');
                // Fokus wandert evtl. in die Bubble – erst danach entscheiden
                setTimeout(() => this.updateBubble(), 0);
            },
        });

        this.labelEditor();
        this.handleForm();
        this.bindContextMenu();
        this.buildLinkBubble();
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
        this.codeView?.dispatch({changes: {from: 0, to: this.codeView.state.doc.length, insert: this.textarea.value}});
        this.editor.commands.setContent(this.textarea.value, {contentType: this.markdown ? 'markdown' : 'html', emitUpdate: false});
        this.update();
    }

    focus() {
        if (this.sourceMode) {
            this.codeView ? this.codeView.focus() : this.textarea.focus();
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
            this.updateBubble();
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
        const index = list.indexOf(activeElement(list[0]));
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
        const menu = this.buildMenu(item.menu(this.ctx()), item.label, !!item.grid);
        wrap.append(menu);
        btn.setAttribute('aria-expanded', 'true');
        this.openMenu = {btn, menu, wrap};
        this.positionMenu(menu, btn);
        (menu.querySelector('[aria-checked="true"]:not(:disabled)') ?? menu.querySelector('button:not(:disabled)'))?.focus();
    }

    buildMenu(entries, label, grid = false) {
        const menu = el('div', {className: 'rex-tiptap-menu' + (grid ? ' rex-tiptap-menu--grid' : ''), role: 'menu', 'aria-label': label});
        for (const entry of entries) {
            if (entry.note) {
                menu.append(el('div', {className: 'rex-tiptap-menu-note', role: 'presentation', text: entry.note}));
                continue;
            }
            if (entry.separator) {
                // keine doppelten Trenner, keiner am Anfang
                if (menu.lastElementChild && !menu.lastElementChild.matches('.rex-tiptap-menu-separator')) {
                    menu.append(el('div', {className: 'rex-tiptap-menu-separator', role: 'separator'}));
                }
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
        menu.lastElementChild?.matches('.rex-tiptap-menu-separator') && menu.lastElementChild.remove();
        menu.querySelector('.rex-tiptap-menu-separator + .rex-tiptap-menu-separator')?.remove();
        menu.addEventListener('keydown', e => this.menuKeydown(e, menu));
        return menu;
    }

    /**
     * Kontextmenü an einer Stelle: Einträge aller Werkzeuge mit `context(ctx)` (z. B. Tabelle).
     * Liefert false, wenn keines etwas beiträgt – dann bleibt das Menü des Browsers.
     */
    contextMenu(x, y) {
        const ctx = this.ctx();
        const entries = [];
        const seen = new Set();
        for (const item of this.items) {
            const list = (item.context ? safe(() => item.context(ctx)) : null)?.filter(entry => {
                // gleiche Einträge (z. B. Liste aus zwei Werkzeugen) nur einmal
                const key = entry.separator ? null : entry.label;
                if (null === key) {
                    return true;
                }
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });
            if (list?.some(entry => !entry.separator)) {
                entries.push(...(entries.length ? [{separator: true}] : []), ...list);
            }
        }
        if (!entries.length) {
            return false;
        }
        entries.push({separator: true}, {note: t('contextHint')});
        this.closeMenu(false);
        const menu = this.buildMenu(entries, t('contextMenu'));
        menu.classList.add('rex-tiptap-menu--context');
        this.root.append(menu);
        // im sichtbaren Bereich halten
        const width = menu.offsetWidth;
        const height = menu.offsetHeight;
        // reicht der Platz nicht, klappt es nach links bzw. oben auf
        const left = x + width > window.innerWidth - 8 ? x - width : x;
        const top = y + height > window.innerHeight - 8 ? y - height : y;
        menu.style.left = Math.max(8, left) + 'px';
        menu.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
        this.openMenu = {btn: null, menu, wrap: menu};
        menu.querySelector('button:not(:disabled)')?.focus();
        return true;
    }

    bindContextMenu() {
        const dom = this.editor.view.dom;
        // Umschalt + Rechtsklick öffnet weiter das Menü des Browsers (Rechtschreibung, Kopieren …)
        this.onContext = e => {
            if (e.shiftKey || !this.editor.isEditable || this.sourceMode) {
                return;
            }
            const {view, state} = this.editor;
            // Rechtsklick auf ein Bild oder eine Trennlinie wählt das Element
            if (['IMG', 'HR'].includes(e.target.nodeName) && view.dom.contains(e.target)) {
                this.editor.commands.setNodeSelection(view.posAtDOM(e.target, 0));
                if (this.contextMenu(e.clientX, e.clientY)) {
                    e.preventDefault();
                }
                return;
            }
            const pos = view.posAtCoords({left: e.clientX, top: e.clientY});
            const {from, to} = state.selection;
            const inCellSelection = !!state.selection.$anchorCell && !!e.target.closest?.('.selectedCell');
            if (pos && !inCellSelection && (pos.pos < from || pos.pos > to)) {
                this.editor.commands.setTextSelection(pos.pos);
            }
            if (this.contextMenu(e.clientX, e.clientY)) {
                e.preventDefault();
            }
        };
        dom.addEventListener('contextmenu', this.onContext);
        // Tastatur: Kontextmenü-Taste oder Umschalt + F10
        this.onContextKey = e => {
            if ('ContextMenu' === e.key || (e.shiftKey && 'F10' === e.key)) {
                const coords = this.editor.view.coordsAtPos(this.editor.state.selection.from);
                if (this.contextMenu(coords.left, coords.bottom + 4)) {
                    e.preventDefault();
                }
            }
        };
        dom.addEventListener('keydown', this.onContextKey);
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
        const index = list.indexOf(activeElement(list[0]));
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
        btn?.setAttribute('aria-expanded', 'false');
        this.openMenu = null;
        if (focusButton) {
            // Kontextmenü: zurück in den Text
            btn ? btn.focus() : this.editor?.commands.focus();
        }
    }

    /* ---------- Link-Bubble ---------- */

    buildLinkBubble() {
        if (!this.has('link')) {
            return;
        }
        this.bubbleTarget = el('span', {className: 'rex-tiptap-bubble-target'});
        this.bubbleOpen = el('a', {className: 'rex-tiptap-bubble-button', target: '_blank', rel: 'noopener', title: t('linkOpen'), 'aria-label': t('linkOpen')}, icon('external'));
        this.bubble = el('div', {className: 'rex-tiptap-bubble', role: 'toolbar', 'aria-label': t('link'), hidden: true},
            icon('link'),
            this.bubbleTarget,
            el('span', {className: 'rex-tiptap-bubble-sep'}),
            el('button', {type: 'button', className: 'rex-tiptap-bubble-button', title: t('linkEdit'), 'aria-label': t('linkEdit'), onclick: () => this.linkDialog()}, icon('edit')),
            ...(this.config.linkStyles?.length ? [el('button', {type: 'button', className: 'rex-tiptap-bubble-button', title: t('linkFormat'), 'aria-label': t('linkFormat'), onclick: e => {
                const box = e.currentTarget.getBoundingClientRect();
                this.contextMenu(box.left, box.bottom + 4);
            }}, icon('linkStyle'))] : []),
            this.bubbleOpen,
            el('button', {type: 'button', className: 'rex-tiptap-bubble-button', title: t('unlink'), 'aria-label': t('unlink'), onclick: () => {
                this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
            }}, icon('unlink')),
        );
        // Klicks in der Bubble nehmen dem Text nicht den Fokus (außer „öffnen“)
        this.bubble.addEventListener('mousedown', e => {
            if (e.target.closest('button')) {
                e.preventDefault();
            }
        });
        this.root.append(this.bubble);
        this.content.addEventListener('scroll', () => this.updateBubble(), {passive: true});
    }

    updateBubble() {
        const bubble = this.bubble;
        if (!bubble || !this.editor || this.editor.isDestroyed) {
            return;
        }
        const editor = this.editor;
        const show = !this.sourceMode && editor.isEditable && !this.dialog && !this.openMenu
            && editor.isActive('link') && (editor.isFocused || bubble.contains(activeElement(bubble)));
        if (!show) {
            bubble.hidden = true;
            return;
        }
        const href = editor.getAttributes('link').href ?? '';
        if (href !== this.bubbleHref) {
            this.bubbleHref = href;
            this.describeLink(href);
        }
        bubble.hidden = false;
        this.placeBubble(bubble, editor.view.coordsAtPos(editor.state.selection.from));
    }

    /** Below the start of the link, inside the editor box */
    placeBubble(bubble, coords) {
        const box = this.root.getBoundingClientRect();
        const width = bubble.offsetWidth;
        const left = Math.max(8, Math.min(coords.left - box.left, this.root.clientWidth - width - 8));
        bubble.style.left = left + 'px';
        bubble.style.top = (coords.bottom - box.top + 6) + 'px';
    }

    /** Ziel lesbar anzeigen: Seite, Datensatz, Datei, E-Mail, Telefon oder Adresse */
    async describeLink(href) {
        const target = this.bubbleTarget;
        const open = this.bubbleOpen;
        const set = (text, url) => {
            if (this.bubbleHref !== href) {
                return;
            }
            target.textContent = text;
            target.title = href;
            if (url && '#' !== url) {
                open.href = url;
                open.hidden = false;
            } else {
                open.removeAttribute('href');
                open.hidden = true;
            }
        };
        const api = this.config.recordApi;
        const info = async params => {
            try {
                const res = await fetch(api + '&' + new URLSearchParams(params), {credentials: 'same-origin'});
                return await res.json();
            } catch {
                return {};
            }
        };
        let m;
        if ((m = /^redaxo:\/\/(\d+)/.exec(href))) {
            set(t('linkPage') + ' ' + m[1], null);
            if (api) {
                const data = await info({article: m[1]});
                set(t('linkPage') + ': ' + (data.label ?? m[1]), data.url);
            }
        } else if ((m = /^yform:\/\/([\w.-]+)\/(\d+)/.exec(href))) {
            const table = (this.config.recordTables ?? []).find(tb => tb.name === m[1])?.label ?? m[1];
            set(table + ' ' + m[2], null);
            if (api) {
                const data = await info({table: m[1], id: m[2]});
                set(table + ': ' + (data.label ?? 'ID ' + m[2]), data.url);
            }
        } else if (/^mailto:/i.test(href)) {
            set(t('linkMail') + ': ' + href.slice(7), href);
        } else if (/^tel:/i.test(href)) {
            set(t('linkPhone') + ': ' + href.slice(4), href);
        } else if (href.startsWith(this.config.mediaUrl ?? '\0')) {
            set(t('linkFile') + ': ' + decodeURIComponent(href.slice(this.config.mediaUrl.length)), href);
        } else {
            set(href.replace(/^https?:\/\//, '').replace(/\/$/, ''), href);
        }
    }

    /* ---------- Quelltext und Vollbild ---------- */

    async toggleSource() {
        this.closeMenu(false);
        if (this.sourceMode) {
            this.codeView?.destroy();
            this.codeView = null;
            this.codeHost?.remove();
            this.codeHost = null;
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
            this.sourceMode = true;
            // Ansicht mit Auszeichnung (CodeMirror, wird nachgeladen); ohne sie die einfache Textarea
            try {
                const {createCodeView} = await import('./code.js');
                this.codeHost = el('div', {className: 'rex-tiptap-code'});
                this.textarea.after(this.codeHost);
                this.codeView = createCodeView({
                    parent: this.codeHost,
                    doc: this.textarea.value,
                    mode: this.markdown ? 'markdown' : 'html',
                    label: this.markdown ? t('sourceMarkdown') : t('sourceHtml'),
                    placeholder: this.config.placeholder,
                    onChange: value => {
                        this.textarea.value = value;
                        this.textarea.dispatchEvent(new Event('input', {bubbles: true}));
                        this.updateCounter();
                    },
                });
                this.codeView.focus();
            } catch (e) {
                console.warn('rex-tiptap: Quelltext-Ansicht ohne Auszeichnung', e);
                this.textarea.hidden = false;
                this.onSourceInput ??= () => this.updateCounter();
                this.textarea.addEventListener('input', this.onSourceInput);
                this.textarea.focus();
            }
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
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const message = await onApply();
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

    /** Text als Absätze einfügen (Leerzeile = neuer Absatz) */
    insertPlain(text) {
        const hardBreak = !!this.editor.schema.nodes.hardBreak;
        this.editor.commands.insertContent(text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => ({
            type: 'paragraph',
            // einfache Zeilenumbrüche bleiben (Umbruch im Absatz)
            content: p.split('\n').flatMap((line, i) => [...(i && hardBreak ? [{type: 'hardBreak'}] : i ? [{type: 'text', text: ' '}] : []), ...(line ? [{type: 'text', text: line}] : [])]),
        })));
    }

    /** Reiner Text, der eindeutig nach Markdown aussieht → Formatierung (mit „Als Text einfügen“) */
    pasteMarkdown(text, html) {
        if (!htmlIsPlain(html) || !looksLikeMarkdown(text)) {
            return false;
        }
        // eigener Schritt im Verlauf: „Als Text einfügen“ nimmt nur die Umwandlung zurück
        this.editor.view.dispatch(closeHistory(this.editor.state.tr));
        const ok = this.editor.chain().focus().insertContent(fitHeadings(text, this.config.headings), {contentType: 'markdown'}).run();
        if (ok) {
            pasteTip(this.root, () => {
                this.editor.chain().focus().undo().run();
                this.insertPlain(text);
            });
        }
        return ok;
    }

    linkDialog() {
        const {editor, config} = this;
        const link = config.link;
        const attrs = editor.getAttributes('link');
        const editing = editor.isActive('link');
        const empty = editor.state.selection.empty && !editing;
        // Markierung merken: Linkmap und Medienpool nehmen dem Editor den Fokus
        const {from, to} = editor.state.selection;
        // markierte Adresse (E-Mail, Web, Domain, Telefon) → sofort Link, ohne Dialog
        if (!editing && !empty) {
            const href = hrefFor(editor.state.doc.textBetween(from, to, ' '), link, true);
            if (href) {
                editor.chain().focus().setLink({href}).run();
                return;
            }
        }

        const url = el('input', {type: 'text', className: 'rex-input', value: attrs.href ?? '', placeholder: link.external ? 'https://' : '', autocomplete: 'off', spellcheck: 'false'});
        const text = el('input', {type: 'text', className: 'rex-input'});
        const blank = el('input', {type: 'checkbox'});
        blank.checked = '_blank' === attrs.target;

        const fields = [this.field(t('linkUrl'), url, [link.external && 'https://…', link.mailto && 'mailto:…', link.tel && 'tel:…'].filter(Boolean).join(', ') || null)];
        if (empty) {
            fields.push(this.field(t('linkText'), text));
        }
        const linkStyles = config.linkStyles ?? [];
        const style = linkStyles.length ? el('select', {className: 'rex-input'},
            el('option', {value: '', text: t('linkStyleNone')}),
            ...linkStyles.map(s => el('option', {value: s.class, text: s.label}))) : null;
        if (style) {
            style.value = attrs.class ?? '';
            fields.push(this.field(t('linkStyle'), style));
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
        // YForm-Datensätze
        const tables = config.recordTables ?? [];
        let recordPanel = null;
        if (config.backend && config.recordApi && tables.length) {
            const tableSelect = el('select', {className: 'rex-input', 'aria-label': t('recordTable')},
                ...tables.map(tb => el('option', {value: tb.name, text: tb.label})));
            const search = el('input', {type: 'search', className: 'rex-input', placeholder: t('recordSearch'), 'aria-label': t('recordSearch')});
            const results = el('div', {className: 'rex-tiptap-records', role: 'listbox', 'aria-label': t('recordResults')});
            let timer = null;
            const load = async () => {
                const params = new URLSearchParams({table: tableSelect.value, q: search.value});
                try {
                    const res = await fetch(config.recordApi + '&' + params, {headers: {Accept: 'application/json'}, credentials: 'same-origin'});
                    const data = await res.json();
                    const list = data.records ?? [];
                    results.replaceChildren(...(list.length ? list.map(r => el('button', {
                        type: 'button', role: 'option', className: 'rex-tiptap-record',
                        onclick: () => {
                            url.value = 'yform://' + tableSelect.value + '/' + r.id;
                            if (empty && !text.value) {
                                text.value = r.label;
                            }
                            recordPanel.hidden = true;
                            url.focus();
                        },
                    }, el('span', {text: r.label}), el('small', {text: 'ID ' + r.id}))) : [el('p', {className: 'rex-tiptap-records-empty', text: t('recordNone')})]));
                } catch {
                    results.replaceChildren(el('p', {className: 'rex-tiptap-records-empty', text: t('recordError')}));
                }
            };
            search.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(load, 250);
            });
            search.addEventListener('keydown', e => {
                if ('Enter' === e.key) {
                    e.preventDefault();
                    load();
                } else if ('ArrowDown' === e.key) {
                    e.preventDefault();
                    results.querySelector('button')?.focus();
                }
            });
            results.addEventListener('keydown', e => {
                const list = [...results.querySelectorAll('button')];
                const i = list.indexOf(activeElement(list[0]));
                if ('ArrowDown' === e.key || 'ArrowUp' === e.key) {
                    e.preventDefault();
                    (list[i + ('ArrowDown' === e.key ? 1 : -1)] ?? ('ArrowUp' === e.key ? search : null))?.focus();
                }
            });
            tableSelect.addEventListener('change', load);
            recordPanel = el('div', {className: 'rex-tiptap-record-panel', hidden: true},
                el('div', {className: 'rex-tiptap-field-row'}, tableSelect, search), results);
            pickers.push(el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: () => {
                recordPanel.hidden = !recordPanel.hidden;
                if (!recordPanel.hidden) {
                    const current = /^yform:\/\/([\w.-]+)\//.exec(url.value);
                    if (current && tables.some(tb => tb.name === current[1])) {
                        tableSelect.value = current[1];
                    }
                    load();
                    search.focus();
                }
            }}, icon('record'), el('span', {text: t('linkRecord')})));
        }
        // gewähltes Ziel lesbar anzeigen (Datensatz)
        const target = el('small', {className: 'rex-tiptap-link-target'});
        const describe = async () => {
            const m = /^yform:\/\/([\w.-]+)\/(\d+)/.exec(url.value);
            target.textContent = '';
            if (m && config.recordApi) {
                try {
                    const res = await fetch(config.recordApi + '&' + new URLSearchParams({table: m[1], id: m[2]}), {credentials: 'same-origin'});
                    const data = await res.json();
                    const table = tables.find(tb => tb.name === m[1])?.label ?? m[1];
                    target.textContent = '→ ' + table + ': ' + (data.label ?? 'ID ' + m[2]);
                } catch {
                    // ohne Bezeichnung
                }
            }
        };
        url.addEventListener('change', describe);
        url.addEventListener('input', () => {
            target.textContent = '';
        });
        describe();
        // Wert wird auch per Skript gesetzt (Auswahl) – dann ebenfalls beschreiben
        const setUrl = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(url, 'value', {
            get: () => setUrl.get.call(url),
            set: v => {
                setUrl.set.call(url, v);
                describe();
            },
        });
        fields.splice(1, 0, target);
        if (recordPanel) {
            fields.splice(2, 0, recordPanel);
        }

        if (pickers.length) {
            fields.splice(2, 0, el('div', {className: 'rex-tiptap-pickers'}, ...pickers));
        }

        const extra = editing ? [el('button', {type: 'button', className: 'rex-tiptap-dialog-button is-danger', text: t('remove'), onclick: () => {
            editor.chain().focus().setTextSelection({from, to}).extendMarkRange('link').unsetLink().run();
            this.dialog?.close();
        }})] : [];

        this.openDialog(editing ? t('linkEdit') : t('linkTitle'), fields, () => {
            const href = normalizeUrl(url.value);
            if (!href) {
                editor.chain().focus().setTextSelection({from, to}).extendMarkRange('link').unsetLink().run();
                return;
            }
            if (!allowedUrl(href, link)) {
                return t('linkInvalid');
            }
            const markAttrs = {href, target: link.targetBlank && blank.checked ? '_blank' : null, rel: link.targetBlank && blank.checked ? 'noopener' : null, class: style?.value || null};
            const c = editor.chain().focus().setTextSelection({from, to});
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
        const image = config.image;
        // Stelle merken (der Medienpool nimmt dem Editor den Fokus); ein gewähltes Bild bleibt gewählt
        const selection = editor.state.selection;
        const restore = chain => attrs.src ? chain.setNodeSelection(selection.from) : chain.setTextSelection({from: selection.from, to: selection.to});
        const pick = config.backend && window.rex?.pick;
        let media = attrs.media ?? null;

        const src = el('input', {type: 'text', className: 'rex-input', value: attrs.src ?? '', readonly: !image.external, spellcheck: 'false'});
        // Alternativtext: leer = aus dem Medienpool (klxm_meta, je Sprache, wird bei der Ausgabe eingesetzt),
        // eigener Text überschreibt, „dekorativ“ = alt="". Ohne Medienpool (externe Adresse) gilt der Text hier.
        const alt = el('input', {type: 'text', className: 'rex-input', value: attrs.alt ?? ''});
        const decorative = el('input', {type: 'checkbox'});
        decorative.checked = '' === attrs.alt;
        const altInfo = el('small', {className: 'rex-tiptap-hint', role: 'status'});
        let poolAlt = null;
        const showAlt = () => {
            alt.disabled = decorative.checked;
            if (!media) {
                alt.placeholder = '';
                altInfo.textContent = t('imageAltHint');
                return;
            }
            alt.placeholder = poolAlt?.decorative ? t('imageAltPoolDecorative') : (poolAlt?.alt ? poolAlt.alt : '');
            altInfo.textContent = decorative.checked ? t('imageAltDecorativeHint')
                : alt.value.trim() ? t('imageAltOwn')
                : poolAlt?.decorative ? t('imageAltPoolDecorativeHint')
                : poolAlt?.alt ? t('imageAltFromPool')
                : t('imageAltPoolMissing');
        };
        const loadPoolAlt = async () => {
            poolAlt = null;
            if (media && config.mediaInfoApi) {
                try {
                    const url = config.mediaInfoApi + '&file=' + encodeURIComponent(media) + '&language=' + (config.language ?? 0);
                    poolAlt = await (await fetch(url, {credentials: 'same-origin'})).json();
                } catch {
                    poolAlt = null;
                }
            }
            showAlt();
        };
        alt.addEventListener('input', showAlt);
        decorative.addEventListener('change', showAlt);
        const title = el('input', {type: 'text', className: 'rex-input', value: attrs.title ?? ''});
        const preview = el('img', {className: 'rex-tiptap-image-preview', alt: '', hidden: !attrs.src, src: attrs.src || null});

        // Mediamanager-Typ (Bildgröße) und Bildformat (Klasse) aus dem Profil
        const type = image.mediaTypes?.length ? el('select', {className: 'rex-input'},
            el('option', {value: '', text: t('imageOriginal')}),
            ...image.mediaTypes.map(name => el('option', {value: name, text: name}))) : null;
        if (type) {
            type.value = attrs.media ? (attrs.mediaType ?? '') : (image.mediaType ?? '');
        }
        const imageStyles = (image.styles ?? []).filter(s => 'video' !== s.media);
        const style = imageStyles.length ? el('select', {className: 'rex-input'},
            el('option', {value: '', text: t('imageStyleNone')}),
            ...imageStyles.map(s => el('option', {value: s.class, text: s.label}))) : null;
        if (style) {
            style.value = attrs.class ?? '';
        }
        const refresh = () => {
            if (media) {
                src.value = mediaSrc(config, media, type?.value ?? '');
            }
            preview.src = src.value;
            preview.hidden = !src.value;
        };
        type?.addEventListener('change', refresh);
        src.addEventListener('change', () => {
            media = null;
            refresh();
            showAlt();
        });

        const choose = async () => {
            const items = await window.rex.pick('media', {types: image.types});
            const [item] = items ?? [];
            if (item) {
                media = item.value;
                refresh();
                loadPoolAlt();
                alt.focus();
            }
        };
        const fields = [];
        if (pick) {
            fields.push(el('div', {className: 'rex-tiptap-pickers'},
                el('button', {type: 'button', className: 'rex-tiptap-dialog-button', onclick: choose}, icon('media'), el('span', {text: t('imageMedia')}))));
        }
        fields.push(this.field(t('imageSrc'), src), preview);
        if (type || style) {
            fields.push(el('div', {className: 'rex-tiptap-field-row'},
                type ? this.field(t('imageSize'), type) : null,
                style ? this.field(t('imageStyle'), style) : null));
        }
        const altField = this.field(t('imageAlt'), alt);
        altField.append(el('label', {className: 'rex-tiptap-check'}, decorative, el('span', {text: t('imageDecorative')})), altInfo);
        fields.push(altField, this.field(t('imageTitleAttr'), title));

        this.openDialog(attrs.src ? t('imageEdit') : t('imageTitle'), fields, () => {
            const value = src.value.trim();
            if (!value) {
                return t('imageSrc') + '?';
            }
            if (!media && /^(https?:)?\/\//i.test(value) && !image.external) {
                return t('linkInvalid');
            }
            restore(editor.chain().focus()).setImage({
                src: value,
                // null = aus dem Medienpool, '' = dekorativ
                alt: decorative.checked ? '' : (alt.value.trim() || (media ? null : '')),
                title: title.value.trim() || null,
                media,
                mediaType: media ? (type?.value || null) : null,
                class: style?.value || null,
            }).run();
        });
        loadPoolAlt();
        if (!attrs.src && pick) {
            choose();
        }
    }

    listStartDialog() {
        const found = nearestList(this.editor.state, ['orderedList']);
        if (!found) {
            return;
        }
        const input = el('input', {type: 'number', className: 'rex-input', min: '1', max: '9999', value: String(found.node.attrs.start ?? 1)});
        this.openDialog(t('listStart').replace(/\s*…$/, ''), [this.field(t('listStartLabel'), input)], () => {
            const start = Math.max(1, Math.min(9999, parseInt(input.value, 10) || 1));
            updateNearestList(this.editor, {start}, ['orderedList']);
        });
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
        this.codeView?.destroy();
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

Object.assign(RexTiptapEditor.prototype, mediaDialogs, uploadMethods, {
    /** Hinweis unten im Editor */
    note(text, actionLabel = null, onAction = null) {
        showNote(this.root, text, actionLabel, onAction);
    },
});
