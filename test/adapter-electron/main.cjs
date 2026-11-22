// Controlled pages only: these tests exercise Electron APIs and loader lifecycle,
// not the authenticated Google chat UI or installation into a real IDE.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, session } = require('electron');

const temporary = process.env.PRISM_ADAPTER_FIXTURE_ROOT;
const resultPath = process.env.PRISM_ADAPTER_RESULT;
const scenarios = [];
const servers = [];
const windows = [];
const controllers = [];
let markerAttribute;
let styleId;
let paletteAttribute;
let themeMarker;
const baseCss = fs.readFileSync(path.join(__dirname, 'base.css'), 'utf8');
const query = '?extensionView=true&extensionVariant=vs-code&hostVariant=antigravity-ide&platform=electron';
const modernDom = '<main class="agy-home" data-testid="conversation-view"><div id="antigravity.agentSidePanelInputBox" class="surface-composer"><div class="surface-composer-card"><div id="prism-target"></div></div></div></main>';
const legacyDom = '<div class="monaco-workbench"><main class="antigravity-agent-side-panel"><div id="antigravity.agentSidePanelInputBox"><div id="prism-target"></div></div></main></div>';
const baseline = 'rgb(16, 32, 48)';
const policy = strict => `default-src 'none'; script-src 'none'; style-src 'self' ${strict ? '' : "'unsafe-inline'"}; frame-src http://127.0.0.1:*; img-src 'self' data:; connect-src 'none'; base-uri 'none'`;
function page(body, strict = false, stylesheet = '/base.css', marker) {
  const style = marker === undefined ? '' : ` style="${themeMarker}: ${marker};"`;
  return `<!doctype html><html${style}><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy(strict)}"><link rel="stylesheet" href="${stylesheet}"></head><body>${body}</body></html>`;
}
function stylesheet(obsidian, warm = '#6A2D15') {
  return Object.entries({ obsidian, warm, crystal: '#DDEEFF', alabaster: '#EEDDBB' }).map(([palette, color]) => `html[${paletteAttribute}="${palette}"] #prism-target { background-color: ${color} !important; }`).join('\n');
}
function writeAppearance(directory, mode, css, extensionRoot, enabled = true) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'appearance.css'), css);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
    schema: 1, owner: 'obsidian-prism-desktop-adapter', mode, enabled, extensionRoot,
    cssSha256: crypto.createHash('sha256').update(css).digest('hex'),
  }));
}
async function until(read, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const value = await read(); if (value) return value; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${label}${last ? ` (${last.message})` : ''}`);
}
async function serve(handler) {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
function fixtureWindow() {
  const window = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  windows.push(window);
  return window;
}
function findFrame(window, pathname) {
  return window.webContents.mainFrame.framesInSubtree.find(frame => { try { return new URL(frame.url).pathname === pathname; } catch { return false; } });
}
async function inspect(frame) {
  return frame.executeJavaScript(`(() => ({
    color: document.getElementById('prism-target') ? getComputedStyle(document.getElementById('prism-target')).backgroundColor : null,
    marker: document.documentElement.getAttribute(${JSON.stringify(markerAttribute)}),
    palette: document.documentElement.getAttribute(${JSON.stringify(paletteAttribute)}),
    nativeMarker: getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(themeMarker)}).trim(),
    styleCount: document.querySelectorAll(${JSON.stringify(`#${styleId}`)}).length,
    policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
    nodeAvailable: typeof require !== 'undefined' || typeof process !== 'undefined'
  }))()`);
}
async function expectColor(frame, color, label) {
  return until(async () => { const state = await inspect(frame); return state.color === color ? state : false; }, label);
}
async function expectRemoved(frame, label) {
  return until(async () => { const state = await inspect(frame); return state.color === baseline && state.marker === null && state.palette === null && state.styleCount === 0 ? state : false; }, label);
}
function pass(label) { scenarios.push(label); console.log(`[adapter-electron] PASS ${label}`); }

async function run() {
  console.log(`[adapter-electron] Fixture main started in Electron ${process.versions.electron}.`);
  fs.mkdirSync(path.join(temporary, 'user-data'), { recursive: true });
  app.setPath('userData', path.join(temporary, 'user-data'));
  app.on('window-all-closed', () => { /* The next scenario creates another window. */ });
  await app.whenReady();
  // All renderer requests are fixture-local. No IDE or Google service is started.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    callback({ cancel: !(['file:', 'devtools:', 'data:'].includes(url.protocol) || (url.protocol === 'http:' && url.hostname === '127.0.0.1')) });
  });
  const { startAppearanceLoader, ATTRIBUTE, STYLE_ID, PALETTE_ATTRIBUTE, THEME_MARKER } = await import(pathToFileURL(process.env.PRISM_ADAPTER_LOADER).href);
  markerAttribute = ATTRIBUTE; styleId = STYLE_ID; paletteAttribute = PALETTE_ATTRIBUTE; themeMarker = THEME_MARKER;
  const extensionRoot = path.join(temporary, 'extension');
  fs.mkdirSync(extensionRoot);
  fs.writeFileSync(path.join(extensionRoot, 'package.json'), JSON.stringify({ name: 'obsidian-prism-vscode-theme', publisher: 'bahayonghang', version: '0.3.0' }));
  const directory = path.join(temporary, 'modern-adapter');
  writeAppearance(directory, 'modern', stylesheet('#123456'), extensionRoot, false);
  const controller = await startAppearanceLoader({ directory });
  controllers.push(controller);

  const inner = await serve((request, response) => {
    const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (pathname === '/base.css') { response.setHeader('Content-Type', 'text/css'); response.end(baseCss); return; }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(page(pathname === '/no-dom' ? '<div id="prism-target"></div>' : modernDom, pathname === '/csp-denied'));
  });
  const bridge = await serve((request, response) => {
    if (request.url === '/base.css') { response.setHeader('Content-Type', 'text/css'); response.end(baseCss); return; }
    const params = new URL(request.url, 'http://fixture.invalid').searchParams;
    const marker = { obsidian: '#505201', warm: '#505202', none: '#00000000' }[params.get('palette')] || '#00000000';
    const extraFrames = params.get('simple') === '1' ? '' : `<iframe src="${inner}/unrelated"></iframe><iframe src="${inner}/no-dom${query}"></iframe><iframe src="${inner}/csp-denied${query}"></iframe>`;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    // The real webview preload puts all theme colors on this parent document's
    // html.style. Google's nested loopback chat does not receive this marker.
    response.end(page(`<iframe id="jetski-frame" src="${inner}/eligible${query}"></iframe>${extraFrames}`, false, '/base.css', marker));
  });
  const outer = await serve((request, response) => {
    if (request.url === '/base.css') { response.setHeader('Content-Type', 'text/css'); response.end(baseCss); return; }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const params = new URL(request.url, 'http://fixture.invalid').searchParams;
    const palette = ['obsidian', 'warm', 'none'].includes(params.get('palette')) ? params.get('palette') : 'none';
    response.end(page(`<iframe src="${bridge}/bridge?palette=${palette}&simple=${params.get('simple') === '1' ? '1' : '0'}"></iframe>${modernDom}`));
  });
  const window = fixtureWindow();
  const warmWindow = fixtureWindow();
  const nonPrismWindow = fixtureWindow();
  await Promise.all([window.loadURL(`${outer}/host?palette=obsidian`), warmWindow.loadURL(`${outer}/host?palette=warm&simple=1`), nonPrismWindow.loadURL(`${outer}/host?palette=none&simple=1`)]);
  let eligible = await until(() => findFrame(window, '/eligible'), 'nested eligible frame');
  const warmFrame = await until(() => findFrame(warmWindow, '/eligible'), 'independent warm palette frame');
  const nonPrismFrame = await until(() => findFrame(nonPrismWindow, '/eligible'), 'independent non-Prism frame');
  const unrelated = await until(() => findFrame(window, '/unrelated'), 'unrelated frame');
  const noDom = await until(() => findFrame(window, '/no-dom'), 'frame without required DOM');
  const cspDenied = await until(() => findFrame(window, '/csp-denied'), 'CSP-denied frame');
  assert.notEqual(new URL(eligible.url).origin, new URL(eligible.parent.url).origin);
  assert.notEqual(eligible.parent, window.webContents.mainFrame);
  for (const frame of [eligible, warmFrame, nonPrismFrame, unrelated, noDom, cspDenied, window.webContents.mainFrame]) {
    const state = await expectRemoved(frame, 'disabled adapter leaves baseline');
    assert.equal(state.nodeAvailable, false, 'Renderer must not receive Node access');
  }
  pass('disabled adapter leaves nested frames and main document unchanged');

  const strictPolicy = (await inspect(cspDenied)).policy;
  const normalPolicy = (await inspect(eligible)).policy;
  const cspProbe = await cspDenied.executeJavaScript(`(() => { const style = document.createElement('style'); style.textContent = '#prism-target { background-color: red !important; }'; document.head.appendChild(style); const color = getComputedStyle(document.getElementById('prism-target')).backgroundColor; style.remove(); return color; })()`);
  assert.equal(cspProbe, baseline, 'The restrictive fixture must actually block inline CSS');
  writeAppearance(directory, 'modern', stylesheet('#123456'), extensionRoot);
  const initialSummary = await controller.refresh();
  assert.equal(initialSummary.appliedFrames, 2, 'Only the two Prism windows are styled');
  assert.equal(initialSummary.blockedFrames, 1, 'The restrictive fixture reports CSP blocking');
  const applied = await expectColor(eligible, 'rgb(18, 52, 86)', 'apply CSS in nested cross-origin frame');
  assert.equal(applied.marker, 'modern'); assert.equal(applied.palette, 'obsidian'); assert.equal(applied.styleCount, 1);
  assert.equal(applied.nativeMarker, '', 'The inner chat must not receive the custom marker through a fake bridge relay');
  assert.equal((await expectColor(warmFrame, 'rgb(106, 45, 21)', 'second window uses its own palette')).palette, 'warm');
  assert.equal(applied.policy, normalPolicy, 'Allowed-frame CSP must remain unchanged');
  for (const frame of [nonPrismFrame, unrelated, noDom, cspDenied, window.webContents.mainFrame]) await expectRemoved(frame, 'URL/DOM/CSP/theme guard');
  assert.equal((await inspect(cspDenied)).policy, strictPolicy, 'Restrictive CSP must remain unchanged');
  pass('cross-origin injection applies only to eligible DOM and fails closed under CSP');
  pass('two Prism windows route different palettes while a non-Prism window stays native');

  writeAppearance(directory, 'modern', stylesheet('#654321'), extensionRoot);
  await expectColor(eligible, 'rgb(101, 67, 33)', 'filesystem watcher updates CSS without manual refresh');
  await eligible.executeJavaScript(`window.__prismFixtureStyleReference = document.getElementById(${JSON.stringify(styleId)})`);
  await controller.refresh();
  await controller.refresh();
  assert.equal((await inspect(eligible)).styleCount, 1, 'Repeated refresh must not duplicate styles');
  assert.equal(await eligible.executeJavaScript(`window.__prismFixtureStyleReference === document.getElementById(${JSON.stringify(styleId)})`), true, 'Unchanged CSS keeps the same style node so animations do not restart');
  pass('owned CSS updates live and repeated refresh stays idempotent');

  await eligible.parent.executeJavaScript(`document.documentElement.style.setProperty(${JSON.stringify(themeMarker)}, '#00000000')`);
  await expectRemoved(eligible, 'switching one window away from Prism removes only its appearance');
  await expectColor(warmFrame, 'rgb(106, 45, 21)', 'warm sibling remains styled');
  // A write from any window always carries all palettes, including when that
  // window currently uses a non-Prism theme. It must not clear a Prism sibling.
  writeAppearance(directory, 'modern', stylesheet('#445566', '#AA7733'), extensionRoot);
  await expectColor(warmFrame, 'rgb(170, 119, 51)', 'shared bundle refresh does not clear another Prism window');
  await expectRemoved(eligible, 'transparent marker remains native after a bundle update');
  await expectRemoved(nonPrismFrame, 'unrelated non-Prism window remains native after a bundle update');
  await warmFrame.executeJavaScript(`window.__prismFixtureStyleReference = document.getElementById(${JSON.stringify(styleId)})`);
  await eligible.parent.executeJavaScript(`document.documentElement.style.setProperty(${JSON.stringify(themeMarker)}, '#505203')`);
  assert.equal((await expectColor(eligible, 'rgb(221, 238, 255)', 'theme marker change selects the crystal palette')).palette, 'crystal');
  assert.equal(await warmFrame.executeJavaScript(`window.__prismFixtureStyleReference === document.getElementById(${JSON.stringify(styleId)})`), true, 'Changing one palette must not restart a sibling style');
  await eligible.parent.executeJavaScript(`document.documentElement.style.setProperty(${JSON.stringify(themeMarker)}, '#505201')`);
  await expectColor(eligible, 'rgb(68, 85, 102)', 'returning to Obsidian uses its latest palette block');
  pass('per-window theme changes remove and reroute CSS without altering sibling windows');

  await noDom.executeJavaScript(`document.body.innerHTML = ${JSON.stringify(modernDom)}`);
  await expectColor(noDom, 'rgb(68, 85, 102)', 'late chat mount is detected by the structural observer');
  await noDom.executeJavaScript(`document.getElementById('antigravity.agentSidePanelInputBox').remove()`);
  await until(async () => { const state = await inspect(noDom); return state.marker === null && state.styleCount === 0; }, 'removed chat DOM removes style and marker');
  await noDom.executeJavaScript(`document.body.innerHTML = '<div id="prism-target"></div>'`);
  await expectRemoved(noDom, 'non-chat content after chat unmount remains unchanged');
  pass('late chat mount and unmount update appearance without reading conversation text');

  await eligible.parent.executeJavaScript(`document.getElementById('jetski-frame').src = ${JSON.stringify(`${inner}/eligible${query}&navigation=2`)}`);
  eligible = await until(() => { const frame = findFrame(window, '/eligible'); return frame?.url.includes('navigation=2') ? frame : false; }, 'replacement eligible frame');
  await expectColor(eligible, 'rgb(68, 85, 102)', 'navigation reapplies CSS in replacement frame');
  pass('navigation reapplies appearance to a new eligible frame');

  fs.writeFileSync(path.join(directory, 'disabled'), 'disabled\n');
  await controller.refresh();
  await expectRemoved(eligible, 'disabled sentinel removes live appearance');
  await expectRemoved(warmFrame, 'disabled sentinel also clears the independently routed sibling');
  fs.unlinkSync(path.join(directory, 'disabled'));
  await controller.refresh();
  await expectColor(eligible, 'rgb(68, 85, 102)', 'explicitly re-enabled fixture');
  fs.unlinkSync(path.join(extensionRoot, 'package.json'));
  await controller.refresh();
  await expectRemoved(eligible, 'uninstalled extension removes live appearance');
  await expectRemoved(warmFrame, 'uninstalled extension clears all previously styled windows');
  pass('disable sentinel and missing extension both remove live CSS and markers');
  await controller.dispose();
  for (const target of [window, warmWindow, nonPrismWindow]) target.close();

  fs.writeFileSync(path.join(extensionRoot, 'package.json'), JSON.stringify({ name: 'obsidian-prism-vscode-theme', publisher: 'bahayonghang', version: '0.3.0' }));
  const legacyDirectory = path.join(temporary, 'legacy-adapter');
  writeAppearance(legacyDirectory, 'legacy', stylesheet('#123456'), extensionRoot);
  const legacyController = await startAppearanceLoader({ directory: legacyDirectory });
  controllers.push(legacyController);
  const legacyRoot = path.join(temporary, 'legacy', 'vs', 'code', 'electron-browser', 'workbench');
  fs.mkdirSync(legacyRoot, { recursive: true });
  fs.writeFileSync(path.join(legacyRoot, 'workbench.html'), page(legacyDom, false, './base.css'));
  fs.writeFileSync(path.join(legacyRoot, 'base.css'), `${baseCss}\n.monaco-workbench { ${themeMarker}: #505204; }`);
  const legacyWindow = fixtureWindow();
  await legacyWindow.loadFile(path.join(legacyRoot, 'workbench.html'));
  const legacyFrame = legacyWindow.webContents.mainFrame;
  const legacyState = await expectColor(legacyFrame, 'rgb(238, 221, 187)', 'legacy workbench appearance');
  assert.equal(legacyState.marker, 'legacy'); assert.equal(legacyState.palette, 'alabaster'); assert.equal(legacyState.styleCount, 1);
  assert.equal(legacyState.nativeMarker, '', 'Legacy marker lives on .monaco-workbench rather than html');
  const unrelatedFile = path.join(temporary, 'workbench.html');
  fs.writeFileSync(unrelatedFile, page(legacyDom, false, pathToFileURL(path.join(legacyRoot, 'base.css')).href));
  const unrelatedWindow = fixtureWindow();
  await unrelatedWindow.loadFile(unrelatedFile);
  await expectRemoved(unrelatedWindow.webContents.mainFrame, 'same DOM outside the verified workbench path');
  pass('legacy styles require both the exact workbench path and sidebar DOM');
  const nonPrismLegacyRoot = path.join(temporary, 'legacy-non-prism', 'vs', 'code', 'electron-browser', 'workbench');
  fs.mkdirSync(nonPrismLegacyRoot, { recursive: true });
  fs.writeFileSync(path.join(nonPrismLegacyRoot, 'workbench.html'), page(legacyDom, false, './base.css'));
  fs.writeFileSync(path.join(nonPrismLegacyRoot, 'base.css'), `${baseCss}\n.monaco-workbench { ${themeMarker}: #00000000; }`);
  const nonPrismLegacyWindow = fixtureWindow();
  await nonPrismLegacyWindow.loadFile(path.join(nonPrismLegacyRoot, 'workbench.html'));
  await expectRemoved(nonPrismLegacyWindow.webContents.mainFrame, 'verified legacy path with a non-Prism marker remains native');
  await expectColor(legacyFrame, 'rgb(238, 221, 187)', 'legacy Prism sibling retains its own appearance');
  pass('legacy per-window markers isolate Prism from a simultaneous non-Prism window');
  fs.writeFileSync(path.join(legacyDirectory, 'disabled'), 'disabled\n');
  await legacyController.refresh();
  await expectRemoved(legacyFrame, 'legacy disable restoration');
  pass('legacy disable restores original computed appearance');
}

run().then(() => finish(), error => finish(error));
async function finish(error) {
  for (const controller of controllers) { try { await controller.dispose(); } catch {} }
  for (const window of windows) { if (!window.isDestroyed()) window.destroy(); }
  for (const server of servers) server.close();
  const result = {
    passed: !error, scope: 'Official Electron runtime with controlled local pages; no authenticated Antigravity chat or IDE app was launched.',
    electronVersion: process.versions.electron, chromiumVersion: process.versions.chrome, scenarios,
    ...(error ? { error: String(error.stack || error) } : {}),
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}
