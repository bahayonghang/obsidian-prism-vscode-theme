// Host classification and privacy boundaries; no IDE installation or account required.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const encode = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
function loadHost(mock = {}) {
  const filename = require.resolve('../out/host.js');
  const originalLoad = Module._load;
  const vscode = {
    version: '1.107.0',
    env: { appName: 'Visual Studio Code', appRoot: '/private/application-root' },
    extensions: { getExtension: () => undefined },
    FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
    Uri: { file: value => value, joinPath: (base, leaf) => `${base}/${leaf}` },
    workspace: { fs: { stat: async () => { throw new Error('No filesystem access expected'); }, readFile: async () => { throw new Error('No file read expected'); } } },
    ...mock,
  };
  delete require.cache[filename];
  Module._load = function (name, parent, isMain) {
    return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain);
  };
  try { return require(filename); } finally { Module._load = originalLoad; }
}

const { classifyHostAppearance, parseProductIdeVersion, formatCompatibilityReport, PRODUCT_METADATA_LIMIT } = loadHost();
const ide = (ideVersion, bridgeVersion, extra = {}) => classifyHostAppearance({ appName: 'Antigravity', vscodeVersion: '1.107.0', ideVersion, bridgeVersion, ...extra });

test('source references distinguish the actual IDE version from the VS Code baseline', () => {
  const legacy = ide('1.23.2');
  assert.deepEqual(legacy, { appName: 'Antigravity', vscodeVersion: '1.107.0', ideVersion: '1.23.2', kind: 'antigravity-ide', colorPath: 'legacy', referenceMatch: true });
  const modern = ide('2.8.0', '1.12.0');
  assert.equal(modern.ideVersion, '2.8.0');
  assert.equal(modern.vscodeVersion, '1.107.0');
  assert.equal(modern.colorPath, 'bridge');
  assert.equal(modern.referenceMatch, true);
  const onlyBaseline = ide(undefined, undefined, { vscodeVersion: '1.23.2' });
  assert.equal(onlyBaseline.ideVersion, undefined);
  assert.equal(onlyBaseline.colorPath, 'unverified', 'a matching engine version must not masquerade as the inspected IDE');
  assert.equal(onlyBaseline.referenceMatch, false);
});

test('known bridges can be recognized on unknown IDE versions without claiming a tested host match', () => {
  for (const bridgeVersion of ['1.12.0', '1.13.0']) {
    for (const ideVersion of [undefined, '2.9.0', '2.8.1', '2.8.0-insider']) {
      const info = ide(ideVersion, bridgeVersion);
      assert.equal(info.colorPath, 'bridge');
      assert.equal(info.referenceMatch, false);
    }
  }
  assert.equal(ide('2.8.0', '1.13.0').referenceMatch, false, 'an uninspected IDE/bridge combination is not an exact source reference');
});

test('missing, malformed and newer bridge versions do not inherit a known modern or legacy contract', () => {
  for (const version of [undefined, '', '1.14.0', '1.13.0-beta.1', '1.13.0+build', 1.12]) {
    const info = ide('2.8.0', version, { bridgeInstalled: true });
    assert.equal(info.colorPath, 'unverified');
    assert.equal(info.referenceMatch, false);
  }
  assert.equal(ide('2.8.0').colorPath, 'unverified', 'the IDE version alone cannot prove that the bundled bridge is available');
  assert.equal(ide('1.23.2', undefined, { bridgeInstalled: true }).colorPath, 'unverified');
  assert.equal(ide('1.23.3').colorPath, 'unverified');
});

test('standard VS Code, the Google extension and unknown forks are distinguished conservatively', () => {
  for (const appName of ['Visual Studio Code', 'Visual Studio Code - Insiders', 'Code - OSS', 'VS Code']) {
    const info = classifyHostAppearance({ appName, vscodeVersion: '1.107.0', ideVersion: '2.8.0' });
    assert.equal(info.kind, 'vscode');
    assert.equal(info.colorPath, 'standard');
    assert.equal(info.ideVersion, undefined);
    assert.equal(info.referenceMatch, false);
  }
  const extension = classifyHostAppearance({ appName: 'Visual Studio Code', vscodeVersion: '1.107.0', bridgeVersion: '1.13.0' });
  assert.equal(extension.kind, 'antigravity-extension');
  assert.equal(extension.colorPath, 'bridge');
  assert.equal(extension.referenceMatch, true);
  for (const appName of ['Cursor', 'Windsurf', 'Some Code Fork', 'NotAntigravity']) {
    const unknown = classifyHostAppearance({ appName, vscodeVersion: '1.107.0' });
    assert.equal(unknown.kind, 'unknown');
    assert.equal(unknown.colorPath, 'unverified');
    const withBridge = classifyHostAppearance({ appName, vscodeVersion: '1.107.0', bridgeVersion: '1.13.0' });
    assert.equal(withBridge.kind, 'antigravity-extension');
    assert.equal(withBridge.colorPath, 'bridge');
    assert.equal(withBridge.referenceMatch, false);
  }
});

