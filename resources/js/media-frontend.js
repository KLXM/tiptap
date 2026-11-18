/*
 * Frontend der Medien-Blöcke (tiptap-media.js): 2-Klick-Platzhalter für YouTube/Vimeo und HTML-Embeds mit Dienst.
 *
 * Schnittstelle zu Einwilligungs-Tools (z. B. consent_kit), anbieterneutral:
 *   Platzhalter  [data-consent-service="youtube"][data-consent-src="…"] mit [data-consent-load] / [data-consent-allow]
 *   Zustand      data-consent-state="blocked|loaded"
 *   JS           window.ConsentKit (Alias cmsConsent): has(key), accept(key); Ereignisse consentkit:ready / consentkit:change
 * Ohne Einwilligungs-Tool lädt ein Klick auf „Video laden“ bzw. „Inhalt laden“ den Inhalt.
 */

const SELECTOR = '.rex-oembed-frame[data-consent-service], .rex-embed-consent[data-consent-service]';
const nonce = document.currentScript?.nonce || '';
const de = (document.documentElement.lang || 'de').toLowerCase().startsWith('de');
const ALLOW = de ? '%s immer erlauben' : 'Always allow %s';
const NAMES = {youtube: 'YouTube', vimeo: 'Vimeo'};

const kit = () => window.ConsentKit || window.cmsConsent || null;
const allowed = service => {
    try {
        return !!kit()?.has?.(service);
    } catch {
        return false;
    }
};

/** Skripte aus einer Vorlage neu anlegen – geklonte Skripte führt der Browser sonst nicht aus */
function revive(fragment) {
    fragment.querySelectorAll('script').forEach(old => {
        const script = document.createElement('script');
        for (const {name, value} of old.attributes) {
            script.setAttribute(name, value);
        }
        script.nonce = old.getAttribute('nonce') || nonce;
        script.text = old.text;
        old.replaceWith(script);
    });
    return fragment;
}

function activate(el, autoplay = false) {
    if ('loaded' === el.dataset.consentState) {
        return;
    }
    el.dataset.consentState = 'loaded';
    if (el.classList.contains('rex-embed-consent')) {
        const template = el.querySelector(':scope > template');
        el.replaceChildren(template ? revive(template.content.cloneNode(true)) : '');
        return;
    }
    let src = el.dataset.consentSrc || el.dataset.src || '';
    if (!autoplay) {
        src = src.replace(/([?&])autoplay=1(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, '');
    }
    if (!/^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//.test(src)) {
        return;
    }
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = el.dataset.consentTitle || NAMES[el.dataset.consentService] || '';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    el.replaceChildren(iframe);
    if (autoplay) {
        iframe.focus();
    }
}

function setup(el) {
    if (el.dataset.consentState) {
        return;
    }
    const service = el.dataset.consentService;
    if (allowed(service)) {
        activate(el);
        return;
    }
    el.dataset.consentState = 'blocked';
    // Mit Einwilligungs-Tool: „… immer erlauben“
    if (kit()?.accept && !el.querySelector('[data-consent-allow]')) {
        const allow = document.createElement('button');
        allow.type = 'button';
        allow.className = 'rex-media-allow';
        allow.dataset.consentAllow = '';
        allow.textContent = ALLOW.replace('%s', NAMES[service] ?? el.dataset.consentTitle ?? service);
        (el.querySelector('.rex-oembed-note, .rex-embed-placeholder') ?? el).append(allow);
    }
}

function scan() {
    document.querySelectorAll(SELECTOR).forEach(setup);
}

document.addEventListener('click', e => {
    const button = e.target.closest?.('[data-consent-load], [data-consent-allow], .rex-embed-load');
    const el = button?.closest(SELECTOR);
    if (!el) {
        return;
    }
    e.preventDefault();
    if (button.hasAttribute('data-consent-allow')) {
        try {
            kit()?.accept?.(el.dataset.consentService);
        } catch {
            // trotzdem laden
        }
    }
    activate(el, true);
});

// Einwilligung erteilt (consent_kit): alle Platzhalter dieses Dienstes laden
document.addEventListener('consentkit:change', e => {
    const accepted = e.detail?.accepted ?? [];
    document.querySelectorAll(SELECTOR).forEach(el => {
        if (accepted.includes(el.dataset.consentService) || allowed(el.dataset.consentService)) {
            activate(el);
        }
    });
});
document.addEventListener('consentkit:ready', scan);

if ('loading' === document.readyState) {
    document.addEventListener('DOMContentLoaded', scan);
} else {
    scan();
}
