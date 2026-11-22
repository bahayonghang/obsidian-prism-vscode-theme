/* Independent VS Code port tests. GPL-3.0-only; modified 2026-11-21. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SETTINGS, SETTING_DEFINITIONS, SETTING_KEYS, CHAT_APPEARANCE_KEYS,
  normalizeSettings, validateSettings, serializeSettings, parseSettings, isPaletteId,
} = require('../out/config.js');

const envelope = settings => ({ format: 'obsidian-prism-vscode-theme', version: 1, settings });

test('clean settings preserve native typography and use supported theme/panel defaults', () => {
  const normalized = normalizeSettings({});
  assert.deepEqual(normalized, DEFAULT_SETTINGS);
  assert.notEqual(normalized, DEFAULT_SETTINGS);
  assert.equal(normalized.accent, 'default');
  assert.equal(normalized.codeFont, 'default');
  for (const key of ['ligatures', 'smoothCaret', 'smoothScrolling']) assert.equal(normalized[key], 'inherit');
  assert.equal(normalized.language, 'auto');
  assert.deepEqual(new Set(SETTING_KEYS), new Set(Object.keys(SETTING_DEFINITIONS)));
  assert.deepEqual(validateSettings(normalized), normalized);
});

test('manual invalid values fall back independently while valid preferences survive', () => {
  const raw = {
    ...DEFAULT_SETTINGS, accent: 'iris', customAccent: '#abc123', ambientIntensity: '70',
    contrast: 'invalid', language: 'zh-CN', italicComments: true, arbitrary: 'ignored',
  };
  const normalized = normalizeSettings(raw);
  assert.equal(normalized.accent, 'iris');
  assert.equal(normalized.customAccent, '#ABC123');
  assert.equal(normalized.ambientIntensity, DEFAULT_SETTINGS.ambientIntensity);
  assert.equal(normalized.contrast, DEFAULT_SETTINGS.contrast);
  assert.equal(normalized.italicComments, true);
  assert.equal(normalized.language, 'zh-CN');
  assert.equal(Object.hasOwn(normalized, 'arbitrary'), false);
  assert.equal(raw.customAccent, '#abc123');
});

test('exports round-trip every supported nondefault control and omit unrelated editor settings', () => {
  const settings = {
    ...DEFAULT_SETTINGS, accent: 'custom', customAccent: '#123ABC', contrast: 'high',
    chatBackground: 'aurora', chatBackgroundIntensity: 35,
    chatComposerStyle: 'native', chatModelStyle: 'native', chatMotion: 'subtle',
    italicComments: true, boldKeywords: true, codeFont: 'cascadia', ligatures: 'on',
    smoothCaret: 'off', smoothScrolling: 'on', cornerStyle: 'soft', ambientIntensity: 35,
    motion: 'off', language: 'zh-CN', preferredDark: 'warm', preferredLight: 'alabaster',
  };
  const text = serializeSettings(settings);
  assert.deepEqual(parseSettings(text), settings);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['format', 'version', 'settings']);
  assert.equal(text.includes('editor.fontFamily'), false);
  assert.deepEqual(parseSettings('\uFEFF' + text), settings);
});

test('partial supported imports fill defaults without changing the shared defaults object', () => {
  const before = structuredClone(DEFAULT_SETTINGS);
  const result = parseSettings(JSON.stringify(envelope({ accent: 'amber', customAccent: '#bAda55' })));
  assert.deepEqual(result, { ...DEFAULT_SETTINGS, accent: 'amber', customAccent: '#BADA55' });
  assert.deepEqual(DEFAULT_SETTINGS, before);
});

test('older exports add chat appearance preferences without importing an adapter enable state', () => {
  const oldPreferences = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).filter(([key]) => !CHAT_APPEARANCE_KEYS.includes(key)));
  oldPreferences.language = 'zh-CN';
  oldPreferences.accent = 'iris';
  const imported = parseSettings(JSON.stringify(envelope(oldPreferences)));
  assert.equal(imported.language, 'zh-CN');
  assert.equal(imported.accent, 'iris');
  assert.deepEqual(Object.fromEntries(CHAT_APPEARANCE_KEYS.map(key => [key, imported[key]])), {
    chatBackground: 'auroraTexture', chatBackgroundIntensity: 70,
    chatComposerStyle: 'prism', chatModelStyle: 'prism', chatMotion: 'off',
  });
  for (const key of ['enabled', 'chatAppearanceEnabled', 'adapterEnabled', 'patch']) {
    assert.equal(Object.hasOwn(imported, key), false);
    assert.throws(() => parseSettings(JSON.stringify(envelope({ ...oldPreferences, [key]: true }))), /Unknown setting/);
  }
});

test('import rejects malformed roots, wrong schema versions and extra envelope fields', () => {
  const values = [
    null, [], 'text', true, {},
    { ...envelope({}), version: 2 }, { ...envelope({}), version: '1' },
    { ...envelope({}), format: 'vscode-settings' },
    { format: 'obsidian-prism-vscode-theme', version: 1 },
    { ...envelope({}), command: 'workbench.action.terminal.new' },
    envelope(null), envelope([]), envelope('settings'),
  ];
  for (const value of values) assert.throws(() => parseSettings(JSON.stringify(value)), undefined, JSON.stringify(value));
  assert.throws(() => parseSettings('{ broken JSON'));
});

test('imports reject arbitrary editor settings, command keys and prototype-shaped keys atomically', () => {
  const keys = ['editor.fontFamily', 'workbench.colorTheme', 'terminal.integrated.env.linux', 'command', 'constructor', 'prototype', '__proto__'];
  for (const key of keys) {
    const payload = `{"format":"obsidian-prism-vscode-theme","version":1,"settings":{"accent":"amber",${JSON.stringify(key)}:"injected"}}`;
    assert.throws(() => parseSettings(payload), /Unknown setting/);
  }
  assert.equal({}.injected, undefined);
  assert.equal(DEFAULT_SETTINGS.accent, 'default');
});

test('strict field validation prevents coercion and CSS injection', () => {
  const invalid = [
    { italicComments: 'true' }, { boldKeywords: 1 }, { ambientIntensity: '35' },
    { ambientIntensity: NaN }, { ambientIntensity: Infinity }, { ambientIntensity: 101 },
    { language: 'zh' }, { motion: '180fps' }, { codeFont: 'url(https://example.invalid/font)' },
    { preferredDark: 'crystal' }, { preferredLight: 'obsidian' },
    { chatBackground: 'url(https://example.invalid/background)' }, { chatBackground: 'custom' },
    { chatBackgroundIntensity: '70' }, { chatBackgroundIntensity: 99 },
    { chatComposerStyle: true }, { chatModelStyle: 'custom' }, { chatMotion: 'standard' },
    { smoothCaret: true }, { ligatures: false }, { customAccent: '#fff' },
    { customAccent: '#12345678' }, { customAccent: 'red' },
    { customAccent: '#123456; background:url(https://example.invalid/)' },
    { customAccent: '#123456\n' }, { customAccent: '#GGGGGG' },
  ];
  for (const value of invalid) assert.throws(() => validateSettings(value), /Invalid value/, JSON.stringify(value));
  assert.deepEqual(validateSettings({ customAccent: '#12abEF' }), { customAccent: '#12ABEF' });
});

test('ASCII imports enforce the 64 KiB boundary including whitespace', () => {
  const body = JSON.stringify(envelope({}));
  assert.deepEqual(parseSettings(body.padEnd(65536, ' ')), DEFAULT_SETTINGS);
  assert.throws(() => parseSettings(body.padEnd(65537, ' ')), /64 KiB/);
});

test('the parser counts UTF-8 bytes, not UTF-16 code units, for its import budget', () => {
  // JSON keeps the last occurrence of a key. This is otherwise a valid supported export.
  const body = `{"format":"obsidian-prism-vscode-theme","version":1,"settings":{"language":"${'界'.repeat(24000)}","language":"en"}}`;
  assert.ok(body.length < 65536);
  assert.ok(Buffer.byteLength(body, 'utf8') > 65536);
  assert.throws(() => parseSettings(body), /64 KiB/);
});

test('palette routing accepts only the four shipped palette IDs', () => {
  for (const id of ['obsidian', 'warm', 'crystal', 'alabaster']) assert.equal(isPaletteId(id), true);
  for (const id of ['host', 'constructor', '__proto__', null, {}, 0]) assert.equal(isPaletteId(id), false);
});
