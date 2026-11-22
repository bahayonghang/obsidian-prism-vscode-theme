/**
 * Independent VS Code adaptation of Obsidian Prism (RMvdesi).
 * Palette source: https://github.com/RMvdesi/obsidian-prism
 * Copyright (C) 2026 RMvdesi; VS Code mapping added 2026-11-21.
 * Modified for this port: native workbench, TextMate, semantic, and ANSI colors;
 * contrast-aware accent controls. GPL-3.0-only. See NOTICE and UPSTREAM.md.
 */
import { PALETTES, type PaletteId } from './palettes';

export interface ThemeOptions {
  accent: 'default' | 'cobalt' | 'iris' | 'amber' | 'mono' | 'custom';
  customAccent: string;
  contrast: 'standard' | 'high';
  sidebarSurface: 'layered' | 'unified' | 'tinted';
  inputBorder: 'subtle' | 'accent';
  italicComments: boolean;
  boldKeywords: boolean;
}

export const DEFAULT_THEME_OPTIONS: Readonly<ThemeOptions> = Object.freeze({
  accent: 'default', customAccent: '#A58AF8', contrast: 'standard',
  sidebarSurface: 'layered', inputBorder: 'subtle',
  italicComments: false, boldKeywords: false,
});

export interface TextMateRule {
  name: string;
  scope?: string | string[];
  settings: { foreground?: string; background?: string; fontStyle?: string };
}

