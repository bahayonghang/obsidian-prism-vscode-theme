// Native color contract for Antigravity's bridge and legacy shared surfaces.
// These are palette tests, not a claim of an authenticated Antigravity UI test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PALETTES, THEMES } = require('../out/palettes.js');
const { createTheme, contrastRatio, mix } = require('../out/theme.js');
const { DEFAULT_SETTINGS, parseSettings, serializeSettings, validateSettings } = require('../out/config.js');

const sidebarStyles = ['layered', 'unified', 'tinted'];
// Actual sources relayed by Google's bridge, including its sideBar-derived aliases.
const bridgeInputs = [
  'sideBar.background', 'sideBar.foreground', 'sideBarTitle.foreground',
  'editor.background', 'editor.foreground', 'foreground', 'descriptionForeground',
  'icon.foreground', 'input.background', 'input.foreground', 'input.border',
  'button.background', 'button.foreground', 'button.hoverBackground',
  'textLink.foreground', 'textLink.activeForeground', 'focusBorder',
  'list.hoverBackground', 'list.activeSelectionBackground', 'list.activeSelectionForeground',
];
const readable = (fg, bg, ratio, label) => assert.ok(contrastRatio(fg, bg) >= ratio,
  `${label}: ${fg} on ${bg} has contrast ${contrastRatio(fg, bg)}`);

test('Prism supplies the real Antigravity bridge inputs without invented vendor color IDs', () => {
  for (const { id } of THEMES) {
    const { colors } = createTheme(id);
    for (const key of bridgeInputs) assert.match(colors[key], /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/, key);
    for (const key of Object.keys(colors)) assert.doesNotMatch(key, /^(agy|antigravity|cascade)\./);
    assert.equal(colors['sideBar.background'], PALETTES[id].sidebar, 'default keeps upstream layers');
  }
});

for (const { id } of THEMES) {
  for (const sidebarSurface of sidebarStyles) {
    test(`${id}/${sidebarSurface}: conversation text stays readable on modern and legacy surfaces`, () => {
      for (const contrast of ['standard', 'high']) {
        const ratio = contrast === 'high' ? 7 : 4.5;
        for (const customAccent of ['#669DF6', '#A58AF8', '#D97757', '#000000', '#FFFFFF', '#00FF00']) {
          const { colors } = createTheme(id, { sidebarSurface, contrast, accent: 'custom', customAccent, inputBorder: 'accent' });
          const canvas = colors['sideBar.background'];
          const input = colors['input.background'];
          const legacyInput = mix(colors['editor.background'], '#6B7280', 0.10);
          for (const key of ['foreground', 'descriptionForeground', 'icon.foreground', 'textLink.foreground', 'textLink.activeForeground']) {
            for (const surface of [canvas, input, legacyInput]) readable(colors[key], surface, ratio, `${id}/${key}`);
          }
          readable(colors['sideBar.foreground'], canvas, ratio, 'bridge canvas text');
          readable(colors['sideBarTitle.foreground'], canvas, ratio, 'sidebar title');
          readable(colors['input.foreground'], input, ratio, 'native input text');
          readable(colors['input.placeholderForeground'], input, ratio, 'native placeholder');
          readable(colors['input.border'], input, 3, 'accent input border');
          readable(colors['input.border'], canvas, 3, 'accent input border against canvas');
          readable(colors['focusBorder'], canvas, 3, 'focus on chat canvas');
          readable(colors['focusBorder'], input, 3, 'focus on input');
          readable(colors['button.foreground'], colors['button.background'], 4.5, 'action label');
        }
      }
    });
  }
}

test('sidebar surface preferences change shared sidebars without repainting the editor or terminal', () => {
  for (const { id } of THEMES) {
    const base = createTheme(id);
    const unified = createTheme(id, { sidebarSurface: 'unified' });
    const tinted = createTheme(id, { sidebarSurface: 'tinted', accent: 'iris' });
    assert.equal(unified.colors['sideBar.background'], base.colors['editor.background']);
    assert.notEqual(tinted.colors['sideBar.background'], base.colors['sideBar.background']);
    assert.equal(tinted.colors['activityBar.background'], tinted.colors['sideBar.background']);
    for (const alternative of [unified, tinted]) {
      for (const key of ['editor.background', 'terminal.background', 'statusBar.background', 'input.background']) {
        assert.equal(alternative.colors[key], base.colors[key], `${id}/${key} should retain its own surface`);
      }
    }
  }
});

test('accent input border is a native control preference, not a legacy gray-frame patch', () => {
  for (const { id } of THEMES) {
    const base = createTheme(id);
    const accent = createTheme(id, { inputBorder: 'accent' });
    assert.notEqual(accent.colors['input.border'], base.colors['input.border']);
    const changes = Object.keys(base.colors).filter(key => base.colors[key] !== accent.colors[key]);
    assert.deepEqual(changes, ['input.border']);
    assert.equal(accent.colors['editor.background'], base.colors['editor.background']);
  }
});

test('new sidebar preferences import strictly and old v0.1 exports migrate with unchanged defaults', () => {
  const original = { ...DEFAULT_SETTINGS };
  delete original.sidebarSurface;
  delete original.inputBorder;
  const oldExport = JSON.stringify({ format: 'obsidian-prism-vscode-theme', version: 1, settings: original });
  assert.deepEqual(parseSettings(oldExport), DEFAULT_SETTINGS);
  const updated = { ...DEFAULT_SETTINGS, sidebarSurface: 'tinted', inputBorder: 'accent' };
  assert.deepEqual(parseSettings(serializeSettings(updated)), updated);
  for (const invalid of [{ sidebarSurface: 'url(https://example.invalid)' }, { sidebarSurface: true }, { inputBorder: '#FFFFFF' }, { inputBorder: false }]) {
    assert.throws(() => validateSettings(invalid), /Invalid value/);
  }
});
