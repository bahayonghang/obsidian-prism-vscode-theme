const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { version, name } = require('../package.json');
fs.mkdirSync('artifacts', { recursive: true });
const cli = require.resolve('@vscode/vsce/vsce');
const result = spawnSync(process.execPath, [cli, 'package', '--no-dependencies', '--allow-missing-repository', '--out', path.join('artifacts', `${name}-${version}.vsix`)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
