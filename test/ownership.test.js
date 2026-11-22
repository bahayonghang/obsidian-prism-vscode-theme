/* Independent VS Code port tests. GPL-3.0-only; modified 2026-11-21. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AppearanceOwnership, reconcile } = require('../out/ownership.js');

const copy = value => value === undefined ? undefined : structuredClone(value);
const scope = '[Obsidian Prism — Obsidian Dark]';
const root = 'workbench.colorCustomizations';
const color = (key, value) => ({ path: [scope, key], value });
const scalar = value => [{ path: [], value }];

/** Models persisted *user* values; it deliberately does not materialize inherited defaults. */
function memoryStore(initial = {}) {
  const values = copy(initial);
  let ledger;
  const state = { writes: [], saves: 0, failWriteAt: 0, failSaveAt: 0, events: [] };
  const store = {
    read(key) { return copy(values[key]); },
    async write(key, value) {
      state.writes.push({ key, value: copy(value) });
      state.events.push(`write:${key}`);
      if (state.failWriteAt === state.writes.length) throw new Error('simulated settings write failure');
      if (value === undefined) delete values[key];
      else values[key] = copy(value);
    },
    load() { return copy(ledger); },
    async save(value) {
      state.saves += 1;
      state.events.push('save');
      if (state.failSaveAt === state.saves) throw new Error('simulated journal save failure');
      ledger = copy(value);
    },
  };
  const owner = new AppearanceOwnership(store);
  return {
    store, owner, state, values,
    edit(key, value) { if (value === undefined) delete values[key]; else values[key] = copy(value); },
    restart() { return new AppearanceOwnership(store); },
  };
}

test('color patches preserve unrelated themes, native top-level values and same-scope user colors', async () => {
  const original = {
    'editor.background': '#101010',
    '[Another Theme]': { 'focusBorder': '#AAAAAA' },
    [scope]: { 'focusBorder': '#111111', 'editor.foreground': '#EEEEEE' },
  };
  const m = memoryStore({ [root]: original });
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#222222'), color('button.background', '#333333')] });
  assert.deepEqual(m.values[root], { ...original, [scope]: { ...original[scope], 'focusBorder': '#222222', 'button.background': '#333333' } });
  assert.deepEqual(original[scope], { 'focusBorder': '#111111', 'editor.foreground': '#EEEEEE' });
  await m.owner.restore('colors');
  assert.deepEqual(m.values[root], original);
  assert.equal(m.owner.has('colors'), false);
});

test('repeated applies are idempotent and retain the first user value for restoration', async () => {
  const m = memoryStore({ 'editor.fontFamily': 'User Font' });
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('Prism Font') });
  const count = m.state.writes.length;
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('Prism Font') });
  assert.equal(m.state.writes.length, count);
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('Another Prism Font') });
  await m.restart().restore('typography');
  assert.equal(m.values['editor.fontFamily'], 'User Font');
});

test('restore distinguishes a missing user root from an explicitly present empty root', async () => {
  for (const initial of [{}, { [root]: {} }]) {
    const m = memoryStore(initial);
    await m.owner.apply('colors', { [root]: [color('focusBorder', '#AABBCC')] });
    await m.owner.restore('colors');
    assert.deepEqual(m.values, initial);
  }
});

test('inherited defaults remain absent in user settings after apply and restore', async () => {
  const m = memoryStore();
  await m.owner.apply('typography', { 'editor.fontLigatures': scalar(true) });
  assert.deepEqual(m.values, { 'editor.fontLigatures': true });
  await m.owner.restore('typography');
  assert.deepEqual(m.values, {});
  assert.equal(Object.hasOwn(m.values, 'editor.fontLigatures'), false);
});

