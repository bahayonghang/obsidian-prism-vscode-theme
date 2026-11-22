const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');
const { createDesktopAdapter, ADAPTER_DIRECTORY, ADAPTER_OWNER, AUDITED_DESKTOP_BUILDS, BOOTSTRAP } = require('../out/desktop-adapter.js');
const hash = value => createHash('sha256').update(value).digest('hex');
const loaderPath = path.join(__dirname, '..', 'media', 'antigravity-loader.mjs');
const css = 'html[data-prism-host-appearance="modern"] .surface-composer { border-radius: 20px; }';

async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-desktop-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const appRoot = path.join(directory, 'app'); const extensionRoot = path.join(directory, 'extension');
  const out = path.join(appRoot, 'out'); const owned = path.join(out, ADAPTER_DIRECTORY);
  await fs.mkdir(out, { recursive: true }); await fs.mkdir(path.join(extensionRoot, 'media'), { recursive: true });
  await fs.copyFile(loaderPath, path.join(extensionRoot, 'media', 'antigravity-loader.mjs'));
  await fs.writeFile(path.join(extensionRoot, 'package.json'), JSON.stringify({ name: 'obsidian-prism-vscode-theme', publisher: 'bahayonghang' }));
  const product = { ideVersion: '2.8.0', applicationName: 'antigravity-ide', nameLong: 'Antigravity IDE' };
  await fs.writeFile(path.join(appRoot, 'product.json'), JSON.stringify(product));
  await fs.writeFile(path.join(appRoot, 'package.json'), JSON.stringify({ type: 'module', main: './out/main.js' }));
  // Test-only audited input: real hashing and all production mutation paths run
  // against this tiny fixture, never against an installed application.
  const original = Buffer.from('// exact audited fixture\r\nexport const fixture = 1;\n');
  const main = path.join(out, 'main.js'); await fs.writeFile(main, original);
  const builds = [{ ...product, mode: 'modern', mainSha256: hash(original), platforms: ['linux'] }];
  const options = { appRoot, extensionRoot, remote: false, web: false, platform: 'linux', appName: 'Antigravity IDE', ...overrides };
  const adapter = createDesktopAdapter(options, builds);
  const manifestFile = path.join(owned, 'manifest.json');
  return { directory, appRoot, extensionRoot, out, owned, original, main, builds, options, adapter,
    manifest: async () => JSON.parse(await fs.readFile(manifestFile, 'utf8')),
    setManifest: async value => fs.writeFile(manifestFile, JSON.stringify(value, null, 2) + '\n'),
  };
}

test('explicit enable, live stylesheet update and disable preserve the main entry byte for byte', async t => {
  const f = await fixture(t);
  assert.equal((await f.adapter.info()).state, 'available');
  await f.adapter.update(css);
  await assert.rejects(fs.stat(f.owned), { code: 'ENOENT' }, 'automatic update cannot install anything');
  const enabled = await f.adapter.enable(css);
  assert.equal(enabled.installed, true); assert.equal(enabled.restartRequired, true);
  assert.deepEqual(await fs.readFile(f.main), Buffer.concat([f.original, Buffer.from(BOOTSTRAP)]));
  assert.deepEqual(await fs.readFile(path.join(f.owned, 'main.original')), f.original);
  const patched = await fs.readFile(f.main);
  await f.adapter.enable(css); // explicit repeated enable does not append another hook
  assert.deepEqual(await fs.readFile(f.main), patched);
  await f.adapter.update(css + '\n/* new appearance */');
  assert.deepEqual(await fs.readFile(f.main), patched, 'ordinary updates touch no application code');
  assert.match(await fs.readFile(path.join(f.owned, 'appearance.css'), 'utf8'), /new appearance/);
  await f.adapter.update('');
  assert.equal(await fs.readFile(path.join(f.owned, 'appearance.css'), 'utf8'), '', 'a non-Prism theme can remove live CSS without reinstalling');
  const disabled = await f.adapter.disable();
  assert.equal(disabled.installed, false); assert.equal(disabled.enabled, false);
  assert.deepEqual(await fs.readFile(f.main), f.original);
  assert.deepEqual(await fs.readFile(path.join(f.owned, 'main.original')), f.original);
  assert.equal((await f.manifest()).enabled, false);
  assert.equal(await fs.readFile(path.join(f.owned, 'disabled'), 'utf8'), ADAPTER_OWNER + '\n');
});

