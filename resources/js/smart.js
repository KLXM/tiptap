/*
 * Komfort beim Schreiben (wie im Editor von fluid):
 *  - Markdown einfügen: reiner Text, der eindeutig nach Markdown aussieht, wird umgewandelt; ein Hinweis bietet
 *    „Als Text einfügen“ (macht die Umwandlung rückgängig).
 *  - Auto-Links: E-Mail- und Web-Adressen sowie Telefonnummern werden beim Tippen (nach Leerzeichen, Enter,
 *    Satzzeichen) zu Links; markierte Adressen werden mit „Link“ sofort verlinkt.
 * Was das Profil nicht erlaubt (mailto, tel, externe Adressen, Überschriften-Ebenen …), bleibt Text.
 */

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {t} from './i18n.js';

/* ---------- Markdown erkennen (gleiche Regeln wie fluid) ---------- */

const TABLE_SEP = /^ *\|? *:?-{2,}:? *(\| *:?-{2,}:? *)*\|? *$/;

/**
 * Sieht reiner Text eindeutig nach Markdown aus? Starke Zeichen (eines reicht): Überschrift „# …“, Code-Zaun,
 * [Text](Adresse), **fett**, Aufgabenliste, Tabelle, Bild. Schwache (zwei nötig): ≥ 2 Listenzeilen, > Zitat,
 * *kursiv*, _kursiv_, `Code`. Normale Sätze mit Bindestrich-Aufzählung bleiben reiner Text.
 */
export function looksLikeMarkdown(text) {
    const s = String(text || '').replace(/\r\n?/g, '\n');
    if (s.trim().length < 3) {
        return false;
    }
    const strong = [
        /^ {0,3}#{1,6}[ \t]+\S/m, /^ {0,3}(```|~~~)/m, /\[[^\]\n]+\]\((https?:\/\/|mailto:|tel:|\/|#|www\.)[^)\s]*\)/,
        /(\*\*|__)(?=\S)[^\n]*?\S\1/, /^\s*[-*+][ \t]+\[[ xX]\][ \t]/m, /!\[[^\]\n]*\]\([^)\s]+\)/,
    ].filter(rx => rx.test(s)).length;
    const table = /^ *\|.*\|/m.test(s) && s.split('\n').some(l => l.includes('|') && TABLE_SEP.test(l) && l.includes('-'));
    const lists = s.split('\n').filter(l => /^\s*([-*+]|\d{1,3}[.)])[ \t]+\S/.test(l)).length;
    const weak = [lists >= 2, /^ {0,3}>[ \t]?\S/m.test(s), /(^|[\s(])\*(?=[^\s*])[^*\n]*[^\s*]\*(?=[\s).,;:!?]|$)/m.test(s),
        /(^|[\s(])_(?=[^\s_])[^_\n]*[^\s_]_(?=[\s).,;:!?]|$)/m.test(s), /`[^`\n]+`/.test(s)].filter(Boolean).length;
    return strong + (table ? 1 : 0) >= 1 || weak >= 2;
}

/** HTML in der Zwischenablage ohne echte Formatierung (Code-Editoren: nur div/span/pre/br) → wie reiner Text */
export const htmlIsPlain = html => !html || !/<(p|h[1-6]|ul|ol|li|b|strong|em|i|a|table|blockquote|img)\b/i.test(html.replace(/<(meta|style)\b[\s\S]*?(<\/style>|>)/gi, ''));

/** Überschriften auf die erlaubten Ebenen schieben (# → kleinste erlaubte Ebene …), sonst Absatz */
export function fitHeadings(markdown, levels) {
    const allowed = [...(levels ?? [])].sort();
    let fence = false;
    return markdown.split('\n').map(line => {
        if (/^ {0,3}(```|~~~)/.test(line)) {
            fence = !fence;
        }
        const m = fence ? null : /^( {0,3})(#{1,6})([ \t]+.*)$/.exec(line);
        if (!m) {
            return line;
        }
        const level = allowed.find(l => l >= m[2].length) ?? allowed.at(-1);
        return level ? m[1] + '#'.repeat(level) + m[3] : m[3].trim();
    }).join('\n');
}

/* ---------- Adressen erkennen (gleiche Regeln wie fluid) ---------- */

