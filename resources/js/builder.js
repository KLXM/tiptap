/*
 Profil-Builder (Backend): Toolbar per Drag & Drop oder Klick zusammenstellen, Einstellungen ohne Code, Vorschau.
 Schreibt die Einstellungen als JSON in die Textarea [data-builder-output].
 */

const T = {
    de: {
        toolbar: 'Toolbar', palette: 'Werkzeuge', paletteHint: 'Klicken fügt das Werkzeug in die markierte Gruppe ein, ziehen geht auch.',
        group: 'Gruppe', addGroup: 'Gruppe hinzufügen', removeGroup: 'Gruppe entfernen', moveUp: 'Gruppe nach vorn', moveDown: 'Gruppe nach hinten',
        emptyGroup: 'Werkzeuge hierher ziehen oder in der Liste anklicken', remove: 'Entfernen',
        chipHint: 'Maus auf ein Werkzeug oder eine Gruppe zeigt Entfernen und Verschieben. Tastatur: Alt + ←/→ verschiebt, Entf entfernt.',
        used: 'bereits in der Toolbar', notMarkdown: 'nicht im Markdown-Modus',
        presets: 'Vorlage', presetMinimal: 'Minimal', presetStandard: 'Standard', presetFull: 'Alles', presetConfirm: 'Toolbar ersetzen?',
        headings: 'Überschriften', headingsHint: 'Welche Ebenen im Absatzformat angeboten werden.',
        blockStyles: 'Blockformate', blockStylesHint: 'Klassen für Absätze, Überschriften, Zitate … – erscheinen im Menü „Blockformat“.',
        inlineStyles: 'Textformate', inlineStylesHint: 'Klassen für markierten Text (<span class="…">) – Menü „Textformat“.',
        label: 'Bezeichnung', cssClass: 'CSS-Klasse(n)', element: 'Element', addStyle: 'Format hinzufügen',
        align: 'Ausrichtung', alignHint: 'Klassen statt style-Attributen (Content-Security-Policy).',
        alignLeft: 'Links', alignCenter: 'Zentriert', alignRight: 'Rechts', alignJustify: 'Blocksatz',
        links: 'Links', linkInternal: 'Interne Links (Linkmap, redaxo://ID)', linkMedia: 'Dateien aus dem Medienpool',
        linkExternal: 'Externe Adressen (http/https)', linkMailto: 'E-Mail (mailto:)', linkTel: 'Telefon (tel:)', linkBlank: 'Option „Neues Fenster“',
        images: 'Bilder', imageTypes: 'Erlaubte Dateitypen', imageExternal: 'Externe Bildadressen erlauben',
        mediaTypes: 'Mediamanager-Typen zur Auswahl', mediaTypesHint: 'Der Bild-Dialog bietet diese Typen an – so kommen Bilder in passender Größe auf die Website.',
        mediaTypeDefault: 'Voreinstellung', mediaTypeOriginal: 'Originaldatei',
        imageStyles: 'Bildformate', imageStylesHint: 'Klassen am Bild, z. B. „links umflossen“ oder „volle Breite“ – Auswahl im Bild-Dialog und per Rechtsklick.',
        filter: 'Filtern …',
        lists: 'Listen', listsHint: 'Zählweisen gibt der Browser selbst aus. Listenformate sind Klassen – das CSS dazu muss auf der Website (und für die Vorschau im Editor) vorhanden sein.',
        listTypes: 'Zählweisen nummerierter Listen', listStyles: 'Listenformate', listFor: 'gilt für', listBoth: 'beide', listOl: 'nummeriert', listUl: 'Aufzählung',
        listPresets: 'Vorlagen mit CSS', addPreset: 'übernehmen',
        linkStyles: 'Linkformate', linkStylesHint: 'Klassen für Links, z. B. „Als Button“ – Auswahl im Link-Dialog, in der Link-Leiste und per Rechtsklick.',
        records: 'Datensätze verlinken (YForm)', recordsHint: 'Diese Tabellen bietet der Link-Dialog an. Wohin der Link führt, steht unter Einstellungen.', recordsNone: 'YForm ist nicht installiert.',
        chars: 'Sonderzeichen', charsHint: 'Durch Leerzeichen getrennt. NBSP = geschütztes Leerzeichen, SHY = weiches Trennzeichen.',
        editor: 'Editor', minHeight: 'Mindesthöhe (px)', maxHeight: 'Maximalhöhe (px, 0 = ohne)', placeholder: 'Platzhalter',
        maxLength: 'Höchstens Zeichen (0 = unbegrenzt)', counter: 'Zeichen und Wörter anzeigen', sticky: 'Toolbar bleibt beim Scrollen sichtbar',
        contentClass: 'Klasse des Inhaltsbereichs', contentClassHint: 'Z. B. für die Stile des Frontends im Editor.',
        pasteText: 'Nur als reinen Text einfügen (empfohlen für Gäste)',
        preview: 'Vorschau', previewHint: 'So sieht der Editor mit diesem Profil aus – Änderungen wirken sofort.',
        output: 'Gespeicherter Wert', sample: '<h2>Überschrift</h2><p>Ein <strong>Beispieltext</strong> mit <em>Formatierung</em> und einem <a href="https://redaxo.org">Link</a>.</p><ul><li>Punkt eins</li><li>Punkt zwei</li></ul>',
        sampleMd: '## Überschrift\n\nEin **Beispieltext** mit *Formatierung* und einem [Link](https://redaxo.org).\n\n- Punkt eins\n- Punkt zwei',
    },
    en: {
        toolbar: 'Toolbar', palette: 'Tools', paletteHint: 'Click adds the tool to the selected group, dragging works too.',
        group: 'Group', addGroup: 'Add group', removeGroup: 'Remove group', moveUp: 'Move group left', moveDown: 'Move group right',
        emptyGroup: 'Drag tools here or click them in the list', remove: 'Remove',
        chipHint: 'Hover a tool or group to remove or move it. Keyboard: Alt + ←/→ moves, Delete removes.',
        used: 'already in the toolbar', notMarkdown: 'not available in Markdown mode',
        presets: 'Preset', presetMinimal: 'Minimal', presetStandard: 'Standard', presetFull: 'Everything', presetConfirm: 'Replace the toolbar?',
        headings: 'Headings', headingsHint: 'Levels offered in the paragraph format menu.',
        blockStyles: 'Block styles', blockStylesHint: 'Classes for paragraphs, headings, quotes … – shown in the “Block style” menu.',
        inlineStyles: 'Text styles', inlineStylesHint: 'Classes for selected text (<span class="…">) – “Text style” menu.',
        label: 'Label', cssClass: 'CSS class(es)', element: 'Element', addStyle: 'Add style',
        align: 'Alignment', alignHint: 'Classes instead of style attributes (Content Security Policy).',
        alignLeft: 'Left', alignCenter: 'Center', alignRight: 'Right', alignJustify: 'Justify',
        links: 'Links', linkInternal: 'Internal links (linkmap, redaxo://ID)', linkMedia: 'Files from the media pool',
        linkExternal: 'External addresses (http/https)', linkMailto: 'E-mail (mailto:)', linkTel: 'Phone (tel:)', linkBlank: 'Option “new window”',
        images: 'Images', imageTypes: 'Allowed file types', imageExternal: 'Allow external image addresses',
        mediaTypes: 'Media manager types to choose from', mediaTypesHint: 'The image dialog offers these types – so images reach the website in a fitting size.',
        mediaTypeDefault: 'Default', mediaTypeOriginal: 'Original file',
        imageStyles: 'Image styles', imageStylesHint: 'Classes on the image, e.g. “float left” or “full width” – chosen in the image dialog and via right click.',
        filter: 'Filter …',
        lists: 'Lists', listsHint: 'Numbering is rendered by the browser. List styles are classes – the CSS has to exist on the website (and for the preview in the editor).',
        listTypes: 'Numbering of ordered lists', listStyles: 'List styles', listFor: 'applies to', listBoth: 'both', listOl: 'numbered', listUl: 'bullets',
        listPresets: 'Presets with CSS', addPreset: 'add',
        linkStyles: 'Link styles', linkStylesHint: 'Classes for links, e.g. “as button” – chosen in the link dialog, the link bar and via right click.',
        records: 'Link records (YForm)', recordsHint: 'The link dialog offers these tables. Where the link leads is set under Settings.', recordsNone: 'YForm is not installed.',
        chars: 'Special characters', charsHint: 'Separated by spaces. NBSP = non-breaking space, SHY = soft hyphen.',
        editor: 'Editor', minHeight: 'Minimum height (px)', maxHeight: 'Maximum height (px, 0 = none)', placeholder: 'Placeholder',
        maxLength: 'Maximum characters (0 = unlimited)', counter: 'Show characters and words', sticky: 'Toolbar stays visible while scrolling',
        contentClass: 'Class of the content area', contentClassHint: 'E.g. to use the frontend styles in the editor.',
        pasteText: 'Paste as plain text only (recommended for guests)',
        preview: 'Preview', previewHint: 'The editor with this profile – changes apply immediately.',
        output: 'Stored value', sample: '<h2>Heading</h2><p>A <strong>sample text</strong> with <em>formatting</em> and a <a href="https://redaxo.org">link</a>.</p><ul><li>Item one</li><li>Item two</li></ul>',
        sampleMd: '## Heading\n\nA **sample text** with *formatting* and a [link](https://redaxo.org).\n\n- Item one\n- Item two',
    },
};
const lang = (document.documentElement.lang || 'de').slice(0, 2) in T ? (document.documentElement.lang || 'de').slice(0, 2) : 'en';
const t = key => T[lang][key] ?? T.en[key] ?? key;

