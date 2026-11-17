import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
// wie das Backend von REDAXO 6
const target = ['chrome125', 'firefox128', 'safari18'];

const builds = [
    {entryPoints: ['resources/js/main.js'], outfile: 'assets/tiptap.js', format: 'esm'},
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
