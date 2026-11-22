// Exercise the production loader inside an isolated official Electron runtime.
// The IDE app, accounts, extensions and user profile are never launched.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function main() {
  if (process.platform !== 'linux') throw new Error('The isolated Electron runtime harness currently targets Linux CI.');
  const configured = process.env.PRISM_ELECTRON_EXECUTABLE || process.env.VSCODE_EXECUTABLE_PATH;
  if (!configured) throw new Error('Set VSCODE_EXECUTABLE_PATH to an official Antigravity executable prepared by scripts/prepare-antigravity.py.');
  const executable = fs.realpathSync(configured);
  const source = path.dirname(executable);
  const product = JSON.parse(fs.readFileSync(path.join(source, 'resources', 'app', 'product.json'), 'utf8'));
  const originalMain = path.join(source, 'resources', 'app', 'out', 'main.js');
  const originalHash = hash(originalMain);
  if (process.env.PRISM_EXPECTED_IDE_VERSION) assert.equal(product.ideVersion, process.env.PRISM_EXPECTED_IDE_VERSION);
  const loader = path.join(root, 'media', 'antigravity-loader.mjs');
  if (!fs.existsSync(loader)) throw new Error('The production appearance loader is missing.');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-adapter-electron-'));
  const runtime = path.join(temporary, 'runtime');
  const resultPath = path.join(temporary, 'result.json');
  let passed = false;
  try {
    fs.mkdirSync(runtime);
    // Packaged Electron ignores a positional app directory. Give an isolated
    // executable its own resources/app; symlink only read-only runtime assets.
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (entry.name === 'resources') continue;
      const from = path.join(source, entry.name);
      const to = path.join(runtime, entry.name);
      if (entry.name === path.basename(executable)) {
        fs.copyFileSync(from, to, fs.constants.COPYFILE_FICLONE);
        fs.chmodSync(to, fs.statSync(from).mode & 0o777);
      } else fs.symlinkSync(from, to, entry.isDirectory() ? 'dir' : 'file');
    }
    const application = path.join(runtime, 'resources', 'app');
    fs.mkdirSync(application, { recursive: true });
    fs.cpSync(path.join(root, 'test', 'adapter-electron'), application, { recursive: true });
    fs.writeFileSync(path.join(application, 'package.json'), JSON.stringify({ name: 'prism-adapter-electron-fixture', version: '1.0.0', main: 'main.cjs' }));
    const env = { ...process.env, PRISM_ADAPTER_LOADER: loader, PRISM_ADAPTER_FIXTURE_ROOT: temporary, PRISM_ADAPTER_RESULT: resultPath };
    delete env.ELECTRON_RUN_AS_NODE;
    const args = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--user-data-dir=${path.join(temporary, 'user-data')}`];
    if (!process.env.DISPLAY) args.push('--ozone-platform=headless');
    const code = await new Promise((resolve, reject) => {
      const child = spawn(path.join(runtime, path.basename(executable)), args, { env, stdio: 'inherit' });
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Electron adapter harness exceeded 120 seconds.')); }, 120000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (value, signal) => { clearTimeout(timer); resolve(value === null ? `signal ${signal}` : value); });
    });
    assert.equal(hash(originalMain), originalHash, 'The source IDE main entry must remain unchanged');
    const result = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')) : undefined;
    if (result) {
      fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
      const report = { ideVersion: product.ideVersion, originalMainUnchanged: true, ...result };
      fs.writeFileSync(path.join(root, 'artifacts', `adapter-electron-${product.ideVersion || 'unknown'}.json`), JSON.stringify(report, null, 2) + '\n');
    }
    assert.equal(code, 0, `Electron fixture exited unsuccessfully: ${result?.error || code}`);
    assert.equal(result?.passed, true, 'The actual Electron fixture must report success');
    passed = true;
    console.log(`[adapter-electron] PASS IDE ${product.ideVersion}: ${result.scenarios.length} real Electron fixture scenarios; no authenticated chat was exercised.`);
  } finally {
    if (passed || process.env.PRISM_KEEP_TEST_PROFILE !== '1') fs.rmSync(temporary, { recursive: true, force: true });
    else console.error(`[adapter-electron] Failed fixture retained: ${temporary}`);
  }
}

main().catch(error => { console.error('[adapter-electron]', error); process.exitCode = 1; });
