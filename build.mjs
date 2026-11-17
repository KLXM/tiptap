import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
// wie das Backend von REDAXO 6
const target = ['chrome125', 'firefox128', 'safari18'];

const builds = [
    // ES-Modul mit nachgeladenen Teilen (z. B. CodeMirror für die Quelltext-Ansicht) in assets/chunks/
    {entryPoints: {tiptap: 'resources/js/main.js'}, outdir: 'assets', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]'},
    {entryPoints: ['resources/js/loader.js'], outfile: 'assets/tiptap-loader.js', format: 'iife'},
    {entryPoints: ['resources/js/builder.js'], outfile: 'assets/builder.js', format: 'iife'},
];

for (const options of builds) {
    const config = {
        ...options,
        bundle: true,
        minify: true,
        sourcemap: false,
        target,
        legalComments: 'eof',
        logLevel: 'info',
    };
    if (watch) {
        await (await esbuild.context(config)).watch();
    } else {
        await esbuild.build(config);
    }
}