test('product metadata accepts only a string ideVersion and cannot leak unrelated product fields', () => {
  assert.equal(parseProductIdeVersion(encode({ ideVersion: '2.8.0', version: '1.107.0', applicationName: '/private/path', secret: 'do-not-report' })), '2.8.0');
  assert.equal(parseProductIdeVersion(encode('\uFEFF{"ideVersion":"1.23.2"}')), '1.23.2');
  for (const product of [null, [], true, 'text', {}, { version: '2.8.0' }, { ideVersion: 2.8 }, { ideVersion: '2.8.0\n' }, { ideVersion: '../secrets' }, { ideVersion: '2.8' }]) {
    assert.equal(parseProductIdeVersion(encode(product)), undefined, JSON.stringify(product));
  }
  assert.equal(parseProductIdeVersion(encode('{broken')), undefined);
  assert.equal(parseProductIdeVersion(new Uint8Array([0xC3, 0x28])), undefined, 'invalid UTF-8 must not be decoded permissively');
});

test('product metadata enforces a byte limit before JSON parsing', () => {
  const body = '{"ideVersion":"2.8.0"}';
  assert.equal(parseProductIdeVersion(encode(body.padEnd(PRODUCT_METADATA_LIMIT))), '2.8.0');
  assert.equal(parseProductIdeVersion(encode(body.padEnd(PRODUCT_METADATA_LIMIT + 1))), undefined);
  const unicode = encode({ ideVersion: '2.8.0', ignored: '界'.repeat(90000) });
  assert.ok(unicode.byteLength > PRODUCT_METADATA_LIMIT);
  assert.equal(parseProductIdeVersion(unicode), undefined);
});

test('host detection reads exactly product.json and extension metadata without activating the bridge', async () => {
  const operations = [];
  const product = encode({ ideVersion: '2.8.0', version: '1.107.0', privatePath: '/do-not-report', secret: 'credential' });
  const { detectHostAppearance } = loadHost({
    env: { appName: 'Antigravity', appRoot: '/private/ide/resources/app' },
    extensions: { getExtension(id) { operations.push(['metadata', id]); return { packageJSON: { version: '1.12.0' }, activate() { throw new Error('must never activate'); } }; } },
    workspace: { fs: {
      async stat(uri) { operations.push(['stat', uri]); return { type: 1, size: product.byteLength }; },
      async readFile(uri) { operations.push(['readFile', uri]); return product; },
    } },
  });
  const result = await detectHostAppearance();
  assert.equal(result.colorPath, 'bridge');
  assert.equal(result.ideVersion, '2.8.0');
  assert.equal(result.referenceMatch, true);
  assert.deepEqual(operations, [
    ['metadata', 'google.google-antigravity'],
    ['stat', '/private/ide/resources/app/product.json'],
    ['readFile', '/private/ide/resources/app/product.json'],
  ]);
  assert.doesNotMatch(JSON.stringify(result), /private|credential|resources\/app|product\.json/);
});

test('oversized or non-file metadata is never read, including size changes after stat', async () => {
  for (const stat of [{ type: 1, size: PRODUCT_METADATA_LIMIT + 1 }, { type: 2, size: 100 }, { type: 1, size: -1 }, { type: 1, size: NaN }]) {
    let reads = 0;
    const { detectHostAppearance } = loadHost({
      env: { appName: 'Antigravity', appRoot: '/private/root' },
      workspace: { fs: { stat: async () => stat, readFile: async () => { reads += 1; return encode({ ideVersion: '1.23.2' }); } } },
    });
    const info = await detectHostAppearance();
    assert.equal(reads, 0);
    assert.equal(info.colorPath, 'unverified');
  }
  const { detectHostAppearance } = loadHost({
    env: { appName: 'Antigravity', appRoot: '/private/root' },
    workspace: { fs: { stat: async () => ({ type: 1, size: 10 }), readFile: async () => encode('{"ideVersion":"1.23.2"}'.padEnd(PRODUCT_METADATA_LIMIT + 1)) } },
  });
  assert.equal((await detectHostAppearance()).colorPath, 'unverified');
});