test('existing false and existing arrays restore exactly, without treating them as absent', async () => {
  const key = 'editor.tokenColorCustomizations';
  const rules = [{ scope: 'comment', settings: { foreground: '#ABCDEF' } }];
  const original = { 'editor.fontLigatures': false, [key]: { [scope]: { textMateRules: rules, comments: '#AAFFAA' } } };
  const m = memoryStore(original);
  await m.owner.apply('typography', { 'editor.fontLigatures': scalar(true) });
  await m.owner.apply('colors', { [key]: [{ path: [scope, 'textMateRules'], value: [...rules, { scope: 'keyword', settings: { fontStyle: 'bold' } }] }] });
  await m.owner.restore('colors');
  await m.owner.restore('typography');
  assert.deepEqual(m.values, original);
});

test('ownership originals distinguish missing leaf, present leaf and never-owned leaf', async () => {
  const m = memoryStore({ [root]: { [scope]: { 'focusBorder': '#AABBCC' } } });
  assert.equal(m.owner.original('colors', root, [scope, 'focusBorder']), undefined);
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#DDEEFF'), color('button.background', '#010203')] });
  assert.deepEqual(m.owner.original('colors', root, [scope, 'focusBorder']), { present: true, value: '#AABBCC' });
  assert.deepEqual(m.owner.original('colors', root, [scope, 'button.background']), { present: false });
  assert.equal(m.owner.original('colors', root, [scope, 'editor.foreground']), undefined);
});

test('a backed-up empty array stays an empty-array original across repeated token updates', async () => {
  const key = 'editor.tokenColorCustomizations';
  const path = [scope, 'textMateRules'];
  const m = memoryStore({ [key]: { [scope]: { textMateRules: [] } } });
  await m.owner.apply('colors', { [key]: [{ path, value: [{ scope: 'comment', settings: { fontStyle: 'italic' } }] }] });
  const original = m.owner.original('colors', key, path);
  assert.deepEqual(original, { present: true, value: [] });
  original.value.push({ scope: 'injected' });
  assert.deepEqual(m.owner.original('colors', key, path), { present: true, value: [] });
  await m.owner.restore('colors');
  assert.deepEqual(m.values[key], { [scope]: { textMateRules: [] } });
});

test('manual changes and deletions detach only the changed leaves across repeated applies', async () => {
  const m = memoryStore({ [root]: { [scope]: { 'focusBorder': '#111111', 'button.background': '#222222' } } });
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#333333'), color('button.background', '#444444')] });
  m.values[root][scope]['focusBorder'] = '#ABCDEF';
  delete m.values[root][scope]['button.background'];
  for (const value of ['#555555', '#666666']) {
    const conflicts = await m.owner.apply('colors', { [root]: [color('focusBorder', value), color('button.background', value)] });
    assert.equal(conflicts.length, 2);
    assert.equal(m.values[root][scope]['focusBorder'], '#ABCDEF');
    assert.equal(Object.hasOwn(m.values[root][scope], 'button.background'), false);
  }
  assert.equal(m.owner.has('colors'), false);
  await m.owner.restore('colors');
  assert.deepEqual(m.values[root], { [scope]: { 'focusBorder': '#ABCDEF' } });
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#777777')] });
  assert.equal(m.values[root][scope]['focusBorder'], '#777777');
  await m.owner.restore('colors');
  assert.equal(m.values[root][scope]['focusBorder'], '#ABCDEF');
});

test('manual edit to one leaf does not prevent another owned leaf restoring', async () => {
  const m = memoryStore({ [root]: { [scope]: { 'focusBorder': '#111111', 'button.background': '#222222' } } });
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#333333'), color('button.background', '#444444')] });
  m.values[root][scope]['focusBorder'] = '#AAAAAA';
  m.values[root]['[New User Theme]'] = { 'editor.background': '#BBBBBB' };
  await m.owner.restore('colors');
  assert.deepEqual(m.values[root], {
    [scope]: { 'focusBorder': '#AAAAAA', 'button.background': '#222222' },
    '[New User Theme]': { 'editor.background': '#BBBBBB' },
  });
});

