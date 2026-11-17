/* Werkzeuge und Erweiterungen anderer AddOns */

import {builtinItems} from './items.js';
import {addIcon} from './icons.js';
import {i18n} from './i18n.js';

const plugins = new Map();
const items = {...builtinItems};

export const registry = {
    /**
     * Erweiterung anmelden:
     *
     *     RexTiptap.register({
     *         id: 'myaddon',
     *         items: {'myaddon:hint': {label: 'Hinweis', icon: 'plugin', run: ({editor}) => …, active: …}},
     *         extensions: ({config, has}) => has('myaddon:hint') ? [HintNode] : [],
     *         icons: {hint: [['circle', {cx: '12', cy: '12', r: '10'}]]},
     *         i18n: {de: {…}, en: {…}},
     *     });
     */
    register(plugin) {
        if (!plugin?.id) {
            throw new Error('RexTiptap.register(): id fehlt');
        }
        plugins.set(plugin.id, plugin);
        for (const [id, item] of Object.entries(plugin.items ?? {})) {
            items[id] = {...item, plugin: plugin.id};
        }
        for (const [name, node] of Object.entries(plugin.icons ?? {})) {
            addIcon(name, node);
        }
        for (const [lang, entries] of Object.entries(plugin.i18n ?? {})) {
            i18n.add(lang, entries);
        }
    },

    plugins() {
        return [...plugins.values()];
    },

    item(id) {
        return items[id];
    },

    items() {
        return items;
    },

    /** Werkzeuge der Toolbar eines Profils, unbekannte (z. B. AddOn entfernt) fallen weg */
    resolveItems(config) {
        const list = [];
        for (const group of config.toolbar ?? []) {
            for (const id of group) {
                if (items[id] && !list.some(i => i.id === id)) {
                    list.push({...items[id], id});
                }
            }
        }
        return list;
    },

    pluginExtensions(ctx) {
        const result = [];
        for (const plugin of plugins.values()) {
            if (typeof plugin.extensions === 'function') {
                result.push(...(plugin.extensions(ctx) ?? []));
            }
        }
        return result;
    },
};
