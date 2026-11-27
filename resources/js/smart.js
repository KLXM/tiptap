/*
 * Writing comfort (as in the fluid editor):
 *  - Paste Markdown: plain text that clearly looks like Markdown is converted; a notice offers
 *    "paste as text" (undoes the conversion).
 *  - Auto-links: email and web addresses as well as phone numbers become links while typing (after space, Enter,
 *    punctuation); selected addresses are linked immediately with "Link".
 * Whatever the profile doesn't allow (mailto, tel, external addresses, heading levels …) stays text.
 */

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {t} from './i18n.js';

/* ---------- Detect Markdown (same rules as fluid) ---------- */

const TABLE_SEP = /^ *\|? *:?-{2,}:? *(\| *:?-{2,}:? *)*\|? *$/;

/**
 * Does plain text clearly look like Markdown? Strong signs (one is enough): heading "# …", code fence,
 * [text](address), **bold**, task list, table, image. Weak ones (two needed): ≥ 2 list lines, > quote,
 * *italic*, _italic_, `code`. Normal sentences with hyphen bullets stay plain text.
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

/** HTML in the clipboard without real formatting (code editors: only div/span/pre/br) → treat as plain text */
export const htmlIsPlain = html => !html || !/<(p|h[1-6]|ul|ol|li|b|strong|em|i|a|table|blockquote|img)\b/i.test(html.replace(/<(meta|style)\b[\s\S]*?(<\/style>|>)/gi, ''));

/** Shift headings to the allowed levels (# → smallest allowed level …), otherwise paragraph */
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

/* ---------- Detect addresses (same rules as fluid) ---------- */

