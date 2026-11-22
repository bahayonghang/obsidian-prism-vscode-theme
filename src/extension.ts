/** Independent theme-only VS Code port. GPL-3.0-only; see UPSTREAM.md. */
import * as vscode from 'vscode';
import { CHAT_APPEARANCE_KEYS, DEFAULT_SETTINGS, FONT_STACKS, SETTING_KEYS, SYSTEM_KEYS, TYPOGRAPHY_KEYS, isPaletteId, isRecord, normalizeSettings, parseSettings, serializeSettings, validateSettings, type Settings } from './config';
import { AppearanceOwnership, equal, type LeafPatch, type Ledger } from './ownership';
import { PALETTES, THEMES, type PaletteId } from './palettes';
import { createTheme } from './theme';
import { getWebviewHtml } from './webview';
import { detectHostAppearance, formatCompatibilityReport, type HostAppearanceInfo } from './host';
import { createAntigravityPreview } from './conversation';
import { formatDesktopAppearanceReport, unavailableChatAdapter, type ChatAppearanceAdapter, type DesktopAppearanceInfo } from './chat-adapter';
import { generateHostAppearanceBundle } from './host-style';

const LEDGER_KEY = 'appearanceOwnership.v1';
const SOURCES = { upstream: 'https://github.com/RMvdesi/obsidian-prism', port: 'https://github.com/bahayonghang/obsidian-prism-vscode-theme' };
const encoder = new TextEncoder();
let outstanding: Promise<unknown> = Promise.resolve();

