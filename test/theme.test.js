// Independent Obsidian Prism VS Code port, added 2026-11-21. GPL-3.0-only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PALETTES, THEMES, UPSTREAM } = require('../out/palettes.js');
const { createTheme, contrastRatio, ensureContrast, normalizeHex, DEFAULT_THEME_OPTIONS } = require('../out/theme.js');

const root = path.resolve(__dirname, '..');
const accents = ['default', 'cobalt', 'iris', 'amber', 'mono', 'custom'];
const contrasts = ['standard', 'high'];
const colorPattern = /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/;

function assertReadable(foreground, background, minimum, message) {
  assert.ok(contrastRatio(foreground, background) >= minimum, `${message}: ${foreground} on ${background} has ratio ${contrastRatio(foreground, background)}`);
}

test('all four native themes retain the pinned upstream canvases and names', () => {
  const expected = {
    obsidian: ['#0E0E11', '#09090B', '#0B0B0E', '#669DF6', 'dark', 'Obsidian Dark'],
    warm: ['#141413', '#10100F', '#141413', '#D97757', 'dark', 'Warm Charcoal'],
    crystal: ['#F4F7FB', '#E8EEF6', '#F4F7FB', '#2563EB', 'light', 'Daylight Crystal'],
    alabaster: ['#F6F4EE', '#EBE6DC', '#F6F4EE', '#C25934', 'light', 'Warm Alabaster'],
  };
  assert.equal(THEMES.length, 4);
  assert.equal(new Set(THEMES.map((theme) => theme.label)).size, 4);
  for (const [id, [background, sidebar, shell, accent, type, name]] of Object.entries(expected)) {
    const theme = createTheme(id);
    assert.equal(theme.name, `Obsidian Prism — ${name}`);
    assert.equal(theme.type, type);
    assert.equal(theme.colors['editor.background'], background);
    assert.equal(theme.colors['sideBar.background'], sidebar);
    assert.equal(theme.colors['titleBar.activeBackground'], shell);
    assert.equal(theme.colors['button.background'], accent);
    assert.equal(theme.semanticHighlighting, true);
  }
});

for (const { id, label } of THEMES) {
  for (const accent of accents) {
    for (const contrast of contrasts) {
      test(`${label}: ${accent}/${contrast} is valid and readable`, () => {
        const options = { accent, customAccent: '#D5F5E0', contrast };
        const theme = createTheme(id, options);
        const minimum = contrast === 'high' ? 7 : 4.5;
        const colors = theme.colors;
        assert.ok(Object.keys(colors).length > 250, 'theme should cover the workbench, not just the editor');
        for (const [key, value] of Object.entries(colors)) {
          assert.match(value, colorPattern, `${key} must be a native hex color`);
          assert.doesNotMatch(key, /^editorIndentGuide\.(background|activeBackground)$/, 'deprecated unnumbered indent-guide IDs must not reappear');
        }
        for (const [foregroundKey, backgroundKey] of [
          ['editor.foreground', 'editor.background'],
          ['editorLineNumber.foreground', 'editor.background'],
          ['sideBar.foreground', 'sideBar.background'],
          ['input.foreground', 'input.background'],
          ['input.placeholderForeground', 'input.background'],
          ['statusBar.foreground', 'statusBar.background'],
          ['titleBar.activeForeground', 'titleBar.activeBackground'],
          ['editorSuggestWidget.foreground', 'editorSuggestWidget.background'],
          ['editorSuggestWidget.selectedForeground', 'editorSuggestWidget.selectedBackground'],
          ['list.activeSelectionForeground', 'list.activeSelectionBackground'],
        ]) assertReadable(colors[foregroundKey], colors[backgroundKey], minimum, foregroundKey);

        assertReadable(colors['button.foreground'], colors['button.background'], 4.5, 'button label');
        assertReadable(colors['button.foreground'], colors['button.hoverBackground'], 4.5, 'hover button label');
        assertReadable(colors['badge.foreground'], colors['badge.background'], 4.5, 'badge label');
        assertReadable(colors['focusBorder'], colors['editor.background'], 3, 'keyboard focus indicator');
        assert.equal(Boolean(colors.contrastBorder), contrast === 'high');

        for (const token of theme.tokenColors) {
          if (token.settings.foreground) {
            assert.match(token.settings.foreground, /^#[0-9A-F]{6}$/);
            assertReadable(token.settings.foreground, colors['editor.background'], minimum, token.name);
          }
        }
        for (const [selector, value] of Object.entries(theme.semanticTokenColors)) {
          const foreground = typeof value === 'string' ? value : value.foreground;
          if (foreground) assertReadable(foreground, colors['editor.background'], minimum, `semantic ${selector}`);
        }
        assert.equal(Object.keys(colors).filter((key) => key.startsWith('terminal.ansi')).length, 16);
        for (const key of ['diffEditor.insertedTextBackground', 'diffEditor.removedTextBackground', 'editor.selectionHighlightBackground', 'editor.wordHighlightBackground']) {
          assert.equal(colors[key].length, 9, `${key} must remain translucent`);
          assert.notEqual(colors[key].slice(-2), 'FF', `${key} must not cover annotations`);
        }
      });
    }
  }
}

test('generated, checked-in themes exactly match the shared runtime generator', () => {
  for (const metadata of THEMES) {
    const themePath = path.resolve(root, metadata.path);
    const written = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    assert.deepEqual(written, createTheme(metadata.id), `stale theme artifact: ${metadata.path}`);
  }
});

test('custom accents keep extreme choices usable without altering the requested button color', () => {
  for (const { id } of THEMES) {
    for (const customAccent of ['#000000', '#FFFFFF', '#FFEE00', '#00FF00', '#000066', '#777777', '#f0f']) {
      const theme = createTheme(id, { accent: 'custom', customAccent });
      const colors = theme.colors;
      assert.equal(colors['button.background'], normalizeHex(customAccent));
      assertReadable(colors['button.foreground'], colors['button.background'], 4.5, `${id}/${customAccent} button`);
      assertReadable(colors['textLink.foreground'], colors['editor.background'], 4.5, `${id}/${customAccent} link`);
      assertReadable(colors['focusBorder'], colors['editor.background'], 3, `${id}/${customAccent} focus`);
    }
  }
});

test('invalid custom colors cannot enter generated theme JSON', () => {
  for (const invalid of ['red', 'url(https://example.com)', '#00FF0099', '#xyz', '', 'var(--accent)']) {
    assert.equal(normalizeHex(invalid), undefined);
    assert.deepEqual(createTheme('warm', { accent: 'custom', customAccent: invalid }), createTheme('warm'));
  }
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex(' #ABC123 '), '#ABC123');
  assert.throws(() => createTheme('missing'), /Unknown Obsidian Prism palette/);
});

