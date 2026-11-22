const esbuild = require('esbuild');
esbuild.buildSync({ entryPoints: ['src/extension.ts'], outfile: 'dist/browser.js', bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', external: ['vscode'], sourcemap: false, minify: true, legalComments: 'inline' });
console.log('Built browser extension (no Node.js runtime dependencies).');
