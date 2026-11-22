/** Theme-only controls. New VS Code implementation, 2026-11-21. GPL-3.0-only. */
import type { PaletteId } from './palettes';
import { DEFAULT_THEME_OPTIONS, type ThemeOptions } from './theme';

export interface Settings extends ThemeOptions {
  codeFont: 'default' | 'jetbrains' | 'cascadia' | 'sfmono';
  ligatures: 'inherit' | 'on' | 'off';
  smoothCaret: 'inherit' | 'on' | 'off';
  smoothScrolling: 'inherit' | 'on' | 'off';
  cornerStyle: 'sharp' | 'balanced' | 'soft';
  ambientIntensity: 0 | 35 | 70 | 100;
  motion: 'off' | 'subtle' | 'standard' | 'ultra';
  language: 'auto' | 'zh-CN' | 'en';
  preferredDark: 'obsidian' | 'warm';
  preferredLight: 'crystal' | 'alabaster';
}

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_THEME_OPTIONS,
  codeFont: 'default', ligatures: 'inherit', smoothCaret: 'inherit', smoothScrolling: 'inherit',
  cornerStyle: 'balanced', ambientIntensity: 70, motion: 'standard', language: 'auto',
  preferredDark: 'obsidian', preferredLight: 'crystal',
};

type SettingDefinition = { type: 'string' | 'boolean' | 'number'; enum?: readonly (string | number)[]; pattern?: string; description: string; zh: string };
const onOff = ['inherit', 'on', 'off'] as const;
export const SETTING_DEFINITIONS: Record<keyof Settings, SettingDefinition> = {
  accent: { type: 'string', enum: ['default','cobalt','iris','amber','mono','custom'], description: 'Accent color for Prism themes. Default follows each palette.', zh: 'Prism 主题强调色。默认随各配色变化。' },
  customAccent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'Custom accent in #RRGGBB format. Used when Accent is Custom.', zh: '自定义强调色，格式为 #RRGGBB；强调色选择 Custom 时生效。' },
  contrast: { type: 'string', enum: ['standard','high'], description: 'Standard Prism borders or stronger borders and secondary text. Does not replace a VS Code High Contrast theme.', zh: '标准 Prism 边界或加强边界与次要文字对比度；不替代 VS Code 高对比主题。' },
  sidebarSurface: { type: 'string', enum: ['layered','unified','tinted'], description: 'Shared sidebar and Antigravity conversation canvas: Prism layers, editor-matched background, or a subtle accent tint. Also changes Explorer and Activity Bar; cannot isolate the chat sidebar.', zh: '侧栏与 Antigravity 对话共用底色：Prism 分层、与编辑区一致、或淡强调色。也影响资源管理器与活动栏，无法只隔离聊天侧栏。' },
  inputBorder: { type: 'string', enum: ['subtle','accent'], description: 'Shared native input border outside the Antigravity composer. Accent adds a visible focus-color outline. The inspected Antigravity clients derive their own composer frames and do not consume this color.', zh: 'Antigravity 聊天输入框之外的原生输入控件共用边框。Accent 使用清晰的强调色边线。已检查的 Antigravity 客户端自行生成聊天输入框外框，不使用此颜色。' },
  italicComments: { type: 'boolean', description: 'Use italic comments in Prism themes.', zh: '在 Prism 主题中使用斜体注释。' },
  boldKeywords: { type: 'boolean', description: 'Use bold keywords in Prism themes.', zh: '在 Prism 主题中使用粗体关键字。' },
  codeFont: { type: 'string', enum: ['default','jetbrains','cascadia','sfmono'], description: 'Font preference. Run Apply Editor Typography to apply globally. Default restores your previous font. Fonts are not downloaded.', zh: '字体偏好。运行“应用编辑器排版”后全局生效；Default 恢复原字体。不下载字体。' },
  ligatures: { type: 'string', enum: onOff, description: 'Ligature preference. Applied only by Apply Editor Typography; Inherit restores your previous value.', zh: '连字偏好。仅在“应用编辑器排版”后生效；Inherit 恢复原值。' },
  smoothCaret: { type: 'string', enum: onOff, description: 'Smooth cursor preference. Applied only by Apply Editor Typography.', zh: '平滑光标偏好。仅在“应用编辑器排版”后生效。' },
  smoothScrolling: { type: 'string', enum: onOff, description: 'Smooth editor scrolling preference. Applied only by Apply Editor Typography.', zh: '编辑器平滑滚动偏好。仅在“应用编辑器排版”后生效。' },
  cornerStyle: { type: 'string', enum: ['sharp','balanced','soft'], description: 'Corner style inside Theme Studio only. VS Code workbench corners remain native.', zh: '仅调整 Theme Studio 面板内的圆角，VS Code 主界面保留原生圆角。' },
  ambientIntensity: { type: 'number', enum: [0,35,70,100], description: 'Ambient glow intensity inside Theme Studio only.', zh: '仅调整 Theme Studio 面板内的环境光强度。' },
  motion: { type: 'string', enum: ['off','subtle','standard','ultra'], description: 'Motion inside Theme Studio only. System reduced-motion preferences take priority.', zh: '仅调整 Theme Studio 面板内的动效；优先遵循系统减少动态效果偏好。' },
  language: { type: 'string', enum: ['auto','zh-CN','en'], description: 'Theme Studio language. Auto follows VS Code; does not change the editor display language.', zh: 'Theme Studio 语言。Auto 跟随 VS Code，不修改编辑器显示语言。' },
  preferredDark: { type: 'string', enum: ['obsidian','warm'], description: 'Dark palette for Apply System Appearance. Saving this preference alone does not enable auto switching.', zh: '“应用系统明暗外观”使用的深色配色；仅保存偏好不会启用自动切换。' },
  preferredLight: { type: 'string', enum: ['crystal','alabaster'], description: 'Light palette for Apply System Appearance. Saving this preference alone does not enable auto switching.', zh: '“应用系统明暗外观”使用的浅色配色；仅保存偏好不会启用自动切换。' },
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
export const TYPOGRAPHY_KEYS = ['codeFont','ligatures','smoothCaret','smoothScrolling'] as const;
export const SYSTEM_KEYS = ['preferredDark','preferredLight'] as const;
export const FONT_STACKS: Record<Exclude<Settings['codeFont'], 'default'>, string> = {
  jetbrains: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
  cascadia: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', Consolas, monospace",
  sfmono: "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validateSettings(value: unknown): Partial<Settings> {
  if (!isRecord(value)) throw new Error('Settings must be an object. / 设置必须是对象。');
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!Object.hasOwn(SETTING_DEFINITIONS, key)) throw new Error(`Unknown setting: ${key}`);
    const definition = SETTING_DEFINITIONS[key as keyof Settings];
    if (typeof raw !== definition.type || (definition.enum && !definition.enum.includes(raw as string | number)) || (definition.pattern && !new RegExp(definition.pattern).test(raw as string))) {
      throw new Error(`Invalid value for ${key}. / 设置值无效：${key}`);
    }
    result[key] = key === 'customAccent' ? (raw as string).toUpperCase() : raw;
  }
  return result as Partial<Settings>;
}
/** Invalid settings edited manually fall back one key at a time. Imports instead fail atomically. */
export function normalizeSettings(value: Record<string, unknown>): Settings {
  const result = { ...DEFAULT_SETTINGS };
  for (const key of SETTING_KEYS) {
    try { Object.assign(result, validateSettings({ [key]: value[key] })); } catch { /* default */ }
  }
  return result;
}
export function isPaletteId(value: unknown): value is PaletteId {
  return value === 'obsidian' || value === 'warm' || value === 'crystal' || value === 'alabaster';
}
export interface SettingsExport { format: 'obsidian-prism-vscode-theme'; version: 1; settings: Settings }
export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ format: 'obsidian-prism-vscode-theme', version: 1, settings }, null, 2) + '\n';
}
export function parseSettings(text: string): Settings {
  if (new TextEncoder().encode(text).byteLength > 65536) throw new Error('Settings file exceeds 64 KiB. / 设置文件超过 64 KiB。');
  const data: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!isRecord(data) || data.format !== 'obsidian-prism-vscode-theme' || data.version !== 1 || Object.keys(data).some(k => !['format','version','settings'].includes(k))) {
    throw new Error('Not a supported Prism settings export. / 不支持的 Prism 设置文件。');
  }
  return { ...DEFAULT_SETTINGS, ...validateSettings(data.settings) };
}
