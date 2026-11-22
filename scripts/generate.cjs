// Deterministic generated themes and extension contributions, from a shared source of truth.
const fs = require('node:fs');
const path = require('node:path');
const { THEMES } = require('../out/palettes.js');
const { createTheme } = require('../out/theme.js');
const { SETTING_DEFINITIONS, DEFAULT_SETTINGS } = require('../out/config.js');
const root = path.resolve(__dirname, '..');
const writeJSON = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
fs.mkdirSync(path.join(root, 'themes'), { recursive: true });
for (const theme of THEMES) writeJSON(theme.path.replace(/^\.\//, ''), createTheme(theme.id));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const labels = {
  openSettings: ['Open Theme Studio', '打开主题工作室'],
  chooseTheme: ['Choose Color Theme', '选择配色主题'],
  openNativeSettings: ['Open Native Settings', '打开原生设置'],
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
manifest.contributes.commands = Object.entries(labels).map(([key, values]) => {
  en[`command.${key}`] = values[0]; zh[`command.${key}`] = values[1];
  return { command: `obsidianPrism.${key}`, title: `%command.${key}%`, category: 'Obsidian Prism' };
});
manifest.contributes.configuration.properties = Object.fromEntries(Object.entries(SETTING_DEFINITIONS).map(([key, { zh: chinese, description, ...schema }], order) => {
  en[`setting.${key}`] = description; zh[`setting.${key}`] = chinese;
  return [`obsidianPrism.${key}`, { ...schema, default: DEFAULT_SETTINGS[key], scope: 'application', order, markdownDescription: `%setting.${key}%` }];
}));
manifest.contributes.themes = THEMES.map(theme => ({ id: theme.label, label: theme.label, uiTheme: theme.type === 'light' ? 'vs' : 'vs-dark', path: theme.path }));
writeJSON('package.json', manifest);
writeJSON('package.nls.json', en);
writeJSON('package.nls.zh-cn.json', zh);
console.log(`Generated ${THEMES.length} themes and localized settings.`);