test('reordered or otherwise manually changed token arrays are not overwritten', async () => {
  const key = 'editor.tokenColorCustomizations';
  const path = [scope, 'textMateRules'];
  const a = { scope: 'comment', settings: { foreground: '#ABCDEF' } };
  const b = { scope: 'keyword', settings: { fontStyle: 'bold' } };
  const m = memoryStore();
  await m.owner.apply('colors', { [key]: [{ path, value: [a, b] }] });
  m.values[key][scope].textMateRules = [b, a];
  await m.owner.apply('colors', { [key]: [{ path, value: [a] }] });
  await m.owner.restore('colors');
  assert.deepEqual(m.values[key][scope].textMateRules, [b, a]);
});

test('removing one managed option restores its original while other managed options continue', async () => {
  const m = memoryStore({ [root]: { [scope]: { 'focusBorder': '#111111' } } });
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#222222'), color('button.background', '#333333')] });
  await m.owner.apply('colors', { [root]: [color('button.background', '#444444')] });
  assert.deepEqual(m.values[root], { [scope]: { 'focusBorder': '#111111', 'button.background': '#444444' } });
  await m.owner.restore('colors');
  assert.deepEqual(m.values[root], { [scope]: { 'focusBorder': '#111111' } });
});

test('values already equal to the requested value are not claimed or reset', async () => {
  const m = memoryStore({ 'editor.fontLigatures': true });
  await m.owner.apply('typography', { 'editor.fontLigatures': scalar(true) });
  assert.equal(m.owner.has('typography'), false);
  assert.equal(m.state.writes.length, 0);
  await m.owner.restore('typography');
  assert.equal(m.values['editor.fontLigatures'], true);
});

test('typography and system settings use independent ownership groups', async () => {
  const m = memoryStore({ 'editor.fontFamily': 'Original', 'window.autoDetectColorScheme': false });
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('Prism') });
  await m.owner.apply('system', { 'window.autoDetectColorScheme': scalar(true) });
  await m.owner.restore('typography');
  assert.equal(m.values['editor.fontFamily'], 'Original');
  assert.equal(m.values['window.autoDetectColorScheme'], true);
  assert.equal(m.owner.has('system'), true);
  await m.owner.restore('system');
  assert.equal(m.values['window.autoDetectColorScheme'], false);
});

test('malformed customization roots and unsafe leaf paths fail without writes', async () => {
  for (const value of [false, 12, 'unexpected', []]) {
    const m = memoryStore({ [root]: value });
    await assert.rejects(m.owner.apply('colors', { [root]: [color('focusBorder', '#123456')] }), /Expected an object/);
    assert.deepEqual(m.values[root], value);
    assert.equal(m.state.writes.length, 0);
  }
  for (const key of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(() => reconcile({}, [{ path: ['safe', key, 'polluted'], value: true }]), /Unsafe setting path/);
  }
  assert.equal({}.polluted, undefined);
});

test('invalid nested customization ancestors are rejected without erasing user content', async () => {
  for (const value of ['mistyped scope', [], false]) {
    const initial = { [root]: { [scope]: value, '[Other]': { 'focusBorder': '#CCCCCC' } } };
    const m = memoryStore(initial);
    await assert.rejects(m.owner.apply('colors', { [root]: [color('focusBorder', '#123456')] }));
    assert.deepEqual(m.values, initial);
    assert.equal(m.state.writes.length, 0);
  }
  const key = 'editor.semanticTokenColorCustomizations';
  const initial = { [key]: { [scope]: { rules: 'mistyped rules' } } };
  const m = memoryStore(initial);
  await assert.rejects(m.owner.apply('colors', { [key]: [{ path: [scope, 'rules', 'keyword'], value: { bold: true } }] }));
  assert.deepEqual(m.values, initial);
  assert.equal(m.state.writes.length, 0);
});