export function activate(context: vscode.ExtensionContext, chatAdapter: ChatAppearanceAdapter = unavailableChatAdapter()): void {
  let panel: vscode.WebviewPanel | undefined;
  let writing = false;
  let pendingPrismChange = false;
  let hostAppearance: Promise<HostAppearanceInfo> | undefined;
  let compatibilityReport = '';
  const reportUri = vscode.Uri.parse('obsidian-prism-report:/compatibility.txt');
  const reportChanges = new vscode.EventEmitter<vscode.Uri>();
  context.subscriptions.push(reportChanges, vscode.workspace.registerTextDocumentContentProvider('obsidian-prism-report', {
    onDidChange: reportChanges.event,
    provideTextDocumentContent: () => compatibilityReport,
  }));
  const copyLedger = (value: Ledger | undefined): Ledger | undefined => value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Ledger;
  // Memento can receive a delayed storage echo after an awaited update. Keep
  // this serialized writer's successful snapshot authoritative for its lifetime;
  // otherwise our own newer settings can be mistaken for later manual edits.
  let ownershipLedger = copyLedger(context.globalState.get<Ledger>(LEDGER_KEY));
  const owner = new AppearanceOwnership({
    read: key => vscode.workspace.getConfiguration().inspect(key)?.globalValue,
    write: (key, value) => vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global),
    load: () => copyLedger(ownershipLedger),
    save: async ledger => {
      // Persist before acknowledging either the write-ahead journal or final
      // state. A failed save retains the previous recoverable local snapshot.
      await context.globalState.update(LEDGER_KEY, copyLedger(ledger));
      ownershipLedger = copyLedger(ledger);
    },
  });

  function settings(): Settings {
    const config = vscode.workspace.getConfiguration('obsidianPrism');
    return normalizeSettings(Object.fromEntries(SETTING_KEYS.map(key => [key, config.get(key)])));
  }
  function language(): 'zh-CN' | 'en' {
    const chosen = settings().language;
    return chosen === 'auto' ? (/^zh/i.test(vscode.env.language) ? 'zh-CN' : 'en') : chosen;
  }
  const tr = (en: string, zh: string) => language() === 'zh-CN' ? zh : en;
  const activeTheme = () => vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
  function activePalette(): PaletteId {
    const light = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrastLight;
    return THEMES.find(theme => theme.label === activeTheme())?.id ?? (light ? settings().preferredLight : settings().preferredDark);
  }
  function getHostAppearance(refresh = false): Promise<HostAppearanceInfo> {
    if (refresh || !hostAppearance) hostAppearance = detectHostAppearance();
    return hostAppearance;
  }
  async function sendState(resetDraft = false): Promise<void> {
    const target = panel;
    if (!target) return;
    const metadata = getHostAppearance();
    const [host, chatAppearance] = await Promise.all([metadata, chatAdapter.info()]);
    if (panel !== target) return;
    // A newer open/extension-change request can replace a slow metadata read.
    // Preserve explicit draft reset semantics while retrying with the new one.
    if (hostAppearance !== metadata) { await sendState(resetDraft); return; }
    const current = settings();
    const palette = activePalette();
    const preview = createTheme(palette, current);
    target.title = tr('Obsidian Prism · Theme Studio', 'Obsidian Prism · 主题工作室');
    await target.webview.postMessage({ type: 'state', settings: current, activeTheme: activeTheme(), themes: THEMES, palette, preview, conversationPreview: createAntigravityPreview(preview), host, chatAppearance, language: language(), autoLanguage: /^zh/i.test(vscode.env.language) ? 'zh-CN' : 'en', typographyApplied: owner.has('typography'), systemApplied: owner.has('system'), resetDraft });
  }
  async function status(en: string, zh: string, level: 'info' | 'error' = 'info'): Promise<void> {
    const message = tr(en, zh);
    if (panel) await panel.webview.postMessage({ type: 'status', level, message });
    else if (level === 'error') void vscode.window.showErrorMessage(`Obsidian Prism: ${message}`);
    else void vscode.window.showInformationMessage(`Obsidian Prism: ${message}`);
  }
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = outstanding.then(async () => {
      writing = true;
      try { return await task(); } finally {
        writing = false;
        if (pendingPrismChange) {
          pendingPrismChange = false;
          queueMicrotask(() => { void run(async () => { await syncColors(); await syncChatAppearance(); await sendState(); }); });
        }
      }
    });
    outstanding = next.catch(() => undefined);
    return next;
  }
  async function run(task: () => Promise<unknown>, propagate = false): Promise<void> {
    try { await enqueue(task); }
    catch (error) {
      // A visible Studio status can otherwise hide host configuration failures
      // from the extension-host log, including an interrupted restoration.
      console.error('[Obsidian Prism] Appearance operation failed:', error);
      try {
        await status(String(error instanceof Error ? error.message : error), String(error instanceof Error ? error.message : error), 'error');
      } catch (reportError) {
        // A disposed Studio must not replace the original operation error or
        // leave an unhandled rejection in a background configuration callback.
        console.error('[Obsidian Prism] Could not report appearance failure:', reportError);
      }
      // Commands are awaitable API operations. Background/webview handlers
      // consume reported failures; commands must let their callers detect them.
      if (propagate) throw error;
    }
  }
  async function save(partial: Partial<Settings>, keys: readonly (keyof Settings)[] = SETTING_KEYS): Promise<void> {
    const config = vscode.workspace.getConfiguration('obsidianPrism');
    for (const key of keys) {
      if (!Object.hasOwn(partial, key)) continue;
      const value = partial[key];
      if (!equal(config.inspect(key)?.globalValue, value)) await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }

  function chatCss(): string {
    // Each real frame selects its native palette marker. An unrelated theme in
    // this window must not erase a different window's Prism styles.
    return generateHostAppearanceBundle(settings());
  }
  async function syncChatAppearance(): Promise<void> {
    const current = await chatAdapter.info();
    // Preferences/import/activation can refresh an existing owned stylesheet,
    // but can never install a hook or reapply it after an application update.
    if (current.installed && current.supported && current.state !== 'conflict') await chatAdapter.update(chatCss());
  }
  async function enableChatAppearance(partial: Partial<Settings> = {}): Promise<void> {
    const current = await chatAdapter.info();
    if (!current.supported || current.state === 'conflict') throw new Error(current.reason);
    if (!THEMES.some(theme => theme.label === activeTheme())) {
      throw new Error(tr('Apply a Prism color theme before enabling chat appearance.', '请先应用一套 Prism 配色，再启用对话外观。'));
    }
    const enable = tr('Enable and keep a backup', '启用并保留备份');
    const choice = await vscode.window.showWarningMessage(
      tr('Enable Prism styling in the real Antigravity conversation?', '在真实 Antigravity 对话区启用 Prism 外观？'),
      { modal: true, detail: tr(
        `This optional adapter changes the verified Antigravity startup file and keeps the original for restoration. Fully quit and reopen Antigravity after enabling. Application updates can require a new compatibility check. Disable the adapter before uninstalling Prism.\n\nStartup: ${current.target || current.appRoot || ''}\nBackup: ${current.backup || ''}`,
        `此可选适配层会修改已验证的 Antigravity 启动文件，并备份原文件供恢复。启用后需要完全退出并重新打开 Antigravity；软件更新后可能需要重新检查兼容性。卸载 Prism 前请先停用适配层。\n\n启动文件：${current.target || current.appRoot || ''}\n备份：${current.backup || ''}`,
      ) }, enable,
    );
    if (choice !== enable) return;
    await save(partial, CHAT_APPEARANCE_KEYS);
    const result = await chatAdapter.enable(chatCss());
    await sendState();
    await reportChatResult(result, 'enabled');
  }
  async function updateChatAppearance(partial: Partial<Settings> = {}): Promise<void> {
    const current = await chatAdapter.info();
    if (!current.installed || current.state === 'conflict') throw new Error(tr('Enable the compatible chat appearance adapter first. ', '请先启用兼容的对话外观适配层。') + current.reason);
    await save(partial, CHAT_APPEARANCE_KEYS);
    const result = await chatAdapter.update(chatCss());
    await sendState();
    await reportChatResult(result, 'updated');
  }
  async function disableChatAppearance(): Promise<void> {
    const result = await chatAdapter.disable();
    await sendState();
    await reportChatResult(result, 'disabled');
  }
  async function reportChatResult(result: DesktopAppearanceInfo, action: 'enabled' | 'updated' | 'disabled'): Promise<void> {
    if (result.state === 'conflict' || (action !== 'disabled' && (!result.supported || !result.installed || !result.enabled))) throw new Error(result.reason);
    const restart = result.restartRequired;
    if (action === 'disabled') {
      await status('Chat styling disabled; the verified original startup file was restored.' + (restart ? ' Fully quit and reopen Antigravity to unload the adapter.' : ''), '已停用对话样式，并恢复已验证的原始启动文件。' + (restart ? ' 请完全退出并重新打开 Antigravity，以卸载适配层。' : ''));
    } else {
      await status(restart ? 'Chat appearance saved. Fully quit and reopen Antigravity to load the adapter; Reload Window is not sufficient.' : 'Chat appearance saved. The running adapter will refresh its stylesheet; this is not a live visual verification.', restart ? '已保存对话外观。请完全退出并重新打开 Antigravity 以加载适配层；仅“重新加载窗口”不够。' : '已保存对话外观，运行中的适配层会刷新样式；这不代表已完成当前聊天页的实机外观验证。');
    }
  }
  async function setLanguage(value: unknown): Promise<void> {
    await save(validateSettings({ language: value }), ['language']);
    await sendState();
    await status('Extension language saved. Native Settings descriptions and choices remain bilingual.', '已保存扩展语言。原生设置的说明和选项始终提供中英双语。');
  }

  /** Store only differences from the shipped themes. Customization keys are exact theme scopes. */
  async function syncColors(): Promise<string[]> {
    const current = settings();
    const patches: Record<string, LeafPatch[]> = { 'workbench.colorCustomizations': [], 'editor.tokenColorCustomizations': [], 'editor.semanticTokenColorCustomizations': [] };
    for (const item of THEMES) {
      const base = createTheme(item.id);
      const desired = createTheme(item.id, current);
      const scope = `[${item.label}]`;
      for (const [key, value] of Object.entries(desired.colors)) {
        if (!equal(base.colors[key], value)) patches['workbench.colorCustomizations'].push({ path: [scope, key], value });
      }
      const modifiedRules = desired.tokenColors.filter((rule, index) => !equal(rule, base.tokenColors[index]));
      if (modifiedRules.length) {
        const path = [scope, 'textMateRules'];
        const original = owner.original('colors', 'editor.tokenColorCustomizations', path);
        const global = vscode.workspace.getConfiguration('editor').inspect<Record<string, unknown>>('tokenColorCustomizations')?.globalValue;
        const scoped = global?.[scope];
        const existing = original ? (original.present ? original.value : undefined) : (isRecord(scoped) ? scoped.textMateRules : undefined);
        // Keep pre-existing rules; only the managed appended rules have priority while customization is active.
        const rules = Array.isArray(existing) ? existing : [];
        patches['editor.tokenColorCustomizations'].push({ path, value: [...rules, ...modifiedRules] });
      }
      for (const [key, value] of Object.entries(desired.semanticTokenColors)) {
        if (!equal(base.semanticTokenColors[key], value)) patches['editor.semanticTokenColorCustomizations'].push({ path: [scope, 'rules', key], value });
      }
    }
    return owner.apply('colors', patches);
  }
  function conflictSuffix(conflicts: string[]): [string, string] {
    return conflicts.length ? [' Existing manual edits were preserved. Reset customizations to release their ownership records.', ' 已保留手动修改；重置自定义设置可清除对应管理记录。'] : ['', ''];
  }
  async function applyTheme(palette: PaletteId, partial: Partial<Settings>): Promise<void> {
    await save(partial);
    const conflicts = await syncColors();
    const name = PALETTES[palette].label;
    await vscode.workspace.getConfiguration('workbench').update('colorTheme', name, vscode.ConfigurationTarget.Global);
    await syncChatAppearance();
    await sendState(true);
    const extra = conflictSuffix(conflicts);
    await status(`Applied ${name}.${extra[0]}`, `已应用 ${name}。${extra[1]}`);
  }
  async function applyTypography(partial: Partial<Settings>): Promise<void> {
    await save(partial, TYPOGRAPHY_KEYS);
    const current = settings();
    const patches: Record<string, LeafPatch[]> = {};
    if (current.codeFont !== 'default') patches['editor.fontFamily'] = [{ path: [], value: FONT_STACKS[current.codeFont] }];
    if (current.ligatures !== 'inherit') patches['editor.fontLigatures'] = [{ path: [], value: current.ligatures === 'on' }];
    if (current.smoothCaret !== 'inherit') patches['editor.cursorSmoothCaretAnimation'] = [{ path: [], value: current.smoothCaret === 'on' ? 'on' : 'off' }];
    if (current.smoothScrolling !== 'inherit') patches['editor.smoothScrolling'] = [{ path: [], value: current.smoothScrolling === 'on' }];
    const conflicts = await owner.apply('typography', patches);
    await sendState();
    const extra = conflictSuffix(conflicts);
    await status(`Editor typography applied to user settings. Workspace/language overrides retain priority.${extra[0]}`, `已应用编辑器用户排版设置，工作区和语言单独设置仍优先。${extra[1]}`);
  }
  async function applySystem(partial: Partial<Settings>): Promise<void> {
    await save(partial, SYSTEM_KEYS);
    await syncColors();
    const current = settings();
    const conflicts = await owner.apply('system', {
      'workbench.preferredDarkColorTheme': [{ path: [], value: PALETTES[current.preferredDark].label }],
      'workbench.preferredLightColorTheme': [{ path: [], value: PALETTES[current.preferredLight].label }],
      'window.autoDetectColorScheme': [{ path: [], value: true }],
    });
    await sendState();
    const extra = conflictSuffix(conflicts);
    await status(`System light/dark appearance enabled. High Contrast preferences are unchanged.${extra[0]}`, `已启用随系统自动切换深浅主题，保留原有高对比偏好。${extra[1]}`);
  }
  async function restore(group: 'typography' | 'system'): Promise<void> {
    const conflicts = await owner.restore(group);
    await sendState();
    await status(conflicts.length ? 'Restored managed values; later manual edits were kept.' : 'Previous appearance settings restored.', conflicts.length ? '已恢复受管理的原值，并保留之后的手动修改。' : '已恢复原来的外观设置。');
  }
  async function reset(): Promise<void> {
    const adapterBefore = await chatAdapter.info();
    const adapterWasInstalled = adapterBefore.canDisable || adapterBefore.installed;
    if (adapterWasInstalled) {
      const restored = await chatAdapter.disable();
      if (restored.state === 'conflict') throw new Error(restored.reason);
    }
    for (const group of ['colors','typography','system']) await owner.restore(group);
    const config = vscode.workspace.getConfiguration('obsidianPrism');
    for (const key of SETTING_KEYS) if (config.inspect(key)?.globalValue !== undefined) await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    await sendState(true);
    await status('Prism preferences reset. Previous values restored where still owned; manual edits preserved.' + (adapterWasInstalled ? ' Chat adapter removed; fully quit and reopen Antigravity.' : ''), '已重置 Prism 偏好，恢复仍受管理的原值，并保留手动修改。' + (adapterWasInstalled ? ' 已移除对话适配层，请完全退出并重新打开 Antigravity。' : ''));
  }
  async function exportSettings(): Promise<void> {
    const uri = await vscode.window.showSaveDialog({ saveLabel: tr('Export Prism Settings', '导出 Prism 设置'), filters: { 'Prism settings': ['json'] } });
    if (!uri) return;
    await vscode.workspace.fs.writeFile(uri, encoder.encode(serializeSettings(settings())));
    await status('Prism preferences exported. Editor-wide settings and backups are not included.', '已导出 Prism 偏好，不包含编辑器其他设置或原值备份。');
  }
  async function importSettings(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true, canSelectFolders: false, filters: { 'Prism settings': ['json'] }, openLabel: tr('Import Prism Settings', '导入 Prism 设置') });
    if (!uris?.length) return;
    const stat = await vscode.workspace.fs.stat(uris[0]);
    if (stat.size > 65536) throw new Error('Settings file exceeds 64 KiB. / 设置文件超过 64 KiB。');
    const imported = parseSettings(new TextDecoder('utf-8', { fatal: true }).decode(await vscode.workspace.fs.readFile(uris[0])));
    await save(imported);
    await syncColors();
    await syncChatAppearance();
    await sendState(true);
    await status('Prism preferences imported. This does not enable the chat adapter. Typography and automatic light/dark switching have separate apply buttons.', '已导入 Prism 偏好；此操作不会启用对话适配层。排版和自动明暗切换需点击各自的应用按钮。');
  }
  const openNative = () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:bahayonghang.obsidian-prism-vscode-theme');

  async function showCompatibilityReport(): Promise<void> {
    const host = await getHostAppearance(true);
    compatibilityReport = formatCompatibilityReport(host, {
      language: language(), activeTheme: activeTheme(),
      colorCustomizations: vscode.workspace.getConfiguration('workbench').get<unknown>('colorCustomizations'),
    });
    const adapter = await chatAdapter.info();
    compatibilityReport += '\n\n' + formatDesktopAppearanceReport(adapter, language());
    reportChanges.fire(reportUri);
    const document = await vscode.workspace.openTextDocument(reportUri);
    await vscode.window.showTextDocument(document, { preview: true });
    await sendState();
  }

  function openStudio(): void {
    hostAppearance = undefined;
    if (panel) { panel.reveal(); void sendState(); return; }
    panel = vscode.window.createWebviewPanel('obsidianPrism.studio', 'Obsidian Prism · Theme Studio', vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] });
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
    const receiver = panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isRecord(message) || typeof message.type !== 'string') return;
      if (message.type === 'ready') { await sendState(true); return; }
      if (message.type === 'preview') {
        try {
          if (!isPaletteId(message.palette)) throw new Error('Invalid palette');
          const draft = { ...settings(), ...validateSettings(message.settings) };
          const preview = createTheme(message.palette, draft);
          await panel?.webview.postMessage({ type: 'preview', preview, conversationPreview: createAntigravityPreview(preview), requestId: message.requestId });
        } catch (error) { await status(String(error instanceof Error ? error.message : error), String(error instanceof Error ? error.message : error), 'error'); }
        return;
      }
      await run(async () => {
        switch (message.type) {
          case 'apply':
            if (!isPaletteId(message.palette)) throw new Error('Invalid palette');
            await applyTheme(message.palette, validateSettings(message.settings)); break;
          case 'applyTypography': await applyTypography(validateSettings(message.settings)); break;
          case 'restoreTypography': await restore('typography'); break;
          case 'applySystem': await applySystem(validateSettings(message.settings)); break;
          case 'restoreSystem': await restore('system'); break;
          case 'enableChatAppearance': await enableChatAppearance(validateSettings(message.settings)); break;
          case 'updateChatAppearance': await updateChatAppearance(validateSettings(message.settings)); break;
          case 'disableChatAppearance': await disableChatAppearance(); break;
          case 'setLanguage': await setLanguage(message.value); break;
          case 'export': await exportSettings(); break;
          case 'import': await importSettings(); break;
          case 'reset': await reset(); break;
          case 'openSettings': await openNative(); break;
          case 'showCompatibilityReport': await showCompatibilityReport(); break;
          case 'openSource':
            if (message.source === 'upstream' || message.source === 'port') await vscode.env.openExternal(vscode.Uri.parse(SOURCES[message.source]));
            break;
          default: throw new Error('Unsupported Theme Studio action. / 不支持的操作。');
        }
      });
    });
    panel.onDidDispose(() => { receiver.dispose(); panel = undefined; }, undefined, context.subscriptions);
  }
  async function chooseTheme(): Promise<void> {
    const picked = await vscode.window.showQuickPick(THEMES.map(theme => ({ label: theme.label, description: theme.description, id: theme.id })), { title: tr('Choose an Obsidian Prism theme', '选择 Obsidian Prism 主题') });
    if (picked) await run(() => applyTheme(picked.id, {}), true);
  }
  async function chooseLanguage(): Promise<void> {
    const picked = await vscode.window.showQuickPick([
      { label: 'Auto / 跟随编辑器', value: 'auto' },
      { label: '简体中文 / Simplified Chinese', value: 'zh-CN' },
      { label: 'English / 英语', value: 'en' },
    ], { title: 'Obsidian Prism · Language / 语言' });
    if (picked) await run(() => setLanguage(picked.value), true);
  }

  const commands: Record<string, () => unknown> = {
    openSettings: openStudio,
    chooseTheme,
    chooseLanguage,
    enableChatAppearance: () => run(() => enableChatAppearance(), true),
    updateChatAppearance: () => run(() => updateChatAppearance(), true),
    disableChatAppearance: () => run(disableChatAppearance, true),
    openNativeSettings: openNative,
    showCompatibilityReport: () => run(showCompatibilityReport, true),
    resetCustomizations: () => run(reset, true),
    exportSettings: () => run(exportSettings, true),
    importSettings: () => run(importSettings, true),
    applyTypography: () => run(() => applyTypography({}), true),
    restoreTypography: () => run(() => restore('typography'), true),
    applySystemAppearance: () => run(() => applySystem({}), true),
    restoreSystemAppearance: () => run(() => restore('system'), true),
  };
  for (const [name, callback] of Object.entries(commands)) context.subscriptions.push(vscode.commands.registerCommand(`obsidianPrism.${name}`, callback));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (writing) {
      if (event.affectsConfiguration('obsidianPrism')) pendingPrismChange = true;
      return;
    }
    if (event.affectsConfiguration('obsidianPrism')) void run(async () => { await syncColors(); await syncChatAppearance(); await sendState(); });
    else if (event.affectsConfiguration('workbench.colorTheme')) void run(async () => { await syncChatAppearance(); await sendState(); });
  }));
  context.subscriptions.push(vscode.window.onDidChangeActiveColorTheme(() => { void run(async () => { await syncChatAppearance(); await sendState(); }); }));
  context.subscriptions.push(vscode.extensions.onDidChange(() => {
    hostAppearance = undefined;
    if (panel) void sendState();
  }));
  context.subscriptions.push({ dispose: () => panel?.dispose() });
  // On clean install this computes no overrides and never changes the selected theme or typography.
  void run(async () => { await syncColors(); await syncChatAppearance(); });
}

/** Deactivation is also called on normal shutdown, so it must not undo persistent user choices. */
export async function deactivate(): Promise<void> { await outstanding; }
