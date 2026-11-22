/** Browser-safe contract for the explicitly enabled desktop appearance adapter. */
export interface DesktopAppearanceInfo {
  state: 'unsupported' | 'available' | 'enabled' | 'restart-required' | 'conflict';
  supported: boolean;
  installed: boolean;
  enabled: boolean;
  restartRequired: boolean;
  /** Owned recovery metadata exists even if an updater replaced the main file. */
  canDisable?: boolean;
  reason: string;
  mode?: 'modern' | 'legacy';
  ideVersion?: string;
  appRoot?: string;
  target?: string;
  backup?: string;
}

export interface ChatAppearanceAdapter {
  info(): Promise<DesktopAppearanceInfo>;
  enable(css: string): Promise<DesktopAppearanceInfo>;
  /** Refresh an already owned stylesheet; never install or replace a host hook. */
  update(css: string): Promise<DesktopAppearanceInfo>;
  disable(): Promise<DesktopAppearanceInfo>;
}

/** Shareable diagnostics deliberately exclude local paths and raw filesystem errors. */
export function formatDesktopAppearanceReport(info: DesktopAppearanceInfo, language: 'en' | 'zh-CN'): string {
  const tr = (en: string, zh: string) => language === 'zh-CN' ? zh : en;
  return [
    tr('Optional real-chat appearance adapter', '可选的真实对话外观适配层'),
    `${tr('State', '状态')}: ${info.state}`,
    `${tr('Supported / installed / enabled', '支持 / 已安装 / 已启用')}: ${info.supported} / ${info.installed} / ${info.enabled}`,
    `${tr('Restart required', '需要重启')}: ${info.restartRequired}`,
    tr('Relative to Antigravity resources/app: startup out/main.js; recovery out/obsidian-prism-desktop/.', '以 Antigravity 的 resources/app 为基准：启动文件 out/main.js；恢复目录 out/obsidian-prism-desktop/。'),
    tr('Local paths and detailed filesystem errors are omitted. View the current diagnostic in Theme Studio; the enable dialog shows the exact startup and backup paths.', '此报告省略本地路径及详细文件系统错误。请在 Theme Studio 查看当前诊断；启用确认框会显示准确的启动文件和备份路径。'),
    tr('Disk compatibility is checked; this report does not inspect account data or prove a live chat render.', '此处检查磁盘兼容性，不读取账户数据，也不代表已验证当前对话页的实际显示。'),
  ].join('\n');
}

export function unavailableChatAdapter(reason = 'Desktop Antigravity is required. / 需要桌面版 Antigravity。'): ChatAppearanceAdapter {
  const value: DesktopAppearanceInfo = { state: 'unsupported', supported: false, installed: false, enabled: false, restartRequired: false, reason };
  const unavailable = async (): Promise<DesktopAppearanceInfo> => { throw new Error(reason); };
  return { info: async () => ({ ...value }), enable: unavailable, update: async () => ({ ...value }), disable: unavailable };
}
