/**
 * Chromium checks for the actual generated host stylesheet against small,
 * independently authored DOM contracts. These are NOT a Google frontend or
 * logged-in host tests. Every screenshot carries an explicit fixture caption.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { generateHostAppearanceBundle } = require('../out/host-style.js');
const { createTheme, mix, contrastRatio } = require('../out/theme.js');
const { createAntigravityPreview } = require('../out/conversation.js');
const { PALETTES, THEMES } = require('../out/palettes.js');
const { DEFAULT_SETTINGS } = require('../out/config.js');
const structures = require('../test/fixtures/host-appearance/structures.json');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'artifacts');
const CAPTION = 'DOM fixture · not a host screenshot';
const SELECTORS = {
  canvas: '#fixture-canvas', composer: '[data-fixture-composer]', card: '[data-fixture-card]',
  trigger: '[data-fixture-trigger]', popup: '#fixture-popup', editor: '[data-fixture-editor]',
  selected: '#fixture-selected', highlighted: '#fixture-highlighted', disabled: '#fixture-disabled',
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function buildFixtureHtml({ kind, palette, surface = 'home' }) {
  const fixture = structures[kind];
  assert.ok(fixture && PALETTES[palette], 'expected a known fixture and palette');
  const p = PALETTES[palette];
  const theme = createTheme(palette);
  const native = createAntigravityPreview(theme);
  const canvas = kind === 'legacy' ? p.background : native.background;
  const card = kind === 'legacy' ? mix(p.background, '#6B7280', 0.1) : native.card;
  const canvasAttributes = kind === 'modern' && surface === 'home'
    ? 'class="agy-home"' : 'data-testid="conversation-view"';
  const title = p.label.split(' — ')[1];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · ${CAPTION}</title><style>
/* Fixture layout and a minimal set of native utility semantics, not host CSS. */
:root { color-scheme: ${p.type}; --fixture-canvas:${canvas}; --fixture-card:${card}; --fixture-edge:${kind === 'legacy' ? '#6B728033' : native.cardBorder}; --fixture-fg:${p.foreground}; --fixture-secondary:${p.secondaryForeground}; --fixture-hover:${p.secondary}; --fixture-panel:${p.shell}; --fixture-line:${p.border}; --fixture-accent:${theme.colors['focusBorder']}; }
* { box-sizing:border-box; }
body { margin:0; padding:36px 44px 28px; background:var(--fixture-panel); color:var(--fixture-fg); font-family:Arial, sans-serif; font-size:14px; }
button { font:inherit; color:inherit; }
[hidden] { display:none !important; }
.fixture-page { width:min(100%,1040px); margin:auto; }
.fixture-caption { display:inline-flex; align-items:center; gap:9px; padding:7px 11px; border:1px solid var(--fixture-accent); border-radius:6px; color:var(--fixture-fg); font-size:12px; font-weight:600; letter-spacing:.025em; }
.fixture-caption::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--fixture-accent); }
.fixture-heading { display:flex; align-items:end; justify-content:space-between; gap:24px; margin:24px 0 25px; }
h1 { margin:0 0 8px; font-size:31px; line-height:1.1; font-weight:600; letter-spacing:-.035em; }
.fixture-heading p { margin:0; color:var(--fixture-secondary); line-height:1.55; font-size:13px; }
.fixture-reference { text-align:right; color:var(--fixture-secondary); font-size:11px; line-height:1.7; white-space:nowrap; }
.fixture-reference strong { display:block; color:var(--fixture-fg); text-transform:uppercase; letter-spacing:.14em; font-size:10px; }
.fixture-grid { display:grid; grid-template-columns:minmax(0,580px) minmax(230px,1fr); gap:32px; }
.fixture-frame { border:1px solid var(--fixture-line); border-radius:14px; overflow:hidden; box-shadow:0 14px 50px #00000014; }
.fixture-surface-bar { height:44px; padding:0 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--fixture-line); background:var(--fixture-canvas); color:var(--fixture-secondary); font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
.fixture-surface-bar span:last-child { opacity:.7; font-size:10px; letter-spacing:.02em; }
#fixture-canvas { height:580px; display:flex; flex-direction:column; background:var(--fixture-canvas); background-image:none; }
.fixture-specimen { flex:1; min-height:160px; padding:66px 28px 24px; }
.fixture-kicker { color:var(--fixture-secondary); font-size:10px; font-weight:600; letter-spacing:.15em; text-transform:uppercase; }
.fixture-specimen h2 { max-width:330px; margin:13px 0 14px; font-size:28px; font-weight:500; line-height:1.22; letter-spacing:-.025em; }
.fixture-specimen p { max-width:320px; margin:0; color:var(--fixture-secondary); font-size:13px; line-height:1.75; }
.fixture-dock { padding:16px 22px 24px; }
[data-fixture-composer] { display:flex; flex-direction:column; padding:1px; border-radius:16px; background:var(--fixture-edge); box-shadow:none; }
[data-fixture-card] { position:relative; display:flex; flex-direction:column; padding:4px; border-radius:15px; color:var(--fixture-fg); background:var(--fixture-card); background-image:none; box-shadow:none; backdrop-filter:none; }
[data-fixture-editor] { min-height:82px; padding:11px 10px 7px; color:var(--fixture-fg); font-size:14px; line-height:1.55; outline:none; overflow-wrap:anywhere; }
[data-fixture-editor]:empty::before { content:attr(data-placeholder); opacity:.60; pointer-events:none; }
[data-fixture-footer] { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:2px; }
[data-fixture-trigger] { display:flex; align-items:center; min-width:0; max-width:100%; height:28px; gap:5px; padding:0 7px 0 9px; border:0; border-radius:${kind === 'modern' ? '999px' : '8px'}; background:transparent; background-image:none; box-shadow:none; color:var(--fixture-secondary); cursor:pointer; font-size:13px; }
[data-fixture-trigger] > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[data-fixture-trigger]:hover { background-color:var(--fixture-hover); }
[data-fixture-trigger]:focus-visible { outline:1px solid var(--fixture-accent); outline-offset:1px; }
[data-fixture-icon] { flex:none; width:14px; height:14px; display:inline-block; visibility:visible; opacity:1; }
[data-fixture-inert-action] { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:0; border-radius:50%; background:var(--fixture-hover); opacity:.45; }
.fixture-popup { position:fixed; width:256px; max-height:260px; overflow:hidden; transform:translate(0px,0px); z-index:50; border:${kind === 'legacy' ? '0' : '1px solid var(--fixture-line)'}; border-radius:16px; background:var(--fixture-card); background-image:none; color:var(--fixture-fg); box-shadow:0 6px 16px #00000026; backdrop-filter:none; }
.fixture-popup > [data-testid="model-selector-panel"] { padding:5px; }
.fixture-popup > .max-h-80 { max-height:320px; overflow:hidden; padding:5px; border:1px solid var(--fixture-line); border-radius:16px; background:var(--fixture-canvas); }
[data-fixture-menu-title] { padding:7px 9px 8px; font-size:11px; color:var(--fixture-secondary); font-weight:600; }
[data-fixture-row] { width:100%; height:34px; display:flex; align-items:center; justify-content:space-between; gap:10px; border:0; border-radius:6px; padding:7px 9px; background:transparent; background-image:none; color:var(--fixture-secondary); font-size:12px; text-align:left; cursor:pointer; opacity:1; }
[data-fixture-row][data-highlighted], [data-fixture-row][data-autofocus="true"] { background:var(--fixture-hover); }
[data-fixture-row].text-foreground { color:var(--fixture-fg); }
[data-fixture-row][disabled], [data-fixture-row][aria-disabled="true"] { opacity:.4; cursor:not-allowed; }
[data-fixture-row]:focus-visible { outline:1px solid var(--fixture-accent); outline-offset:-1px; }
.fixture-aside { padding:7px 0; }
.fixture-aside h2 { margin:0 0 12px; font-size:17px; font-weight:500; letter-spacing:-.015em; }
.fixture-aside p { color:var(--fixture-secondary); font-size:12px; line-height:1.8; margin:0 0 25px; }
.fixture-token { display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:10px; align-items:center; padding:13px 0; border-bottom:1px solid var(--fixture-line); font-size:12px; }
.fixture-token i { display:block; height:28px; border-radius:7px; border:1px solid var(--fixture-line); }
.fixture-token code { font-family:monospace; color:var(--fixture-secondary); font-size:10px; }
.fixture-notes { margin-top:29px; padding-top:22px; border-top:1px solid var(--fixture-line); }
.fixture-notes strong { display:block; margin-bottom:8px; font-size:11px; letter-spacing:.06em; }
.fixture-notes p { margin:0; font-size:11px; }
.fixture-footer { display:flex; justify-content:space-between; gap:16px; margin-top:22px; color:var(--fixture-secondary); font-size:10px; line-height:1.5; }
.fixture-native-feedback { display:inline-block; width:10px; height:10px; border:1px solid currentColor; border-right-color:transparent; border-radius:50%; margin-right:5px; }
@keyframes fixture-native-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:no-preference) { .fixture-native-feedback { animation:fixture-native-spin 1.4s linear infinite; } }
@media (max-width:760px) { body { padding:22px 16px; } .fixture-heading { margin-top:21px; } h1 { font-size:26px; } .fixture-heading p { font-size:12px; } .fixture-reference { display:none; } .fixture-grid { grid-template-columns:minmax(0,1fr); gap:0; } .fixture-aside { display:none; } #fixture-canvas { height:590px; } .fixture-specimen { padding:52px 20px 20px; } .fixture-specimen h2 { font-size:25px; } .fixture-dock { padding:15px 15px 22px; } .fixture-caption { font-size:10px; } .fixture-footer { flex-direction:column; gap:5px; } }
</style></head><body><main class="fixture-page">
<div class="fixture-caption">${CAPTION}</div>
<header class="fixture-heading"><div><h1>${escapeHtml(title)}</h1><p>Prism appearance on an independently authored structural test fixture.</p></div><div class="fixture-reference"><strong>${kind === 'modern' ? 'Modern bridge structure' : 'Legacy sidebar structure'}</strong>${kind === 'modern' ? 'CLI frontend 1.5.14' : 'IDE workbench 1.23.2'}<br>Appearance only · local CSS</div></header>
<div class="fixture-grid"><section class="fixture-frame"><div class="fixture-surface-bar"><span id="fixture-surface-label">${surface === 'home' ? 'Home surface' : 'Conversation surface'}</span><span>Structural specimen</span></div>
<div ${kind === 'legacy' ? 'class="antigravity-agent-side-panel"' : 'class="fixture-modern-frame"'}><div id="fixture-canvas" ${canvasAttributes}>
<div class="fixture-specimen"><div class="fixture-kicker">Appearance specimen</div><h2>Quiet light.<br>A little more depth.</h2><p>Independent test content for checking background, texture and control surfaces. No conversation or model service is running.</p></div>
<div class="fixture-dock">${fixture.composer}</div></div></div></section>
<aside class="fixture-aside"><h2>Surface inspection</h2><p>The stylesheet is the extension’s real output. The surrounding DOM is a small test fixture, not the Antigravity application.</p>
${[['canvas', 'Canvas'], ['card-solid', 'Composer'], ['pill', 'Model pill'], ['popup-solid', 'Menu'], ['focus', 'Focus ring']].map(([token, label]) => `<div class="fixture-token"><i style="background:var(--prism-host-${token},var(--fixture-card))"></i><span>${label}</span><code data-fixture-token="${token}">—</code></div>`).join('')}
<div class="fixture-notes"><strong>WHAT THIS CHECKS</strong><p>CSS selection, readable surfaces, keyboard focus, preserved menu geometry and existing control states.</p></div><div class="fixture-notes"><strong>WHAT THIS DOES NOT PROVE</strong><p>Logged-in host rendering, every future host version, or any chat/model behavior.</p></div></aside></div>
<footer class="fixture-footer"><span>Obsidian Prism · RMvdesi · GPL-3.0-only</span><span><i class="fixture-native-feedback" aria-hidden="true"></i>Existing fixture feedback stays independent.</span></footer>
</main><div id="fixture-portals">${fixture.popup}${kind === 'modern' ? fixture.effortPopup : ''}</div></body></html>`;
}

/** Add minimal fixture handlers only, never imported into the shipped extension. */
async function initializeFixture(page, kind) {
  await page.evaluate(kind => {
    const composer = document.getElementById('antigravity.agentSidePanelInputBox');
    composer.dataset.fixtureComposer = '';
    const card = composer.querySelector(kind === 'modern' ? '.surface-composer-card' : '.bg-input');
    card.dataset.fixtureCard = '';
    const editor = card.querySelector('[contenteditable]');
    editor.dataset.fixtureEditor = '';
    editor.dataset.placeholder = 'Focus this editable specimen…';
    const trigger = composer.querySelector(kind === 'modern' ? '[data-testid="model-selector-trigger"]' : 'button[aria-label^="Select model, current:"]');
    trigger.dataset.fixtureTrigger = '';
    const footer = composer.querySelector(kind === 'modern' ? '.agy-composer-footer' : '.no-focus-agent-input');
    footer.dataset.fixtureFooter = '';
    const icon = (name, path) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.dataset.fixtureIcon = name; svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', path); shape.setAttribute('fill', 'none'); shape.setAttribute('stroke', 'currentColor'); shape.setAttribute('stroke-width', '1.35'); shape.setAttribute('stroke-linecap', 'round'); shape.setAttribute('stroke-linejoin', 'round');
      svg.append(shape); return svg;
    };
    trigger.append(icon('chevron', 'm4 6 4 4 4-4'));
    const inertAction = document.createElement('button');
    inertAction.type = 'button'; inertAction.disabled = true; inertAction.dataset.fixtureInertAction = '';
    inertAction.dataset.testid = 'send-button'; inertAction.setAttribute('aria-label', 'Inert fixture action');
    inertAction.append(icon('inert-action', 'M8 12V4m-4 4 4-4 4 4')); footer.append(inertAction);
    const portals = document.getElementById('fixture-portals');
    const popup = portals.firstElementChild;
    popup.id = 'fixture-popup'; popup.classList.add('fixture-popup');
    const panel = kind === 'modern' ? popup.querySelector('[data-testid="model-selector-panel"]') : popup.firstElementChild;
    let title = panel.querySelector('[data-testid="model-selector-header"]');
    if (!title) { title = document.createElement('div'); title.textContent = 'Fixture menu'; panel.prepend(title); }
    title.dataset.fixtureMenuTitle = '';
    const rows = [...panel.querySelectorAll('button')];
    for (const [index, row] of rows.entries()) {
      row.dataset.fixtureRow = '';
      row.id = ['fixture-selected', 'fixture-highlighted', 'fixture-disabled'][index];
    }
    rows[0].append(icon('selection', 'm3 8 3 3 7-7'));
    if (kind === 'modern') {
      for (const [id, text] of [['model-selector-custom-item', 'Custom fixture row'], ['model-selector-orchestrator', 'Orchestrator fixture row']]) {
        const row = document.createElement('button'); row.type = 'button'; row.setAttribute('role', 'menuitem');
        row.className = 'agy-overlay-item'; row.dataset.testid = id; row.dataset.fixtureRow = ''; row.textContent = text; panel.append(row);
      }
      const effort = portals.lastElementChild; effort.id = 'fixture-effort-popup'; effort.classList.add('fixture-popup'); effort.hidden = true;
      effort.querySelector('button').dataset.fixtureRow = '';
      Object.assign(effort.style, { left: '650px', top: '300px', width: '180px', maxHeight: '160px' });
    }
    const opener = kind === 'legacy' ? trigger.parentElement : trigger;
    window.fixtureState = { opens: 0, closes: 0, selections: 0, disabledClicks: 0 };
    window.positionFixturePopup = () => {
      const bounds = trigger.getBoundingClientRect();
      const left = Math.max(16, Math.min(bounds.left, innerWidth - 272));
      const height = popup.getBoundingClientRect().height || 220;
      Object.assign(popup.style, { left: `${left}px`, top: `${Math.max(24, bounds.top - height - 10)}px` });
    };
    window.setFixturePopupOpen = (open, restoreFocus = false) => {
      popup.hidden = !open; opener.setAttribute('aria-expanded', String(open));
      if (open) { window.fixtureState.opens += 1; window.positionFixturePopup(); }
      else { window.fixtureState.closes += 1; if (restoreFocus) trigger.focus(); }
    };
    opener.addEventListener('click', () => {
      if (trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
      window.setFixturePopupOpen(popup.hidden);
    });
    popup.addEventListener('click', event => {
      const row = event.target.closest('[data-fixture-row]');
      if (!row) return;
      if (row.disabled || row.getAttribute('aria-disabled') === 'true' || row.hasAttribute('data-disabled')) { window.fixtureState.disabledClicks += 1; return; }
      window.fixtureState.selections += 1;
      window.setFixturePopupOpen(false, true);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !popup.hidden) { event.preventDefault(); window.setFixturePopupOpen(false, true); }
    });
    window.addEventListener('resize', () => { if (!popup.hidden) window.positionFixturePopup(); });
    window.setFixturePopupOpen(true);
  }, kind);
}

const VISUAL_PROPERTIES = ['backgroundColor', 'backgroundImage', 'boxShadow', 'color', 'borderRadius', 'borderTopColor', 'outlineColor', 'outlineStyle', 'outlineWidth', 'outlineOffset', 'backdropFilter', 'opacity', 'pointerEvents', 'display', 'visibility'];
async function visual(page, selector) {
  return page.locator(selector).evaluate((node, properties) => {
    const style = getComputedStyle(node);
    return Object.fromEntries(properties.map(property => [property, style[property]]));
  }, VISUAL_PROPERTIES);
}
async function geometry(page, selector = SELECTORS.popup) {
  return page.locator(selector).evaluate(node => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    const properties = ['position', 'left', 'top', 'transform', 'width', 'height', 'maxHeight', 'overflowX', 'overflowY', 'zIndex'];
    return { ...Object.fromEntries(properties.map(property => [property, style[property]])), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  });
}
async function tokenColor(page, token) {
  return page.evaluate(token => {
    const node = document.createElement('span');
    // Resolve the token itself, including system colors; do not let the probe's
    // text role remap Canvas to CanvasText in forced-colors mode.
    node.style.forcedColorAdjust = 'none'; node.style.color = `var(--prism-host-${token})`; document.body.append(node);
    const color = getComputedStyle(node).color; node.remove(); return color;
  }, token);
}
async function setMarker(page, marker) {
  await page.evaluate(marker => {
    if (marker) document.documentElement.dataset.prismHostAppearance = marker;
    else delete document.documentElement.dataset.prismHostAppearance;
  }, marker);
}
async function setSurface(page, kind, surface) {
  await page.evaluate(({ kind, surface }) => {
    const canvas = document.getElementById('fixture-canvas');
    canvas.classList.toggle('agy-home', kind === 'modern' && surface === 'home');
    if (kind === 'modern' && surface === 'home') canvas.removeAttribute('data-testid');
    else canvas.dataset.testid = 'conversation-view';
    document.getElementById('fixture-surface-label').textContent = `${surface === 'home' ? 'Home' : 'Conversation'} surface`;
  }, { kind, surface });
}
async function refreshTokenLabels(page) {
  await page.evaluate(() => {
    for (const label of document.querySelectorAll('[data-fixture-token]')) {
      label.textContent = getComputedStyle(document.documentElement).getPropertyValue(`--prism-host-${label.dataset.fixtureToken}`).trim().toUpperCase();
    }
  });
}
function rgbHex(color) {
  const match = color.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
  assert.ok(match, `Expected browser RGB color, received ${color}`);
  return `#${match.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}`;
}

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  let browser, page, sheet;
  const errors = [], requests = [], results = [];
  try {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      || (!fs.existsSync(chromium.executablePath()) && fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    page = await browser.newPage({ viewport: { width: 1120, height: 920 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    async function load(kind, palette, surface = 'home') {
      sheet = undefined;
      await page.setViewportSize({ width: 1120, height: 920 });
      await page.emulateMedia({ colorScheme: PALETTES[palette].type, reducedMotion: 'no-preference', forcedColors: 'none' });
      await page.setContent(buildFixtureHtml({ kind, palette, surface }));
      await initializeFixture(page, kind);
      await page.evaluate(value => { document.documentElement.dataset.prismHostPalette = value; }, palette);
      assert.equal(await page.locator('.fixture-caption').textContent(), CAPTION);
    }
    async function apply(kind, palette, overrides = {}) {
      if (sheet) await sheet.evaluate(node => node.remove());
      sheet = await page.addStyleTag({ content: generateHostAppearanceBundle({ ...DEFAULT_SETTINGS, ...overrides }) });
      await page.evaluate(value => { document.documentElement.dataset.prismHostPalette = value; }, palette);
      await setMarker(page, kind);
    }

    for (const kind of ['modern', 'legacy']) {
      for (const { id: palette } of THEMES) {
        const label = `${kind}/${palette}`;
        await load(kind, palette);
        const before = {};
        for (const key of ['canvas', 'composer', 'card', 'trigger', 'popup', 'disabled']) before[key] = await visual(page, SELECTORS[key]);
        const nativePopupGeometry = await geometry(page);
        const nativeIcons = await page.locator('[data-fixture-icon]').evaluateAll(nodes => nodes.map(node => node.outerHTML));
        const nativeMarkup = await page.locator(SELECTORS.composer).evaluate(node => node.innerHTML);
        sheet = await page.addStyleTag({ content: generateHostAppearanceBundle({ ...DEFAULT_SETTINGS }) });
        for (const marker of [null, 'unverified']) {
          await setMarker(page, marker);
          assert.deepEqual(await visual(page, SELECTORS.card), before.card, `${label}: unverified documents retain native card appearance`);
          assert.deepEqual(await visual(page, SELECTORS.popup), before.popup, `${label}: unverified documents retain native menu appearance`);
        }
        await setMarker(page, kind);
        await page.evaluate(() => { delete document.documentElement.dataset.prismHostPalette; });
        assert.deepEqual(await visual(page, SELECTORS.card), before.card, `${label}: the bundle also requires a verified per-window palette`);
        await page.evaluate(value => { document.documentElement.dataset.prismHostPalette = value; }, palette);
        for (const surface of ['home', 'conversation']) {
          await setSurface(page, kind, surface);
          const canvas = await visual(page, SELECTORS.canvas);
          assert.match(canvas.backgroundImage, /radial-gradient/, `${label}/${surface}: real generated aurora reaches this surface`);
          assert.match(canvas.backgroundImage, /repeating-linear-gradient/, `${label}/${surface}: texture is present`);
          assert.equal(canvas.backgroundColor, await tokenColor(page, 'canvas'));
        }
        const card = await visual(page, SELECTORS.card);
        assert.equal(card.backgroundColor, await tokenColor(page, 'card'), `${label}: composer uses its generated card token`);
        assert.match(card.backgroundImage, /linear-gradient/, `${label}: composer sheen is visible to Chromium`);
        assert.notEqual(card.backgroundColor, before.card.backgroundColor);
        const popup = await visual(page, SELECTORS.popup);
        assert.equal(popup.backgroundColor, await tokenColor(page, 'popup'), `${label}: portaled popup receives CSS`);
        assert.match(popup.backgroundImage, /linear-gradient/);
        assert.notEqual(popup.boxShadow, before.popup.boxShadow);
        assert.deepEqual(await geometry(page), nativePopupGeometry, `${label}: popup placement/size/transform/scroll contract unchanged`);
        assert.equal(await page.locator(SELECTORS.composer).evaluate(node => node.innerHTML), nativeMarkup, 'CSS does not replace existing content');
        assert.deepEqual(await page.locator('[data-fixture-icon]').evaluateAll(nodes => nodes.map(node => node.outerHTML)), nativeIcons);
        for (const icon of await page.locator('[data-fixture-icon]').all()) {
          assert.equal(await icon.isVisible(), true, `${label}: existing fixture icon remains visible`);
          assert.equal(await icon.evaluate(node => getComputedStyle(node).opacity), '1');
        }
        const disabled = await visual(page, SELECTORS.disabled);
        assert.equal(disabled.opacity, before.disabled.opacity, `${label}: native disabled opacity retained`);
        assert.equal(disabled.pointerEvents, before.disabled.pointerEvents);
        assert.equal(await page.locator(SELECTORS.disabled).isDisabled(), true);
        assert.equal(await page.locator('[data-fixture-inert-action]').isDisabled(), true);
        assert.equal(await page.locator('[data-fixture-icon="selection"]').count(), 1);
        if (kind === 'modern') {
          assert.equal((await visual(page, SELECTORS.selected)).color, await tokenColor(page, 'foreground'));
          assert.equal((await visual(page, SELECTORS.highlighted)).backgroundColor, await tokenColor(page, 'row-hover'));
          for (const id of ['model-selector-custom-item', 'model-selector-orchestrator']) {
            assert.equal((await visual(page, `[data-testid="${id}"]`)).color, await tokenColor(page, 'secondary'));
          }
          await page.locator('#fixture-effort-popup').evaluate(node => { node.hidden = false; });
          const effortGeometry = await geometry(page, '#fixture-effort-popup');
          assert.equal((await visual(page, '#fixture-effort-popup')).backgroundColor, await tokenColor(page, 'popup'));
          await setMarker(page, null);
          assert.deepEqual(await geometry(page, '#fixture-effort-popup'), effortGeometry, 'separate effort portal geometry is unchanged');
          await setMarker(page, kind);
          await page.locator('#fixture-effort-popup').evaluate(node => { node.hidden = true; });
        } else {
          assert.equal(await page.locator(SELECTORS.selected).getAttribute('data-autofocus'), 'true');
          assert.equal((await visual(page, SELECTORS.selected)).backgroundColor, await tokenColor(page, 'row-hover'));
        }

        // Real browser focus, hover and key events operate only minimal fixture handlers.
        await page.evaluate(() => window.setFixturePopupOpen(false));
        await page.mouse.move(8, 8);
        const closedPill = await visual(page, SELECTORS.trigger);
        assert.equal(closedPill.backgroundColor, await tokenColor(page, 'pill'));
        await page.locator(SELECTORS.trigger).evaluate(node => { node.setAttribute('aria-disabled', 'true'); node.style.opacity = '.5'; });
        await page.locator(SELECTORS.trigger).hover();
        assert.equal((await visual(page, SELECTORS.trigger)).backgroundColor, await tokenColor(page, 'pill'), `${label}: disabled model trigger does not pick up hover emphasis`);
        assert.equal((await visual(page, SELECTORS.trigger)).opacity, '0.5', `${label}: model trigger retains its fixture-provided disabled opacity`);
        assert.equal(await page.locator(SELECTORS.trigger).isDisabled(), true);
        await page.locator(SELECTORS.trigger).evaluate(node => { node.removeAttribute('aria-disabled'); node.style.removeProperty('opacity'); });
        await page.locator(SELECTORS.trigger).hover();
        assert.equal((await visual(page, SELECTORS.trigger)).backgroundColor, await tokenColor(page, 'pill-hover'));
        await page.mouse.move(8, 8);
        await page.locator(SELECTORS.editor).click();
        const focus = await visual(page, SELECTORS.composer);
        assert.equal(focus.outlineStyle, 'solid'); assert.equal(focus.outlineWidth, '1px');
        assert.equal(focus.outlineColor, await tokenColor(page, 'focus'));
        await page.locator(SELECTORS.editor).fill('Typing stays in the existing editable fixture.');
        assert.equal(await page.locator(SELECTORS.editor).textContent(), 'Typing stays in the existing editable fixture.');
        await page.locator(SELECTORS.editor).fill('');
        await page.locator(SELECTORS.trigger).focus();
        await page.locator(SELECTORS.trigger).press('Enter');
        assert.equal(await page.locator(SELECTORS.popup).isVisible(), true, `${label}: Enter opens the existing fixture popup`);
        assert.equal((await visual(page, SELECTORS.trigger)).backgroundColor, await tokenColor(page, 'pill-hover'), `${label}: expanded state is styled without requiring hover`);
        assert.equal((await visual(page, SELECTORS.trigger)).outlineWidth, '2px', `${label}: keyboard focus remains visible on the model pill`);
        const count = await page.evaluate(() => window.fixtureState.selections);
        await page.locator(SELECTORS.disabled).evaluate(node => node.click());
        assert.equal(await page.evaluate(() => window.fixtureState.selections), count, `${label}: disabled row does not select`);
        await page.locator(SELECTORS.highlighted).focus();
        await page.locator(SELECTORS.highlighted).press('Enter');
        assert.equal(await page.evaluate(() => window.fixtureState.selections), count + 1);
        assert.equal(await page.locator(SELECTORS.popup).isVisible(), false);
        assert.equal(await page.locator(SELECTORS.trigger).evaluate(node => node === document.activeElement), true);
        await page.locator(SELECTORS.trigger).press('Enter');
        await page.locator(SELECTORS.trigger).press('Escape');
        assert.equal(await page.locator(SELECTORS.popup).isVisible(), false, `${label}: Escape closes the existing fixture popup`);
        assert.equal(await page.locator(SELECTORS.trigger).evaluate(node => node === document.activeElement), true);
        await page.evaluate(() => { document.activeElement?.blur(); window.setFixturePopupOpen(true); });
        await setSurface(page, kind, ['warm', 'alabaster'].includes(palette) ? 'conversation' : 'home');
        await refreshTokenLabels(page);
        assert.deepEqual(await geometry(page), nativePopupGeometry, `${label}: interactions did not change popup geometry`);
        await page.screenshot({ path: path.join(artifacts, `chat-${kind}-${palette}.png`), fullPage: true, animations: 'disabled', caret: 'hide' });
        results.push({ kind, palette, screenshot: `chat-${kind}-${palette}.png`, realApplicationCapture: false });

        // A narrow structural fixture guards against our CSS introducing overflow.
        await page.setViewportSize({ width: 360, height: 900 });
        await page.evaluate(() => window.positionFixturePopup());
        const narrowGeometry = await geometry(page);
        await setMarker(page, null);
        assert.deepEqual(await geometry(page), narrowGeometry, `${label}: narrow menu geometry retained`);
        await setMarker(page, kind);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label}: no horizontal overflow introduced`);
        const triggerBounds = await page.locator(SELECTORS.trigger).boundingBox();
        assert.ok(triggerBounds && triggerBounds.width > 20 && triggerBounds.x >= 0 && triggerBounds.x + triggerBounds.width <= 360);
        const popupBounds = await page.locator(SELECTORS.popup).boundingBox();
        assert.ok(popupBounds && popupBounds.x >= 0 && popupBounds.x + popupBounds.width <= 360);
      }
    }

    // Preference isolation and accessibility checks on both sampled structures.
    for (const kind of ['modern', 'legacy']) {
      await load(kind, 'obsidian');
      const baseline = {};
      for (const key of ['canvas', 'composer', 'card', 'trigger', 'popup']) baseline[key] = await visual(page, SELECTORS[key]);
      await apply(kind, 'obsidian', { chatBackground: 'none', chatComposerStyle: 'native', chatModelStyle: 'native' });
      for (const key of Object.keys(baseline)) assert.deepEqual(await visual(page, SELECTORS[key]), baseline[key], `${kind}: all-native preferences preserve ${key}`);
      await apply(kind, 'obsidian', { chatComposerStyle: 'native', chatModelStyle: 'native' });
      assert.match((await visual(page, SELECTORS.canvas)).backgroundImage, /radial-gradient/);
      for (const key of ['composer', 'card', 'trigger', 'popup']) assert.deepEqual(await visual(page, SELECTORS[key]), baseline[key], `${kind}: background does not restyle native ${key}`);
      await apply(kind, 'obsidian', { chatBackgroundIntensity: 0, chatComposerStyle: 'native', chatModelStyle: 'native' });
      assert.deepEqual(await visual(page, SELECTORS.canvas), baseline.canvas);
      await apply(kind, 'obsidian', { chatBackground: 'none', chatModelStyle: 'native' });
      assert.deepEqual(await visual(page, SELECTORS.popup), baseline.popup);
      assert.equal((await visual(page, SELECTORS.trigger)).backgroundColor, baseline.trigger.backgroundColor);
      assert.notEqual((await visual(page, SELECTORS.card)).backgroundColor, baseline.card.backgroundColor);
      await apply(kind, 'obsidian', { chatBackground: 'none', chatComposerStyle: 'native' });
      assert.deepEqual(await visual(page, SELECTORS.card), baseline.card);
      assert.notEqual((await visual(page, SELECTORS.popup)).backgroundColor, baseline.popup.backgroundColor);
      await apply(kind, 'obsidian', { chatBackground: 'aurora' });
      assert.match((await visual(page, SELECTORS.canvas)).backgroundImage, /radial-gradient/);
      assert.doesNotMatch((await visual(page, SELECTORS.canvas)).backgroundImage, /repeating-linear-gradient/);
      const defaultFocus = await tokenColor(page, 'focus');
      await apply(kind, 'obsidian', { accent: 'custom', customAccent: '#DF63B5', chatBackgroundIntensity: 35 });
      assert.notEqual(await tokenColor(page, 'focus'), defaultFocus);
      const softBackground = (await visual(page, SELECTORS.canvas)).backgroundImage;
      await apply(kind, 'obsidian', { accent: 'custom', customAccent: '#DF63B5', chatBackgroundIntensity: 100 });
      assert.notEqual((await visual(page, SELECTORS.canvas)).backgroundImage, softBackground);

      await apply(kind, 'obsidian', { chatMotion: 'subtle' });
      assert.match(await page.locator('html').evaluate(node => getComputedStyle(node).animationName), /prism-host-aurora-drift/);
      assert.equal(await page.locator('.fixture-native-feedback').evaluate(node => getComputedStyle(node).animationName), 'fixture-native-spin');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).animationName), 'none');
      assert.match((await visual(page, SELECTORS.canvas)).backgroundImage, /radial-gradient/, 'reduced motion retains static background');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await apply(kind, 'obsidian', { chatMotion: 'off' });
      assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).animationName), 'none');
      assert.equal(await page.locator('.fixture-native-feedback').evaluate(node => getComputedStyle(node).animationName), 'fixture-native-spin');

      for (const { id: palette } of THEMES) {
        await load(kind, palette);
        await apply(kind, palette, { contrast: 'high', chatMotion: 'subtle' });
        const card = await visual(page, SELECTORS.card), popup = await visual(page, SELECTORS.popup);
        assert.equal((await visual(page, SELECTORS.canvas)).backgroundImage, 'none');
        assert.equal(card.backgroundImage, 'none'); assert.equal(popup.backgroundImage, 'none');
        assert.equal(popup.backdropFilter, 'none'); assert.equal(popup.boxShadow, 'none');
        assert.ok(contrastRatio(rgbHex(card.color), rgbHex(card.backgroundColor)) >= 7, `${kind}/${palette}: high-contrast card text`);
        assert.ok(contrastRatio(rgbHex(popup.borderTopColor), rgbHex(popup.backgroundColor)) >= 3, `${kind}/${palette}: high-contrast menu edge`);
        await apply(kind, palette);
        await page.emulateMedia({ forcedColors: 'active' });
        const forced = await visual(page, SELECTORS.card);
        assert.equal((await visual(page, SELECTORS.canvas)).backgroundImage, 'none');
        assert.equal(forced.backgroundImage, 'none');
        assert.equal(forced.backgroundColor, await tokenColor(page, 'card'));
        assert.equal(forced.color, await tokenColor(page, 'foreground'));
        assert.equal((await visual(page, SELECTORS.popup)).backdropFilter, 'none');
        assert.equal((await visual(page, SELECTORS.popup)).boxShadow, 'none');
        assert.equal(await page.locator('[data-fixture-icon="selection"]').isVisible(), true);
        await page.emulateMedia({ forcedColors: 'none' });
      }
    }
    assert.deepEqual(errors, [], 'no browser errors');
    assert.deepEqual(requests, [], 'generated CSS and fixture perform no network requests');
    fs.writeFileSync(path.join(artifacts, 'chat-fixture-report.json'), JSON.stringify({
      kind: 'synthetic-dom-css-verification', caption: CAPTION, realApplicationCapture: false,
      checks: ['computed CSS', 'home/conversation selectors', 'focus/hover/expanded', 'portaled menus', 'native geometry', 'existing controls/icons', 'fixture Enter/Escape handlers', '360px viewport', 'reduced motion', 'high contrast', 'forced colors', 'native/none settings'],
      screenshots: results,
    }, null, 2) + '\n');
    process.stdout.write(`Chat CSS fixture checks passed: ${results.length} palette/host pairs; 8 labeled screenshots in artifacts/. These are DOM fixtures, not host screenshots.\n`);
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'chat-fixture-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { buildFixtureHtml, CAPTION, SELECTORS };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
