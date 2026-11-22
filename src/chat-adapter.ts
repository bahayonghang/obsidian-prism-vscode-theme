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

export function unavailableChatAdapter(reason = 'Desktop Antigravity is required. / 需要桌面版 Antigravity。'): ChatAppearanceAdapter {
  const value: DesktopAppearanceInfo = { state: 'unsupported', supported: false, installed: false, enabled: false, restartRequired: false, reason };
  const unavailable = async (): Promise<DesktopAppearanceInfo> => { throw new Error(reason); };
  return { info: async () => ({ ...value }), enable: unavailable, update: async () => ({ ...value }), disable: unavailable };
}