const PRESETS = {
    presetMinimal: [['bold', 'italic'], ['bulletList', 'orderedList'], ['link', 'unlink'], ['undo', 'redo']],
    presetStandard: [['undo', 'redo'], ['heading'], ['bold', 'italic', 'underline', 'strike'], ['bulletList', 'orderedList', 'blockquote'], ['link', 'unlink', 'image', 'table'], ['source', 'fullscreen']],
    presetFull: [['undo', 'redo'], ['heading', 'blockStyle', 'inlineStyle'], ['bold', 'italic', 'underline', 'strike', 'highlight'], ['subscript', 'superscript', 'code', 'clearFormatting'], ['bulletList', 'orderedList', 'blockquote', 'codeBlock'], ['align'], ['link', 'unlink', 'image', 'table', 'horizontalRule', 'specialChars'], ['source', 'fullscreen']],
};

const CHAR_NAMES = {' ': 'NBSP', '­': 'SHY'};
const CHAR_VALUES = {NBSP: ' ', SHY: '­'};

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
        } else if ('checked' === key || 'value' === key) {
            node[key] = value;
        } else {
            node.setAttribute(key, true === value ? '' : String(value));
        }
    }
    node.append(...children.filter(c => null !== c && undefined !== c && false !== c));
    return node;
}

