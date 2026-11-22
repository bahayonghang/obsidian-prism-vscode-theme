/** Real Chromium verification of the shipped webview; only the vscode bridge is mocked. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === 'vscode') return { Uri: { joinPath: (_base, ...parts) => ({ toString: () => parts.join('/') }) } };
  return originalLoad.call(this, name, parent, isMain);
};
let getWebviewHtml;
try { ({ getWebviewHtml } = require('../out/webview.js')); } finally { Module._load = originalLoad; }
const { createTheme } = require('../out/theme.js');
const { createAntigravityPreview } = require('../out/conversation.js');
const { THEMES, PALETTES } = require('../out/palettes.js');
const { DEFAULT_SETTINGS, TYPOGRAPHY_KEYS, SYSTEM_KEYS } = require('../out/config.js');

async function main() {
  let html;
  const server = http.createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
    } else if (['/media/settings.js', '/media/settings.css'].includes(request.url)) {
      response.setHeader('Content-Type', request.url.endsWith('.js') ? 'application/javascript' : 'text/css');
      response.end(fs.readFileSync(path.join(root, request.url)));
    } else if (request.url === '/favicon.ico') { response.statusCode = 204; response.end(); }
    else { response.statusCode = 404; response.end(); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    html = getWebviewHtml({ cspSource: origin, asWebviewUri: uri => ({ toString: () => `${origin}/${uri.toString()}` }) }, { toString: () => '' });
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (!fs.existsSync(chromium.executablePath()) && fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
    const errors = [];
    const requests = [];
    const messages = [];
    const previewWaiters = new Set();
    const waitForPreview = predicate => new Promise((resolve, reject) => {
      const listener = settings => { if (predicate(settings)) { clearTimeout(timeout); previewWaiters.delete(listener); resolve(); } };
      const timeout = setTimeout(() => { previewWaiters.delete(listener); reject(new Error('Expected preview response did not arrive.')); }, 5000);
      previewWaiters.add(listener);
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    let state = {
      type: 'state', settings: { ...DEFAULT_SETTINGS }, activeTheme: 'Default Dark Modern', themes: THEMES,
      palette: 'obsidian', preview: createTheme('obsidian'), conversationPreview: createAntigravityPreview(createTheme('obsidian')), language: 'en', autoLanguage: 'en',
      typographyApplied: false, systemApplied: false,
      host: { appName: 'Visual Studio Code (UI fixture)', vscodeVersion: '1.96.0', kind: 'vscode', colorPath: 'standard', referenceMatch: false }
    };
    const send = message => page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data })), message);
    async function hostColors(theme) {
      await page.evaluate(colors => {
        const map = {
          '--vscode-editor-background': 'editor.background', '--vscode-editor-foreground': 'editor.foreground',
          '--vscode-sideBar-background': 'sideBar.background', '--vscode-descriptionForeground': 'descriptionForeground',
          '--vscode-widget-border': 'panel.border', '--vscode-focusBorder': 'focusBorder',
          '--vscode-button-background': 'button.background', '--vscode-button-foreground': 'button.foreground',
          '--vscode-button-hoverBackground': 'button.hoverBackground', '--vscode-button-secondaryBackground': 'button.secondaryBackground',
          '--vscode-button-secondaryForeground': 'button.secondaryForeground', '--vscode-input-background': 'input.background',
          '--vscode-input-foreground': 'input.foreground', '--vscode-input-border': 'input.border',
          '--vscode-list-hoverBackground': 'list.hoverBackground', '--vscode-textLink-foreground': 'textLink.foreground'
        };
        document.body.style.setProperty('--vscode-font-family', 'Arial, sans-serif');
        for (const [key, token] of Object.entries(map)) if (colors[token]) document.body.style.setProperty(key, colors[token]);
      }, theme.colors);
    }
    await page.exposeFunction('postToHost', async message => {
      messages.push(message);
      if (message.type === 'ready') { await send(state); await hostColors(state.preview); }
      else if (message.type === 'preview') {
        const preview = createTheme(message.palette, message.settings);
        await send({ type: 'preview', preview, conversationPreview: createAntigravityPreview(preview), requestId: message.requestId });
        for (const listener of previewWaiters) listener(message.settings);
      }
      else if (message.type === 'apply') {
        state = { ...state, settings: { ...message.settings }, palette: message.palette, activeTheme: THEMES.find(theme => theme.id === message.palette).label, preview: createTheme(message.palette, message.settings) };
        state.conversationPreview = createAntigravityPreview(state.preview);
        await hostColors(state.preview); await send({ ...state, resetDraft: true });
        await send({ type: 'status', level: 'info', message: 'Theme applied.' });
      } else if (message.type === 'applyTypography' || message.type === 'applySystem') {
        const typography = message.type === 'applyTypography';
        for (const key of typography ? TYPOGRAPHY_KEYS : SYSTEM_KEYS) state.settings[key] = message.settings[key];
        state[typography ? 'typographyApplied' : 'systemApplied'] = true;
        await send(state); await send({ type: 'status', level: 'info', message: 'Appearance preferences applied.' });
      } else if (message.type === 'restoreTypography' || message.type === 'restoreSystem') {
        state[message.type === 'restoreTypography' ? 'typographyApplied' : 'systemApplied'] = false;
        await send(state);
      } else if (message.type === 'reset') {
        state = { ...state, settings: { ...DEFAULT_SETTINGS }, preview: createTheme(state.palette), typographyApplied: false, systemApplied: false };
        state.conversationPreview = createAntigravityPreview(state.preview);
        await send({ ...state, resetDraft: true });
      }
    });
    await page.addInitScript(() => { window.acquireVsCodeApi = () => ({ postMessage: message => window.postToHost(message) }); });
    await page.goto(origin);
    await page.locator('#app[aria-busy="false"]').waitFor();
    assert.equal(await page.locator('input[name="palette"]').count(), 4);
    assert.equal(await page.locator('input[name="accent"]').count(), 6);
    assert.equal(await page.locator('#sidebar-surface').inputValue(), 'layered');
    assert.equal(await page.locator('#input-border').inputValue(), 'subtle');
    assert.equal(await page.locator('#conversation-preview').isVisible(), true, 'conversation is the initial preview');
    assert.equal(await page.locator('#conversation-color-content').isVisible(), true, 'semantic composer preview is available');
    assert.equal(await page.locator('#editor-preview').isVisible(), false);
    assert.equal(await page.locator('#host-app').textContent(), state.host.appName);
    assert.match(await page.locator('#preview-scope-note').textContent(), /not a host screenshot/);

    // Host cards show provided metadata and sampled-reference limits, never invented full support.
    const hostFixtures = [
      { appName: 'Antigravity (UI fixture)', vscodeVersion: '1.107.0', ideVersion: 'bridge-fixture', bridgeVersion: '3.0.0-fixture', kind: 'antigravity-ide', colorPath: 'bridge', referenceMatch: true },
      { appName: 'Antigravity (legacy UI fixture)', vscodeVersion: '1.107.0', ideVersion: 'legacy-fixture', kind: 'antigravity-ide', colorPath: 'legacy', referenceMatch: true },
      { appName: 'Code with Antigravity (UI fixture)', vscodeVersion: '1.107.0', bridgeVersion: '3.0.0-fixture', kind: 'antigravity-extension', colorPath: 'bridge', referenceMatch: true },
      { appName: 'Unsampled editor (UI fixture)', vscodeVersion: 'unknown-fixture', kind: 'unknown', colorPath: 'unverified', referenceMatch: false },
      state.host
    ];
    for (const host of hostFixtures) {
      state.host = host;
      await send(state);
      assert.equal(await page.locator('#compatibility-card').getAttribute('data-host-kind'), host.kind);
      assert.equal(await page.locator('#compatibility-card').getAttribute('data-color-path'), host.colorPath);
      assert.equal(await page.locator('#host-app').textContent(), host.appName);
      assert.equal(await page.locator('#host-vscode-version').textContent(), host.vscodeVersion);
      assert.equal(await page.locator('#host-ide-version').textContent(), host.ideVersion || 'Not reported');
      assert.equal(await page.locator('#host-bridge-version').textContent(), host.bridgeVersion || 'Not reported');
      assert.equal(await page.locator('#legacy-preview-note').isVisible(), ['legacy', 'unverified'].includes(host.colorPath));
      if (host.referenceMatch) assert.match(await page.locator('#host-reference-note').textContent(), /not a live visual check/);
      if (host.colorPath === 'legacy') assert.match(await page.locator('#legacy-preview-note').textContent(), /fixed gray outer border/);
      if (host.colorPath === 'unverified') assert.match(await page.locator('#host-reference-note').textContent(), /outside the sampled references/);
    }
    state.host = hostFixtures[0];
    await send(state);
    await page.locator('#preview-editor-tab').click();
    assert.equal(await page.locator('#editor-preview').isVisible(), true, 'original code preview remains available');
    assert.equal(await page.locator('#conversation-preview').isVisible(), false);
    await page.locator('#preview-editor-tab').press('ArrowLeft');
    assert.equal(await page.locator('#conversation-preview').isVisible(), true, 'keyboard navigation selects the conversation tab');

    // Studio effects do not change the conversation geometry or create a fake host glow.
    const composerRadius = await page.locator('#conversation-composer').evaluate(node => getComputedStyle(node).borderRadius);
    await page.locator('#corner-style').selectOption('soft');
    await page.locator('#ambient-intensity').selectOption('100');
    assert.equal(await page.locator('#conversation-composer').evaluate(node => getComputedStyle(node).borderRadius), composerRadius);
    assert.equal(await page.locator('#live-preview').evaluate(node => getComputedStyle(node, '::after').content), 'none');
    await page.locator('#corner-style').selectOption(DEFAULT_SETTINGS.cornerStyle);
    await page.locator('#ambient-intensity').selectOption(String(DEFAULT_SETTINGS.ambientIntensity));

    // Native input outlines deliberately do not repaint Antigravity's derived composer.
    const originalComposerBorder = await page.locator('#conversation-composer').evaluate(node => getComputedStyle(node).borderTopColor);
    const borderPreview = waitForPreview(settings => settings.inputBorder === 'accent' && settings.sidebarSurface === 'layered');
    await page.locator('#input-border').selectOption('accent');
    await borderPreview;
    assert.equal(await page.locator('#conversation-composer').evaluate(node => getComputedStyle(node).borderTopColor), originalComposerBorder);

    // Both controls feed the generator; the conversation consumes the derived semantic colors only.
    await page.locator('#sidebar-surface').selectOption('unified');
    await send({ ...state, systemApplied: true });
    assert.equal(await page.locator('#sidebar-surface').inputValue(), 'unified');
    assert.equal(await page.locator('#input-border').inputValue(), 'accent');
    const unifiedPreview = createTheme('obsidian', { ...DEFAULT_SETTINGS, sidebarSurface: 'unified', inputBorder: 'accent' });
    const unifiedConversation = createAntigravityPreview(unifiedPreview);
    await page.waitForFunction(expected => document.getElementById('live-preview').style.getPropertyValue('--conversation-card-border').toUpperCase() === expected.toUpperCase(), unifiedConversation.cardBorder);
    for (const [selector, property, color] of [
      ['#conversation-preview', 'backgroundColor', unifiedConversation.background],
      ['#conversation-composer', 'backgroundColor', unifiedConversation.card],
      ['#conversation-composer', 'borderTopColor', unifiedConversation.cardBorder],
      ['#conversation-composer > p', 'color', unifiedConversation.placeholder],
      ['.conversation-send', 'color', unifiedConversation.primaryForeground],
      ['.conversation-send', 'backgroundColor', unifiedConversation.primary]
    ]) {
      assert.equal(await page.evaluate(({ selector, property, color }) => {
        const reference = document.createElement('span'); reference.style.color = color; document.body.append(reference);
        const expected = getComputedStyle(reference).color; reference.remove();
        return getComputedStyle(document.querySelector(selector))[property] === expected;
      }, { selector, property, color }), true, `${selector} ${property} uses the derived Antigravity semantic color`);
    }
    await page.locator('#apply').click();
    await page.locator('#status').filter({ hasText: 'Theme applied.' }).waitFor();
    assert.equal(state.settings.sidebarSurface, 'unified');
    assert.equal(state.settings.inputBorder, 'accent');
    await page.locator('#sidebar-surface').selectOption('tinted');
    await page.waitForFunction(expected => document.getElementById('token-sidebar').textContent === expected.toUpperCase(), createTheme('obsidian', { ...state.settings, sidebarSurface: 'tinted' }).colors['sideBar.background']);
    await page.locator('#sidebar-surface').selectOption('layered');
    await page.locator('#input-border').selectOption('subtle');
    await page.locator('#apply').click();
    await page.waitForFunction(() => document.getElementById('input-border').value === 'subtle' && !document.getElementById('apply').disabled);
    assert.equal(state.settings.sidebarSurface, 'layered');
    assert.equal(state.settings.inputBorder, 'subtle');
    const artifacts = path.join(root, 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'studio-en.png'), fullPage: true });

    // Every mini-palette selects a real generated theme preview, never a synthetic approximation.
    for (const id of ['warm', 'crystal', 'alabaster', 'obsidian']) {
      await page.locator(`label[for="palette-${id}"]`).click();
      await page.waitForFunction(expected => document.getElementById('token-background').textContent === expected, PALETTES[id].background.toUpperCase());
    }
    await page.locator('label[for="palette-warm"]').click();
    await page.locator('label[for="accent-iris"]').click();
    await page.locator('#italic-comments').check();
    await send({ ...state, typographyApplied: true });
    assert.equal(await page.locator('#palette-warm').isChecked(), true, 'unrelated host state preserves palette draft');
    assert.equal(await page.locator('#accent-iris').isChecked(), true, 'unrelated host state preserves color draft');
    await page.locator('label[for="accent-custom"]').click();
    await page.locator('#custom-accent').fill('#x');
    assert.equal(await page.locator('#apply').isDisabled(), true, 'invalid custom color cannot be applied');
    assert.equal(await page.locator('#custom-accent').getAttribute('aria-invalid'), 'true');
    await page.locator('#custom-accent').fill('#008877');
    assert.equal(await page.locator('#apply').isDisabled(), false);
    await page.locator('#language').selectOption('zh-CN');
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    assert.equal(await page.locator('#antigravity-heading').textContent(), 'Antigravity 与侧边栏');
    assert.equal(await page.locator('#preview-conversation-tab').textContent(), '对话区');
    assert.match(await page.locator('#host-reference-note').textContent(), /不代表已在当前宿主完成实机外观验证/);
    await page.locator('#language').selectOption('auto');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.locator('#language').selectOption('zh-CN');
    await page.locator('label[for="accent-default"]').click();
    await page.locator('#apply').click();
    await page.locator('#status').filter({ hasText: 'Theme applied.' }).waitFor();
    assert.equal(state.palette, 'warm'); assert.equal(state.settings.italicComments, true);
    assert.equal(state.settings.customAccent, '#008877');
    assert.equal(await page.locator('#palette-warm').isChecked(), true);
    await page.screenshot({ path: path.join(artifacts, 'studio-zh.png'), fullPage: true });

    // Editor-wide actions are explicit and leave color drafts local.
    await page.locator('label[for="accent-amber"]').click();
    await page.locator('#code-font').selectOption('cascadia');
    await page.locator('#apply-typography').click();
    await page.waitForFunction(() => document.getElementById('restore-typography').disabled === false);
    assert.equal(state.settings.codeFont, 'cascadia');
    assert.equal(state.settings.accent, 'default');
    assert.equal(await page.locator('#accent-amber').isChecked(), true);
    await page.locator('#restore-typography').click();
    await page.waitForFunction(() => document.getElementById('restore-typography').disabled === true);
    await page.locator('#preferred-light').selectOption('alabaster');
    await page.locator('#apply-system').click();
    await page.waitForFunction(() => document.getElementById('restore-system').disabled === false);
    assert.equal(state.settings.preferredLight, 'alabaster');
    await page.locator('#restore-system').click();
    await page.waitForFunction(() => document.getElementById('restore-system').disabled === true);

    // Invalid/stale preview responses cannot repaint a newer choice.
    await page.locator('label[for="palette-crystal"]').click();
    await page.waitForFunction(() => document.getElementById('token-background').textContent === '#F4F7FB');
    await send({ type: 'preview', preview: createTheme('obsidian'), requestId: -1 });
    assert.equal(await page.locator('#token-background').textContent(), '#F4F7FB');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'studio-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile layout has no horizontal overflow');
    await page.locator('#preview-editor-tab').click();
    assert.equal(await page.locator('#editor-preview').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'editor preview also fits narrow panels');
    await page.locator('#preview-conversation-tab').click();

    // Native keyboard radio behavior and focus visibility remain available.
    await page.locator('#palette-crystal').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#palette-alabaster').isChecked(), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#motion').selectOption('ultra');
    assert.equal(await page.locator('.palette-card').first().evaluate(node => getComputedStyle(node).transitionDuration), '0s');

    for (const id of ['export', 'import', 'open-settings', 'upstream-source', 'port-source', 'compatibility-report']) await page.locator(`#${id}`).click();
    for (const type of ['export', 'import', 'openSettings', 'openSource', 'showCompatibilityReport']) assert.ok(messages.some(message => message.type === type), `${type} bridge action is reachable`);
    await page.locator('#reset').click();
    await page.waitForFunction(() => document.getElementById('accent-default').checked);
    assert.deepEqual(errors, [], 'no page errors, asset errors or CSP violations');
    assert.ok(requests.every(url => url.startsWith(origin)), 'the panel makes no external network requests');
    console.log(`UI checks passed: four palettes, Antigravity bridge-color sketch, shared surface/border controls, host metadata and scope, editor preview, drafts, color validation, language, apply, native actions, stale messages, keyboard, reduced motion, mobile layout, CSP. Screenshots: ${artifacts}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