test('web, remote, macOS and non-Antigravity hosts are read-only unsupported targets', async t => {
  for (const options of [{ web: true }, { remote: true }, { platform: 'darwin' }, { appName: 'Visual Studio Code' }]) {
    const f = await fixture(t, options);
    assert.equal((await f.adapter.info()).state, 'unsupported');
    await assert.rejects(f.adapter.enable(css));
    assert.equal((await f.adapter.update(css)).supported, false);
    assert.deepEqual(await fs.readFile(f.main), f.original);
    await assert.rejects(fs.stat(f.owned), { code: 'ENOENT' });
  }
});

test('Windows audit profiles use their own official hashes and enforce platform and product identity', async t => {
  const legacy = AUDITED_DESKTOP_BUILDS.find(build => build.ideVersion === '1.23.2' && build.platforms.includes('win32'));
  const modern = AUDITED_DESKTOP_BUILDS.find(build => build.ideVersion === '2.8.0' && build.platforms.includes('win32'));
  assert.equal(legacy.mainSha256, 'c98cfe9d4256fda7e9f30603cdcddf45e206a4dc3181784c1508e218b6562d65');
  assert.equal(legacy.applicationName, 'antigravity'); assert.equal(legacy.mode, 'legacy');
  assert.equal(modern.mainSha256, '187c3f56c0947da78d5991cb0ab34acbf00766bbeb96d7b3781f3b4fd8bffe4d');
  assert.equal(modern.applicationName, 'antigravity-ide'); assert.equal(modern.mode, 'modern');
  for (const build of [legacy, modern]) assert.notEqual(build.mainSha256, AUDITED_DESKTOP_BUILDS.find(item => item.ideVersion === build.ideVersion && item.platforms.includes('linux')).mainSha256);
  const f = await fixture(t, { platform: 'win32' });
  assert.equal((await f.adapter.info()).state, 'unsupported', 'a Linux audit cannot authorize a Windows main entry');
  f.builds.push({ ...f.builds[0], platforms: ['win32'] });
  assert.equal((await f.adapter.info()).state, 'available');
  await fs.writeFile(path.join(f.appRoot, 'product.json'), JSON.stringify({ ideVersion: '2.8.0', applicationName: 'antigravity', nameLong: 'Antigravity' }));
  assert.equal((await f.adapter.info()).state, 'unsupported', 'matching bytes cannot substitute another product identity');
  await assert.rejects(f.adapter.enable(css), /audited/);
  assert.deepEqual(await fs.readFile(f.main), f.original);
});

test('unrecognized main hash cannot install, and an external main edit is never restored over', async t => {
  const f = await fixture(t);
  await fs.appendFile(f.main, '// external before install');
  assert.equal((await f.adapter.info()).state, 'unsupported');
  await assert.rejects(f.adapter.enable(css), /audited/);
  await fs.writeFile(f.main, f.original); await f.adapter.enable(css);
  const external = Buffer.concat([await fs.readFile(f.main), Buffer.from('// external after install')]);
  await fs.writeFile(f.main, external);
  const beforeCss = await fs.readFile(path.join(f.owned, 'appearance.css'));
  const state = await f.adapter.update('/* must not overwrite */');
  assert.equal(state.state, 'conflict'); assert.equal(state.canDisable, true);
  assert.deepEqual(await fs.readFile(path.join(f.owned, 'appearance.css')), beforeCss);
  const disabled = await f.adapter.disable();
  assert.equal(disabled.state, 'conflict'); assert.equal(disabled.enabled, false);
  assert.deepEqual(await fs.readFile(f.main), external);
  assert.deepEqual(await fs.readFile(path.join(f.owned, 'main.original')), f.original);
  assert.equal(await fs.readFile(path.join(f.owned, 'disabled'), 'utf8'), ADAPTER_OWNER + '\n');
});

test('a damaged backup stops restoration but the disable sentinel still stops live styling', async t => {
  const f = await fixture(t); await f.adapter.enable(css);
  const patched = await fs.readFile(f.main);
  await fs.writeFile(path.join(f.owned, 'main.original'), 'damaged backup');
  const state = await f.adapter.info(); assert.equal(state.state, 'conflict'); assert.equal(state.canDisable, true);
  await assert.rejects(f.adapter.disable(), /Backup|备份/);
  assert.deepEqual(await fs.readFile(f.main), patched);
  assert.equal(await fs.readFile(path.join(f.owned, 'disabled'), 'utf8'), ADAPTER_OWNER + '\n');
});