let uid = 0;

class Builder {
    constructor(root) {
        this.root = root;
        this.output = document.querySelector(root.dataset.output);
        this.catalog = JSON.parse(root.dataset.catalog);
        this.items = Object.fromEntries(this.catalog.flatMap(c => c.items).map(i => [i.id, i]));
        this.config = JSON.parse(this.output.value || '{}');
        this.mediaTypes = JSON.parse(root.dataset.mediaTypes || '[]');
        this.recordTables = JSON.parse(root.dataset.recordTables || '{}');
        this.form = this.output.form;
        this.modeInputs = [...this.form.querySelectorAll('[name="mode"]')];
        this.selectedGroup = 0;
        this.drag = null;
        this.modeInputs.forEach(input => input.addEventListener('change', () => this.changed(true)));
        this.render();
        this.renderDefaultType();
        this.changed(false);
    }

    get mode() {
        return this.modeInputs.find(i => i.checked)?.value ?? 'html';
    }

    icon(name) {
        // Symbole aus dem Editor-Bundle, sonst Font Awesome / Puzzle-Platzhalter
        if (window.RexTiptap?.icon) {
            return window.RexTiptap.icon(name);
        }
        return el('i', {className: 'rex-icon fa-solid fa-puzzle-piece', 'aria-hidden': 'true'});
    }

    changed(rebuildPreview = true) {
        this.output.value = JSON.stringify(this.config);
        this.renderToolbar();
        this.renderPalette();
        this.root.dataset.mode = this.mode;
        if (rebuildPreview) {
            clearTimeout(this.previewTimer);
            this.previewTimer = setTimeout(() => this.renderPreview(), 250);
        } else {
            this.renderPreview();
        }
    }

    /* ---------- Aufbau ---------- */

    render() {
        this.toolbarEl = el('div', {className: 'tt-b-toolbar'});
        this.paletteEl = el('div', {className: 'tt-b-palette'});
        this.previewEl = el('div', {className: 'tt-b-preview'});
        this.outputEl = el('pre', {className: 'tt-b-output'});

        const presets = el('div', {className: 'tt-b-presets'}, el('span', {text: t('presets') + ':'}),
            ...Object.keys(PRESETS).map(key => el('button', {type: 'button', className: 'rex-button', 'data-size': 'sm', text: t(key), onclick: () => {
                if (this.config.toolbar?.length && !window.confirm(t('presetConfirm'))) {
                    return;
                }
                this.config.toolbar = PRESETS[key].map(g => [...g]);
                this.selectedGroup = 0;
                this.changed();
            }})));

        this.root.replaceChildren(
            el('section', {className: 'tt-b-section tt-b-section--toolbar'},
                el('div', {className: 'tt-b-head'}, el('h3', {text: t('toolbar')}), presets),
                this.toolbarEl,
                el('p', {className: 'tt-b-hint', text: t('chipHint')}),
                el('h4', {text: t('palette')}),
                el('p', {className: 'tt-b-hint', text: t('paletteHint')}),
                this.paletteEl,
            ),
            el('div', {className: 'tt-b-columns'},
                el('div', {className: 'tt-b-settings'}, ...this.settings()),
                el('section', {className: 'tt-b-section tt-b-section--preview'},
                    el('h3', {text: t('preview')}),
                    el('p', {className: 'tt-b-hint', text: t('previewHint')}),
                    this.previewEl,
                    el('details', {className: 'tt-b-details'}, el('summary', {text: t('output')}), this.outputEl),
                ),
            ),
        );
    }

    /* ---------- Toolbar ---------- */