const EMAIL = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}$/i;
const URL_RE = /^(?:https?:\/\/[^\s<>"]+|www\.[\w-]+(?:\.[\w-]+)+(?:[/?#][^\s<>"]*)?)$/i;
const DOMAIN = /^[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?:[/?#][^\s<>"]*)?$/i;
// Phone: starts with + or 0 (also "(0…)"), digits with spaces, / - . ( ) – 6 to 15 digits
const TEL = /^(?:\+|00|\(?0)[\d\s/().-]*\d$/;
const TEL_END = /(?:\+|\(?0)[\d\s/().-]*\d$/;
const END = /(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}|https?:\/\/[^\s<>"]+|www\.[\w-]+(?:\.[\w-]+)+(?:[/?#][^\s<>"]*)?)$/i;
const telOk = v => {
    const n = v.replace(/\D/g, '').length;
    return n >= 6 && n <= 15 && !/\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(v) && !/\s{2,}/.test(v);
};

/** tel: address in international format (0… → +49…) */
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

/** Link target for an address in the text (email → mailto:, www./domain → https://, phone → tel:) or null */
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

/** Address at the end of the text before the cursor: {from, to, href} relative to the start of the text */
function addressAtEnd(text, link, punct) {
    const before = text.replace(/[\s.,;:!?)\]'"»“]+$/, '');
    let m = before.match(END);
    if (!m && link?.tel) {
        // longest matching number at the end ("Tel. 02841 35656" → "02841 35656")
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
    // ? : ; ! ) can appear in web addresses – there only on space/Enter
    if (!href || (punct && /^https?:/i.test(href))) {
        return null;
    }
    return {from: before.length - m[0].length, to: before.length, href};
}

/** Auto-links while typing: after space, Enter or punctuation the address before it is linked */
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

/* ---------- Notice after pasting ---------- */

let tip = null;
let tipTimer = 0;

/** Notice at the bottom of the editor (role="status", closes after 10 s), optionally with a button */
export function showNote(host, text, actionLabel = null, onAction = null) {
    tip?.remove();
    clearTimeout(tipTimer);
    tip = document.createElement('div');
    tip.className = 'rex-tiptap-tip';
    tip.setAttribute('role', 'status');
    const label = document.createElement('span');
    label.textContent = text;
    tip.append(label);
    if (actionLabel && onAction) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'rex-tiptap-tip-button';
        action.textContent = actionLabel;
        action.addEventListener('click', () => {
            const x = tip;
            tip = null;
            x.remove();
            onAction();
        });
        tip.append(action);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'rex-tiptap-tip-close';
    close.setAttribute('aria-label', t('close'));
    close.textContent = '×';
    close.addEventListener('click', () => {
        tip?.remove();
        tip = null;
    });
    tip.append(close);
    // click keeps the caret in the text (undo acts on the editor)
    tip.addEventListener('mousedown', e => e.preventDefault());
    host.append(tip);
    tipTimer = setTimeout(() => {
        tip?.remove();
        tip = null;
    }, 10000);
}

/** "Markdown converted · Paste as text · ×" */
export function pasteTip(host, onPlain) {
    showNote(host, t('markdownConverted'), t('markdownAsText'), onPlain);
}

/* ---------- Clean up HTML pasted from outside ---------- */

/** Remove entirely (including content): media, scripts, forms and controls of foreign pages */
const DROP = 'script,style,noscript,template,iframe,object,embed,frame,frameset,img,picture,source,video,audio,track,canvas,svg,math,map,area,'
    + 'form,input,select,option,optgroup,textarea,button,label,dialog,meta,link,base,head,title,nav,aside,header,footer,figure>figcaption:only-child';

/** Elements whose content is kept but which are dropped themselves (containers without meaning) */
const UNWRAP = 'span,font,small,big,abbr,acronym,cite,dfn,kbd,samp,var,time,mark,u,ins,del,s,strike,bdi,bdo,wbr';

/** Containers: unwrap if they contain blocks, turn into a paragraph if only text (otherwise text runs together) */
const CONTAINERS = 'div,section,article,main,figure,figcaption,center,address,details,summary,dd,dt,dl';
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,table,hr,' + CONTAINERS;

/** Attributes that may stay (the editor checks against the profile again afterwards) */
const KEEP_ATTRS = {a: ['href'], ol: ['start', 'type'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan']};

/**
 * Reduce HTML from the clipboard (foreign website, Word, mail) to pure content: no classes, styles, IDs,
 * data attributes, no images/videos/iframes, no form elements and controls, no empty lists and paragraphs.
 * Whatever remains (headings, paragraphs, lists, links, bold, italic, tables …) is filtered by the editor according
 * to the profile; on save it is additionally sanitized on the server.
 */
export function cleanPastedHtml(html) {
    // remove event and style attributes before parsing (CSP reports, none of it may ever take effect)
    html = html.replace(/\s(?:on[a-z]+|style)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;
    body.querySelectorAll(DROP).forEach(n => n.remove());
    // comments (e.g. Word: <!--[if …]>)
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
    const comments = [];
    while (walker.nextNode()) {
        comments.push(walker.currentNode);
    }
    comments.forEach(c => c.remove());
    // unwrap Word namespaces (o:p, w:…) and inline containers
    [...body.querySelectorAll('*')].reverse().forEach(n => {
        const tag = n.tagName.toLowerCase();
        if (tag.includes(':') || n.matches(UNWRAP)) {
            n.replaceWith(...n.childNodes);
        }
    });
    // block containers: from the inside out
    [...body.querySelectorAll(CONTAINERS)].reverse().forEach(n => {
        if ([...n.children].some(c => c.matches(BLOCKS))) {
            n.replaceWith(...n.childNodes);
        } else {
            const p = doc.createElement('p');
            p.append(...n.childNodes);
            n.replaceWith(p);
        }
    });
    // attributes down to the essentials
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
    // remove empty elements (from the inside out): list items, lists, paragraphs, headings, links
    const isEmpty = n => '' === (n.textContent ?? '').replace(/[\s ​]+/g, '');
    for (let pass = 0; pass < 3; pass++) {
        [...body.querySelectorAll('li, ul, ol, p, h1, h2, h3, h4, h5, h6, blockquote, a, strong, b, em, i, table, tr')].reverse()
            .filter(isEmpty)
            .forEach(n => n.remove());
    }
    return body.innerHTML;
}

/** Text last copied in a tiptap editor – pasting it counts as internal (media are kept) */
let lastCopied = null;

const normal = text => String(text ?? '').replace(/\s+/g, ' ').trim();

export function rememberCopy(text) {
    lastCopied = normal(text);
}

export function isInternalPaste(text) {
    return null !== lastCopied && normal(text) === lastCopied;
}
