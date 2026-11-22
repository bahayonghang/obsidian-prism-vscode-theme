/**
 * Optional appearance-only adaptation of Obsidian Prism, Copyright (C) 2026
 * RMvdesi. Independent CSS generator for Antigravity's existing UI, not a
 * replacement chat client. GPL-3.0-only; see NOTICE and UPSTREAM.md.
 *
 * Verified structures: CLI frontend 1.5.14 and IDE 1.23.2 workbench. Modern
 * model menus are portaled outside the composer. Legacy menus have no stable
 * test IDs, so their exact role/class combination is intentionally required.
 * Do not broaden these selectors to generic workbench buttons or dialogs.
 */
import type { Settings } from './config';
import { PALETTES, type PaletteId } from './palettes';
import { alpha, createTheme, ensureContrast, mix } from './theme';
import { PRISM_THEME_MARKERS } from './theme-marker';

const MODERN = 'html[data-prism-host-appearance="modern"]';
const LEGACY = 'html[data-prism-host-appearance="legacy"]';
const LEGACY_SIDEBAR = `${LEGACY} .antigravity-agent-side-panel`;
const INPUT_ID = '#antigravity\\.agentSidePanelInputBox';
const MODERN_COMPOSER = `${MODERN} ${INPUT_ID}.surface-composer`;
const LEGACY_COMPOSER = `${LEGACY_SIDEBAR} ${INPUT_ID}`;
const MODERN_MENU = `${MODERN} .agy-overlay:has([data-testid="model-selector-panel"])`;
// An effort submenu is a separate portal, not a descendant of the model menu.
const MODERN_EFFORT_MENU = `${MODERN} .agy-overlay:has([data-testid="model-selector-effort-option"])`;
const LEGACY_MENU = `${LEGACY} [role="dialog"][aria-modal="true"][class~="!w-64"][class~="!rounded-2xl"][class~="!overflow-hidden"][class~="!bg-ide-editor-background"]:has(> .max-h-80.bg-ide-chat-background)`;
const MODERN_TRIGGER = `${MODERN_COMPOSER} [data-testid="model-selector-trigger"]`;
// These fixed prefixes are present in the sampled legacy host; model names are
// neither read nor copied. Unknown/localized future structures simply retain
// their native model-button style.
const LEGACY_TRIGGER_SUFFIX = 'button:is([aria-label^="Select model, current:"], [aria-label^="Configure battle mode, comparing"])';
const LEGACY_TRIGGER = `${LEGACY_COMPOSER} ${LEGACY_TRIGGER_SUFFIX}`;
const ENABLED = ':not(:disabled):not([aria-disabled="true"]):not([data-disabled])';

const SPECTRUM: Record<PaletteId, readonly [string, string]> = {
  obsidian: ['#A58AF8', '#5BC4BE'],
  warm: ['#E2B354', '#A58AF8'],
  crystal: ['#7C3AED', '#0D9488'],
  alabaster: ['#D97706', '#3B66A8'],
};

function readableOn(color: string, backgrounds: readonly string[], minimum: number): string {
  return backgrounds.reduce((value, background) => ensureContrast(value, background, minimum), color);
}

function rule(selectors: readonly string[], declarations: string): string {
  return `${selectors.join(',\n')} {\n${declarations.trim().split('\n').map((line) => `  ${line.trim()}`).join('\n')}\n}\n`;
}

/** One installation shares preferences, but each frame chooses its own palette.
 * A non-Prism window must not clear another window's stylesheet. The loader
 * routes these blocks using the native per-window contributed color marker.
 */
export function generateHostAppearanceBundle(settings: Settings): string {
  return (Object.keys(PRISM_THEME_MARKERS) as PaletteId[]).map(palette => {
    const qualifier = `[data-prism-host-palette="${palette}"]`;
    return generateHostAppearanceCss(palette, settings)
      .replaceAll(MODERN, `${MODERN}${qualifier}`)
      .replaceAll(LEGACY, `${LEGACY}${qualifier}`);
  }).join('\n');
}