    renderToolbar() {
        const toolbar = this.config.toolbar ??= [];
        const groups = toolbar.map((group, index) => {
            const chips = group.map((id, pos) => this.chip(id, index, pos));
            const groupEl = el('div', {
                className: 'tt-b-group' + (index === this.selectedGroup ? ' is-selected' : ''),
                role: 'group',
                'aria-label': t('group') + ' ' + (index + 1),
                onclick: e => {
                    if (e.target === groupEl || e.target.classList.contains('tt-b-group-items')) {
                        this.selectedGroup = index;
                        this.renderToolbar();
                    }
                },
            },
            el('div', {className: 'tt-b-group-items'}, ...(chips.length ? chips : [el('span', {className: 'tt-b-empty', text: t('emptyGroup')})])),
            el('div', {className: 'tt-b-group-actions'},
                this.smallButton('chevron-left', t('moveUp'), () => this.moveGroup(index, -1), 0 === index),
                this.smallButton('chevron-right', t('moveDown'), () => this.moveGroup(index, 1), index === toolbar.length - 1),
                this.smallButton('xmark', t('removeGroup'), () => this.removeGroup(index), false, true),
            ));
            this.dropTarget(groupEl, index);
            return groupEl;
        });
        const add = el('button', {type: 'button', className: 'tt-b-add-group', onclick: () => {
            toolbar.push([]);
            this.selectedGroup = toolbar.length - 1;
            this.changed();
        }}, el('i', {className: 'rex-icon fa-solid fa-plus', 'aria-hidden': 'true'}), el('span', {text: t('addGroup')}));
        this.toolbarEl.replaceChildren(...groups, add);
    }

    smallButton(icon, label, onclick, disabled = false, danger = false) {
        return el('button', {type: 'button', className: 'tt-b-small' + (danger ? ' tt-b-small--danger' : ''), title: label, 'aria-label': label, disabled, onclick},
            el('i', {className: 'rex-icon fa-solid fa-' + icon, 'aria-hidden': 'true'}));
    }

    chip(id, group, pos) {
        const item = this.items[id];
        const invalid = !item || ('markdown' === this.mode && !item.markdown);
        const label = item?.label ?? id;
        const chip = el('span', {
            className: 'tt-b-chip' + (invalid ? ' is-invalid' : ''),
            draggable: 'true',
            tabindex: '0',
            role: 'button',
            title: label + (invalid && item ? ' – ' + t('notMarkdown') : ''),
            'aria-label': label,
            'data-id': id,
        }, this.icon(item?.icon ?? 'plugin'), el('span', {className: 'tt-b-chip-label', text: label}),
        el('button', {type: 'button', className: 'tt-b-chip-remove', tabindex: '-1', 'aria-label': t('remove') + ': ' + label, onclick: e => {
            e.stopPropagation();
            this.removeItem(group, pos);
        }}, '×'));
        chip.addEventListener('dragstart', e => {
            this.drag = {id, from: [group, pos]};
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
            chip.classList.add('is-dragging');
        });
        chip.addEventListener('dragend', () => chip.classList.remove('is-dragging'));
        chip.addEventListener('keydown', e => {
            if ('Delete' === e.key || 'Backspace' === e.key) {
                e.preventDefault();
                this.removeItem(group, pos);
                this.focusChip(group, Math.max(0, pos - 1));
            } else if (e.altKey && ('ArrowLeft' === e.key || 'ArrowRight' === e.key)) {
                e.preventDefault();
                this.moveItem(group, pos, 'ArrowLeft' === e.key ? -1 : 1);
            } else if ('ArrowLeft' === e.key || 'ArrowRight' === e.key) {
                e.preventDefault();
                const chips = [...this.toolbarEl.querySelectorAll('.tt-b-chip')];
                chips[chips.indexOf(chip) + ('ArrowLeft' === e.key ? -1 : 1)]?.focus();
            }
        });
        chip.addEventListener('focus', () => {
            if (this.selectedGroup !== group) {
                this.selectedGroup = group;
                this.toolbarEl.querySelectorAll('.tt-b-group').forEach((g, i) => g.classList.toggle('is-selected', i === group));
            }
        });
        return chip;
    }

    focusChip(group, pos) {
        requestAnimationFrame(() => {
            const groupEl = this.toolbarEl.querySelectorAll('.tt-b-group')[group];
            groupEl?.querySelectorAll('.tt-b-chip')[pos]?.focus();
        });
    }

    dropTarget(groupEl, index) {
        groupEl.addEventListener('dragover', e => {
            if (!this.drag) {
                return;
            }
            e.preventDefault();
            // passend zu effectAllowed, sonst verwirft der Browser den Drop
            e.dataTransfer.dropEffect = this.drag.from ? 'move' : 'copy';
            groupEl.classList.add('is-over');
            const pos = this.dropPosition(groupEl, e.clientX, e.clientY);
            groupEl.querySelectorAll('.tt-b-chip').forEach((c, i) => {
                c.classList.toggle('drop-before', i === pos);
                c.classList.toggle('drop-after', pos === groupEl.querySelectorAll('.tt-b-chip').length && i === pos - 1);
            });
        });
        groupEl.addEventListener('dragleave', e => {
            if (!groupEl.contains(e.relatedTarget)) {
                groupEl.classList.remove('is-over');
                groupEl.querySelectorAll('.tt-b-chip').forEach(c => c.classList.remove('drop-before', 'drop-after'));
            }
        });
        groupEl.addEventListener('drop', e => {
            e.preventDefault();
            if (!this.drag) {
                return;
            }
            let pos = this.dropPosition(groupEl, e.clientX, e.clientY);
            const {id, from} = this.drag;
            this.drag = null;
            if (from) {
                const [g, p] = from;
                this.config.toolbar[g].splice(p, 1);
                if (g === index && p < pos) {
                    pos--;
                }
            } else {
                this.removeEverywhere(id);
            }
            this.config.toolbar[index].splice(pos, 0, id);
            this.selectedGroup = index;
            this.changed();
        });
    }

