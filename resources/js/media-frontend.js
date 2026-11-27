/*
 * Frontend of the media blocks (tiptap-media.js): two-click placeholder for YouTube/Vimeo and HTML embeds with a service.
 *
 * Interface to consent tools (e.g. consent_kit), vendor-neutral:
 *   Placeholder  [data-consent-service="youtube"][data-consent-src="…"] with [data-consent-load] / [data-consent-allow]
 *   State        data-consent-state="blocked|loaded"
 *   JS           window.ConsentKit (alias cmsConsent): has(key), accept(key); events consentkit:ready / consentkit:change
 * Without a consent tool, a click on „Video laden“ or „Inhalt laden“ loads the content.
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

/** Recreate scripts from a template – the browser doesn't execute cloned scripts otherwise */
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
    // with a consent tool: „… immer erlauben“
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
            // load anyway
        }
    }
    activate(el, true);
});

// consent given (consent_kit): load all placeholders of this service
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
