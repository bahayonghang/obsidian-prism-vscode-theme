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
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    let state = {
      type: 'state', settings: { ...DEFAULT_SETTINGS }, activeTheme: 'Default Dark Modern', themes: THEMES,
      palette: 'obsidian', preview: createTheme('obsidian'), language: 'en', autoLanguage: 'en',
      typographyApplied: false, systemApplied: false
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
      else if (message.type === 'preview') await send({ type: 'preview', preview: createTheme(message.palette, message.settings), requestId: message.requestId });
      else if (message.type === 'apply') {
        state = { ...state, settings: { ...message.settings }, palette: message.palette, activeTheme: THEMES.find(theme => theme.id === message.palette).label, preview: createTheme(message.palette, message.settings) };
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
        await send({ ...state, resetDraft: true });
      }
    });
    await page.addInitScript(() => { window.acquireVsCodeApi = () => ({ postMessage: message => window.postToHost(message) }); });
    await page.goto(origin);
    await page.locator('#app[aria-busy="false"]').waitFor();
    assert.equal(await page.locator('input[name="palette"]').count(), 4);
    assert.equal(await page.locator('input[name="accent"]').count(), 6);
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

    // Native keyboard radio behavior and focus visibility remain available.
    await page.locator('#palette-crystal').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#palette-alabaster').isChecked(), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#motion').selectOption('ultra');
    assert.equal(await page.locator('.palette-card').first().evaluate(node => getComputedStyle(node).transitionDuration), '0s');

    for (const id of ['export', 'import', 'open-settings', 'upstream-source', 'port-source']) await page.locator(`#${id}`).click();
    for (const type of ['export', 'import', 'openSettings', 'openSource']) assert.ok(messages.some(message => message.type === type), `${type} bridge action is reachable`);
    await page.locator('#reset').click();
    await page.waitForFunction(() => document.getElementById('accent-default').checked);
    assert.deepEqual(errors, [], 'no page errors, asset errors or CSP violations');
    assert.ok(requests.every(url => url.startsWith(origin)), 'the panel makes no external network requests');
    console.log(`UI checks passed: four palettes, drafts, color validation, language, apply, native actions, stale messages, keyboard, reduced motion, mobile layout, CSP. Screenshots: ${artifacts}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