    dropPosition(groupEl, x, y) {
        const chips = [...groupEl.querySelectorAll('.tt-b-chip')];
        for (const [i, chip] of chips.entries()) {
            const r = chip.getBoundingClientRect();
            if (y < r.bottom && x < r.left + r.width / 2) {
                return i;
            }
        }
        return chips.length;
    }

    removeEverywhere(id) {
        for (const group of this.config.toolbar) {
            const i = group.indexOf(id);
            if (i >= 0) {
                group.splice(i, 1);
            }
        }
    }

    addItem(id) {
        const toolbar = this.config.toolbar;
        if (!toolbar.length) {
            toolbar.push([]);
            this.selectedGroup = 0;
        }
        this.removeEverywhere(id);
        const group = Math.min(this.selectedGroup, toolbar.length - 1);
        toolbar[group].push(id);
        this.changed();
    }

    removeItem(group, pos) {
        this.config.toolbar[group].splice(pos, 1);
        this.changed();
    }

    moveItem(group, pos, dir) {
        const toolbar = this.config.toolbar;
        const list = toolbar[group];
        const target = pos + dir;
        if (target >= 0 && target < list.length) {
            [list[pos], list[target]] = [list[target], list[pos]];
            this.changed();
            this.focusChip(group, target);
        } else if (toolbar[group + dir]) {
            // über den Rand: in die Nachbargruppe
            const [id] = list.splice(pos, 1);
            const next = group + dir;
            if (dir < 0) {
                toolbar[next].push(id);
            } else {
                toolbar[next].unshift(id);
            }
            this.selectedGroup = next;
            this.changed();
            this.focusChip(next, dir < 0 ? toolbar[next].length - 1 : 0);
        }
    }

    moveGroup(index, dir) {
        const toolbar = this.config.toolbar;
        [toolbar[index], toolbar[index + dir]] = [toolbar[index + dir], toolbar[index]];
        this.selectedGroup = index + dir;
        this.changed();
    }

    removeGroup(index) {
        this.config.toolbar.splice(index, 1);
        this.selectedGroup = Math.max(0, Math.min(this.selectedGroup, this.config.toolbar.length - 1));
        this.changed();
    }

    /* ---------- Palette ---------- */

    renderPalette() {
        const used = new Set((this.config.toolbar ?? []).flat());
        const markdown = 'markdown' === this.mode;
        this.paletteEl.replaceChildren(...this.catalog.map(category => el('div', {className: 'tt-b-category'},
            el('h5', {text: category.label}),
            el('div', {className: 'tt-b-category-items'}, ...category.items.map(item => {
                const unavailable = markdown && !item.markdown;
                // kein <button>: Browser ziehen Buttons nicht zuverlässig (Firefox gar nicht)
                const button = el('span', {
                    role: 'button',
                    tabindex: unavailable ? '-1' : '0',
                    className: 'tt-b-tool' + (used.has(item.id) ? ' is-used' : ''),
                    draggable: unavailable ? null : 'true',
                    'aria-disabled': unavailable ? 'true' : null,
                    title: [item.description, used.has(item.id) ? t('used') : '', unavailable ? t('notMarkdown') : ''].filter(Boolean).join(' – ') || item.label,
                    onclick: () => unavailable || this.addItem(item.id),
                    onkeydown: e => {
                        if (!unavailable && ('Enter' === e.key || ' ' === e.key)) {
                            e.preventDefault();
                            this.addItem(item.id);
                        }
                    },
                }, this.icon(item.icon), el('span', {text: item.label}), item.menu ? el('i', {className: 'rex-icon fa-solid fa-caret-down tt-b-menu-mark', 'aria-hidden': 'true'}) : null);
                button.addEventListener('dragstart', e => {
                    this.drag = {id: item.id, from: null};
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', item.id);
                });
                return button;
            })),
        )));
    }

    /* ---------- Einstellungen ---------- */

