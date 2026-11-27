/*
 REDAXO TipTap – small loader (assets/tiptap-loader.js, classic script).

 Loads the editor bundle only when an editor appears on the page (also later, e.g. in collections). Until then
 `RexTiptap.register()` collects the extensions of other addons, `RexTiptap.ready(fn)` waits for the bundle.
 */
(() => {
    const api = (window.RexTiptap = window.RexTiptap || {});
    if (api.__loader) {
        return;
    }
    api.__loader = true;
    api.__queue = api.__queue || [];
    api.__ready = api.__ready || [];
    api.register = api.register || (plugin => api.__queue.push(plugin));
    api.ready = fn => (api.tiptap ? fn(api) : api.__ready.push(fn));

    const script = document.currentScript;
    const [base, query] = script.src.split('?');
    const bundle = base.replace(/tiptap-loader\.js$/, 'tiptap.js') + (query ? '?' + query : '');
    let loading = null;
    api.load = () => (loading ??= import(bundle).catch(e => {
        loading = null;
        console.error('rex-tiptap: Bundle nicht geladen', e);
    }));

    const selector = 'rex-tiptap, textarea[data-tiptap]';
    const check = node => {
        if (!api.tiptap && (node.matches?.(selector) || node.querySelector?.(selector))) {
            api.load();
        }
    };
    const start = () => {
        check(document.documentElement);
        const observer = new MutationObserver(mutations => {
            if (api.tiptap) {
                observer.disconnect();
                return;
            }
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (1 === node.nodeType) {
                        check(node);
                    }
                }
            }
        });
        observer.observe(document.documentElement, {childList: true, subtree: true});
    };
    if ('loading' === document.readyState) {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