test('restricted, malformed and browser-unavailable product metadata degrades without throwing', async () => {
  for (const fs of [
    { stat: async () => { throw new Error('Access denied: /private/root'); } },
    { stat: async () => ({ type: 1, size: 100 }), readFile: async () => { throw new Error('Cannot read /private/root'); } },
    { stat: async () => ({ type: 1, size: 100 }), readFile: async () => encode('{broken') },
  ]) {
    const { detectHostAppearance } = loadHost({ env: { appName: 'Antigravity', appRoot: '/private/root' }, workspace: { fs } });
    const info = await detectHostAppearance();
    assert.equal(info.colorPath, 'unverified');
    assert.equal(info.ideVersion, undefined);
    assert.doesNotMatch(JSON.stringify(info), /private|Access denied|Cannot read/);
  }
  const browser = loadHost({ env: { appName: 'Antigravity', appRoot: '' } });
  assert.equal((await browser.detectHostAppearance()).colorPath, 'unverified');
  const standard = loadHost();
  assert.equal((await standard.detectHostAppearance()).colorPath, 'standard');
  const metadataFailure = loadHost({
    env: { appName: 'Antigravity', appRoot: '/private/root' },
    extensions: { getExtension() { throw new Error('Extension metadata unavailable'); } },
    workspace: { fs: { stat: async () => ({ type: 1, size: 100 }), readFile: async () => encode({ ideVersion: '1.23.2' }) } },
  });
  assert.equal((await metadataFailure.detectHostAppearance()).colorPath, 'unverified', 'unavailable extension metadata cannot prove that a legacy host has no bridge');
});

test('compatibility reports include only relevant native colors and applicable theme scopes', () => {
  const theme = 'Obsidian Prism — Obsidian Dark';
  const report = formatCompatibilityReport(ide('1.23.2'), {
    language: 'en', activeTheme: theme,
    colorCustomizations: {
      'editor.background': '#123456',
      'sideBar.foreground': '#fff',
      'input.border': 'url(https://do-not-report.invalid)',
      'chat.messages': 'private conversation',
      credentials: 'secret-token',
      '[Obsidian Prism*]': { 'sideBar.background': '#242424', secret: 'secret-in-scope' },
      [`[${theme}]`]: { 'input.placeholderForeground': '#AABBCC', 'button.background': 'default', token: 'access-token' },
      '[Other Theme]': { 'editor.background': '#987654', 'input.foreground': 'other-secret' },
    },
  });
  assert.match(report, /#123456/);
  assert.match(report, /#242424/);
  assert.match(report, /#AABBCC/);
  assert.match(report, /"button.background": "default"/);
  assert.doesNotMatch(report, /private conversation|secret-token|secret-in-scope|access-token|other-secret|do-not-report|#987654/);
  assert.match(report, /90% editor\.background/);
  assert.match(report, /10% fixed #6B7280/);
  assert.match(report, /20% fixed gray/);
  assert.match(report, /inputBorder does not change that legacy composer frame/);
  assert.match(report, /source reference match is not visual testing/i);
  assert.match(report, /shared native sidebar colors/);
  assert.match(report, /neither the inspected modern nor legacy Antigravity composer consumes it/);
  assert.match(report, /Forwarding input\.\* through the Google bridge does not mean the composer uses those keys/);
});

test('reports localize the version distinction and unknown-version limits', () => {
  const info = ide('2.9.0', '1.14.0');
  const report = formatCompatibilityReport(info, { language: 'zh-CN', activeTheme: 'Prism', colorCustomizations: null });
  assert.match(report, /VS Code 引擎版本（不是 Antigravity IDE 版本）: 1\.107\.0/);
  assert.match(report, /Antigravity IDE 版本: 2\.9\.0/);
  assert.match(report, /尚未核实的外观实现/);
  assert.match(report, /源码样本匹配: 否/);
  assert.match(report, /不代表本机界面已经过视觉验收/);
  assert.match(report, /inputBorder 不会改变这个旧版聊天输入框外框/);
});