    settings() {
        const c = this.config;
        const set = (path, value) => {
            const keys = path.split('.');
            let target = c;
            for (const key of keys.slice(0, -1)) {
                target = target[key] ??= {};
            }
            target[keys.at(-1)] = value;
            this.changed();
        };
        const get = path => path.split('.').reduce((o, k) => o?.[k], c);

        const field = (label, input, hint) => {
            input.id ||= 'tt-b-' + (++uid);
            return el('div', {className: 'tt-b-field'}, el('label', {for: input.id, text: label}), input, hint ? el('small', {text: hint}) : null);
        };
        const text = (path, label, hint, placeholder) => field(label, el('input', {type: 'text', className: 'rex-input', value: get(path) ?? '', placeholder, oninput: e => set(path, e.target.value)}), hint);
        const number = (path, label, min, max) => field(label, el('input', {type: 'number', className: 'rex-input', min, max, value: get(path) ?? 0, oninput: e => set(path, parseInt(e.target.value || '0', 10))}));
        const check = (path, label) => el('label', {className: 'tt-b-check'}, el('input', {type: 'checkbox', checked: !!get(path), onchange: e => set(path, e.target.checked)}), el('span', {text: label}));
        const section = (title, hint, ...children) => el('details', {className: 'tt-b-section tt-b-setting', open: true},
            el('summary', {}, el('h3', {text: title})), hint ? el('p', {className: 'tt-b-hint', text: hint}) : null, ...children);

        const headings = el('div', {className: 'tt-b-inline'}, ...[1, 2, 3, 4, 5, 6].map(level => el('label', {className: 'tt-b-check'},
            el('input', {type: 'checkbox', checked: (c.headings ?? []).includes(level), onchange: e => {
                const list = new Set(c.headings ?? []);
                e.target.checked ? list.add(level) : list.delete(level);
                set('headings', [...list].sort());
            }}), el('span', {text: 'H' + level}))));

        return [
            section(t('headings'), t('headingsHint'), headings),
            el('div', {className: 'tt-b-html-only'},
                section(t('blockStyles'), t('blockStylesHint'), this.styleList('blockStyles', true)),
                section(t('inlineStyles'), t('inlineStylesHint'), this.styleList('inlineStyles', false)),
                section(t('align'), t('alignHint'), el('div', {className: 'tt-b-grid'},
                    text('align.left', t('alignLeft')), text('align.center', t('alignCenter')),
                    text('align.right', t('alignRight')), text('align.justify', t('alignJustify')))),
            ),
            section(t('links'), null,
                check('link.internal', t('linkInternal')), check('link.media', t('linkMedia')), check('link.external', t('linkExternal')),
                check('link.mailto', t('linkMailto')), check('link.tel', t('linkTel')), check('link.targetBlank', t('linkBlank'))),
            section(t('lists'), t('listsHint'),
                el('h4', {text: t('listTypes')}),
                this.checkList('listTypes', [['1', '1, 2, 3'], ['a', 'a, b, c'], ['A', 'A, B, C'], ['i', 'i, ii, iii'], ['I', 'I, II, III']]),
                el('h4', {text: t('listStyles')}),
                this.styleList('listStyles', false, true),
                this.listPresets()),
            section(t('linkStyles'), t('linkStylesHint'), this.styleList('linkStyles', false)),
            section(t('records'), t('recordsHint'), this.checkList('link.records', Object.entries(this.recordTables).map(([name, label]) => [name, label + ' (' + name + ')']), t('recordsNone'))),
            section(t('images'), null,
                field(t('imageTypes'), el('input', {type: 'text', className: 'rex-input', value: (c.image?.types ?? []).join(', '), oninput: e => set('image.types', e.target.value.split(/[\s,]+/).filter(Boolean))})),
                check('image.external', t('imageExternal')),
                el('h4', {text: t('mediaTypes')}), el('p', {className: 'tt-b-hint', text: t('mediaTypesHint')}),
                this.checkList('image.mediaTypes', this.mediaTypes.map(name => [name, name]), '', () => this.renderDefaultType()),
                this.defaultTypeField = el('div'),
                el('h4', {text: t('imageStyles')}), el('p', {className: 'tt-b-hint', text: t('imageStylesHint')}),
                this.styleList('image.styles', false)),
            section(t('chars'), t('charsHint'),
                field(t('chars'), el('input', {type: 'text', className: 'rex-input', value: (c.specialChars ?? []).map(ch => CHAR_NAMES[ch] ?? ch).join(' '), oninput: e => set('specialChars', e.target.value.split(/\s+/).filter(Boolean).map(ch => CHAR_VALUES[ch] ?? ch))}))),
            section(t('editor'), null,
                el('div', {className: 'tt-b-grid'},
                    number('minHeight', t('minHeight'), 60, 2000), number('maxHeight', t('maxHeight'), 0, 4000),
                    number('maxLength', t('maxLength'), 0, 1000000), text('placeholder', t('placeholder'))),
                text('contentClass', t('contentClass'), t('contentClassHint'), 'prose'),
                check('counter', t('counter')), check('stickyToolbar', t('sticky')), check('pasteText', t('pasteText'))),
        ];
    }

