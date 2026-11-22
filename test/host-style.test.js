const test = require('node:test');
const assert = require('node:assert/strict');
const { transformSync } = require('esbuild');
const { DEFAULT_SETTINGS } = require('../out/config.js');
const { THEMES } = require('../out/palettes.js');
const { createTheme, contrastRatio } = require('../out/theme.js');
const { generateHostAppearanceCss, generateHostAppearanceBundle } = require('../out/host-style.js');
const structures = require('./fixtures/host-appearance/structures.json');

const options = (overrides = {}) => ({ ...DEFAULT_SETTINGS, ...overrides });
const cssFor = (overrides = {}, id = 'obsidian') => generateHostAppearanceCss(id, options(overrides));
function firstToken(css, name) {
  const match = css.match(new RegExp(`--prism-host-${name}: ([^;]+);`));
  assert.ok(match, `missing ${name} token`);
  return match[1];
}

test('the installed stylesheet routes every palette through an explicit per-frame identity', () => {
  const bundle = generateHostAppearanceBundle(DEFAULT_SETTINGS);
  for (const mode of ['modern', 'legacy']) for (const theme of THEMES) {
    assert.ok(bundle.includes(`html[data-prism-host-appearance="${mode}"][data-prism-host-palette="${theme.id}"]`));
  }
  assert.doesNotMatch(bundle, /html\[data-prism-host-appearance="(?:modern|legacy)"\](?!\[data-prism-host-palette=)/, 'there are no unqualified Prism rules that can leak across window palettes');
  assert.ok(Buffer.byteLength(bundle) < 128 * 1024);
  assert.equal(transformSync(bundle, { loader: 'css' }).warnings.length, 0);
});

test('host CSS is deterministic, local and isolated behind explicit host markers', () => {
  const css = cssFor();
  assert.equal(css, cssFor());
  assert.ok(Buffer.byteLength(css) < 24000, 'payload stays small enough for an optional local stylesheet');
  assert.doesNotMatch(css, /@import|url\s*\(|javascript:|expression\s*\(|<script|\b(?:https?|file):/i);
  assert.doesNotMatch(css, /\.monaco-|\.workbench|#workbench|(^|[},])\s*(?:body|button|input|textarea|dialog)\s*[{,]/m);
  for (const { 1: selector } of css.matchAll(/(?:^|})\s*([^{}]+)\{/g)) {
    if (selector.trim().startsWith('@')) continue;
    assert.match(selector, /html\[data-prism-host-appearance="(?:modern|legacy)"\]/,
      `unscoped stylesheet rule: ${selector}`);
  }
  assert.doesNotMatch(css, /(?:--background|--foreground|--card|--secondary)\s*:/,
    'Prism must not replace host semantic variables globally');
});

test('CSS parses for all palettes, accents and contrast modes, including extreme custom accents', () => {
  const accents = ['default', 'cobalt', 'iris', 'amber', 'mono', 'custom'];
  for (const { id } of THEMES) {
    for (const accent of accents) {
      for (const contrast of ['standard', 'high']) {
        const css = cssFor({ accent, contrast, chatMotion: 'subtle' }, id);
        const result = transformSync(css, { loader: 'css', target: 'chrome140', logLevel: 'silent' });
        assert.deepEqual(result.warnings, [], `${id}/${accent}/${contrast}`);
        assert.doesNotMatch(css, /undefined|NaN|Infinity/);
      }
    }
    for (const customAccent of ['#000000', '#FFFFFF', '#FF00FF', '#00FF00', '#abc', 'red;} body { display:none;/*']) {
      const css = cssFor({ accent: 'custom', customAccent }, id);
      const result = transformSync(css, { loader: 'css', target: 'chrome140', logLevel: 'silent' });
      assert.deepEqual(result.warnings, [], `${id}/${customAccent}`);
      assert.doesNotMatch(css, /display\s*:\s*none|red;|body\s*{/);
    }
  }
});

test('actual palette surfaces and custom accents reach the host CSS without using native input colors', () => {
  const results = new Set();
  for (const { id } of THEMES) {
    const css = cssFor({}, id);
    const theme = createTheme(id);
    assert.equal(firstToken(css, 'canvas'), theme.colors['sideBar.background']);
    results.add(css);
    const tinted = cssFor({ sidebarSurface: 'tinted' }, id);
    assert.notEqual(firstToken(css, 'canvas'), firstToken(tinted, 'canvas'));
    const custom = cssFor({ accent: 'custom', customAccent: '#D848B6' }, id);
    assert.notEqual(firstToken(css, 'focus'), firstToken(custom, 'focus'));
    assert.notEqual(firstToken(css, 'background'), firstToken(custom, 'background'));
    assert.equal(css, cssFor({ inputBorder: 'accent' }, id), 'the shared native input control is not the host composer');
  }
  assert.equal(results.size, 4);
});

test('normal and high-contrast text and focus tokens remain readable on their solid surfaces', () => {
  for (const { id } of THEMES) {
    for (const contrast of ['standard', 'high']) {
      for (const customAccent of ['#000000', '#FFFFFF', '#7A29BE']) {
        const css = cssFor({ accent: 'custom', customAccent, contrast }, id);
        const surfaces = ['canvas', 'card-solid', 'popup-solid', 'pill', 'pill-hover'];
        for (const surface of surfaces) {
          const background = firstToken(css, surface);
          for (const token of ['foreground', 'secondary']) {
            assert.ok(contrastRatio(firstToken(css, token), background) >= (contrast === 'high' ? 7 : 4.5),
              `${id}/${contrast}/${customAccent}: ${token} on ${surface}`);
          }
          assert.ok(contrastRatio(firstToken(css, 'focus'), background) >= 3,
            `${id}/${contrast}/${customAccent}: focus on ${surface}`);
          if (contrast === 'high') assert.ok(contrastRatio(firstToken(css, 'border'), background) >= 3);
        }
      }
    }
  }
});

test('background off, zero intensity and high contrast omit decorative canvas overrides', () => {
  for (const preferences of [{ chatBackground: 'none' }, { chatBackgroundIntensity: 0 }, { contrast: 'high' }]) {
    const css = cssFor({ ...preferences, chatMotion: 'subtle' });
    assert.doesNotMatch(css, /\.agy-home|\[data-testid="conversation-view"\]|radial-gradient|repeating-linear-gradient|@keyframes|@property/);
  }
  const noOverrides = cssFor({ chatBackground: 'none', chatComposerStyle: 'native', chatModelStyle: 'native' });
  assert.doesNotMatch(noOverrides, /[{}]/);
  assert.match(noOverrides, /no overrides requested/);
});

test('native component choices omit their own overrides while leaving independent choices available', () => {
  const noComposer = cssFor({ chatComposerStyle: 'native' });
  assert.doesNotMatch(noComposer, /> \.surface-composer-card|> \.bg-input|:focus-within|caret-color:/);
  assert.match(noComposer, /model-selector-trigger/);
  const noModel = cssFor({ chatModelStyle: 'native' });
  assert.doesNotMatch(noModel, /model-selector-|Select model, current:|\[role="dialog"\]/);
  assert.match(noModel, /> \.surface-composer-card/);
  const noBoth = cssFor({ chatComposerStyle: 'native', chatModelStyle: 'native' });
  assert.match(noBoth, /\.agy-home/);
  assert.doesNotMatch(noBoth, /agentSidePanelInputBox|model-selector/);
});

test('texture is opt-in and intensity changes only generated decorative color amounts', () => {
  const aurora = cssFor({ chatBackground: 'aurora' });
  const texture = cssFor({ chatBackground: 'auroraTexture' });
  assert.doesNotMatch(aurora, /repeating-linear-gradient|circle at 1px 1px/);
  assert.match(texture, /repeating-linear-gradient/);
  assert.match(texture, /circle at 1px 1px/);
  const soft = cssFor({ chatBackgroundIntensity: 35 });
  const full = cssFor({ chatBackgroundIntensity: 100 });
  assert.notEqual(firstToken(soft, 'background'), firstToken(full, 'background'));
  for (const name of ['foreground', 'card-solid', 'popup-solid', 'focus', 'pill']) {
    assert.equal(firstToken(soft, name), firstToken(full, name));
  }
});

test('host styling never borrows Studio corners, glow, fonts or animation preferences', () => {
  assert.equal(cssFor(), cssFor({
    cornerStyle: 'soft', ambientIntensity: 100, motion: 'ultra',
    codeFont: 'jetbrains', ligatures: 'on', smoothCaret: 'on', smoothScrolling: 'on',
    italicComments: true, boldKeywords: true, language: 'zh-CN',
  }));
});

test('only explicitly requested gradient motion is added and it honors OS motion preferences', () => {
  assert.doesNotMatch(cssFor(), /@keyframes|\banimation\s*:/);
  const css = cssFor({ chatMotion: 'subtle' });
  assert.match(css, /@property --prism-host-aurora-drift/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) and \(forced-colors: none\)/);
  assert.match(css, /animation: prism-host-aurora-drift 28s ease-in-out infinite alternate/);
  assert.doesNotMatch(css, /animation:\s*(?:none|[^;]*spin)|transition:\s*all/);
  assert.doesNotMatch(css, /\.animate-spin|\.animate-fade-in|running|aria-busy|MutationObserver/);
});

test('forced colors and reduced transparency remove decoration without hiding native controls', () => {
  const css = cssFor();
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /--prism-host-background: none;/);
  assert.match(css, /--prism-host-row-hover: Highlight;/);
  assert.match(css, /--prism-host-row-hover-foreground: HighlightText;/);
  assert.match(css, /--prism-host-popup-filter: none;/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@supports not \(backdrop-filter: blur\(1px\)\)/);
  assert.doesNotMatch(css, /forced-color-adjust\s*:\s*none|outline\s*:\s*(?:0|none)/);
  const high = cssFor({ contrast: 'high' });
  assert.equal(firstToken(high, 'sheen'), 'none');
  assert.equal(firstToken(high, 'popup-filter'), 'none');
  assert.equal(firstToken(high, 'card-shadow'), 'none');
});

test('host geometry, popup positioning, pointer behavior and native controls are preserved', () => {
  const css = cssFor({ chatMotion: 'subtle' });
  assert.doesNotMatch(css, /(?:^|[;{\n])\s*(?:position|inset|left|right|top|bottom|transform|translate|z-index|width|height|min-width|max-width|min-height|max-height|overflow(?:-[xy])?|pointer-events|display|visibility|opacity|padding(?:-\w+)?|margin(?:-\w+)?|font-family|font-size|content)\s*:/m);
  assert.doesNotMatch(css, /::(?:before|after)|\bsvg\b|send-button|input-cancel-button/);
  for (const { 1: selector } of css.matchAll(/(?:^|})\s*([^{}]+)\{/g)) {
    if (selector.includes(':hover') || selector.includes('[data-highlighted]')) {
      for (const line of selector.split('\n')) {
        if (line.includes(':hover') || line.includes('[data-highlighted]')) {
          assert.match(line, /:not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled\]\)/);
        }
      }
    }
  }
  assert.match(css, /:focus-visible\s*\{/);
});

test('modern portal and legacy structural contracts stay explicit and source-labeled', () => {
  const css = cssFor();
  assert.match(css, /\.agy-overlay:has\(\[data-testid="model-selector-panel"\]\)/);
  assert.match(css, /\.agy-overlay:has\(\[data-testid="model-selector-effort-option"\]\)/);
  assert.match(css, /\.antigravity-agent-side-panel #antigravity\\\.agentSidePanelInputBox/);
  assert.match(css, /\[role="dialog"\]\[aria-modal="true"\]\[class~="!w-64"\]/);
  assert.match(css, /:has\(> \.max-h-80\.bg-ide-chat-background\)/);
  assert.match(css, /button\[data-autofocus\]/);
  assert.doesNotMatch(css, /\[data-selected|\[aria-selected/);
  assert.equal(structures.kind, 'synthetic-selector-fixtures');
  assert.equal(structures.realApplicationCapture, false);
  assert.equal(structures.modern.reference, 'official-cli-frontend-1.5.14');
  assert.equal(structures.legacy.reference, 'official-ide-1.23.2-workbench');
  assert.match(structures.legacy.popup, /role="dialog"/);
});
