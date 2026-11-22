// Deterministic generated themes and extension contributions, from a shared source of truth.
const fs = require('node:fs');
const path = require('node:path');
const { THEMES } = require('../out/palettes.js');
const { createTheme } = require('../out/theme.js');
const { SETTING_DEFINITIONS, DEFAULT_SETTINGS } = require('../out/config.js');
const { THEME_MARKER_ID } = require('../out/theme-marker.js');
const root = path.resolve(__dirname, '..');
const writeJSON = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
fs.mkdirSync(path.join(root, 'themes'), { recursive: true });
for (const theme of THEMES) writeJSON(theme.path.replace(/^\.\//, ''), createTheme(theme.id));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const labels = {
  openSettings: ['Open Theme Studio', '打开主题工作室'],
  chooseLanguage: ['Choose Extension Language / 选择扩展语言', '选择扩展语言 / Choose Extension Language'],
  chooseTheme: ['Choose Color Theme', '选择配色主题'],
  openNativeSettings: ['Open Native Settings', '打开原生设置'],
  showCompatibilityReport: ['Show Antigravity Compatibility Report', '查看 Antigravity 兼容性报告'],
  enableChatAppearance: ['Enable Chat Appearance (Advanced)', '启用对话外观（高级）'],
  updateChatAppearance: ['Update Chat Appearance', '更新对话外观'],
  disableChatAppearance: ['Disable and Restore Chat Appearance', '停用并恢复对话外观'],
  applyTypography: ['Apply Editor Typography', '应用编辑器排版'],
  restoreTypography: ['Restore Editor Typography', '恢复编辑器排版'],
  applySystemAppearance: ['Apply System Appearance', '应用系统明暗外观'],
  restoreSystemAppearance: ['Restore System Appearance', '恢复系统明暗外观'],
  exportSettings: ['Export Settings', '导出设置'],
  importSettings: ['Import Settings', '导入设置'],
  resetCustomizations: ['Reset Customizations', '重置自定义设置'],
};
const en = {};
const zh = {};
en['color.themeMarker'] = 'Internal per-window Prism palette identity for the optional chat adapter. This is not a visible surface color.';
zh['color.themeMarker'] = '可选对话适配层使用的窗口级 Prism 配色标记，不用于可见界面颜色。';
manifest.contributes.colors = [{
  id: THEME_MARKER_ID, description: '%color.themeMarker%',
  defaults: { dark: '#00000000', light: '#00000000', highContrast: '#00000000', highContrastLight: '#00000000' },
}];
const bilingualLabel = (first, second) => first === second ? first : `${first} / ${second}`;
manifest.contributes.commands = Object.entries(labels).map(([key, values]) => {
  en[`command.${key}`] = values[0]; zh[`command.${key}`] = values[1];
  return { command: `obsidianPrism.${key}`, title: `%command.${key}%`, category: 'Obsidian Prism' };
});
// Manifest strings follow the IDE locale, not an extension preference. Keep native
// settings readable in either language while Theme Studio switches independently.
const definitions = Object.entries(SETTING_DEFINITIONS).sort(([a], [b]) => a === 'language' ? -1 : b === 'language' ? 1 : 0);
manifest.contributes.configuration.properties = Object.fromEntries(definitions.map(([key, { zh: chinese, description, enumLabels, ...schema }], order) => {
  en[`setting.${key}`] = `${description}\n\n${chinese}`;
  zh[`setting.${key}`] = `${chinese}\n\n${description}`;
  if (schema.enum && (!enumLabels || enumLabels.length !== schema.enum.length)) throw new Error(`Missing native option labels for ${key}`);
  if (enumLabels && !schema.enum) throw new Error(`Option labels require an enum for ${key}`);
  const enumItemLabels = enumLabels?.map(([english, chinese], index) => {
    const labelKey = `setting.${key}.option.${schema.enum[index]}`;
    en[labelKey] = bilingualLabel(english, chinese);
    zh[labelKey] = bilingualLabel(chinese, english);
    return `%${labelKey}%`;
  });
  return [`obsidianPrism.${key}`, { ...schema, ...(enumItemLabels ? { enumItemLabels } : {}), default: DEFAULT_SETTINGS[key], scope: 'application', order, markdownDescription: `%setting.${key}%` }];
}));
manifest.contributes.themes = THEMES.map(theme => ({ id: theme.label, label: theme.label, uiTheme: theme.type === 'light' ? 'vs' : 'vs-dark', path: theme.path }));
writeJSON('package.json', manifest);
writeJSON('package.nls.json', en);
writeJSON('package.nls.zh-cn.json', zh);
console.log(`Generated ${THEMES.length} themes and localized settings.`);