    /** Mehrfachauswahl als Kästchen, gespeichert als Liste unter path */
    checkList(path, options, emptyText = '', after = null) {
        const parts = path.split('.');
        const owner = () => parts.slice(0, -1).reduce((o, k) => o[k] ??= {}, this.config);
        const values = () => owner()[parts.at(-1)] ??= [];
        if (!options.length) {
            return emptyText ? el('p', {className: 'tt-b-hint', text: emptyText}) : el('span');
        }
        const box = el('div', {className: 'tt-b-inline' + (options.length > 12 ? ' tt-b-checklist' : '')});
        const draw = () => {
            const chosen = new Set(values());
            // lange Listen: gewählte zuerst
            const sorted = options.length > 12 ? [...options].sort((a, b) => Number(chosen.has(b[0])) - Number(chosen.has(a[0]))) : options;
            box.replaceChildren(...sorted.map(([value, label]) => el('label', {className: 'tt-b-check', 'data-filter': (value + ' ' + label).toLowerCase()},
                el('input', {type: 'checkbox', checked: chosen.has(value), onchange: e => {
                    const list = new Set(values());
                    e.target.checked ? list.add(value) : list.delete(value);
                    owner()[parts.at(-1)] = options.map(([v]) => v).filter(v => list.has(v));
                    after?.();
                    this.changed();
                }}), el('span', {text: label}))));
        };
        draw();
        if (options.length <= 12) {
            return box;
        }
        const filter = el('input', {type: 'search', className: 'rex-input', placeholder: t('filter'), 'aria-label': t('filter'), oninput: () => {
            const q = filter.value.trim().toLowerCase();
            box.querySelectorAll('[data-filter]').forEach(item => {
                item.hidden = '' !== q && !item.dataset.filter.includes(q) && !item.querySelector('input').checked;
            });
        }});
        return el('div', {className: 'tt-b-checklist-wrap'}, filter, box);
    }

    renderDefaultType() {
        const image = this.config.image ??= {};
        const types = image.mediaTypes ?? [];
        if (!types.includes(image.mediaType)) {
            image.mediaType = '';
        }
        const select = el('select', {className: 'rex-input', id: 'tt-b-default-type', onchange: e => {
            image.mediaType = e.target.value;
            this.changed();
        }}, el('option', {value: '', text: t('mediaTypeOriginal'), selected: !image.mediaType}),
        ...types.map(name => el('option', {value: name, text: name, selected: image.mediaType === name})));
        this.defaultTypeField?.replaceChildren(...(types.length ? [el('div', {className: 'tt-b-field'}, el('label', {for: 'tt-b-default-type', text: t('mediaTypeDefault')}), select)] : []));
    }

    /** Vorlagen für Listenformate – Klasse übernehmen, CSS zum Kopieren */
    listPresets() {
        const presets = [
            {label: 'Gegliedert (1.1, 1.2)', class: 'list-outline', list: 'ol', css: 'ol.list-outline, ol.list-outline ol { counter-reset: item; list-style: none; }\nol.list-outline li { counter-increment: item; }\nol.list-outline li::before { content: counters(item, ".") ". "; font-variant-numeric: tabular-nums; }'},
            {label: 'Häkchen', class: 'list-check', list: 'ul', css: 'ul.list-check { list-style: none; padding-left: 1.6em; }\nul.list-check > li::before { content: "✓"; margin-left: -1.4em; width: 1.4em; display: inline-block; color: currentColor; }'},
            {label: 'Ohne Zeichen', class: 'list-plain', list: 'both', css: '.list-plain { list-style: none; padding-left: 0; }'},
        ];
        return el('details', {className: 'tt-b-details'}, el('summary', {text: t('listPresets')}),
            ...presets.map(p => el('div', {className: 'tt-b-preset'},
                el('div', {className: 'tt-b-preset-head'}, el('strong', {text: p.label}), el('code', {text: p.class}),
                    el('button', {type: 'button', className: 'rex-button', 'data-size': 'sm', text: t('addPreset'), onclick: () => {
                        const list = this.config.listStyles ??= [];
                        if (!list.some(s => s.class === p.class)) {
                            list.push({label: p.label, class: p.class, list: p.list});
                            this.listStylesRedraw?.();
                            this.changed();
                        }
                    }})),
                el('pre', {className: 'tt-b-output', text: p.css}))));
    }

