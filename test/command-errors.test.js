// Exercise the actual extension's registered commands and event callbacks.
// This models deterministic API write failures, not the unproven legacy CI transient.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { DEFAULT_SETTINGS } = require('../out/config.js');

const copy = value => value === undefined ? undefined : structuredClone(value);
const scope = '[Obsidian Prism — Obsidian Dark]';
const colorsKey = 'workbench.colorCustomizations';
const tokensKey = 'editor.tokenColorCustomizations';
const semanticKey = 'editor.semanticTokenColorCustomizations';
const baseline = {
  'workbench.colorTheme': 'Monokai',
  [colorsKey]: { [scope]: { 'button.background': '#112233' }, '[Monokai]': { 'editor.background': '#242424' } },
  [tokensKey]: { textMateRules: [{ scope: 'entity.name.function', settings: { foreground: '#224466' } }], [scope]: { textMateRules: [{ name: 'User numeric rule', scope: 'constant.numeric', settings: { foreground: '#446688' } }] } },
  [semanticKey]: { [scope]: { rules: { property: '#668899' } } },
};

class Emitter {
  listeners = new Set();
  event = listener => { this.listeners.add(listener); return { dispose: () => this.listeners.delete(listener) }; };
  fire(value) { for (const listener of [...this.listeners]) listener(value); }
  dispose() { this.listeners.clear(); }
}
const uri = value => ({ toString: () => value });
const disposable = () => ({ dispose() {} });

function chatAdapterFixture() {
  let state = { state: 'available', supported: true, installed: false, enabled: false, restartRequired: false, reason: 'Audited test installation', target: '/fixture/resources/app/out/main.js' };
  const calls = [];
  return {
    calls,
    adapter: {
      async info() { return copy(state); },
      async enable(css) { calls.push({ action: 'enable', css }); state = { ...state, state: 'restart-required', installed: true, enabled: true, restartRequired: true }; return copy(state); },
      async update(css) { calls.push({ action: 'update', css }); return copy(state); },
      async disable() { calls.push({ action: 'disable' }); state = { ...state, state: 'available', installed: false, enabled: false, restartRequired: true }; return copy(state); },
    },
  };
}

async function fixture(t, preferences = {}, adapter) {
  const values = copy({ ...baseline, ...preferences });
  const defaults = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [`obsidianPrism.${key}`, value]));
  const storage = {};
  const commands = new Map();
  const configurationChanged = new Emitter();
  const notifications = [];
  const messages = [];
  const writes = [];
  const errors = [];
  const failures = new Map();
  let receiveMessage;
  let reportFailure;
  let confirm = true;
  let pickedLanguage = 'zh-CN';
  t.mock.method(console, 'error', (...args) => errors.push(args));

  const vscode = {
    version: '1.107.0', env: { appName: 'Visual Studio Code', language: 'en', appRoot: '' },
    ConfigurationTarget: { Global: 1 }, ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    ViewColumn: { Active: -1 }, EventEmitter: Emitter,
    Uri: { parse: uri, file: path => uri(`file://${path}`), joinPath: (base, ...parts) => uri(`${base.toString()}/${parts.join('/')}`) },
    extensions: { getExtension: () => undefined, onDidChange: new Emitter().event },
    commands: {
      registerCommand(name, callback) { commands.set(name, callback); return { dispose: () => commands.delete(name) }; },
      async executeCommand(name, ...args) { return commands.get(name)?.(...args); },
    },
    workspace: {
      onDidChangeConfiguration: configurationChanged.event,
      registerTextDocumentContentProvider: disposable,
      getConfiguration(section = '') {
        const full = key => section ? `${section}.${key}` : key;
        return {
          get(key, fallback) { const name = full(key); return copy(Object.hasOwn(values, name) ? values[name] : Object.hasOwn(defaults, name) ? defaults[name] : fallback); },
          inspect(key) { return { globalValue: copy(values[full(key)]) }; },
          async update(key, value) {
            const name = full(key);
            writes.push(name);
            if (failures.has(name)) {
              const error = failures.get(name); failures.delete(name); throw error;
            }
            if (value === undefined) delete values[name];
            else values[name] = copy(value);
            configurationChanged.fire({ affectsConfiguration: prefix => name === prefix || name.startsWith(`${prefix}.`) });
          },
        };
      },
    },
    window: {
      activeColorTheme: { kind: 2 }, onDidChangeActiveColorTheme: new Emitter().event,
      // Notification dismissal must never hold up command completion or rejection.
      showErrorMessage(message) { notifications.push({ level: 'error', message }); return new Promise(() => {}); },
      showInformationMessage(message) { notifications.push({ level: 'info', message }); return new Promise(() => {}); },
      async showWarningMessage(message, options, action) { notifications.push({ level: 'warning', message, options }); return confirm ? action : undefined; },
      async showQuickPick(items) { return items.find(item => item.value === pickedLanguage); },
      createWebviewPanel() {
        const disposed = new Emitter();
        return {
          reveal() {}, dispose: () => disposed.fire(), onDidDispose: disposed.event,
          webview: {
            cspSource: 'https://fixture.invalid', asWebviewUri: value => value,
            onDidReceiveMessage(callback) { receiveMessage = callback; return { dispose: () => { receiveMessage = undefined; } }; },
            async postMessage(message) {
              if (message.type === 'status' && message.level === 'error' && reportFailure) {
                const error = reportFailure; reportFailure = undefined; throw error;
              }
              messages.push(copy(message)); return true;
            },
          },
        };
      },
    },
  };
  const context = {
    subscriptions: [], extensionUri: uri('file:///fixture/extension'),
    globalState: { get: key => copy(storage[key]), update: async (key, value) => { storage[key] = copy(value); } },
  };
  // Reload only the three modules that import VS Code; all production palette,
  // validation, ownership and operation logic remains real.
  for (const name of ['extension', 'host', 'webview']) delete require.cache[require.resolve(`../out/${name}.js`)];
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) { return name === 'vscode' ? vscode : originalLoad.call(this, name, parent, isMain); };
  let extension;
  try { extension = require('../out/extension.js'); } finally { Module._load = originalLoad; }
  extension.activate(context, adapter);
  await extension.deactivate(); // Drain the real activation queue; no test-only runtime hook.
  t.after(async () => {
    await extension.deactivate();
    for (const subscription of context.subscriptions) subscription.dispose();
  });
  return {
    values, writes, errors, notifications, messages, storage,
    command: name => vscode.commands.executeCommand(`obsidianPrism.${name}`),
    userWrite: (key, value) => vscode.workspace.getConfiguration().update(key, value),
    message: message => receiveMessage(message),
    failWrite: (key, error) => failures.set(key, error),
    failReport: error => { reportFailure = error; },
    drain: () => extension.deactivate(),
    confirm: value => { confirm = value; },
    pickLanguage: value => { pickedLanguage = value; },
  };
}