const EMAIL = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}$/i;
const URL_RE = /^(?:https?:\/\/[^\s<>"]+|www\.[\w-]+(?:\.[\w-]+)+(?:[/?#][^\s<>"]*)?)$/i;
const DOMAIN = /^[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?:[/?#][^\s<>"]*)?$/i;
// Telefon: beginnt mit + oder 0 (auch „(0…)“), Ziffern mit Leerzeichen, / - . ( ) – 6 bis 15 Ziffern
const TEL = /^(?:\+|00|\(?0)[\d\s/().-]*\d$/;
const TEL_END = /(?:\+|\(?0)[\d\s/().-]*\d$/;
const END = /(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}|https?:\/\/[^\s<>"]+|www\.[\w-]+(?:\.[\w-]+)+(?:[/?#][^\s<>"]*)?)$/i;
const telOk = v => {
    const n = v.replace(/\D/g, '').length;
    return n >= 6 && n <= 15 && !/\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(v) && !/\s{2,}/.test(v);
};

/** tel:-Adresse in internationaler Form (0… → +49…) */
export function telHref(value) {
    let n = String(value || '').trim().replace(/^tel:/i, '').replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
    if (n.startsWith('00')) {
        n = '+' + n.slice(2);
    } else if (n.startsWith('0')) {
        n = '+49' + n.slice(1);
    } else if (n && !n.startsWith('+')) {
        n = '+49' + n;
    }
    return n.replace(/\D/g, '').length >= 5 ? 'tel:' + n : null;
}

/** Link-Ziel zu einer Adresse im Text (E-Mail → mailto:, www./Domain → https://, Telefon → tel:) oder null */
export function hrefFor(text, link, domains = false) {
    const v = String(text || '').trim();
    if (EMAIL.test(v)) {
        return link?.mailto ? 'mailto:' + v : null;
    }
    if (URL_RE.test(v)) {
        return link?.external ? (/^https?:/i.test(v) ? v : 'https://' + v) : null;
    }
    if (TEL.test(v) && telOk(v)) {
        return link?.tel ? telHref(v) : null;
    }
    if (domains && DOMAIN.test(v) && !/^\d+(\.\d+)+$/.test(v)) {
        return link?.external ? 'https://' + v : null;
    }
    return null;
}

/** Adresse am Ende des Textes vor dem Cursor: {from, to, href} relativ zum Textanfang */
function addressAtEnd(text, link, punct) {
    const before = text.replace(/[\s.,;:!?)\]'"»“]+$/, '');
    let m = before.match(END);
    if (!m && link?.tel) {
        // längste passende Nummer am Ende („Tel. 02841 35656“ → „02841 35656“)
        const t2 = before.match(TEL_END);
        if (t2) {
            let v = t2[0].replace(/^[\s/.-]+/, '');
            while (v && !(TEL.test(v) && telOk(v))) {
                v = v.replace(/^\S+\s*/, '');
            }
            if (v) {
                m = [v];
            }
        }
    }
    if (!m || /[\w.+@/-]/.test(before.charAt(before.length - m[0].length - 1) || ' ')) {
        return null;
    }
    const href = hrefFor(m[0], link);
    // ? : ; ! ) können in Web-Adressen stehen – dort erst bei Leerzeichen/Enter
    if (!href || (punct && /^https?:/i.test(href))) {
        return null;
    }
    return {from: before.length - m[0].length, to: before.length, href};
}

/** Auto-Links beim Tippen: nach Leerzeichen, Enter oder Satzzeichen wird die Adresse davor verlinkt */
export function rexAutoLink(config) {
    return Extension.create({
        name: 'rexAutoLink',
        addProseMirrorPlugins() {
            const editor = this.editor;
            return [new Plugin({
                key: new PluginKey('rexAutoLink'),
                props: {
                    handleKeyDown(view, event) {
                        const punct = /^[.,;:!?)]$/.test(event.key);
                        if (!(' ' === event.key || 'Enter' === event.key || punct) || event.isComposing) {
                            return false;
                        }
                        const {state} = view;
                        const {$from, empty} = state.selection;
                        const type = state.schema.marks.link;
                        if (!empty || !type || !$from.parent.isTextblock || $from.parent.type.spec.code) {
                            return false;
                        }
                        const text = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
                        const found = addressAtEnd(text, config.link, punct);
                        if (!found) {
                            return false;
                        }
                        const start = $from.start() + found.from;
                        const end = $from.start() + found.to;
                        if (state.doc.rangeHasMark(start, end, type)) {
                            return false;
                        }
                        view.dispatch(state.tr.addMark(start, end, type.create({href: found.href})).removeStoredMark(type));
                        editor.emit('rexAutoLink', {href: found.href});
                        return false;
                    },
                },
            })];
        },
    });
}

/* ---------- Hinweis nach dem Einfügen ---------- */

let tip = null;
let tipTimer = 0;

/** „Markdown umgewandelt · Als Text einfügen · ×“ unten im Editor (role="status", schließt nach 10 s) */
export function pasteTip(host, onPlain) {
    tip?.remove();
    clearTimeout(tipTimer);
    tip = document.createElement('div');
    tip.className = 'rex-tiptap-tip';
    tip.setAttribute('role', 'status');
    const label = document.createElement('span');
    label.textContent = t('markdownConverted');
    const plain = document.createElement('button');
    plain.type = 'button';
    plain.className = 'rex-tiptap-tip-button';
    plain.textContent = t('markdownAsText');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'rex-tiptap-tip-close';
    close.setAttribute('aria-label', t('close'));
    close.textContent = '×';
    tip.append(label, plain, close);
    // Klick lässt die Schreibmarke im Text (Rückgängig wirkt auf den Editor)
    tip.addEventListener('mousedown', e => e.preventDefault());
    plain.addEventListener('click', () => {
        const x = tip;
        tip = null;
        x.remove();
        onPlain();
    });
    close.addEventListener('click', () => {
        tip?.remove();
        tip = null;
    });
    host.append(tip);
    tipTimer = setTimeout(() => {
        tip?.remove();
        tip = null;
    }, 10000);
}

/* ---------- Eingefügtes HTML von außen bereinigen ---------- */

/** Ganz entfernen (samt Inhalt): Medien, Skripte, Formulare und Bedienelemente fremder Seiten */
const DROP = 'script,style,noscript,template,iframe,object,embed,frame,frameset,img,picture,source,video,audio,track,canvas,svg,math,map,area,'
    + 'form,input,select,option,optgroup,textarea,button,label,dialog,meta,link,base,head,title,nav,aside,header,footer,figure>figcaption:only-child';

/** Elemente, deren Inhalt bleibt, die selbst aber wegfallen (Container ohne Bedeutung) */
const UNWRAP = 'span,font,small,big,abbr,acronym,cite,dfn,kbd,samp,var,time,mark,u,ins,del,s,strike,bdi,bdo,wbr';

/** Container: mit Blöcken darin auspacken, mit nur Text darin zum Absatz machen (sonst läuft Text zusammen) */
const CONTAINERS = 'div,section,article,main,figure,figcaption,center,address,details,summary,dd,dt,dl';
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,table,hr,' + CONTAINERS;

/** Attribute, die bleiben dürfen (der Editor prüft danach noch einmal gegen das Profil) */
const KEEP_ATTRS = {a: ['href'], ol: ['start', 'type'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan']};

/**
 * HTML aus der Zwischenablage (fremde Website, Word, Mail) auf reinen Inhalt bringen: keine Klassen, Stile, IDs,
 * data-Attribute, keine Bilder/Videos/iframes, keine Formular- und Bedienelemente, keine leeren Listen und Absätze.
 * Was übrig bleibt (Überschriften, Absätze, Listen, Links, fett, kursiv, Tabellen …), filtert der Editor nach dem
 * Profil; gespeichert wird zusätzlich serverseitig bereinigt.
 */
export function cleanPastedHtml(html) {
    // Ereignis- und Stil-Attribute schon vor dem Einlesen weg (CSP-Meldungen, nichts davon darf je wirken)
    html = html.replace(/\s(?:on[a-z]+|style)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;
    body.querySelectorAll(DROP).forEach(n => n.remove());
    // Kommentare (z. B. Word: <!--[if …]>)
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
    const comments = [];
    while (walker.nextNode()) {
        comments.push(walker.currentNode);
    }
    comments.forEach(c => c.remove());
    // Word-Namensräume (o:p, w:…) und Inline-Container auspacken
    [...body.querySelectorAll('*')].reverse().forEach(n => {
        const tag = n.tagName.toLowerCase();
        if (tag.includes(':') || n.matches(UNWRAP)) {
            n.replaceWith(...n.childNodes);
        }
    });
    // Block-Container: von innen nach außen
    [...body.querySelectorAll(CONTAINERS)].reverse().forEach(n => {
        if ([...n.children].some(c => c.matches(BLOCKS))) {
            n.replaceWith(...n.childNodes);
        } else {
            const p = doc.createElement('p');
            p.append(...n.childNodes);
            n.replaceWith(p);
        }
    });
    // Attribute auf das Nötigste
    body.querySelectorAll('*').forEach(n => {
        const keep = KEEP_ATTRS[n.tagName.toLowerCase()] ?? [];
        for (const {name} of [...n.attributes]) {
            if (!keep.includes(name)) {
                n.removeAttribute(name);
            }
        }
        if ('A' === n.tagName && !/^(https?:|mailto:|tel:|\/|#)/i.test(n.getAttribute('href') ?? '')) {
            n.replaceWith(...n.childNodes);
        }
    });
    // Leeres entfernen (von innen nach außen): Listeneinträge, Listen, Absätze, Überschriften, Links
    const isEmpty = n => '' === (n.textContent ?? '').replace(/[\s ​]+/g, '');
    for (let pass = 0; pass < 3; pass++) {
        [...body.querySelectorAll('li, ul, ol, p, h1, h2, h3, h4, h5, h6, blockquote, a, strong, b, em, i, table, tr')].reverse()
            .filter(isEmpty)
            .forEach(n => n.remove());
    }
    return body.innerHTML;
}

/** Zuletzt in einem tiptap-Editor kopierter Text – Einfügen davon gilt als intern (Medien bleiben erhalten) */
let lastCopied = null;

const normal = text => String(text ?? '').replace(/\s+/g, ' ').trim();

export function rememberCopy(text) {
    lastCopied = normal(text);
}

export function isInternalPaste(text) {
    return null !== lastCopied && normal(text) === lastCopied;
}