test('externally edited loader or stylesheet is preserved by automatic update', async t => {
  for (const name of ['loader.mjs', 'appearance.css']) {
    const f = await fixture(t); await f.adapter.enable(css);
    const file = path.join(f.owned, name); await fs.appendFile(file, '\n/* external edit */');
    const original = await fs.readFile(file);
    assert.equal((await f.adapter.update('new CSS')).state, 'conflict');
    assert.deepEqual(await fs.readFile(file), original);
  }
});

test('interruption before any backup write remains explicitly recoverable from the audited original', async t => {
  const f = await fixture(t); await f.adapter.enable(css);
  const manifest = await f.manifest(); manifest.stage = 'prepared';
  await fs.writeFile(f.main, f.original);
  await f.setManifest(manifest);
  for (const name of ['main.original', 'loader.mjs', 'appearance.css', 'restore.mjs']) await fs.unlink(path.join(f.owned, name));
  const state = await f.adapter.info(); assert.equal(state.state, 'available'); assert.equal(state.installed, false);
  await f.adapter.update('no auto reinstall');
  assert.deepEqual(await fs.readFile(f.main), f.original);
  await f.adapter.enable(css);
  assert.equal((await f.adapter.info()).installed, true);
  assert.ok((await fs.readdir(f.out)).some(name => name.startsWith(ADAPTER_DIRECTORY + '-backup-')));
  await f.adapter.disable(); assert.deepEqual(await fs.readFile(f.main), f.original);
});

test('interruption after the main patch and during a CSS commit recovers without another app patch', async t => {
  const f = await fixture(t); await f.adapter.enable(css);
  const manifest = await f.manifest(); manifest.stage = 'prepared';
  const pending = '/* interrupted pending CSS */'; manifest.pendingCssSha256 = hash(pending);
  await f.setManifest(manifest); await fs.writeFile(path.join(f.owned, 'appearance.css'), pending);
  const main = await fs.readFile(f.main);
  await f.adapter.update(css);
  assert.deepEqual(await fs.readFile(f.main), main);
  assert.equal((await f.manifest()).pendingCssSha256, undefined);
  assert.equal((await f.manifest()).stage, 'installed');
  await f.adapter.disable(); assert.deepEqual(await fs.readFile(f.main), f.original);
});

test('an audited application upgrade requires explicit enable and retains the old backup separately', async t => {
  const f = await fixture(t); await f.adapter.enable(css);
  const upgraded = Buffer.from('// separately audited upgraded app\n');
  f.builds.push({ ...f.builds[0], ideVersion: '2.8.1', mainSha256: hash(upgraded) });
  await fs.writeFile(path.join(f.appRoot, 'product.json'), JSON.stringify({ ideVersion: '2.8.1', applicationName: 'antigravity-ide', nameLong: 'Antigravity IDE' }));
  await fs.writeFile(f.main, upgraded);
  const state = await f.adapter.info(); assert.equal(state.state, 'available'); assert.equal(state.installed, false); assert.equal(state.canDisable, true);
  await f.adapter.update('no automatic hook'); assert.deepEqual(await fs.readFile(f.main), upgraded);
  await f.adapter.enable(css);
  const archived = (await fs.readdir(f.out)).find(name => name.startsWith(ADAPTER_DIRECTORY + '-backup-2.8.0-'));
  assert.ok(archived); assert.deepEqual(await fs.readFile(path.join(f.out, archived, 'main.original')), f.original);
  await f.adapter.disable(); assert.deepEqual(await fs.readFile(f.main), upgraded);
});

test('the durable restore script works after the extension has been removed', async t => {
  const f = await fixture(t); await f.adapter.enable(css);
  await fs.rm(f.extensionRoot, { recursive: true });
  const result = await promisify(execFile)(process.execPath, [path.join(f.owned, 'restore.mjs')]);
  assert.match(result.stdout, /Original main entry restored/);
  assert.deepEqual(await fs.readFile(f.main), f.original);
  assert.deepEqual(await fs.readFile(path.join(f.owned, 'main.original')), f.original);
});