    styleList(key, block, listKind = false) {
        const wrap = el('div', {className: 'tt-b-styles'});
        const elements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'table'];
        const draw = () => {
            const parts = key.split('.');
            let owner = this.config;
            for (const part of parts.slice(0, -1)) {
                owner = owner[part] ??= {};
            }
            const list = owner[parts.at(-1)] ??= [];
            wrap.replaceChildren(
                ...list.map((style, i) => el('div', {className: 'tt-b-style'},
                    el('input', {type: 'text', className: 'rex-input', 'aria-label': t('label'), placeholder: t('label'), value: style.label ?? '', oninput: e => {
                        style.label = e.target.value;
                        this.changed();
                    }}),
                    el('input', {type: 'text', className: 'rex-input', 'aria-label': t('cssClass'), placeholder: t('cssClass'), value: style.class ?? '', spellcheck: 'false', oninput: e => {
                        style.class = e.target.value;
                        this.changed();
                    }}),
                    block ? el('select', {className: 'rex-input', 'aria-label': t('element'), onchange: e => {
                        style.element = e.target.value;
                        this.changed();
                    }}, ...elements.map(name => el('option', {value: name, text: '<' + name + '>', selected: (style.element ?? 'p') === name}))) : null,
                    listKind ? el('select', {className: 'rex-input', 'aria-label': t('listFor'), onchange: e => {
                        style.list = e.target.value;
                        this.changed();
                    }}, ...[['both', t('listBoth')], ['ol', t('listOl')], ['ul', t('listUl')]].map(([v, l]) => el('option', {value: v, text: l, selected: (style.list ?? 'both') === v}))) : null,
                    this.smallButton('trash', t('remove'), () => {
                        list.splice(i, 1);
                        draw();
                        this.changed();
                    }),
                )),
                el('button', {type: 'button', className: 'rex-button', 'data-size': 'sm', onclick: () => {
                    list.push(block ? {label: '', class: '', element: 'p'} : (listKind ? {label: '', class: '', list: 'both'} : {label: '', class: ''}));
                    draw();
                    this.changed();
                    wrap.querySelectorAll('.tt-b-style input')[list.length * 2 - 2]?.focus();
                }}, el('i', {className: 'rex-icon fa-solid fa-plus', 'aria-hidden': 'true'}), ' ' + t('addStyle')),
            );
        };
        draw();
        if (listKind) {
            this.listStylesRedraw = draw;
        }
        return wrap;
    }

    /* ---------- Vorschau ---------- */

    renderPreview() {
        const markdown = 'markdown' === this.mode;
        const old = this.previewEl.querySelector('rex-tiptap');
        const value = old?.value || (markdown ? t('sampleMd') : t('sample'));
        const previousMode = this.previewEl.dataset.mode;
        // Beim Wechsel des Modus mit dem passenden Beispiel beginnen
        const content = previousMode && previousMode !== this.mode ? (markdown ? t('sampleMd') : t('sample')) : value;
        this.previewEl.dataset.mode = this.mode;

        const config = {
            ...this.config,
            name: 'preview',
            mode: this.mode,
            backend: true,
            mediaUrl: this.root.dataset.mediaUrl || '/media/',
            mediaManagerUrl: this.root.dataset.mediaManagerUrl || '/index.php?rex_media_type=__TYPE__&rex_media_file=__FILE__',
            // wie im echten Editor: verlinkbare Tabellen mit Bezeichnung und Such-Adresse
            recordApi: this.root.dataset.recordApi,
            recordTables: (this.config.link?.records ?? []).filter(name => this.recordTables[name]).map(name => ({name, label: this.recordTables[name]})),
            // Markdown kennt keine Klassen
            ...(markdown ? {blockStyles: [], inlineStyles: [], toolbar: (this.config.toolbar ?? []).map(g => g.filter(id => this.items[id]?.markdown !== false))} : {}),
        };
        const textarea = el('textarea', {className: 'rex-input', 'aria-label': t('preview')});
        textarea.value = content;
        const editor = el('rex-tiptap', {'data-config': JSON.stringify(config)}, textarea);
        editor.addEventListener('rex-tiptap:change', e => {
            this.outputEl.textContent = e.detail.value;
        });
        this.outputEl.textContent = content;
        this.previewEl.replaceChildren(editor);
        window.RexTiptap?.load?.();
    }
}

function start() {
    // Kurzansicht der Toolbar in der Profilliste
    document.querySelectorAll('[data-tiptap-mini]').forEach(mini => {
        const icon = window.RexTiptap?.icon;
        if (!icon || mini.childElementCount) {
            return;
        }
        for (const group of JSON.parse(mini.dataset.tiptapMini || '[]')) {
            const span = el('span');
            for (const id of group) {
                const item = window.RexTiptap.items.item(id);
                const node = icon(item?.icon ?? 'plugin');
                node.setAttribute('aria-hidden', 'true');
                const wrap = el('span', {className: 'tt-mini-item', title: item?.label ?? id}, node);
                span.append(wrap.firstChild);
                span.lastChild.setAttribute?.('data-title', item?.label ?? id);
            }
            mini.append(span);
        }
        mini.setAttribute('aria-label', JSON.parse(mini.dataset.tiptapMini || '[]').flat().map(id => window.RexTiptap.items.item(id)?.label ?? id).join(', '));
        mini.setAttribute('role', 'img');
    });
    document.querySelectorAll('[data-tiptap-builder]').forEach(root => {
        if (!root.builder) {
            root.builder = new Builder(root);
        }
    });
}

// Symbole kommen aus dem Editor-Bundle: erst rendern, wenn es da ist
function boot() {
    const api = window.RexTiptap;
    if (api?.ready) {
        api.load?.();
        api.ready(() => start());
    } else {
        start();
    }
}

if ('loading' === document.readyState) {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

// Ausprobieren: Profil wechseln lädt die Seite neu
document.addEventListener('change', e => {
    const select = e.target.closest?.('[data-tiptap-reload]');
    if (select) {
        const url = new URL(window.location.href);
        url.searchParams.set(select.name, select.value);
        window.location.href = url.toString();
    }
});