test('native reset rejects a second-root write failure and a retry restores originals while keeping manual edits', { timeout: 3000 }, async t => {
  const f = await fixture(t, { 'obsidianPrism.accent': 'iris', 'obsidianPrism.italicComments': true });
  const manual = copy(f.values[colorsKey]);
  manual[scope]['button.background'] = '#AA5588';
  await f.userWrite(colorsKey, manual);
  const failure = new Error('Injected second color-root write failure');
  f.failWrite(tokensKey, failure);
  const offset = f.writes.length;

  await assert.rejects(f.command('resetCustomizations'), error => error === failure);
  assert.deepEqual(f.writes.slice(offset), [colorsKey, tokensKey], 'the failure happens after the first root was restored');
  const expectedColors = copy(baseline[colorsKey]);
  expectedColors[scope]['button.background'] = '#AA5588';
  assert.deepEqual(f.values[colorsKey], expectedColors);
  assert.notDeepEqual(f.values[tokensKey], baseline[tokensKey], 'the failed root still needs recovery');
  assert.equal(f.values['obsidianPrism.italicComments'], true, 'failed reset does not claim to have cleared preferences');
  assert.ok(f.notifications.some(entry => entry.level === 'error' && entry.message.includes(failure.message)));
  assert.equal(f.errors[0][1], failure, 'the original error is retained in the extension-host log');

  // Simulate a manual edit between the interrupted operation and the user's retry.
  expectedColors[scope].focusBorder = '#00AA99';
  await f.userWrite(colorsKey, expectedColors);
  await assert.doesNotReject(f.command('resetCustomizations'));
  await f.drain();
  assert.deepEqual(f.values[colorsKey], expectedColors);
  assert.deepEqual(f.values[tokensKey], baseline[tokensKey]);
  assert.deepEqual(f.values[semanticKey], baseline[semanticKey]);
  assert.equal(f.values['obsidianPrism.accent'], undefined);
  assert.equal(f.values['obsidianPrism.italicComments'], undefined);
  assert.equal(f.storage['appearanceOwnership.v1'].groups.colors, undefined);
});

