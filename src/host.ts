/** Read-only host metadata and appearance diagnostics. GPL-3.0-only. */
import * as vscode from 'vscode';

export interface HostAppearanceInfo {
  appName: string;
  vscodeVersion: string;
  ideVersion?: string;
  bridgeVersion?: string;
  kind: 'antigravity-ide' | 'antigravity-extension' | 'vscode' | 'unknown';
  colorPath: 'bridge' | 'legacy' | 'unverified' | 'standard';
  /** Matches an inspected source sample; this is not a claim of visual validation. */
  referenceMatch: boolean;
}

export interface HostMetadata {
  appName: unknown;
  vscodeVersion: unknown;
  ideVersion?: unknown;
  bridgeVersion?: unknown;
  bridgeInstalled?: boolean;
}

export const PRODUCT_METADATA_LIMIT = 256 * 1024;
const BRIDGE_ID = 'google.google-antigravity';
const KNOWN_BRIDGES = new Set(['1.12.0', '1.13.0']);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const label = (value: unknown, fallback: string): string => typeof value === 'string'
  ? value.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim().slice(0, 160) || fallback : fallback;
function version(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 80 && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value) ? value : undefined;
}
const isAntigravity = (appName: string) => /^Antigravity(?: IDE)?(?: - (?:Insiders|Exploration))?$/i.test(appName);
const isVSCode = (appName: string) => /^(?:Visual Studio Code|VS Code|Code(?: - OSS)?)(?: - (?:Insiders|Exploration))?$/i.test(appName);

/** Classify only observed contracts; VS Code's engine version is never an IDE version. */
export function classifyHostAppearance(metadata: HostMetadata): HostAppearanceInfo {
  const appName = label(metadata.appName, 'Unknown');
  const vscodeVersion = version(metadata.vscodeVersion) ?? 'unknown';
  const ideVersion = isAntigravity(appName) ? version(metadata.ideVersion) : undefined;
  const bridgeVersion = version(metadata.bridgeVersion);
  const bridgeInstalled = metadata.bridgeInstalled === true || bridgeVersion !== undefined;
  const kind: HostAppearanceInfo['kind'] = isAntigravity(appName) ? 'antigravity-ide'
    : bridgeInstalled ? 'antigravity-extension' : isVSCode(appName) ? 'vscode' : 'unknown';
  let colorPath: HostAppearanceInfo['colorPath'] = kind === 'vscode' ? 'standard' : 'unverified';
  let referenceMatch = false;
  if (bridgeVersion && KNOWN_BRIDGES.has(bridgeVersion)) {
    colorPath = 'bridge';
    referenceMatch = kind === 'antigravity-ide'
      ? ideVersion === '2.8.0' && bridgeVersion === '1.12.0'
      : isVSCode(appName) && bridgeVersion === '1.13.0';
  } else if (kind === 'antigravity-ide' && ideVersion === '1.23.2' && !bridgeInstalled) {
    colorPath = 'legacy';
    referenceMatch = true;
  }
  return { appName, vscodeVersion, ...(ideVersion ? { ideVersion } : {}), ...(bridgeVersion ? { bridgeVersion } : {}), kind, colorPath, referenceMatch };
}

/** Product metadata contains many unrelated fields. Extract only its actual ideVersion. */
export function parseProductIdeVersion(bytes: Uint8Array): string | undefined {
  if (bytes.byteLength > PRODUCT_METADATA_LIMIT) return undefined;
  try {
    const product: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''));
    return isRecord(product) ? version(product.ideVersion) : undefined;
  } catch { return undefined; }
}

/** No extension activation, external requests, installation changes, or chat access. */
export async function detectHostAppearance(): Promise<HostAppearanceInfo> {
  const appName = vscode.env.appName;
  let ideVersion: string | undefined;
  let bridgeInstalled = false;
  let bridgeLookupFailed = false;
  let bridgeVersion: unknown;
  try {
    const bridge = vscode.extensions.getExtension(BRIDGE_ID);
    bridgeInstalled = bridge !== undefined;
    bridgeVersion = bridge?.packageJSON?.version;
  } catch { bridgeLookupFailed = true; }
  if (isAntigravity(label(appName, 'Unknown')) && vscode.env.appRoot) {
    try {
      // Never use a workspace path or scan the installation. This is the only file read.
      const uri = vscode.Uri.joinPath(vscode.Uri.file(vscode.env.appRoot), 'product.json');
      const stat = await vscode.workspace.fs.stat(uri);
      if ((stat.type & vscode.FileType.File) !== 0 && Number.isSafeInteger(stat.size) && stat.size >= 0 && stat.size <= PRODUCT_METADATA_LIMIT) {
        ideVersion = parseProductIdeVersion(await vscode.workspace.fs.readFile(uri));
      }
    } catch { /* Browser hosts and restricted installations may not expose product.json. */ }
  }
  const info = classifyHostAppearance({ appName, vscodeVersion: vscode.version, ideVersion, bridgeInstalled, bridgeVersion });
  return bridgeLookupFailed ? { ...info, colorPath: 'unverified', referenceMatch: false } : info;
}

