import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
// like the REDAXO 6 backend
const target = ['chrome125', 'firefox128', 'safari18'];

const builds = [
    // ES module with lazily loaded parts (e.g. CodeMirror for the source view) in assets/chunks/
    {entryPoints: {tiptap: 'resources/js/main.js'}, outdir: 'assets', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]'},
    {entryPoints: ['resources/js/loader.js'], outfile: 'assets/tiptap-loader.js', format: 'iife'},
    {entryPoints: ['resources/js/builder.js'], outfile: 'assets/builder.js', format: 'iife'},
    // frontend of the media blocks (placeholder, consent) – small, without TipTap
    {entryPoints: ['resources/js/media-frontend.js'], outfile: 'assets/tiptap-media.js', format: 'iife'},
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
