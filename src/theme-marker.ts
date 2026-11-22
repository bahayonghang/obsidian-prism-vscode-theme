import type { PaletteId } from './palettes';

/** Public contributed color used only as per-window appearance metadata. */
export const THEME_MARKER_ID = 'obsidianPrism.themeMarker';
export const THEME_MARKER_CSS = '--vscode-obsidianPrism-themeMarker';
export const PRISM_THEME_MARKERS: Readonly<Record<PaletteId, string>> = Object.freeze({
  obsidian: '#505201', warm: '#505202', crystal: '#505203', alabaster: '#505204',
});