test('background configuration failures are reported and consumed without poisoning the command queue', { timeout: 3000 }, async t => {
  const f = await fixture(t);
  const failure = new Error('Injected background color write failure');
  f.failWrite(colorsKey, failure);
  await f.userWrite('obsidianPrism.accent', 'iris');
  // This command queues behind the failed event callback and must still finish,
  // even though the notification promise deliberately never resolves.
  await assert.doesNotReject(f.command('restoreTypography'));
  assert.ok(f.notifications.some(entry => entry.level === 'error' && entry.message.includes(failure.message)));
  assert.equal(f.errors[0][1], failure);
  await assert.doesNotReject(f.command('resetCustomizations'));
  await f.drain();
  assert.deepEqual(f.values[colorsKey], baseline[colorsKey]);
  assert.equal(f.values['obsidianPrism.accent'], undefined);
});

test('webview actions report a write failure without rejecting their message callback', { timeout: 3000 }, async t => {
  const f = await fixture(t, { 'obsidianPrism.accent': 'iris' });
  await f.command('openSettings');
  const failure = new Error('Injected Studio reset failure');
  f.failWrite(tokensKey, failure);
  await assert.doesNotReject(f.message({ type: 'reset' }));
  assert.ok(f.messages.some(message => message.type === 'status' && message.level === 'error' && message.message === failure.message));
  await assert.doesNotReject(f.command('resetCustomizations'));
  await f.drain();
  assert.deepEqual(f.values[tokensKey], baseline[tokensKey]);
});

test('failed Studio error delivery cannot replace the original command rejection', { timeout: 3000 }, async t => {
  const f = await fixture(t, { 'obsidianPrism.accent': 'iris' });
  await f.command('openSettings');
  const failure = new Error('Injected original settings failure');
  const deliveryFailure = new Error('Injected disposed Studio');
  f.failWrite(tokensKey, failure);
  f.failReport(deliveryFailure);
  await assert.rejects(f.command('resetCustomizations'), error => error === failure);
  assert.ok(f.errors.some(entry => entry[1] === deliveryFailure));
  await assert.doesNotReject(f.command('resetCustomizations'));
  await f.drain();
  assert.deepEqual(f.values[tokensKey], baseline[tokensKey]);
});

test('a delayed storage echo cannot detach newer owned token rules, while real manual edits remain authoritative', { timeout: 3000 }, async t => {
  const f = await fixture(t, { 'obsidianPrism.accent': 'iris' });
  const ledgerKey = 'appearanceOwnership.v1';
  const olderStorageEcho = copy(f.storage[ledgerKey]);
  assert.equal(f.values[tokensKey][scope].textMateRules.length, 2);

  await f.userWrite('obsidianPrism.italicComments', true);
  await f.command('restoreTypography');
  await f.drain();
  assert.equal(f.values[tokensKey][scope].textMateRules.length, 5);

  const manualColors = copy(f.values[colorsKey]);
  manualColors[scope]['button.background'] = '#AA5588';
  await f.userWrite(colorsKey, manualColors);
  const manualScope = '[Obsidian Prism — Warm Charcoal]';
  const manualTokens = copy(f.values[tokensKey]);
  manualTokens[manualScope].textMateRules.push({ name: 'Later user rule', scope: 'entity.name.tag', settings: { foreground: '#123456' } });
  await f.userWrite(tokensKey, manualTokens);

  // Model a stale self-origin storage broadcast replacing the Memento cache
  // after a newer awaited update. Native settings remain fully up to date.
  f.storage[ledgerKey] = olderStorageEcho;
  await f.userWrite('obsidianPrism.accent', 'amber');
  await f.command('restoreTypography');
  await f.drain();
  const ownedRules = f.values[tokensKey][scope].textMateRules;
  assert.equal(ownedRules.find(rule => rule.name === 'Markdown URLs').settings.foreground, '#F6CB75', 'our newer rules must remain managed after an old storage echo');
  assert.equal(f.values[colorsKey][scope]['button.background'], '#AA5588');
  assert.deepEqual(f.values[tokensKey][manualScope], manualTokens[manualScope], 'a real manual token-array edit must still detach');

  await f.command('resetCustomizations');
  await f.drain();
  const expectedColors = copy(baseline[colorsKey]);
  expectedColors[scope]['button.background'] = '#AA5588';
  const expectedTokens = copy(baseline[tokensKey]);
  expectedTokens[manualScope] = manualTokens[manualScope];
  assert.deepEqual(f.values[colorsKey], expectedColors);
  assert.deepEqual(f.values[tokensKey], expectedTokens, 'reset recovers original rules except the genuinely edited scope');
  assert.deepEqual(f.values[semanticKey], baseline[semanticKey]);
  assert.equal(f.values['obsidianPrism.accent'], undefined);
  assert.equal(f.values['obsidianPrism.italicComments'], undefined);
});

