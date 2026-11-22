// Only mutates the SHA-pinned disposable IDE cache prepared by this repository.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createDesktopAdapter, ADAPTER_DIRECTORY, BOOTSTRAP } = require('../out/desktop-adapter.js');
const { generateHostAppearanceBundle } = require('../out/host-style.js');
const { DEFAULT_SETTINGS } = require('../out/config.js');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

async function main() {
  const action = process.argv[2];
  assert.ok(['enable', 'restore'].includes(action), 'Usage: node scripts/manage-test-adapter.cjs enable|restore');
  const root = path.resolve(__dirname, '..');
  const executable = process.env.VSCODE_EXECUTABLE_PATH;
  if (!executable) throw new Error('VSCODE_EXECUTABLE_PATH is required');
  const appRoot = await fs.realpath(path.join(path.dirname(executable), 'resources', 'app'));
  const cache = await fs.realpath(path.join(root, '.antigravity-test'));
  const relative = path.relative(cache, appRoot);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Refuse to modify any installation outside this repository’s disposable IDE cache');
  const product = JSON.parse(await fs.readFile(path.join(appRoot, 'product.json'), 'utf8'));
  assert.equal(product.ideVersion, process.env.PRISM_EXPECTED_IDE_VERSION);
  const mainFile = path.join(appRoot, 'out', 'main.js');
  const reportFile = path.join(root, 'artifacts', `adapter-startup-${product.ideVersion}.json`);
  const adapter = createDesktopAdapter({ appRoot, extensionRoot: root, remote: false, web: false });
  if (action === 'enable') {
    const before = await adapter.info();
    assert.equal(before.state, 'available', before.reason);
    const bytes = await fs.readFile(mainFile);
    const info = await adapter.enable(generateHostAppearanceBundle(DEFAULT_SETTINGS));
    assert.equal(info.installed, true, info.reason);
    assert.equal(info.restartRequired, true);
    const patched = await fs.readFile(mainFile);
    assert.deepEqual(patched, Buffer.concat([bytes, Buffer.from(BOOTSTRAP)]));
    await fs.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.writeFile(reportFile, JSON.stringify({ ideVersion: product.ideVersion, enabledAt: Date.now(), originalSha256: sha(bytes), patchedSha256: sha(patched), installed: true }, null, 2));
    console.log(`[adapter-startup] Installed the production hook into disposable IDE ${product.ideVersion}.`);
  } else {
    const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    let runtime;
    try { runtime = JSON.parse(await fs.readFile(path.join(appRoot, 'out', ADAPTER_DIRECTORY, 'status.json'), 'utf8')); } catch { /* Restoration must still run if startup failed. */ }
    const result = await adapter.disable();
    const restoredHash = sha(await fs.readFile(mainFile));
    assert.equal(restoredHash, report.originalSha256, result.reason);
    report.restoredSha256 = restoredHash;
    report.restored = true;
    report.loaderStartedInActualIde = runtime?.owner === 'obsidian-prism-desktop-adapter' && runtime.at >= report.enabledAt;
    if (runtime) report.runtime = { enabled: runtime.enabled, appliedFrames: runtime.appliedFrames, blockedFrames: runtime.blockedFrames };
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
    assert.equal(report.loaderStartedInActualIde, true, 'The production loader must actually run from the official IDE main entry');
    console.log(`[adapter-startup] Actual IDE ${product.ideVersion} loaded the hook; original entry restored byte for byte. No authenticated conversation was exercised.`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