test('journal failure before mutation leaves all user values untouched', async () => {
  const initial = { 'editor.fontFamily': 'Original' };
  const m = memoryStore(initial);
  m.state.failSaveAt = 1;
  await assert.rejects(m.owner.apply('typography', { 'editor.fontFamily': scalar('Prism') }), /journal save failure/);
  assert.deepEqual(m.values, initial);
  assert.equal(m.state.writes.length, 0);
});

test('failed first application can restore completed writes after a restart', async () => {
  const initial = { 'editor.fontFamily': 'Original', 'editor.fontLigatures': false };
  const m = memoryStore(initial);
  m.state.failWriteAt = 2;
  await assert.rejects(m.owner.apply('typography', {
    'editor.fontFamily': scalar('Prism'), 'editor.fontLigatures': scalar(true),
  }), /settings write failure/);
  assert.equal(m.values['editor.fontFamily'], 'Prism');
  assert.equal(m.values['editor.fontLigatures'], false);
  assert.equal(m.state.events[0], 'save');
  await m.restart().restore('typography');
  assert.deepEqual(m.values, initial);
});

test('failure after an existing group changes retains originals for both written and unwritten keys', async () => {
  const initial = { 'editor.fontFamily': 'Original Font', 'editor.fontLigatures': false };
  const m = memoryStore(initial);
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('First Font'), 'editor.fontLigatures': scalar(true) });
  m.state.failWriteAt = m.state.writes.length + 2;
  await assert.rejects(m.owner.apply('typography', {
    'editor.fontFamily': scalar('Second Font'), 'editor.fontLigatures': scalar('contextual'),
  }), /settings write failure/);
  await m.restart().restore('typography');
  assert.deepEqual(m.values, initial);
});

test('failed same-root update does not lose a removed leaf or its original backup', async () => {
  const initial = { [root]: { [scope]: { 'focusBorder': '#111111', 'button.background': '#222222' } } };
  const m = memoryStore(initial);
  await m.owner.apply('colors', { [root]: [color('focusBorder', '#333333'), color('button.background', '#444444')] });
  m.state.failWriteAt = m.state.writes.length + 1;
  await assert.rejects(m.owner.apply('colors', { [root]: [color('focusBorder', '#555555')] }), /settings write failure/);
  await m.restart().restore('colors');
  assert.deepEqual(m.values, initial);
});

test('a rejected same-leaf update still restores the original value instead of detaching it', async () => {
  const initial = { 'editor.fontFamily': 'Original Font' };
  const m = memoryStore(initial);
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('First Prism Font') });
  m.state.failWriteAt = m.state.writes.length + 1;
  await assert.rejects(m.owner.apply('typography', { 'editor.fontFamily': scalar('Second Prism Font') }), /settings write failure/);
  assert.equal(m.values['editor.fontFamily'], 'First Prism Font');
  await m.restart().restore('typography');
  assert.deepEqual(m.values, initial);
});

test('partial restore can be retried after a restart without replacing later manual changes', async () => {
  const initial = { 'editor.fontFamily': 'Original Font', 'editor.fontLigatures': false };
  const m = memoryStore(initial);
  await m.owner.apply('typography', { 'editor.fontFamily': scalar('Prism'), 'editor.fontLigatures': scalar(true) });
  m.state.failWriteAt = m.state.writes.length + 2;
  await assert.rejects(m.owner.restore('typography'), /settings write failure/);
  m.edit('editor.fontFamily', 'Manual After Failure');
  await m.restart().restore('typography');
  assert.deepEqual(m.values, { ...initial, 'editor.fontFamily': 'Manual After Failure' });
});

test('failed final journal save leaves a recoverable backup for completed mutations', async () => {
  const initial = { 'editor.fontFamily': 'Original Font' };
  const m = memoryStore(initial);
  m.state.failSaveAt = 2;
  await assert.rejects(m.owner.apply('typography', { 'editor.fontFamily': scalar('Prism') }), /journal save failure/);
  assert.equal(m.values['editor.fontFamily'], 'Prism');
  await m.restart().restore('typography');
  assert.deepEqual(m.values, initial);
});