test('the durable restore script rejects a manifest rewritten to authorize an external main edit', async t => {
  const f = await fixture(t); await f.adapter.enable(css);
  const external = Buffer.concat([await fs.readFile(f.main), Buffer.from('// later external change\n')]);
  await fs.writeFile(f.main, external);
  const manifest = await f.manifest(); manifest.patchedSha256 = hash(external);
  await f.setManifest(manifest);
  await assert.rejects(promisify(execFile)(process.execPath, [path.join(f.owned, 'restore.mjs')]), /Patch hash mismatch/);
  assert.deepEqual(await fs.readFile(f.main), external);
  assert.deepEqual(await fs.readFile(path.join(f.owned, 'main.original')), f.original);
  assert.equal(await fs.readFile(path.join(f.owned, 'disabled'), 'utf8'), ADAPTER_OWNER + '\n');
});

test('an active filesystem lock prevents concurrent mutations and is not removed by the rejected writer', async t => {
  const f = await fixture(t);
  const lock = path.join(f.out, '.obsidian-prism-desktop.lock');
  const value = JSON.stringify({ owner: ADAPTER_OWNER, pid: process.pid, token: 'another-writer' });
  await fs.writeFile(lock, value);
  await assert.rejects(f.adapter.enable(css), /Another appearance operation/);
  assert.equal(await fs.readFile(lock, 'utf8'), value);
  assert.deepEqual(await fs.readFile(f.main), f.original);
});

test('loader guards reject unrelated origins and expose no arbitrary evaluation or CSS fetch channel', async () => {
  const loader = await import(pathToFileURL(loaderPath).href);
  const query = '?extensionView=true&extensionVariant=vs-code&hostVariant=antigravity-ide&platform=electron';
  for (const host of ['127.0.0.1:1234', 'localhost:5678', '[::1]:9876']) assert.equal(loader.isEligibleFrameUrl('http://' + host + '/' + query, 'modern'), true);
  for (const url of ['https://example.com/' + query, 'http://127.0.0.1/', 'http://127.0.0.1/' + query.replace('antigravity-ide', 'other-host'), 'file:///anywhere.html']) assert.equal(loader.isEligibleFrameUrl(url, 'modern'), false);
  assert.equal(loader.isEligibleFrameUrl('vscode-file://vscode-app/app/out/vs/code/electron-browser/workbench/workbench.html', 'legacy'), true);
  assert.equal(loader.isEligibleFrameUrl('file:///tmp/workbench.html', 'legacy'), false);
  const source = await fs.readFile(loaderPath, 'utf8');
  assert.doesNotMatch(source, /\.debugger\.|fetch\(|XMLHttpRequest|textContent\s*\?\.|innerText|localStorage|document\.cookie/);
  assert.equal(loader.ATTRIBUTE, 'data-prism-host-appearance');
});

test('per-frame palette decoding matches contributed theme markers and rejects transparent or unknown themes', async () => {
  const loader = await import(pathToFileURL(loaderPath).href);
  const { THEME_MARKER_CSS, PRISM_THEME_MARKERS } = require('../out/theme-marker.js');
  assert.equal(loader.THEME_MARKER, THEME_MARKER_CSS);
  assert.equal(loader.PALETTE_ATTRIBUTE, 'data-prism-host-palette');
  for (const [palette, marker] of Object.entries(PRISM_THEME_MARKERS)) {
    assert.equal(loader.parseThemeMarker(marker), palette);
    assert.equal(loader.parseThemeMarker(marker.toUpperCase() + 'FF'), palette);
    const blue = Number.parseInt(marker.slice(-2), 16);
    assert.equal(loader.parseThemeMarker(`rgb(80, 82, ${blue})`), palette);
    assert.equal(loader.parseThemeMarker(`rgba(80, 82, ${blue}, 1)`), palette);
    assert.equal(loader.parseThemeMarker(`rgb(80 82 ${blue} / 100%)`), palette);
  }
  for (const marker of [undefined, '', 'transparent', '#00000000', '#50520100', '#505205', 'rgba(80, 82, 1, 0)', 'rgb(80, 82, 5)', 'var(--other-color)']) {
    assert.equal(loader.parseThemeMarker(marker), undefined);
  }
});