/**
 * Generate only local CSS. The separately enabled adapter supplies the exact
 * document marker after verifying a host; this module performs no I/O or DOM
 * inspection. Native / none settings omit the corresponding selectors.
 */
export function generateHostAppearanceCss(palette: PaletteId, settings: Settings): string {
  const p = PALETTES[palette];
  const theme = createTheme(palette, settings);
  const dark = theme.type === 'dark';
  const high = settings.contrast === 'high';
  const intensity = [0, 35, 70, 100].includes(settings.chatBackgroundIntensity)
    ? settings.chatBackgroundIntensity / 100 : 0;
  const backgroundEnabled = !high && intensity > 0
    && (settings.chatBackground === 'aurora' || settings.chatBackground === 'auroraTexture');
  const composerEnabled = settings.chatComposerStyle === 'prism';
  const modelEnabled = settings.chatModelStyle === 'prism';
  if (!backgroundEnabled && !composerEnabled && !modelEnabled) {
    return '/* Obsidian Prism host appearance: no overrides requested. */\n';
  }

  const canvas = theme.colors['sideBar.background'];
  const card = mix(p.surface, canvas, dark ? 0.14 : 0.035);
  const popup = mix(p.surface, p.secondary, dark ? 0.30 : 0.09);
  const pill = mix(card, p.secondary, dark ? 0.80 : 0.68);
  const accent = theme.colors['focusBorder'];
  const hover = mix(pill, accent, dark ? 0.13 : 0.09);
  const textSurfaces = [canvas, card, popup, pill, hover];
  const foreground = readableOn(p.foreground, textSurfaces, high ? 7 : 4.5);
  const secondary = readableOn(p.secondaryForeground, textSurfaces, high ? 7 : 4.5);
  const muted = readableOn(p.muted, [card, popup, pill], high ? 7 : 4.5);
  // A little margin above 3:1 accommodates the very light card sheen.
  const focus = readableOn(accent, textSurfaces, 3.3);
  const border = high ? readableOn(p.muted, textSurfaces, 3)
    : mix(card, foreground, dark ? 0.16 : 0.18);
  const highlight = palette === 'warm' || palette === 'alabaster' ? '#FFF8EC' : '#E8F0FF';
  const sheen = high ? 'none' : dark
    ? `linear-gradient(172deg, ${alpha(highlight, 0.065)} 0%, ${alpha(accent, 0.018)} 39%, ${alpha(canvas, 0.18)} 100%)`
    : `linear-gradient(176deg, ${alpha('#FFFFFF', 0.85)} 0%, ${alpha(mix(canvas, '#FFFFFF', 0.35), 0.42)} 100%)`;
  const popupSheen = high ? 'none'
    : `linear-gradient(165deg, ${alpha(highlight, dark ? 0.055 : 0.72)} 0%, ${alpha(accent, dark ? 0.015 : 0.025)} 45%, transparent 100%)`;
  const edge = high ? border
    : `linear-gradient(142deg, ${mix(card, foreground, dark ? 0.21 : 0.18)} 0%, ${mix(card, accent, dark ? 0.19 : 0.17)} 46%, ${mix(card, foreground, dark ? 0.10 : 0.12)} 100%)`;
  const activeEdge = high ? focus
    : `linear-gradient(142deg, ${mix(card, focus, 0.74)} 0%, ${mix(card, focus, 0.52)} 48%, ${mix(card, focus, 0.38)} 100%)`;
  const specular = high ? 'transparent' : alpha(highlight, dark ? 0.095 : 0.94);
  const cardShadow = high ? 'none' : dark
    ? `inset 0 1px 0 ${alpha(highlight, 0.045)}, 0 2px 5px #00000024, 0 18px 36px -18px #000000A3`
    : `inset 0 1px 0 #FFFFFFF0, 0 1px 3px ${alpha(p.foreground, 0.06)}, 0 14px 30px -18px ${alpha(p.foreground, 0.25)}`;
  const popupShadow = high ? 'none' : dark
    ? `inset 0 1px 0 ${alpha(highlight, 0.12)}, 0 4px 10px #00000030, 0 20px 46px -12px #000000A3`
    : `inset 0 1px 0 #FFFFFFF0, 0 1px 3px ${alpha(p.foreground, 0.08)}, 0 18px 38px -12px ${alpha(p.foreground, 0.14)}`;
  const pillShadow = `inset 0 0 0 1px ${border}${high ? '' : `, inset 0 1px 0 ${specular}, 0 2px 5px ${alpha('#000000', dark ? 0.10 : 0.035)}`}`;
  const canvasSelectors = [
    `${MODERN} .agy-home`,
    `${MODERN} [data-testid="conversation-view"]`,
    `${LEGACY_SIDEBAR} [data-testid="conversation-view"]`,
  ];
  const composers = [MODERN_COMPOSER, LEGACY_COMPOSER];
  const cards = [`${MODERN_COMPOSER} > .surface-composer-card`, `${LEGACY_COMPOSER} > .bg-input`];
  const triggers = [MODERN_TRIGGER, LEGACY_TRIGGER];
  const menus = [MODERN_MENU, MODERN_EFFORT_MENU, LEGACY_MENU];
  const modernRows = [
    `${MODERN_MENU} [data-testid="model-selector-item"]`,
    `${MODERN_MENU} [data-testid="model-selector-custom-item"]`,
    `${MODERN_MENU} [data-testid="model-selector-orchestrator"]`,
    `${MODERN_EFFORT_MENU} .agy-overlay-item:has([data-testid="model-selector-effort-option"])`,
  ];
  const legacyRows = [`${LEGACY_MENU} button[data-autofocus]`];
  const rows = [...modernRows, ...legacyRows];

  const css: string[] = ['/* Obsidian Prism — optional, scoped host appearance. GPL-3.0-only. */\n'];
  css.push(rule([MODERN, LEGACY], `
    --prism-host-canvas: ${canvas};
    --prism-host-foreground: ${foreground};
    --prism-host-secondary: ${secondary};
    --prism-host-muted: ${muted};
    --prism-host-card: ${high ? card : alpha(card, dark ? 0.975 : 0.985)};
    --prism-host-card-solid: ${card};
    --prism-host-border: ${border};
    --prism-host-focus: ${focus};
    --prism-host-pill: ${pill};
    --prism-host-pill-hover: ${hover};
    --prism-host-popup: ${high ? popup : alpha(popup, dark ? 0.965 : 0.975)};
    --prism-host-popup-solid: ${popup};
    --prism-host-row-hover: ${hover};
    --prism-host-row-hover-foreground: ${foreground};
    --prism-host-sheen: ${sheen};
    --prism-host-popup-sheen: ${popupSheen};
    --prism-host-edge: ${edge};
    --prism-host-active-edge: ${activeEdge};
    --prism-host-specular: ${specular};
    --prism-host-card-shadow: ${cardShadow};
    --prism-host-popup-shadow: ${popupShadow};
    --prism-host-pill-shadow: ${pillShadow};
    --prism-host-popup-filter: ${high ? 'none' : 'blur(12px) saturate(1.08)'};
    --prism-host-aurora-drift: 0%;
  `));

  if (backgroundEnabled) {
    const spectral = settings.accent === 'mono' ? [accent, accent]
      : settings.accent === 'default' ? SPECTRUM[palette]
        : SPECTRUM[palette].map((color) => mix(accent, color, 0.28));
    const a = (color: string, amount: number) => alpha(color, amount * intensity);
    const layers = [
      `radial-gradient(95% 52% at calc(8% + var(--prism-host-aurora-drift)) 106%, ${a(accent, dark ? 0.34 : 0.17)} 0%, ${a(accent, dark ? 0.11 : 0.045)} 42%, transparent 78%)`,
      `radial-gradient(75% 48% at calc(100% - var(--prism-host-aurora-drift)) 104%, ${a(spectral[0], dark ? 0.25 : 0.13)} 0%, transparent 77%)`,
      `radial-gradient(88% 32% at 48% 114%, ${a(spectral[1], dark ? 0.22 : 0.10)} 0%, transparent 86%)`,
      `radial-gradient(86% 40% at 96% -16%, ${a(accent, dark ? 0.075 : 0.055)} 0%, transparent 75%)`,
    ];
    const sizes = ['100% 100%', '100% 100%', '100% 100%', '100% 100%'];
    const repeats = ['no-repeat', 'no-repeat', 'no-repeat', 'no-repeat'];
    if (settings.chatBackground === 'auroraTexture') {
      // Fine local gradients create a restrained woven grain; no bitmap or URL.
      layers.unshift(`radial-gradient(circle at 1px 1px, ${a(foreground, dark ? 0.045 : 0.035)} 0.5px, transparent 0.8px)`,
        `repeating-linear-gradient(118deg, ${a(foreground, dark ? 0.018 : 0.012)} 0px, ${a(foreground, dark ? 0.018 : 0.012)} 0.5px, transparent 0.5px, transparent 7px)`);
      sizes.unshift('5px 5px', '100% 100%');
      repeats.unshift('repeat', 'repeat');
    }
    css.push(rule([MODERN, LEGACY], `--prism-host-background: ${layers.join(', ')};`));
    css.push(rule(canvasSelectors, `
      background-color: var(--prism-host-canvas) !important;
      background-image: var(--prism-host-background) !important;
      background-size: ${sizes.join(', ')} !important;
      background-repeat: ${repeats.join(', ')};
      background-attachment: scroll;
    `));
    // Motion changes only our inherited gradient coordinate. Animating an
    // existing chat element would replace its native fade/feedback animation.
    // No content, model status, busy state or chat events are observed.
    if (settings.chatMotion === 'subtle') {
      css.push(`@property --prism-host-aurora-drift {
  syntax: '<percentage>';
  inherits: true;
  initial-value: 0%;
}
@keyframes prism-host-aurora-drift {
  from { --prism-host-aurora-drift: 0%; }
  to { --prism-host-aurora-drift: 9%; }
}
@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {
${rule([MODERN, LEGACY], 'animation: prism-host-aurora-drift 28s ease-in-out infinite alternate;')}}
`);
    }
  }

  if (composerEnabled) {
    css.push(rule(composers, `
      background: var(--prism-host-edge) !important;
      box-shadow: var(--prism-host-card-shadow) !important;
    `));
    css.push(rule(cards, `
      background-color: var(--prism-host-card) !important;
      background-image: var(--prism-host-sheen) !important;
      color: var(--prism-host-foreground) !important;
      box-shadow: inset 0 1px 0 var(--prism-host-specular) !important;
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
    `));
    css.push(rule(composers.map((selector) => `${selector}:focus-within`), `
      background: var(--prism-host-active-edge) !important;
      outline: 1px solid var(--prism-host-focus) !important;
      outline-offset: 2px;
    `));
    css.push(rule(composers.map((selector) => `${selector} [contenteditable="true"]`), 'caret-color: var(--prism-host-focus);'));
  }

  if (modelEnabled) {
    css.push(rule(triggers, `
      color: var(--prism-host-secondary) !important;
      background-color: var(--prism-host-pill) !important;
      background-image: var(--prism-host-sheen) !important;
      border-radius: 999px !important;
      box-shadow: var(--prism-host-pill-shadow) !important;
    `));
    css.push(rule([
      ...triggers.map((selector) => `${selector}${ENABLED}:hover`),
      `${MODERN_TRIGGER}${ENABLED}[aria-expanded="true"]`,
      `${LEGACY_COMPOSER} [role="button"][aria-haspopup="dialog"][aria-expanded="true"] > ${LEGACY_TRIGGER_SUFFIX}${ENABLED}`,
    ], `
      background-color: var(--prism-host-pill-hover) !important;
      color: var(--prism-host-foreground) !important;
      box-shadow: inset 0 0 0 1px var(--prism-host-focus), inset 0 1px 0 var(--prism-host-specular) !important;
    `));
    css.push(rule(triggers.map((selector) => `${selector}:focus-visible`), `
      outline: 2px solid var(--prism-host-focus) !important;
      outline-offset: 2px;
    `));
    css.push(rule(menus, `
      background-color: var(--prism-host-popup) !important;
      background-image: var(--prism-host-popup-sheen) !important;
      color: var(--prism-host-foreground) !important;
      border-color: var(--prism-host-border) !important;
      box-shadow: var(--prism-host-popup-shadow) !important;
      -webkit-backdrop-filter: var(--prism-host-popup-filter) !important;
      backdrop-filter: var(--prism-host-popup-filter) !important;
    `));
    css.push(rule([
      `${MODERN_MENU} [data-testid="model-selector-panel"]`,
      `${LEGACY_MENU} > .max-h-80.bg-ide-chat-background`,
    ], `
      background-color: transparent !important;
      border-color: var(--prism-host-border) !important;
    `));
    css.push(rule([`${MODERN_MENU} [data-testid="model-selector-header"]`], 'color: var(--prism-host-muted) !important;'));
    css.push(rule(rows, 'color: var(--prism-host-secondary) !important;'));
    // The sampled modern renderer uses this class for its selected/highlighted
    // label and renders its own checkmark; retain that native distinction.
    css.push(rule(modernRows.map((selector) => `${selector}.text-foreground`), 'color: var(--prism-host-foreground) !important;'));
    css.push(rule([
      ...rows.map((selector) => `${selector}${ENABLED}:hover`),
      ...modernRows.map((selector) => `${selector}${ENABLED}[data-highlighted]`),
      ...legacyRows.map((selector) => `${selector}${ENABLED}[data-autofocus="true"]`),
    ], `
      background-color: var(--prism-host-row-hover) !important;
      color: var(--prism-host-row-hover-foreground) !important;
    `));
    css.push(rule(rows.map((selector) => `${selector}${ENABLED}:focus-visible`), `
      outline: 2px solid var(--prism-host-focus) !important;
      outline-offset: -2px;
    `));
    // Fixed popup placement, transforms, height limits, native menu selection
    // marks, disabled opacity, pointer events and overflow are left untouched.
    css.push(`@media (prefers-reduced-transparency: reduce) {
${rule(menus, `background-color: var(--prism-host-popup-solid) !important;
background-image: none !important;
-webkit-backdrop-filter: none !important;
backdrop-filter: none !important;`)}}
@supports not (backdrop-filter: blur(1px)) {
${rule(menus, 'background-color: var(--prism-host-popup-solid) !important;')}}
`);
  }

  if (composerEnabled) {
    css.push(`@media (prefers-reduced-transparency: reduce) {
${rule(cards, 'background-color: var(--prism-host-card-solid) !important;\nbackground-image: none !important;')}}\n`);
  }
  // Keep forced-colors in control. The variable override also reaches hover /
  // focus states with higher specificity, without suppressing native feedback.
  css.push(`@media (forced-colors: active) {
${rule([MODERN, LEGACY], `
--prism-host-canvas: Canvas;
--prism-host-foreground: CanvasText;
--prism-host-secondary: CanvasText;
--prism-host-muted: CanvasText;
--prism-host-card: Canvas;
--prism-host-card-solid: Canvas;
--prism-host-border: CanvasText;
--prism-host-focus: Highlight;
--prism-host-pill: ButtonFace;
--prism-host-pill-hover: ButtonFace;
--prism-host-popup: Canvas;
--prism-host-popup-solid: Canvas;
--prism-host-row-hover: Highlight;
--prism-host-row-hover-foreground: HighlightText;
--prism-host-background: none;
--prism-host-sheen: none;
--prism-host-popup-sheen: none;
--prism-host-edge: CanvasText;
--prism-host-active-edge: Highlight;
--prism-host-specular: transparent;
--prism-host-card-shadow: none;
--prism-host-popup-shadow: none;
--prism-host-pill-shadow: none;
--prism-host-popup-filter: none;`)}${modelEnabled ? rule(triggers, 'outline: 1px solid ButtonText;\noutline-offset: -1px;') : ''}}
`);
  return css.join('\n');
}