/** Only native appearance keys can enter diagnostics; never dump arbitrary user settings. */
export const APPEARANCE_DIAGNOSTIC_KEYS = [
  'foreground', 'descriptionForeground', 'disabledForeground', 'focusBorder', 'icon.foreground',
  'editor.background', 'editor.foreground', 'editorWidget.background', 'editorWidget.foreground', 'editorWidget.border',
  'sideBar.background', 'sideBar.foreground', 'sideBar.border', 'sideBarTitle.foreground',
  'sideBarSectionHeader.background', 'sideBarSectionHeader.foreground', 'sideBarSectionHeader.border',
  'input.background', 'input.foreground', 'input.border', 'input.placeholderForeground',
  'button.background', 'button.foreground', 'button.hoverBackground', 'button.border',
  'button.secondaryBackground', 'button.secondaryForeground', 'button.secondaryHoverBackground',
  'dropdown.background', 'dropdown.foreground', 'dropdown.border', 'dropdown.listBackground',
  'toolbar.hoverBackground', 'toolbar.activeBackground', 'list.hoverBackground',
  'textLink.foreground', 'textLink.activeForeground', 'textCodeBlock.background',
  'textPreformat.foreground', 'textPreformat.background', 'widget.border', 'widget.shadow',
  'badge.background', 'badge.foreground',
] as const;

