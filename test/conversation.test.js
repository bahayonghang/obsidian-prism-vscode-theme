// Independent model checks against the documented external consumer contract.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTheme, contrastRatio } = require('../out/theme.js');
const { THEMES } = require('../out/palettes.js');
const { createAntigravityPreview } = require('../out/conversation.js');

test('conversation preview uses the bridge canvas instead of the editor or native input canvas', () => {
  const theme = createTheme('obsidian');
  const p = createAntigravityPreview(theme);
  assert.equal(p.model, 'google-bridge-default-contrast');
  assert.equal(p.background, '#09090B');
  assert.equal(p.foreground, '#F2F2F5');
  assert.equal(p.card, '#151517');
  assert.equal(p.cardBorder, '#202022');
  assert.equal(p.placeholder, '#9A9A9C');
  assert.notEqual(p.card, theme.colors['input.background']);
  assert.notEqual(p.background, theme.colors['editor.background']);
});

test('light conversation cards mix the sidebar canvas with white, not the dark-mode formula', () => {
  const p = createAntigravityPreview(createTheme('crystal'));
  assert.equal(p.background, '#E8EEF6');
  assert.equal(p.card, '#EFF3F9');
  assert.equal(p.cardBorder, '#DEE3E9');
  assert.equal(p.placeholder, '#696F7D');
});

test('unconsumed native input customizations cannot misleadingly alter the conversation sketch', () => {
  const theme = createTheme('warm');
  const original = createAntigravityPreview(theme);
  const modified = structuredClone(theme);
  for (const key of ['input.background', 'input.foreground', 'input.border', 'input.placeholderForeground']) modified.colors[key] = '#FF00FF';
  assert.deepEqual(createAntigravityPreview(modified), original);
  assert.deepEqual(createAntigravityPreview(createTheme('warm', { inputBorder: 'accent' })), original);
});

test('sidebar and accent preferences propagate to the actual conversation surface family', () => {
  for (const { id } of THEMES) {
    const base = createAntigravityPreview(createTheme(id));
    const changed = createAntigravityPreview(createTheme(id, { sidebarSurface: 'tinted', accent: 'iris' }));
    for (const key of ['background', 'card', 'cardBorder', 'placeholder', 'primary', 'link']) assert.notEqual(changed[key], base[key], `${id}/${key}`);
    assert.ok(contrastRatio(changed.foreground, changed.card) >= 7, `${id} body text should remain readable`);
    const unifiedTheme = createTheme(id, { sidebarSurface: 'unified' });
    assert.equal(createAntigravityPreview(unifiedTheme).background, unifiedTheme.colors['editor.background']);
  }
});