export interface SemanticStyle {
  foreground?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface ColorTheme {
  $schema: string;
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
  tokenColors: TextMateRule[];
  semanticHighlighting: true;
  semanticTokenColors: Record<string, string | SemanticStyle>;
}

/** Accent controls accept opaque RGB only; alpha belongs to derived surfaces. */
export function normalizeHex(value: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim();
  if (/^#[\da-f]{6}$/i.test(hex)) return hex.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(hex)) {
    return `#${hex.slice(1).split('').map((part) => part + part).join('')}`.toUpperCase();
  }
  return undefined;
}

function rgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Expected an opaque hex color: ${hex}`);
  return [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number];
}

function hexFromRgb(channels: readonly number[]): string {
  return `#${channels.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Mix two opaque colors in sRGB; weight=0 keeps first, weight=1 keeps second. */
export function mix(first: string, second: string, weight: number): string {
  const a = rgb(first), b = rgb(second);
  const amount = Math.min(1, Math.max(0, weight));
  return hexFromRgb(a.map((channel, index) => channel + (b[index] - channel) * amount));
}

export function alpha(color: string, opacity: number): string {
  const normalized = normalizeHex(color);
  if (!normalized) throw new Error(`Expected an opaque hex color: ${color}`);
  return normalized + Math.round(Math.min(1, Math.max(0, opacity)) * 255).toString(16).padStart(2, '0').toUpperCase();
}

export function relativeLuminance(color: string): number {
  const [red, green, blue] = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Adjust only when needed, keeping the hue as close to the requested color as possible. */
export function ensureContrast(color: string, background: string, minimum = 4.5): string {
  const normalized = normalizeHex(color);
  if (!normalized) throw new Error(`Expected an opaque hex color: ${color}`);
  if (contrastRatio(normalized, background) >= minimum) return normalized;
  const target = contrastRatio('#000000', background) >= contrastRatio('#FFFFFF', background) ? '#000000' : '#FFFFFF';
  // A monotonic move toward the higher-contrast endpoint; final quantization is
  // included in the predicate, so 8-bit rounding cannot break the threshold.
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middle = (low + high) / 2;
    if (contrastRatio(mix(normalized, target, middle), background) >= minimum) high = middle;
    else low = middle;
  }
  return mix(normalized, target, high);
}

/** Shared host text is used on several nearby surfaces, including Antigravity chat. */
function readableOn(color: string, backgrounds: readonly string[], minimum: number): string {
  return backgrounds.reduce((value, background) => ensureContrast(value, background, minimum), color);
}

function buttonLabel(background: string): string {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#000000', background) ? '#FFFFFF' : '#000000';
}

const ACCENTS = {
  dark: { cobalt: '#669DF6', iris: '#A58AF8', amber: '#F2B84B', mono: '#D4D7E0' },
  light: { cobalt: '#2563EB', iris: '#7C3AED', amber: '#D97706', mono: '#334155' },
} as const;

const LINKS = {
  dark: { cobalt: '#8AB4F8', iris: '#BBA6FF', amber: '#F6CB75', mono: '#E2E5EE' },
  light: { cobalt: '#1D4ED8', iris: '#6D28D9', amber: '#B45309', mono: '#1E293B' },
} as const;

/** No filesystem, VS Code, or browser dependency: one source for build and runtime. */
export function createTheme(id: PaletteId, options: Partial<ThemeOptions> = {}): ColorTheme {
  const p = PALETTES[id];
  if (!p) throw new Error(`Unknown Obsidian Prism palette: ${id}`);
  const settings: ThemeOptions = { ...DEFAULT_THEME_OPTIONS, ...options };
  const high = settings.contrast === 'high';
  const dark = p.type === 'dark';
  const textRatio = high ? 7 : 4.5;
  const suppliedAccent = settings.accent;
  const namedAccent = suppliedAccent !== 'default' && suppliedAccent !== 'custom'
    && Object.prototype.hasOwnProperty.call(ACCENTS[p.type], suppliedAccent)
    ? suppliedAccent as keyof typeof ACCENTS.dark : undefined;
  const customAccent = suppliedAccent === 'custom' ? normalizeHex(settings.customAccent) : undefined;
  // Upstream "follow" uses its native palette accent. There is no agent/model
  // detection in a theme extension, so the four palette defaults remain stable.
  const accent = namedAccent ? ACCENTS[p.type][namedAccent] : customAccent ?? p.accent;
  const linkSource = namedAccent ? LINKS[p.type][namedAccent] : customAccent ?? p.link;
  const background = p.background;
  // Antigravity's bridge sources its conversation canvas from sideBar.*.
  // These are shared native keys: Explorer and other sidebars change too.
  const sidebar = settings.sidebarSurface === 'unified' ? background
    : settings.sidebarSurface === 'tinted' ? mix(p.sidebar, accent, dark ? 0.08 : 0.06)
      : p.sidebar;
  // The legacy 1.23.2 composer blends editor.background with a fixed gray.
  // Its outer gray frame is not controlled by input.border; see ANTIGRAVITY.md.
  const legacyInput = mix(background, '#6B7280', 0.10);
  const sharedSurfaces = [background, sidebar, p.surface, p.secondary, legacyInput];
  const foreground = readableOn(p.foreground, sharedSurfaces, textRatio);
  const muted = readableOn(p.muted, sharedSurfaces, textRatio);
  const surfaceForeground = ensureContrast(p.foreground, p.surface, textRatio);
  const surfaceMuted = ensureContrast(p.muted, p.surface, textRatio);
  const sidebarMuted = ensureContrast(p.muted, sidebar, textRatio);
  const focus = readableOn(accent, sharedSurfaces, 3);
  const accentText = readableOn(accent, sharedSurfaces, textRatio);
  const link = readableOn(linkSource, sharedSurfaces, textRatio);
  const surfaceLink = ensureContrast(linkSource, p.surface, textRatio);
  const border = high ? ensureContrast(p.muted, background, 3) : p.border;
  const cardBorder = high ? ensureContrast(p.muted, p.surface, 3) : p.cardBorder;
  const inputBorder = settings.inputBorder === 'accent' ? readableOn(accent, [p.surface, sidebar], 3) : cardBorder;
  const hover = mix(p.surface, p.foreground, dark ? 0.055 : 0.04);
  const selected = mix(sidebar, accent, dark ? 0.18 : 0.10);
  const selectedForeground = ensureContrast(p.foreground, selected, textRatio);
  const activeSurface = mix(p.surface, accent, dark ? 0.16 : 0.08);
  const activeForeground = ensureContrast(p.foreground, activeSurface, textRatio);
  const buttonForeground = buttonLabel(accent);
  const buttonHover = mix(accent, buttonForeground === '#FFFFFF' ? '#000000' : '#FFFFFF', 0.12);
  const warning = ensureContrast(p.warning, background, textRatio);
  const error = ensureContrast(p.error, background, textRatio);
  const success = ensureContrast(p.success, background, textRatio);
  const info = ensureContrast(dark ? '#669DF6' : '#2563EB', background, textRatio);
  const transparent = '#00000000';
  const colors: Record<string, string> = {
    'foreground': foreground,
    'descriptionForeground': muted,
    'disabledForeground': alpha(p.foreground, 0.42),
    'errorForeground': error,
    'focusBorder': focus,
    'icon.foreground': readableOn(p.secondaryForeground, sharedSurfaces, textRatio),
    'selection.background': alpha(accent, 0.25),
    'widget.border': cardBorder,
    'widget.shadow': dark ? '#00000066' : '#0F172A20',
    'sash.hoverBorder': accent,
    'window.activeBorder': border,
    'window.inactiveBorder': border,
    'textLink.foreground': link,
    'textLink.activeForeground': accentText,
    'textBlockQuote.background': alpha(accent, 0.05),
    'textBlockQuote.border': alpha(accent, 0.55),
    'textCodeBlock.background': p.surface,
    'textPreformat.foreground': ensureContrast(p.syntax.string, p.surface, textRatio),
    'textPreformat.background': p.surface,
    'textSeparator.foreground': border,
    'toolbar.hoverBackground': hover,
    'toolbar.activeBackground': activeSurface,
    'toolbar.hoverOutline': transparent,
    'button.background': accent,
    'button.foreground': buttonForeground,
    'button.hoverBackground': buttonHover,
    'button.border': high ? ensureContrast(accent, p.surface, 3) : transparent,
    'button.separator': alpha(buttonForeground, 0.35),
    'button.secondaryBackground': p.secondary,
    'button.secondaryForeground': ensureContrast(p.foreground, p.secondary, textRatio),
    'button.secondaryHoverBackground': mix(p.secondary, p.foreground, 0.06),
    'checkbox.background': p.surface,
    'checkbox.foreground': surfaceLink,
    'checkbox.border': cardBorder,
    'dropdown.background': p.surface,
    'dropdown.listBackground': p.surface,
    'dropdown.foreground': surfaceForeground,
    'dropdown.border': cardBorder,
    'input.background': p.surface,
    'input.foreground': surfaceForeground,
    'input.border': inputBorder,
    'input.placeholderForeground': surfaceMuted,
    'inputOption.activeBackground': activeSurface,
    'inputOption.activeForeground': activeForeground,
    'inputOption.activeBorder': ensureContrast(accent, activeSurface, 3),
    'inputOption.hoverBackground': hover,
    'inputValidation.errorBackground': mix(p.surface, p.error, 0.08),
    'inputValidation.errorForeground': ensureContrast(p.foreground, mix(p.surface, p.error, 0.08), textRatio),
    'inputValidation.errorBorder': ensureContrast(p.error, p.surface, 3),
    'inputValidation.warningBackground': mix(p.surface, p.warning, 0.08),
    'inputValidation.warningForeground': ensureContrast(p.foreground, mix(p.surface, p.warning, 0.08), textRatio),
    'inputValidation.warningBorder': ensureContrast(p.warning, p.surface, 3),
    'inputValidation.infoBackground': mix(p.surface, info, 0.08),
    'inputValidation.infoForeground': ensureContrast(p.foreground, mix(p.surface, info, 0.08), textRatio),
    'inputValidation.infoBorder': ensureContrast(info, p.surface, 3),
    'scrollbar.shadow': dark ? '#00000033' : '#0F172A0C',
    'scrollbarSlider.background': alpha(p.muted, 0.23),
    'scrollbarSlider.hoverBackground': alpha(p.muted, 0.38),
    'scrollbarSlider.activeBackground': alpha(p.muted, 0.52),
    'badge.background': accent,
    'badge.foreground': buttonForeground,
    'progressBar.background': accent,
    'list.activeSelectionBackground': selected,
    'list.activeSelectionForeground': selectedForeground,
    'list.activeSelectionIconForeground': selectedForeground,
    'list.inactiveSelectionBackground': mix(sidebar, p.foreground, 0.065),
    'list.inactiveSelectionForeground': ensureContrast(p.foreground, mix(sidebar, p.foreground, 0.065), textRatio),
    'list.inactiveSelectionIconForeground': p.secondaryForeground,
    'list.hoverBackground': hover,
    'list.hoverForeground': ensureContrast(p.foreground, hover, textRatio),
    'list.focusBackground': selected,
    'list.focusForeground': selectedForeground,
    'list.focusHighlightForeground': ensureContrast(accent, selected, textRatio),
    'list.highlightForeground': ensureContrast(accent, sidebar, textRatio),
    'list.focusOutline': focus,
    'list.inactiveFocusOutline': border,
    'list.dropBackground': alpha(accent, 0.16),
    'list.errorForeground': ensureContrast(p.error, sidebar, textRatio),
    'list.warningForeground': ensureContrast(p.warning, sidebar, textRatio),
    'list.deemphasizedForeground': sidebarMuted,
    'listFilterWidget.background': p.surface,
    'listFilterWidget.outline': accent,
    'listFilterWidget.noMatchesOutline': error,
    'list.filterMatchBackground': alpha(accent, 0.18),
    'list.filterMatchBorder': alpha(accent, 0.45),
    'tree.indentGuidesStroke': alpha(p.muted, high ? 0.65 : 0.25),
    'tree.inactiveIndentGuidesStroke': alpha(p.muted, high ? 0.40 : 0.12),
    'activityBar.background': sidebar,
    'activityBar.foreground': ensureContrast(accent, sidebar, textRatio),
    'activityBar.inactiveForeground': sidebarMuted,
    'activityBar.border': border,
    'activityBar.activeBorder': accent,
    'activityBar.activeFocusBorder': focus,
    'activityBar.activeBackground': alpha(accent, 0.08),
    'activityBarBadge.background': accent,
    'activityBarBadge.foreground': buttonForeground,
    'activityBarTop.foreground': accentText,
    'activityBarTop.inactiveForeground': muted,
    'activityBarTop.activeBorder': accent,
    'activityBarTop.dropBorder': accent,
    'sideBar.background': sidebar,
    'sideBar.foreground': ensureContrast(p.foreground, sidebar, textRatio),
    'sideBar.border': border,
    'sideBarTitle.foreground': ensureContrast(p.foreground, sidebar, textRatio),
    'sideBarSectionHeader.background': mix(sidebar, p.foreground, 0.025),
    'sideBarSectionHeader.foreground': ensureContrast(p.foreground, mix(sidebar, p.foreground, 0.025), textRatio),
    'sideBarSectionHeader.border': border,
    'sideBar.dropBackground': alpha(accent, 0.16),
    'editorGroup.border': border,
    'editorGroup.dropBackground': alpha(accent, 0.13),
    'editorGroupHeader.tabsBackground': p.shell,
    'editorGroupHeader.tabsBorder': border,
    'editorGroupHeader.noTabsBackground': background,
    'editorGroupHeader.border': border,
    'editorGroup.emptyBackground': background,
    'editorGroup.focusedEmptyBorder': focus,
    'tab.activeBackground': background,
    'tab.activeForeground': foreground,
    'tab.inactiveBackground': p.shell,
    'tab.inactiveForeground': ensureContrast(p.muted, p.shell, textRatio),
    'tab.border': border,
    'tab.activeBorder': background,
    'tab.activeBorderTop': accent,
    'tab.unfocusedActiveBorderTop': alpha(accent, 0.5),
    'tab.unfocusedActiveForeground': muted,
    'tab.unfocusedInactiveForeground': ensureContrast(p.muted, p.shell, textRatio),
    'tab.hoverBackground': hover,
    'tab.hoverForeground': ensureContrast(p.foreground, hover, textRatio),
    'tab.unfocusedHoverBackground': hover,
    'tab.activeModifiedBorder': warning,
    'tab.inactiveModifiedBorder': alpha(warning, 0.7),
    'tab.lastPinnedBorder': alpha(p.muted, 0.4),
    'editor.background': background,
    'editor.foreground': foreground,
    'editorLineNumber.foreground': muted,
    'editorLineNumber.activeForeground': foreground,
    'editorCursor.foreground': accentText,
    'editorCursor.background': background,
    'editor.selectionBackground': alpha(accent, dark ? 0.24 : 0.18),
    'editor.inactiveSelectionBackground': alpha(accent, dark ? 0.12 : 0.09),
    'editor.selectionHighlightBackground': alpha(accent, 0.09),
    'editor.selectionHighlightBorder': alpha(accent, 0.35),
    'editor.wordHighlightBackground': alpha(accent, 0.10),
    'editor.wordHighlightBorder': alpha(accent, 0.24),
    'editor.wordHighlightStrongBackground': alpha(accent, 0.16),
    'editor.wordHighlightStrongBorder': alpha(accent, 0.45),
    'editor.wordHighlightTextBackground': alpha(accent, 0.08),
    'editor.findMatchBackground': alpha(p.warning, 0.28),
    'editor.findMatchBorder': warning,
    'editor.findMatchHighlightBackground': alpha(p.warning, 0.16),
    'editor.findMatchHighlightBorder': alpha(warning, 0.4),
    'editor.findRangeHighlightBackground': alpha(accent, 0.07),
    'editor.hoverHighlightBackground': alpha(accent, 0.09),
    'editor.lineHighlightBackground': alpha(p.foreground, dark ? 0.035 : 0.025),
    'editor.lineHighlightBorder': transparent,
    'editor.rangeHighlightBackground': alpha(accent, 0.05),
    'editor.symbolHighlightBackground': alpha(accent, 0.10),
    'editorLink.activeForeground': link,
    'editorWhitespace.foreground': alpha(p.muted, 0.35),
    'editorIndentGuide.background1': alpha(p.muted, high ? 0.5 : 0.18),
    'editorIndentGuide.activeBackground1': alpha(accent, high ? 0.85 : 0.55),
    'editorRuler.foreground': alpha(p.muted, 0.18),
    'editorCodeLens.foreground': muted,
    'editorInlayHint.foreground': ensureContrast(p.muted, p.surface, textRatio),
    'editorInlayHint.background': alpha(p.muted, 0.08),
    'editorInlayHint.typeForeground': ensureContrast(p.syntax.type, p.surface, textRatio),
    'editorInlayHint.typeBackground': alpha(p.syntax.type, 0.06),
    'editorInlayHint.parameterForeground': ensureContrast(p.syntax.property, p.surface, textRatio),
    'editorInlayHint.parameterBackground': alpha(p.syntax.property, 0.06),
    'editorBracketMatch.background': alpha(accent, 0.12),
    'editorBracketMatch.border': alpha(accent, 0.6),
    'editorOverviewRuler.border': transparent,
    'editorOverviewRuler.findMatchForeground': alpha(warning, 0.65),
    'editorOverviewRuler.rangeHighlightForeground': alpha(accent, 0.5),
    'editorOverviewRuler.selectionHighlightForeground': alpha(accent, 0.55),
    'editorOverviewRuler.wordHighlightForeground': alpha(accent, 0.4),
    'editorOverviewRuler.wordHighlightStrongForeground': alpha(accent, 0.65),
    'editorOverviewRuler.modifiedForeground': alpha(info, 0.8),
    'editorOverviewRuler.addedForeground': alpha(success, 0.8),
    'editorOverviewRuler.deletedForeground': alpha(error, 0.8),
    'editorOverviewRuler.errorForeground': alpha(error, 0.8),
    'editorOverviewRuler.warningForeground': alpha(warning, 0.8),
    'editorOverviewRuler.infoForeground': alpha(info, 0.8),
    'editorError.foreground': error,
    'editorWarning.foreground': warning,
    'editorInfo.foreground': info,
    'editorHint.foreground': muted,
    'editorUnnecessaryCode.opacity': '#00000099',
    'editorGutter.background': background,
    'editorGutter.modifiedBackground': info,
    'editorGutter.addedBackground': success,
    'editorGutter.deletedBackground': error,
    'editorGutter.foldingControlForeground': muted,
    'editorWidget.background': p.surface,
    'editorWidget.foreground': surfaceForeground,
    'editorWidget.border': cardBorder,
    'editorWidget.resizeBorder': accent,
    'editorSuggestWidget.background': p.surface,
    'editorSuggestWidget.foreground': surfaceForeground,
    'editorSuggestWidget.border': cardBorder,
    'editorSuggestWidget.highlightForeground': surfaceLink,
    'editorSuggestWidget.selectedBackground': activeSurface,
    'editorSuggestWidget.selectedForeground': activeForeground,
    'editorSuggestWidget.selectedIconForeground': activeForeground,
    'editorSuggestWidget.focusHighlightForeground': ensureContrast(accent, activeSurface, textRatio),
    'editorHoverWidget.background': p.surface,
    'editorHoverWidget.foreground': surfaceForeground,
    'editorHoverWidget.border': cardBorder,
    'editorHoverWidget.statusBarBackground': p.secondary,
    'editorGhostText.foreground': alpha(muted, high ? 0.9 : 0.65),
    'debugExceptionWidget.background': p.surface,
    'debugExceptionWidget.border': error,
    'editorMarkerNavigation.background': p.surface,
    'editorMarkerNavigationError.background': error,
    'editorMarkerNavigationWarning.background': warning,
    'editorMarkerNavigationInfo.background': info,
    'diffEditor.insertedLineBackground': '#34A85316',
    'diffEditor.insertedTextBackground': '#34A85330',
    'diffEditor.removedLineBackground': '#EA433516',
    'diffEditor.removedTextBackground': '#EA433530',
    'diffEditor.diagonalFill': alpha(p.muted, 0.10),
    'diffEditor.border': border,
    'diffEditorGutter.insertedLineBackground': '#34A85326',
    'diffEditorGutter.removedLineBackground': '#EA433526',
    'diffEditor.unchangedRegionBackground': p.sidebar,
    'diffEditor.unchangedRegionForeground': sidebarMuted,
    'peekView.border': accent,
    'peekViewEditor.background': p.surface,
    'peekViewEditorGutter.background': p.surface,
    'peekViewEditor.matchHighlightBackground': alpha(p.warning, 0.2),
    'peekViewResult.background': p.sidebar,
    'peekViewResult.fileForeground': ensureContrast(p.foreground, p.sidebar, textRatio),
    'peekViewResult.lineForeground': sidebarMuted,
    'peekViewResult.matchHighlightBackground': alpha(p.warning, 0.2),
    'peekViewResult.selectionBackground': selected,
    'peekViewResult.selectionForeground': selectedForeground,
    'peekViewTitle.background': p.secondary,
    'peekViewTitleLabel.foreground': ensureContrast(p.foreground, p.secondary, textRatio),
    'peekViewTitleDescription.foreground': ensureContrast(p.muted, p.secondary, textRatio),
    'merge.currentHeaderBackground': alpha(p.success, 0.25),
    'merge.currentContentBackground': alpha(p.success, 0.08),
    'merge.incomingHeaderBackground': alpha(info, 0.25),
    'merge.incomingContentBackground': alpha(info, 0.08),
    'merge.commonHeaderBackground': alpha(p.muted, 0.25),
    'merge.commonContentBackground': alpha(p.muted, 0.08),
    'merge.border': border,
    'panel.background': p.shell,
    'panel.border': border,
    'panel.dropBorder': accent,
    'panelTitle.activeBorder': accent,
    'panelTitle.activeForeground': ensureContrast(p.foreground, p.shell, textRatio),
    'panelTitle.inactiveForeground': ensureContrast(p.muted, p.shell, textRatio),
    'panelSection.border': border,
    'panelSectionHeader.background': p.surface,
    'panelSectionHeader.foreground': surfaceForeground,
    'statusBar.background': p.sidebar,
    'statusBar.foreground': ensureContrast(p.foreground, p.sidebar, textRatio),
    'statusBar.border': border,
    'statusBar.noFolderBackground': p.sidebar,
    'statusBar.noFolderForeground': ensureContrast(p.foreground, p.sidebar, textRatio),
    'statusBar.debuggingBackground': accent,
    'statusBar.debuggingForeground': buttonForeground,
    'statusBar.debuggingBorder': border,
    'statusBarItem.hoverBackground': alpha(p.foreground, 0.08),
    'statusBarItem.activeBackground': alpha(p.foreground, 0.14),
    'statusBarItem.prominentBackground': alpha(accent, 0.15),
    'statusBarItem.prominentForeground': ensureContrast(p.foreground, mix(p.sidebar, accent, 0.15), textRatio),
    'statusBarItem.prominentHoverBackground': alpha(accent, 0.22),
    'statusBarItem.remoteBackground': accent,
    'statusBarItem.remoteForeground': buttonForeground,
    'statusBarItem.errorBackground': p.error,
    'statusBarItem.errorForeground': buttonLabel(p.error),
    'statusBarItem.warningBackground': p.warning,
    'statusBarItem.warningForeground': buttonLabel(p.warning),
    'titleBar.activeBackground': p.shell,
    'titleBar.activeForeground': ensureContrast(p.foreground, p.shell, textRatio),
    'titleBar.inactiveBackground': p.shell,
    'titleBar.inactiveForeground': ensureContrast(p.muted, p.shell, textRatio),
    'titleBar.border': border,
    'menubar.selectionBackground': hover,
    'menubar.selectionForeground': ensureContrast(p.foreground, hover, textRatio),
    'menu.background': p.surface,
    'menu.foreground': surfaceForeground,
    'menu.border': cardBorder,
    'menu.selectionBackground': activeSurface,
    'menu.selectionForeground': activeForeground,
    'menu.separatorBackground': cardBorder,
    'commandCenter.background': p.surface,
    'commandCenter.foreground': surfaceForeground,
    'commandCenter.border': cardBorder,
    'commandCenter.activeBackground': hover,
    'commandCenter.activeForeground': ensureContrast(p.foreground, hover, textRatio),
    'commandCenter.activeBorder': focus,
    'notificationCenter.border': cardBorder,
    'notificationCenterHeader.background': p.secondary,
    'notificationCenterHeader.foreground': ensureContrast(p.foreground, p.secondary, textRatio),
    'notificationToast.border': cardBorder,
    'notifications.background': p.surface,
    'notifications.foreground': surfaceForeground,
    'notifications.border': cardBorder,
    'notificationLink.foreground': surfaceLink,
    'notificationsErrorIcon.foreground': ensureContrast(p.error, p.surface, textRatio),
    'notificationsWarningIcon.foreground': ensureContrast(p.warning, p.surface, textRatio),
    'notificationsInfoIcon.foreground': ensureContrast(info, p.surface, textRatio),
    'quickInput.background': p.surface,
    'quickInput.foreground': surfaceForeground,
    'quickInputTitle.background': p.secondary,
    'quickInputList.focusBackground': activeSurface,
    'quickInputList.focusForeground': activeForeground,
    'quickInputList.focusIconForeground': activeForeground,
    'pickerGroup.foreground': surfaceLink,
    'pickerGroup.border': cardBorder,
    'terminal.background': background,
    'terminal.foreground': foreground,
    'terminal.border': border,
    'terminalCursor.foreground': accentText,
    'terminalCursor.background': background,
    'terminal.selectionBackground': alpha(accent, 0.24),
    'terminal.inactiveSelectionBackground': alpha(accent, 0.12),
    'terminal.findMatchBackground': alpha(p.warning, 0.28),
    'terminal.findMatchBorder': warning,
    'terminal.findMatchHighlightBackground': alpha(p.warning, 0.16),
    'terminal.tab.activeBorder': accent,
    'debugToolBar.background': p.surface,
    'debugToolBar.border': cardBorder,
    'debugIcon.startForeground': success,
    'debugIcon.pauseForeground': info,
    'debugIcon.stopForeground': error,
    'debugIcon.disconnectForeground': error,
    'debugIcon.restartForeground': success,
    'debugIcon.stepOverForeground': info,
    'debugIcon.stepIntoForeground': info,
    'debugIcon.stepOutForeground': info,
    'debugIcon.continueForeground': info,
    'editor.stackFrameHighlightBackground': alpha(p.warning, 0.12),
    'editor.focusedStackFrameHighlightBackground': alpha(p.success, 0.14),
    'gitDecoration.addedResourceForeground': ensureContrast(p.success, sidebar, textRatio),
    'gitDecoration.modifiedResourceForeground': ensureContrast(p.warning, sidebar, textRatio),
    'gitDecoration.deletedResourceForeground': ensureContrast(p.error, sidebar, textRatio),
    'gitDecoration.renamedResourceForeground': ensureContrast(info, sidebar, textRatio),
    'gitDecoration.untrackedResourceForeground': ensureContrast(p.success, sidebar, textRatio),
    'gitDecoration.ignoredResourceForeground': sidebarMuted,
    'gitDecoration.conflictingResourceForeground': ensureContrast(p.error, sidebar, textRatio),
    'settings.headerForeground': foreground,
    'settings.modifiedItemIndicator': accent,
    'settings.dropdownBackground': p.surface,
    'settings.dropdownForeground': surfaceForeground,
    'settings.dropdownBorder': cardBorder,
    'settings.checkboxBackground': p.surface,
    'settings.checkboxForeground': surfaceLink,
    'settings.checkboxBorder': cardBorder,
    'settings.textInputBackground': p.surface,
    'settings.textInputForeground': surfaceForeground,
    'settings.textInputBorder': cardBorder,
    'settings.numberInputBackground': p.surface,
    'settings.numberInputForeground': surfaceForeground,
    'settings.numberInputBorder': cardBorder,
    'settings.focusedRowBackground': alpha(accent, 0.035),
    'settings.rowHoverBackground': alpha(p.foreground, 0.025),
    'breadcrumb.background': background,
    'breadcrumb.foreground': muted,
    'breadcrumb.focusForeground': foreground,
    'breadcrumb.activeSelectionForeground': accentText,
    'breadcrumbPicker.background': p.surface,
    'minimap.findMatchHighlight': alpha(warning, 0.75),
    'minimap.selectionHighlight': alpha(accent, 0.5),
    'minimap.errorHighlight': error,
    'minimap.warningHighlight': warning,
    'minimap.background': background,
    'minimapSlider.background': alpha(p.muted, 0.12),
    'minimapSlider.hoverBackground': alpha(p.muted, 0.22),
    'minimapSlider.activeBackground': alpha(p.muted, 0.3),
    'minimapGutter.addedBackground': success,
    'minimapGutter.modifiedBackground': info,
    'minimapGutter.deletedBackground': error,
    'notebook.cellBorderColor': cardBorder,
    'notebook.cellEditorBackground': background,
    'notebook.cellHoverBackground': alpha(p.foreground, 0.025),
    'notebook.focusedCellBorder': accent,
    'notebook.focusedEditorBorder': focus,
    'notebook.selectedCellBackground': alpha(accent, 0.055),
    'notebook.selectedCellBorder': alpha(accent, 0.6),
    'notebook.outputContainerBackgroundColor': p.surface,
    'notebook.outputContainerBorderColor': cardBorder,
    'notebookStatusSuccessIcon.foreground': success,
    'notebookStatusErrorIcon.foreground': error,
    'notebookStatusRunningIcon.foreground': info,
    'testing.iconPassed': success,
    'testing.iconFailed': error,
    'testing.iconErrored': error,
    'testing.iconQueued': warning,
    'testing.iconUnset': muted,
    'testing.iconSkipped': muted,
    'charts.foreground': foreground,
    'charts.lines': border,
    'charts.red': error,
    'charts.blue': info,
    'charts.yellow': warning,
    'charts.green': success,
    'charts.purple': ensureContrast(p.syntax.keyword, background, 3),
    'charts.orange': ensureContrast(dark ? '#E59377' : '#B45309', background, 3),
    'welcomePage.background': background,
    'welcomePage.tileBackground': p.surface,
    'welcomePage.tileHoverBackground': hover,
    'welcomePage.tileBorder': cardBorder,
    'walkThrough.embeddedEditorBackground': p.surface,
  };

  if (high) {
    colors.contrastBorder = border;
    colors.contrastActiveBorder = focus;
  }

  const bracketColors = [p.syntax.type, p.syntax.keyword, p.syntax.function, p.syntax.number, p.syntax.string, p.syntax.property];
  bracketColors.forEach((color, index) => {
    const value = ensureContrast(color, background, textRatio);
    colors[`editorBracketHighlight.foreground${index + 1}`] = value;
    colors[`editorBracketPairGuide.background${index + 1}`] = alpha(value, high ? 0.45 : 0.18);
    colors[`editorBracketPairGuide.activeBackground${index + 1}`] = alpha(value, high ? 0.85 : 0.55);
  });
  colors['editorBracketHighlight.unexpectedBracket.foreground'] = error;

  // Preserve ANSI black/white roles; chromatic colors are adjusted for readability.
  const ansi: Record<string, string> = dark ? {
    Black: '#27272F', Red: '#E5534B', Green: '#50A37B', Yellow: '#E2B354',
    Blue: '#669DF6', Magenta: '#A58AF8', Cyan: '#58C4F6', White: '#C4C4CE',
    BrightBlack: '#8A8A98', BrightRed: '#F18078', BrightGreen: '#7BD4A4', BrightYellow: '#F6CB75',
    BrightBlue: '#8AB4F8', BrightMagenta: '#C4B5FD', BrightCyan: '#8CE0FF', BrightWhite: '#F2F2F5',
  } : {
    Black: '#1C1814', Red: '#B91C1C', Green: '#15803D', Yellow: '#B45309',
    Blue: '#2563EB', Magenta: '#7C3AED', Cyan: '#0F766E', White: '#D9DEE7',
    BrightBlack: '#5B6B82', BrightRed: '#DC2626', BrightGreen: '#15803D', BrightYellow: '#B45309',
    BrightBlue: '#1D4ED8', BrightMagenta: '#6D28D9', BrightCyan: '#0D746D', BrightWhite: '#FFFFFF',
  };
  for (const [key, value] of Object.entries(ansi)) {
    colors[`terminal.ansi${key}`] = /^(Black|White|BrightWhite)$/.test(key) ? value : ensureContrast(value, background, textRatio);
  }

  const syntax = { ...p.syntax };
  for (const key of Object.keys(syntax) as Array<keyof typeof syntax>) {
    syntax[key] = ensureContrast(syntax[key], background, textRatio);
  }
  const commentStyle = settings.italicComments ? 'italic' : '';
  const keywordStyle = settings.boldKeywords ? 'bold' : '';
  const tokenColors: TextMateRule[] = [
    { name: 'Default text', settings: { foreground, background } },
    { name: 'Comments', scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: muted, fontStyle: commentStyle } },
    { name: 'Documentation tags', scope: ['storage.type.class.jsdoc', 'entity.name.type.instance.jsdoc', 'keyword.other.documentation'], settings: { foreground: syntax.type, fontStyle: commentStyle } },
    { name: 'Keywords and storage', scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.other'], settings: { foreground: syntax.keyword, fontStyle: keywordStyle } },
    { name: 'Operators', scope: ['keyword.operator', 'punctuation.separator', 'punctuation.accessor'], settings: { foreground: syntax.operator, fontStyle: '' } },
    { name: 'Language constants and booleans', scope: ['constant.language', 'support.constant', 'variable.language'], settings: { foreground: syntax.keyword } },
    { name: 'Numbers', scope: ['constant.numeric'], settings: { foreground: syntax.number } },
    { name: 'Strings', scope: ['string', 'punctuation.definition.string'], settings: { foreground: syntax.string } },
    { name: 'Regular expressions', scope: ['string.regexp', 'constant.other.character-class.regexp'], settings: { foreground: syntax.regexp } },
    { name: 'Escapes and interpolation', scope: ['constant.character.escape', 'punctuation.definition.template-expression', 'punctuation.section.embedded'], settings: { foreground: syntax.number } },
    { name: 'Template expressions', scope: ['meta.template.expression', 'source.js.embedded', 'source.ts.embedded'], settings: { foreground } },
    { name: 'Functions and methods', scope: ['entity.name.function', 'support.function', 'meta.function-call', 'variable.function'], settings: { foreground: syntax.function } },
    { name: 'Types and classes', scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class', 'storage.type.cs'], settings: { foreground: syntax.type } },
    { name: 'Parameters', scope: ['variable.parameter', 'meta.parameter'], settings: { foreground: syntax.variable } },
    { name: 'Variables', scope: ['variable.other.readwrite', 'variable.other.object', 'variable.other'], settings: { foreground: syntax.variable } },
    { name: 'Properties and keys', scope: ['variable.other.property', 'variable.other.object.property', 'support.variable.property', 'meta.object-literal.key'], settings: { foreground: syntax.property } },
    { name: 'Constants', scope: ['variable.other.constant', 'constant.other', 'entity.name.constant'], settings: { foreground: syntax.number } },
    { name: 'Decorators and annotations', scope: ['meta.decorator', 'entity.name.function.decorator', 'punctuation.definition.annotation'], settings: { foreground: syntax.type } },
    { name: 'Python self and cls', scope: ['variable.language.special.self.python', 'variable.parameter.function.language.special.self.python', 'variable.language.special.cls.python'], settings: { foreground: syntax.keyword } },
    { name: 'Python docstrings', scope: ['string.quoted.docstring.multi.python'], settings: { foreground: muted, fontStyle: commentStyle } },
    { name: 'Python built-ins', scope: ['support.function.builtin.python', 'support.type.python'], settings: { foreground: syntax.function } },
    { name: 'HTML and JSX tags', scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: syntax.tag } },
    { name: 'HTML and JSX attributes', scope: ['entity.other.attribute-name', 'entity.other.attribute-name.jsx', 'entity.other.attribute-name.tsx'], settings: { foreground: syntax.attribute } },
    { name: 'CSS selectors', scope: ['entity.other.attribute-name.class.css', 'entity.other.attribute-name.id.css', 'entity.name.tag.css'], settings: { foreground: syntax.type } },
    { name: 'CSS properties', scope: ['support.type.property-name.css', 'support.type.property-name.scss'], settings: { foreground: syntax.property } },
    { name: 'JSON and YAML keys', scope: ['support.type.property-name.json', 'string.json support.type.property-name.json', 'entity.name.tag.yaml', 'meta.mapping.key.yaml'], settings: { foreground: syntax.property } },
    { name: 'JSON values', scope: ['string.quoted.double.json'], settings: { foreground: syntax.string } },
    { name: 'Markdown headings', scope: ['markup.heading', 'entity.name.section.markdown', 'punctuation.definition.heading.markdown'], settings: { foreground: syntax.function, fontStyle: 'bold' } },
    { name: 'Markdown bold', scope: ['markup.bold'], settings: { foreground, fontStyle: 'bold' } },
    { name: 'Markdown italic', scope: ['markup.italic'], settings: { foreground, fontStyle: 'italic' } },
    { name: 'Markdown strikethrough', scope: ['markup.strikethrough'], settings: { foreground: muted, fontStyle: 'strikethrough' } },
    { name: 'Markdown code', scope: ['markup.inline.raw', 'markup.fenced_code.block', 'markup.raw.block', 'punctuation.definition.raw.markdown'], settings: { foreground: syntax.string } },
    { name: 'Markdown link text', scope: ['string.other.link.title', 'string.other.link.description'], settings: { foreground: syntax.function } },
    { name: 'Markdown URLs', scope: ['markup.underline.link', 'markup.underline.link.image', 'punctuation.definition.metadata.markdown'], settings: { foreground: link, fontStyle: 'underline' } },
    { name: 'Markdown lists and quotes', scope: ['punctuation.definition.list.begin.markdown', 'markup.quote'], settings: { foreground: syntax.keyword } },
    { name: 'Diff inserted', scope: ['markup.inserted', 'punctuation.definition.inserted'], settings: { foreground: success } },
    { name: 'Diff deleted', scope: ['markup.deleted', 'punctuation.definition.deleted'], settings: { foreground: error } },
    { name: 'Diff changed', scope: ['markup.changed', 'meta.diff.header'], settings: { foreground: warning } },
    { name: 'Invalid syntax', scope: ['invalid.illegal', 'invalid.deprecated'], settings: { foreground: error, fontStyle: 'underline' } },
  ];

  const semanticTokenColors: ColorTheme['semanticTokenColors'] = {
    namespace: syntax.type,
    type: syntax.type,
    class: syntax.type,
    enum: syntax.type,
    interface: syntax.type,
    struct: syntax.type,
    typeParameter: syntax.type,
    parameter: syntax.variable,
    variable: syntax.variable,
    property: syntax.property,
    enumMember: syntax.number,
    decorator: syntax.type,
    event: syntax.property,
    function: syntax.function,
    method: syntax.function,
    macro: syntax.type,
    label: syntax.property,
    comment: { foreground: muted, italic: Boolean(settings.italicComments) },
    string: syntax.string,
    keyword: { foreground: syntax.keyword, bold: Boolean(settings.boldKeywords) },
    number: syntax.number,
    regexp: syntax.regexp,
    operator: syntax.operator,
    'variable.readonly': syntax.number,
    'property.readonly': syntax.number,
    'variable.defaultLibrary': syntax.keyword,
    'function.defaultLibrary': syntax.function,
    'method.defaultLibrary': syntax.function,
    '*.deprecated': { foreground: muted },
  };

  return {
    $schema: 'vscode://schemas/color-theme',
    name: p.label,
    type: p.type,
    colors,
    tokenColors,
    semanticHighlighting: true,
    semanticTokenColors,
  };
}
