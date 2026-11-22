/**
 * Palette values adapted from Obsidian Prism, Copyright (C) 2026 RMvdesi.
 * https://github.com/RMvdesi/obsidian-prism
 * Upstream: 5dac53bfa7cf917d40101dad2579f32dd1b1b587, style.css:30–100.
 * Modified 2026-11-21: extracted four palettes and added VS Code metadata and
 * syntax-category assignments for this independent port. GPL-3.0-only.
 * Preserve LICENSE, NOTICE, and THIRD_PARTY_NOTICES.md with redistributions.
 */

export type PaletteId = 'obsidian' | 'warm' | 'crystal' | 'alabaster';

export interface SyntaxPalette {
  keyword: string;
  function: string;
  type: string;
  number: string;
  string: string;
  variable: string;
  property: string;
  operator: string;
  regexp: string;
  tag: string;
  attribute: string;
}

export interface Palette {
  id: PaletteId;
  label: string;
  type: 'dark' | 'light';
  description: string;
  /** The editor/content canvas; Obsidian's outer shell is a different shade. */
  background: string;
  shell: string;
  sidebar: string;
  surface: string;
  secondary: string;
  mutedSurface: string;
  foreground: string;
  secondaryForeground: string;
  muted: string;
  placeholder: string;
  border: string;
  cardBorder: string;
  accent: string;
  link: string;
  error: string;
  warning: string;
  success: string;
  tonal: readonly [string, string, string, string, string];
  /** Newly assigned syntax roles, drawn from the upstream design palette. */
  syntax: SyntaxPalette;
}

export const UPSTREAM = Object.freeze({
  project: 'Obsidian Prism',
  author: 'RMvdesi',
  url: 'https://github.com/RMvdesi/obsidian-prism',
  commit: '5dac53bfa7cf917d40101dad2579f32dd1b1b587',
  version: '1.0.7-beta.1',
  license: 'GPL-3.0-only',
});

export const PALETTES: Readonly<Record<PaletteId, Palette>> = {
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian Prism — Obsidian Dark',
    type: 'dark',
    description: '深空黑曜 · Cool charcoal surfaces with a clear cobalt accent.',
    background: '#0E0E11', shell: '#0B0B0E', sidebar: '#09090B',
    surface: '#141418', secondary: '#1C1C22', mutedSurface: '#141418',
    foreground: '#F2F2F5', secondaryForeground: '#C4C4CE',
    muted: '#8A8A98', placeholder: '#626270',
    border: '#DAE4FF0D', cardBorder: '#DAE4FF11',
    accent: '#669DF6', link: '#8AB4F8',
    error: '#E5534B', warning: '#F2B84B', success: '#50A37B',
    tonal: ['#08090C', '#0D0F14', '#13161E', '#1A1E29', '#202534'],
    syntax: {
      keyword: '#A58AF8', function: '#58C4F6', type: '#E2B354',
      number: '#E59377', string: '#4CC39A', variable: '#F2F2F5',
      property: '#8AB4F8', operator: '#C4C4CE', regexp: '#5BC4BE',
      tag: '#669DF6', attribute: '#E2B354',
    },
  },
  warm: {
    id: 'warm',
    label: 'Obsidian Prism — Warm Charcoal',
    type: 'dark',
    description: '暖炭玄岩 · Warm charcoal, cream text, and terracotta accents.',
    background: '#141413', shell: '#141413', sidebar: '#10100F',
    surface: '#1B1A18', secondary: '#22201D', mutedSurface: '#1B1A18',
    foreground: '#F2EFE9', secondaryForeground: '#CEC8BC',
    muted: '#A39E93', placeholder: '#6E6A61',
    border: '#F5F0E60E', cardBorder: '#F5F0E614',
    accent: '#D97757', link: '#E59377',
    error: '#E5534B', warning: '#E5A93B', success: '#56A87E',
    tonal: ['#0E0D0C', '#141312', '#1B1917', '#23201D', '#2B2723'],
    syntax: {
      keyword: '#E59377', function: '#F6C2A8', type: '#E2B354',
      number: '#A58AF8', string: '#56A87E', variable: '#F2EFE9',
      property: '#7AA2D4', operator: '#CEC8BC', regexp: '#5BC4BE',
      tag: '#D97757', attribute: '#E2B354',
    },
  },
  crystal: {
    id: 'crystal',
    label: 'Obsidian Prism — Daylight Crystal',
    type: 'light',
    description: '白昼冷晶 · Cool slate-blue panels and a bright, clear canvas.',
    background: '#F4F7FB', shell: '#F4F7FB', sidebar: '#E8EEF6',
    surface: '#FFFFFF', secondary: '#E9EFF8', mutedSurface: '#ECF1F9',
    foreground: '#0F172A', secondaryForeground: '#334155',
    muted: '#5B6B82', placeholder: '#7C8CA5',
    border: '#0F172A1C', cardBorder: '#0F172A26',
    accent: '#2563EB', link: '#1D4ED8',
    error: '#DC2626', warning: '#D97706', success: '#059669',
    tonal: ['#E6EDF7', '#F4F7FB', '#FFFFFF', '#EDF3FB', '#FFFFFF'],
    syntax: {
      keyword: '#7C3AED', function: '#2563EB', type: '#D97706',
      number: '#B45309', string: '#059669', variable: '#0F172A',
      property: '#3B66A8', operator: '#334155', regexp: '#0D9488',
      tag: '#2563EB', attribute: '#D97706',
    },
  },
  alabaster: {
    id: 'alabaster',
    label: 'Obsidian Prism — Warm Alabaster',
    type: 'light',
    description: '暖白画册 · Warm paper, linen-colored panels, and clay accents.',
    background: '#F6F4EE', shell: '#F6F4EE', sidebar: '#EBE6DC',
    surface: '#FFFFFF', secondary: '#EFECE3', mutedSurface: '#F1EEE6',
    foreground: '#1C1814', secondaryForeground: '#3F3830',
    muted: '#6B6257', placeholder: '#8E8477',
    border: '#2A20141D', cardBorder: '#2A201428',
    accent: '#C25934', link: '#B54D28',
    error: '#DC2626', warning: '#D97706', success: '#15803D',
    tonal: ['#EAE4D8', '#F6F4EE', '#FFFFFF', '#F1ECE2', '#FFFFFF'],
    syntax: {
      keyword: '#B54D28', function: '#3B66A8', type: '#D97706',
      number: '#7C3AED', string: '#15803D', variable: '#1C1814',
      property: '#0D9488', operator: '#3F3830', regexp: '#0D9488',
      tag: '#C25934', attribute: '#B45309',
    },
  },
};

export interface ThemeMetadata {
  id: PaletteId;
  label: string;
  type: 'dark' | 'light';
  path: string;
  description: string;
}

export const THEMES: readonly ThemeMetadata[] = Object.values(PALETTES).map(
  ({ id, label, type, description }) => ({
    id, label, type, path: `./themes/${id}-color-theme.json`, description,
  }),
);
