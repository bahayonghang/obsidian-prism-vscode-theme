/** Theme-only controls. New VS Code implementation, 2026-11-21. GPL-3.0-only. */
import type { PaletteId } from './palettes';
import { DEFAULT_THEME_OPTIONS, type ThemeOptions } from './theme';

export interface Settings extends ThemeOptions {
  chatBackground: 'none' | 'aurora' | 'auroraTexture';
  chatBackgroundIntensity: 0 | 35 | 70 | 100;
  chatComposerStyle: 'native' | 'prism';
  chatModelStyle: 'native' | 'prism';
  chatMotion: 'off' | 'subtle';
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
  chatBackground: 'auroraTexture', chatBackgroundIntensity: 70,
  chatComposerStyle: 'prism', chatModelStyle: 'prism', chatMotion: 'off',
  codeFont: 'default', ligatures: 'inherit', smoothCaret: 'inherit', smoothScrolling: 'inherit',
  cornerStyle: 'balanced', ambientIntensity: 70, motion: 'standard', language: 'auto',
  preferredDark: 'obsidian', preferredLight: 'crystal',
};

type SettingDefinition = {
  type: 'string' | 'boolean' | 'number';
  enum?: readonly (string | number)[];
  /** Native Settings labels; values above remain the stable JSON/import contract. */
  enumLabels?: readonly (readonly [en: string, zh: string])[];
  pattern?: string;
  description: string;
  zh: string;
};
const onOff = ['inherit', 'on', 'off'] as const;
const onOffLabels = [['Keep previous setting', '保留原设置'], ['On', '开启'], ['Off', '关闭']] as const;
export const SETTING_DEFINITIONS: Record<keyof Settings, SettingDefinition> = {
  accent: { type: 'string', enum: ['default','cobalt','iris','amber','mono','custom'], enumLabels: [['Palette default', '随配色默认'], ['Cobalt', '钴蓝'], ['Iris', '鸢尾紫'], ['Amber', '琥珀'], ['Monochrome', '单色'], ['Custom', '自定义']], description: 'Accent color for Prism themes. Default follows each palette.', zh: 'Prism 主题强调色。默认随各配色变化。' },
  customAccent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'Custom accent in #RRGGBB format. Used when Accent is Custom.', zh: '自定义强调色，格式为 #RRGGBB；强调色选择 Custom 时生效。' },
  contrast: { type: 'string', enum: ['standard','high'], enumLabels: [['Standard', '标准'], ['Stronger borders and text', '加强边界与文字对比']], description: 'Standard Prism borders or stronger borders and secondary text. Does not replace a VS Code High Contrast theme.', zh: '标准 Prism 边界或加强边界与次要文字对比度；不替代 VS Code 高对比主题。' },
  sidebarSurface: { type: 'string', enum: ['layered','unified','tinted'], enumLabels: [['Prism layers', 'Prism 分层'], ['Match editor', '与编辑区一致'], ['Accent tint', '淡强调色']], description: 'Shared sidebar and Antigravity conversation canvas: Prism layers, editor-matched background, or a subtle accent tint. Also changes Explorer and Activity Bar; cannot isolate the chat sidebar.', zh: '侧栏与 Antigravity 对话共用底色：Prism 分层、与编辑区一致、或淡强调色。也影响资源管理器与活动栏，无法只隔离聊天侧栏。' },
  inputBorder: { type: 'string', enum: ['subtle','accent'], enumLabels: [['Subtle', '柔和边框'], ['Accent', '强调色边框']], description: 'Shared native input border outside the Antigravity composer. Accent adds a visible focus-color outline. The inspected Antigravity clients derive their own composer frames and do not consume this color.', zh: 'Antigravity 聊天输入框之外的原生输入控件共用边框。Accent 使用清晰的强调色边线。已检查的 Antigravity 客户端自行生成聊天输入框外框，不使用此颜色。' },
  chatBackground: { type: 'string', enum: ['none','aurora','auroraTexture'], enumLabels: [['None', '无背景效果'], ['Aurora', '极光'], ['Aurora with texture', '极光与纹理']], description: 'Background effect for the optional Antigravity chat appearance adapter. Requires the separate Enable Chat Appearance command; saving or importing this preference never enables the adapter.', zh: 'Antigravity 可选对话外观适配器的背景效果。仅在单独执行“启用对话外观”命令后生效；保存或导入此偏好不会启用适配器。' },
  chatBackgroundIntensity: { type: 'number', enum: [0,35,70,100], enumLabels: [['Off · 0%', '关闭 · 0%'], ['Soft · 35%', '轻柔 · 35%'], ['Balanced · 70%', '均衡 · 70%'], ['Full · 100%', '饱满 · 100%']], description: 'Background effect intensity for the optional Antigravity chat appearance adapter. Requires the separate Enable Chat Appearance command; saving or importing this preference never enables the adapter.', zh: 'Antigravity 可选对话外观适配器的背景效果强度。仅在单独执行“启用对话外观”命令后生效；保存或导入此偏好不会启用适配器。' },
  chatComposerStyle: { type: 'string', enum: ['native','prism'], enumLabels: [['Native', '保留原生样式'], ['Prism', 'Prism 样式']], description: 'Composer styling for the optional Antigravity chat appearance adapter. Native retains the host style. Requires the separate Enable Chat Appearance command; saving or importing this preference never enables the adapter.', zh: 'Antigravity 可选对话外观适配器的输入区样式；Native 保留宿主样式。仅在单独执行“启用对话外观”命令后生效；保存或导入此偏好不会启用适配器。' },
  chatModelStyle: { type: 'string', enum: ['native','prism'], enumLabels: [['Native', '保留原生样式'], ['Prism', 'Prism 样式']], description: 'Model selector styling for the optional Antigravity chat appearance adapter. Native retains the host style. Requires the separate Enable Chat Appearance command; saving or importing this preference never enables the adapter.', zh: 'Antigravity 可选对话外观适配器的模型选择器样式；Native 保留宿主样式。仅在单独执行“启用对话外观”命令后生效；保存或导入此偏好不会启用适配器。' },
  chatMotion: { type: 'string', enum: ['off','subtle'], enumLabels: [['Off', '关闭'], ['Subtle', '轻微']], description: 'Motion for the optional Antigravity chat appearance adapter. Off by default. Requires the separate Enable Chat Appearance command; saving or importing this preference never enables the adapter.', zh: 'Antigravity 可选对话外观适配器的动效，默认关闭。仅在单独执行“启用对话外观”命令后生效；保存或导入此偏好不会启用适配器。' },
  italicComments: { type: 'boolean', description: 'Use italic comments in Prism themes.', zh: '在 Prism 主题中使用斜体注释。' },
  boldKeywords: { type: 'boolean', description: 'Use bold keywords in Prism themes.', zh: '在 Prism 主题中使用粗体关键字。' },
  codeFont: { type: 'string', enum: ['default','jetbrains','cascadia','sfmono'], enumLabels: [['Keep editor font', '保留编辑器字体'], ['JetBrains Mono', 'JetBrains Mono'], ['Cascadia Code', 'Cascadia Code'], ['SF Mono', 'SF Mono']], description: 'Font preference. Run Apply Editor Typography to apply globally. Default restores your previous font. Fonts are not downloaded.', zh: '字体偏好。运行“应用编辑器排版”后全局生效；Default 恢复原字体。不下载字体。' },
  ligatures: { type: 'string', enum: onOff, enumLabels: onOffLabels, description: 'Ligature preference. Applied only by Apply Editor Typography; Inherit restores your previous value.', zh: '连字偏好。仅在“应用编辑器排版”后生效；Inherit 恢复原值。' },
  smoothCaret: { type: 'string', enum: onOff, enumLabels: onOffLabels, description: 'Smooth cursor preference. Applied only by Apply Editor Typography.', zh: '平滑光标偏好。仅在“应用编辑器排版”后生效。' },
  smoothScrolling: { type: 'string', enum: onOff, enumLabels: onOffLabels, description: 'Smooth editor scrolling preference. Applied only by Apply Editor Typography.', zh: '编辑器平滑滚动偏好。仅在“应用编辑器排版”后生效。' },
  cornerStyle: { type: 'string', enum: ['sharp','balanced','soft'], enumLabels: [['Sharp', '利落'], ['Balanced', '均衡'], ['Soft', '柔和']], description: 'Corner style inside Theme Studio only. VS Code workbench corners remain native.', zh: '仅调整 Theme Studio 面板内的圆角，VS Code 主界面保留原生圆角。' },
  ambientIntensity: { type: 'number', enum: [0,35,70,100], enumLabels: [['Off · 0%', '关闭 · 0%'], ['Soft · 35%', '轻柔 · 35%'], ['Balanced · 70%', '均衡 · 70%'], ['Full · 100%', '饱满 · 100%']], description: 'Ambient glow intensity inside Theme Studio only.', zh: '仅调整 Theme Studio 面板内的环境光强度。' },
  motion: { type: 'string', enum: ['off','subtle','standard','ultra'], enumLabels: [['Off', '关闭'], ['Subtle', '轻微'], ['Standard', '标准'], ['Expressive', '灵动']], description: 'Motion inside Theme Studio only. System reduced-motion preferences take priority.', zh: '仅调整 Theme Studio 面板内的动效；优先遵循系统减少动态效果偏好。' },
  language: { type: 'string', enum: ['auto','zh-CN','en'], enumLabels: [['Follow editor', '跟随编辑器'], ['Simplified Chinese', '简体中文'], ['English', '英语']], description: 'Language for Theme Studio, extension dialogs and reports. Auto follows the editor display language. Native Settings descriptions and choices stay bilingual; the IDE generates row headings from setting IDs. This does not change the IDE display language.', zh: 'Theme Studio、扩展对话框与报告的语言。自动模式跟随编辑器显示语言。原生设置的说明和选项始终提供中英双语，行标题由 IDE 根据设置键名生成。本选项不修改 IDE 的显示语言。' },
  preferredDark: { type: 'string', enum: ['obsidian','warm'], enumLabels: [['Obsidian Dark', '黑曜石深色'], ['Warm Charcoal', '暖炭灰']], description: 'Dark palette for Apply System Appearance. Saving this preference alone does not enable auto switching.', zh: '“应用系统明暗外观”使用的深色配色；仅保存偏好不会启用自动切换。' },
  preferredLight: { type: 'string', enum: ['crystal','alabaster'], enumLabels: [['Daylight Crystal', '日光水晶'], ['Warm Alabaster', '暖雪花石']], description: 'Light palette for Apply System Appearance. Saving this preference alone does not enable auto switching.', zh: '“应用系统明暗外观”使用的浅色配色；仅保存偏好不会启用自动切换。' },
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
/** Appearance preferences only. Enabling the adapter is a separate explicit action. */
export const CHAT_APPEARANCE_KEYS = ['chatBackground','chatBackgroundIntensity','chatComposerStyle','chatModelStyle','chatMotion'] as const;
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
