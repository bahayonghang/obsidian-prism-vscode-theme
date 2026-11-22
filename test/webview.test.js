const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function loadWebview() {
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === 'vscode') return { Uri: { joinPath: (base, ...parts) => ({ toString: () => `${base.toString()}/${parts.join('/')}` }) } };
    return originalLoad.call(this, name, parent, isMain);
  };
  try { return require('../out/webview.js'); } finally { Module._load = originalLoad; }
}

const { getWebviewHtml } = loadWebview();
const uri = { toString: () => 'file:///extension' };
const webview = { cspSource: 'https://file+.vscode-resource.vscode-cdn.net', asWebviewUri: value => ({ toString: () => `https://local.invalid/${value.toString()}` }) };

test('webview isolates scripts, connections, forms and local resources', () => {
  const html = getWebviewHtml(webview, uri);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|onclick=|onerror=/);
  const script = html.match(/<script nonce="([a-f0-9]{48})" src="([^"]+)"><\/script>/);
  assert.ok(script, 'exactly one external, nonced script is present');
  assert.ok(html.includes(`script-src 'nonce-${script[1]}'`));
  assert.ok(script[2].endsWith('/media/settings.js'));
  assert.equal((html.match(/<script /g) || []).length, 1);
  assert.match(html, /href="[^"]+\/media\/settings.css"/);
  assert.notEqual(script[1], getWebviewHtml(webview, uri).match(/<script nonce="([^"]+)"/)[1]);
});

test('resource URI attributes are escaped rather than interpolated as markup', () => {
  const html = getWebviewHtml({ ...webview, asWebviewUri: () => ({ toString: () => 'local://x" onload="bad<&' }) }, uri);
  assert.match(html, /local:\/\/x&quot; onload=&quot;bad&lt;&amp;/);
  assert.doesNotMatch(html, /src="local:\/\/x" onload=/);
});

test('appearance controls explain native scope and preserve visible upstream attribution', () => {
  const html = getWebviewHtml(webview, uri);
  assert.match(html, /RMvdesi/);
  assert.match(html, /GPL-3.0-only/);
  assert.match(html, /Independent Antigravity IDE \/ VS Code port/);
  assert.match(html, /They do not change the Antigravity main window, conversation layout or VS Code window/);
  assert.match(html, /editor-wide user settings/);
  for (const id of ['apply', 'apply-typography', 'restore-typography', 'apply-system', 'restore-system', 'import', 'export', 'reset', 'compatibility-report']) {
    assert.ok(html.includes(`id="${id}"`), `${id} action is available`);
  }
});

test('Antigravity preview identifies its limits and exposes shared native controls', () => {
  const html = getWebviewHtml(webview, uri);
  assert.match(html, /ANTIGRAVITY IDE/);
  assert.match(html, /data-setting="sidebarSurface"/);
  assert.match(html, /data-setting="inputBorder"/);
  assert.match(html, /Explorer and other sidebars change too/);
  assert.match(html, /not a host screenshot/);
  assert.match(html, /outside the Antigravity composer/);
  assert.match(html, /Modern Antigravity derives its composer from this canvas/);
  assert.match(html, /Legacy IDE 1\.23\.2 uses the editor background and fixed gray/);
  assert.match(html, /id="preview-conversation-tab" role="tab"[^>]+aria-selected="true"/);
  assert.match(html, /id="editor-preview"[^>]+hidden/);
  assert.doesNotMatch(html, /id="conversation-preview"[^>]+hidden/);
  const css = fs.readFileSync(path.join(__dirname, '../media/settings.css'), 'utf8');
  assert.match(css, /\.conversation-composer \{[^}]+border-radius: 12px/);
  assert.doesNotMatch(css, /\.live-preview::after/);
  assert.doesNotMatch(css, /\.conversation[^}]*\{[^}]*var\(--radius/);
  const js = fs.readFileSync(path.join(__dirname, '../media/settings.js'), 'utf8');
  assert.match(js, /function showConversationPreview/);
  assert.match(js, /'card-border': 'cardBorder'/);
  assert.doesNotMatch(js, /colors\['input\.(background|foreground|border|placeholderForeground)'\]/);
});

test('client renders untrusted host text without HTML sinks or network APIs', () => {
  const js = fs.readFileSync(path.join(__dirname, '../media/settings.js'), 'utf8');
  assert.doesNotMatch(js, /\.innerHTML\s*=|insertAdjacentHTML|\beval\s*\(|\bfetch\s*\(|XMLHttpRequest|WebSocket/);
  assert.match(js, /message\.resetDraft/);
  assert.match(js, /message\.requestId !== latestPreviewRequest/);
  assert.match(js, /dirtyKeys\.has/);
});