test('chat preferences and theme application never install the optional adapter', async t => {
  const chat = chatAdapterFixture();
  const f = await fixture(t, { 'obsidianPrism.chatBackground': 'aurora' }, chat.adapter);
  await f.userWrite('obsidianPrism.chatComposerStyle', 'prism');
  await f.drain();
  await f.command('openSettings');
  await f.message({ type: 'apply', palette: 'crystal', settings: { chatBackground: 'auroraTexture', chatBackgroundIntensity: 100 } });
  await f.drain();
  assert.deepEqual(chat.calls, [], 'activation, preference changes, and Apply Theme cannot install or touch an unowned adapter');
  assert.equal(f.values['obsidianPrism.chatBackgroundIntensity'], 100);
});

test('explicit chat enable saves only chat preferences and keeps a palette-routed bundle across window themes', async t => {
  const chat = chatAdapterFixture();
  const f = await fixture(t, { 'workbench.colorTheme': 'Obsidian Prism — Obsidian Dark' }, chat.adapter);
  await f.command('openSettings');
  await f.message({ type: 'enableChatAppearance', settings: { chatBackground: 'aurora', chatBackgroundIntensity: 35, codeFont: 'jetbrains', language: 'zh-CN', accent: 'iris' } });
  await f.drain();
  assert.equal(chat.calls.filter(call => call.action === 'enable').length, 1);
  assert.match(chat.calls.find(call => call.action === 'enable').css, /data-prism-host-appearance/);
  assert.equal(f.values['obsidianPrism.chatBackground'], 'aurora');
  assert.equal(f.values['obsidianPrism.chatBackgroundIntensity'], 35);
  for (const key of ['codeFont', 'language', 'accent']) assert.equal(f.values[`obsidianPrism.${key}`], undefined, `${key} draft is not applied`);
  assert.match(f.notifications.find(note => note.level === 'warning').options.detail, /Fully quit and reopen/);
  await f.userWrite('workbench.colorTheme', 'Monokai');
  await f.drain();
  assert.equal(chat.calls.at(-1).action, 'update');
  assert.equal(chat.calls.at(-1).css, chat.calls.find(call => call.action === 'enable').css, 'a non-Prism window cannot erase another window’s palette-routed bundle');
  for (const palette of ['obsidian', 'warm', 'crystal', 'alabaster']) assert.ok(chat.calls.at(-1).css.includes(`data-prism-host-palette="${palette}"`));
  await f.command('disableChatAppearance');
  assert.equal(chat.calls.at(-1).action, 'disable');
});

test('cancelled chat enable neither writes preferences nor installs an adapter', async t => {
  const chat = chatAdapterFixture();
  const f = await fixture(t, { 'workbench.colorTheme': 'Obsidian Prism — Obsidian Dark' }, chat.adapter);
  await f.command('openSettings');
  f.confirm(false);
  const writesBefore = f.writes.length;
  await f.message({ type: 'enableChatAppearance', settings: { chatBackground: 'none' } });
  await f.drain();
  assert.equal(f.writes.length, writesBefore);
  assert.deepEqual(chat.calls, []);
});

test('independent language changes persist immediately without changing the active theme or installing chat styling', async t => {
  const chat = chatAdapterFixture();
  const f = await fixture(t, {}, chat.adapter);
  const original = copy(f.values);
  const writeOffset = f.writes.length;
  await f.command('chooseLanguage');
  await f.drain();
  assert.equal(f.values['obsidianPrism.language'], 'zh-CN');
  assert.equal(f.values['workbench.colorTheme'], original['workbench.colorTheme']);
  assert.deepEqual(f.writes.slice(writeOffset), ['obsidianPrism.language']);
  assert.deepEqual(chat.calls, []);
  await f.command('openSettings');
  await f.message({ type: 'setLanguage', value: 'en' });
  await f.drain();
  assert.equal(f.values['obsidianPrism.language'], 'en');
  assert.equal(f.messages.filter(message => message.type === 'state').at(-1).language, 'en');
  assert.deepEqual(chat.calls, []);
});

test('an application update racing a chat refresh cannot be reported as a successful live update', async t => {
  const chat = chatAdapterFixture();
  const f = await fixture(t, { 'workbench.colorTheme': 'Obsidian Prism — Obsidian Dark' }, chat.adapter);
  await f.command('enableChatAppearance');
  await f.drain();
  chat.adapter.update = async () => ({ state: 'available', supported: true, installed: false, enabled: false, restartRequired: false, reason: 'Application updated; explicit enable is required.' });
  await assert.rejects(f.command('updateChatAppearance'), /Application updated/);
  assert.ok(f.notifications.some(note => note.level === 'error' && /Application updated/.test(note.message)));
});