test('font style controls agree for TextMate and semantic highlighting', () => {
  for (const italicComments of [true, false]) {
    for (const boldKeywords of [true, false]) {
      const theme = createTheme('obsidian', { italicComments, boldKeywords });
      const comments = theme.tokenColors.find((rule) => rule.name === 'Comments');
      const keywords = theme.tokenColors.find((rule) => rule.name === 'Keywords and storage');
      assert.equal(comments.settings.fontStyle, italicComments ? 'italic' : '');
      assert.equal(keywords.settings.fontStyle, boldKeywords ? 'bold' : '');
      assert.equal(theme.semanticTokenColors.comment.italic, italicComments);
      assert.equal(theme.semanticTokenColors.keyword.bold, boldKeywords);
    }
  }
});

test('syntax rules cover source code, data formats, Markdown, and semantic providers', () => {
  const theme = createTheme('crystal');
  const scopes = theme.tokenColors.flatMap((rule) => Array.isArray(rule.scope) ? rule.scope : rule.scope ? [rule.scope] : []);
  for (const scope of ['support.function.builtin.python', 'support.type.property-name.json', 'meta.mapping.key.yaml', 'entity.other.attribute-name.tsx', 'markup.heading', 'markup.inline.raw', 'entity.name.function']) {
    assert.ok(scopes.includes(scope), `missing ${scope}`);
  }
  for (const semantic of ['class', 'interface', 'typeParameter', 'property', 'function', 'method', 'variable.readonly', 'comment']) {
    assert.ok(Object.prototype.hasOwnProperty.call(theme.semanticTokenColors, semantic), `missing ${semantic}`);
  }
});

test('contrast correction is stable and uses actual WCAG luminance', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#AABBCC', '#AABBCC'), 1);
  for (const background of ['#0E0E11', '#141413', '#F4F7FB', '#F6F4EE']) {
    for (const foreground of ['#777777', '#FFFFFF', '#000000', '#FFEE00']) {
      const adjusted = ensureContrast(foreground, background, 7);
      assertReadable(adjusted, background, 7, 'contrast-corrected text');
      assert.equal(ensureContrast(adjusted, background, 7), adjusted);
    }
  }
});

test('generation does not mutate caller options or the shared upstream palette', () => {
  const original = JSON.stringify(PALETTES);
  const options = Object.freeze({ accent: 'custom', customAccent: '#FFF', contrast: 'high', italicComments: false });
  const theme = createTheme('obsidian', options);
  theme.colors['editor.background'] = '#FFFFFF';
  assert.equal(JSON.stringify(PALETTES), original);
  assert.equal(createTheme('obsidian').colors['editor.background'], '#0E0E11');
  assert.deepEqual(DEFAULT_THEME_OPTIONS, { accent: 'default', customAccent: '#A58AF8', contrast: 'standard', italicComments: false, boldKeywords: false });
});

test('upstream identity, license, source pin, and modification notices remain visible', () => {
  assert.equal(UPSTREAM.author, 'RMvdesi');
  assert.equal(UPSTREAM.project, 'Obsidian Prism');
  assert.equal(UPSTREAM.url, 'https://github.com/RMvdesi/obsidian-prism');
  assert.equal(UPSTREAM.commit, '5dac53bfa7cf917d40101dad2579f32dd1b1b587');
  assert.equal(UPSTREAM.license, 'GPL-3.0-only');
  for (const file of ['src/palettes.ts', 'src/theme.ts']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /RMvdesi/);
    assert.match(source, /2026-11-21/);
    assert.match(source, /GPL-3\.0-only/);
  }
});