function themeScopeMatches(scope: string, activeTheme: string): boolean {
  if (scope.length > 1024 || !/^(?:\[[^\]]+\])+$/.test(scope)) return false;
  return [...scope.matchAll(/\[([^\]]+)\]/g)].some((match) => {
    const pattern = match[1].split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${pattern}$`).test(activeTheme);
  });
}
function colorEntries(value: unknown): Record<string, string | null> {
  if (!isRecord(value)) return {};
  const entries: Record<string, string | null> = {};
  for (const key of APPEARANCE_DIAGNOSTIC_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const color = value[key];
    if (color === null || color === 'default' || (typeof color === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color))) entries[key] = color;
  }
  return entries;
}

export interface CompatibilityReportContext {
  language: 'zh-CN' | 'en';
  activeTheme: string;
  colorCustomizations: unknown;
}

export function formatCompatibilityReport(host: HostAppearanceInfo, context: CompatibilityReportContext): string {
  const zh = context.language === 'zh-CN';
  const tr = (en: string, cn: string) => zh ? cn : en;
  const activeTheme = label(context.activeTheme, tr('(not reported)', '（未读取）'));
  const customizations: Record<string, unknown> = colorEntries(context.colorCustomizations);
  if (isRecord(context.colorCustomizations)) {
    for (const [scope, values] of Object.entries(context.colorCustomizations)) {
      if (!themeScopeMatches(scope, context.activeTheme)) continue;
      const colors = colorEntries(values);
      if (Object.keys(colors).length) customizations[scope] = colors;
    }
  }
  const pathLabels: Record<HostAppearanceInfo['colorPath'], string> = {
    bridge: tr('Google extension theme bridge', 'Google 扩展的主题桥接'),
    legacy: tr('Legacy IDE chat using shared native colors', '旧版 IDE 对话区使用共享原生颜色'),
    standard: tr('Standard VS Code native themes', '标准 VS Code 原生主题'),
    unverified: tr('Unverified appearance implementation', '尚未核实的外观实现'),
  };
  return [
    tr('Obsidian Prism — Appearance Compatibility Report', 'Obsidian Prism — 外观兼容性报告'),
    '',
    `${tr('Application', '应用')}: ${host.appName}`,
    `${tr('Host kind', '宿主类型')}: ${host.kind}`,
    `${tr('VS Code engine version (not the Antigravity IDE version)', 'VS Code 引擎版本（不是 Antigravity IDE 版本）')}: ${host.vscodeVersion}`,
    `${tr('Antigravity IDE version', 'Antigravity IDE 版本')}: ${host.ideVersion ?? tr('(unavailable or not applicable)', '（无法读取或不适用）')}`,
    `${tr('Google Antigravity extension version', 'Google Antigravity 扩展版本')}: ${host.bridgeVersion ?? tr('(not detected or unavailable)', '（未检测到或无法读取）')}`,
    `${tr('Appearance path', '外观路径')}: ${pathLabels[host.colorPath]} (${host.colorPath})`,
    `${tr('Source reference match', '源码样本匹配')}: ${host.referenceMatch ? tr('yes', '是') : tr('no', '否')}`,
    `${tr('Active color theme', '当前配色主题')}: ${activeTheme}`,
    '',
    tr('Evidence and scope', '依据与范围'),
    tr('- Source-inspected references: Antigravity IDE 1.23.2 (legacy), IDE 2.8.0 with bundled Google 1.12.0, and the Google 1.13.0 extension package (bridge).', '- 已检查源码的样本：Antigravity IDE 1.23.2（旧版）、IDE 2.8.0 内置 Google 1.12.0，以及 Google 1.13.0 扩展包（桥接）。'),
    tr('- A source reference match is not visual testing of this installation. Other host versions or combinations remain unverified; a known bridge can be identified independently of the IDE version.', '- 命中源码样本不代表本机界面已经过视觉验收。其他宿主版本或组合仍需核实；已知主题桥接可以独立于 IDE 版本识别。'),
    tr('- The modern composer color model was inspected in the CLI 1.5.14 frontend. The Google client can update independently; this extension does not read or launch its backend to infer a client version.', '- 新版聊天输入框颜色模型取自 CLI 1.5.14 前端。Google 客户端可独立更新；本扩展不会读取或启动其后台来推测客户端版本。'),
    tr('- Native color support depends on which keys the host consumes. Fixed colors, logo artwork, layout, corners and motion remain controlled by the host.', '- 原生颜色能否生效取决于宿主使用哪些键；写死的颜色、标志图形、布局、圆角与动效仍由宿主控制。'),
    tr('- sidebarSurface uses shared native sidebar colors and also changes Explorer and Activity Bar. inputBorder changes native input controls only; neither the inspected modern nor legacy Antigravity composer consumes it.', '- sidebarSurface 使用共享原生侧栏颜色，也会改变资源管理器和活动栏。inputBorder 仅改变原生输入控件；已检查的新版与旧版 Antigravity 聊天输入框均不使用它。'),
    tr('- The inspected modern frontend derives its composer card and frame from sidebar canvas/foreground colors. Forwarding input.* through the Google bridge does not mean the composer uses those keys.', '- 已检查的新版前端从侧栏底色与前景色派生聊天输入框的卡片与外框颜色。Google 桥接转发 input.*，不等于聊天输入框会使用这些键。'),
    tr('- In the inspected legacy IDE, the composer fill blends 90% editor.background with 10% fixed #6B7280; its outer frame uses 20% fixed gray. inputBorder does not change that legacy composer frame.', '- 已检查的旧版 IDE 中，输入框底色混合 90% editor.background 与 10% 固定 #6B7280；外框使用 20% 固定灰色。inputBorder 不会改变这个旧版聊天输入框外框。'),
    tr('- User and workspace color overrides can take precedence over shipped theme colors. Prism keeps its changes inside its own theme scopes and preserves later manual edits.', '- 用户及工作区颜色覆盖可能优先于主题自带颜色。Prism 将改动限定在自己的主题作用域内，并保留后续手动修改。'),
    '',
    tr('Relevant workbench.colorCustomizations entries', '相关 workbench.colorCustomizations 条目'),
    tr('Only known native appearance keys and theme scopes matching the active theme are shown from the merged configuration. This is not a dump of user settings or the final computed DOM colors.', '仅显示合并配置中相关原生外观键及匹配当前主题的作用域；这不是用户设置全量导出，也不是界面最终计算色值。'),
    JSON.stringify(customizations, null, 2),
    '',
    tr('This read-only report contains version/theme metadata and color overrides only. It does not activate Google extensions, read conversations or credentials, or change application files.', '此只读报告仅包含版本、主题元数据和颜色覆盖；不激活 Google 扩展，不读取对话或凭据，不修改应用文件。'),
    '',
  ].join('\n');
}
