/** Node-only, explicit local installation of the appearance-only Electron hook. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ChatAppearanceAdapter, DesktopAppearanceInfo } from './chat-adapter';

export const ADAPTER_OWNER = 'obsidian-prism-desktop-adapter';
export const ADAPTER_DIRECTORY = 'obsidian-prism-desktop';
export const BOOTSTRAP = '\n/* OBSIDIAN_PRISM_DESKTOP_BEGIN v1 */\nvoid import("./obsidian-prism-desktop/loader.mjs").then(module => module.startAppearanceLoader()).catch(() => {});\n/* OBSIDIAN_PRISM_DESKTOP_END v1 */\n';
type Mode = 'modern' | 'legacy';
export interface AuditedDesktopBuild {
  ideVersion: string; applicationName: string; nameLong: string; mode: Mode;
  mainSha256: string; platforms: readonly string[];
}
export const AUDITED_DESKTOP_BUILDS: readonly AuditedDesktopBuild[] = [
  { ideVersion: '1.23.2', applicationName: 'antigravity', nameLong: 'Antigravity', mode: 'legacy', mainSha256: '353263dae8c02d06e8d596e8fb3cb22a93a33ad207cadb094458c2170d0bc73e', platforms: ['linux'] },
  { ideVersion: '2.8.0', applicationName: 'antigravity-ide', nameLong: 'Antigravity IDE', mode: 'modern', mainSha256: '2a20131586471b1c0a22a7174021904c927b3d3a5fb21cb038c42919bb2af764', platforms: ['linux'] },
  { ideVersion: '1.23.2', applicationName: 'antigravity', nameLong: 'Antigravity', mode: 'legacy', mainSha256: 'c98cfe9d4256fda7e9f30603cdcddf45e206a4dc3181784c1508e218b6562d65', platforms: ['win32'] },
  { ideVersion: '2.8.0', applicationName: 'antigravity-ide', nameLong: 'Antigravity IDE', mode: 'modern', mainSha256: '187c3f56c0947da78d5991cb0ab34acbf00766bbeb96d7b3781f3b4fd8bffe4d', platforms: ['win32'] },
];
export interface DesktopAdapterOptions {
  appRoot: string; extensionRoot: string; remote: boolean; web: boolean;
  platform?: NodeJS.Platform; appName?: string;
}
interface Manifest {
  schema: 1; owner: typeof ADAPTER_OWNER; enabled: boolean; stage: 'prepared' | 'installed' | 'disabled';
  ideVersion: string; applicationName: string; mode: Mode; platform: string;
  originalSha256: string; patchedSha256: string; loaderSha256: string; restoreSha256: string;
  cssSha256: string; pendingCssSha256?: string; extensionRoot: string;
  createdAt: string; updatedAt: string;
}
interface Context {
  root: string; out: string; directory: string; main: string; backup: string;
  bytes: Buffer; mainHash: string; product: Record<string, unknown>; build?: AuditedDesktopBuild;
  manifest?: Manifest; manifestHash?: string;
}
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const message = (english: string, chinese: string) => `${english} / ${chinese}`;
const unsupported = (reason: string): DesktopAppearanceInfo => ({ state: 'unsupported', supported: false, installed: false, enabled: false, restartRequired: false, reason });

// This recovery entry is independent of the extension's installation directory.
// It restores only the exact recorded patch, never an updated or edited app.
const RESTORE_SOURCE = String.raw`import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
const directory = path.dirname(fileURLToPath(import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const regular = async file => { const s = await fs.lstat(file); if (!s.isFile() || s.isSymbolicLink()) throw new Error('Refusing unexpected file: ' + path.basename(file)); return fs.readFile(file); };
const manifest = JSON.parse((await regular(path.join(directory, 'manifest.json'))).toString());
if (manifest.schema !== 1 || manifest.owner !== 'obsidian-prism-desktop-adapter') throw new Error('Unknown backup manifest');
await fs.writeFile(path.join(directory, 'disabled'), 'obsidian-prism-desktop-adapter\n', { flag: 'wx', mode: 0o600 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
const target = path.join(directory, '..', 'main.js');
const backup = await regular(path.join(directory, 'main.original'));
if (sha(backup) !== manifest.originalSha256) throw new Error('Backup hash mismatch; no application file changed');
const bootstrap = ${JSON.stringify(BOOTSTRAP)};
if (sha(Buffer.concat([backup, Buffer.from(bootstrap)])) !== manifest.patchedSha256) throw new Error('Patch hash mismatch; no application file changed');
const current = await regular(target);
if (![manifest.originalSha256, manifest.patchedSha256].includes(sha(current))) throw new Error('Application updated or externally modified; styling disabled, application preserved, backup retained');
if (sha(current) === manifest.patchedSha256) {
  const temp = target + '.prism-restore-' + randomUUID();
  try {
    const s = await fs.stat(target);
    await fs.writeFile(temp, backup, { flag: 'wx', mode: s.mode });
    if (sha(await regular(target)) !== manifest.patchedSha256) throw new Error('Application changed during restoration');
    await fs.rename(temp, target);
    if (sha(await regular(target)) !== manifest.originalSha256) throw new Error('Restoration verification failed');
  } finally { await fs.unlink(temp).catch(() => {}); }
}
console.log('Original main entry restored. Restart Antigravity to unload the adapter. Backups retained in ' + directory);
`;

async function regular(file: string, limit = 64 * 1024 * 1024): Promise<Buffer> {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error(message(`Unexpected or oversized file: ${path.basename(file)}`, `文件类型或大小异常：${path.basename(file)}`));
  return fs.readFile(file);
}
async function currentHash(file: string): Promise<string | undefined> {
  try { return digest(await regular(file)); } catch (error) { if (isMissing(error)) return undefined; throw error; }
}
async function assertDirectory(directory: string): Promise<void> {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(message('Refusing a linked or unexpected adapter directory.', '拒绝符号链接或异常的适配目录。'));
}
async function atomic(file: string, data: Buffer | string, expected: string | undefined): Promise<void> {
  if (await currentHash(file) !== expected) throw new Error(message('File changed before update; external changes preserved.', '文件在更新前发生变化，已保留外部修改。'));
  const temp = `${file}.prism-${randomUUID()}.tmp`;
  let mode = 0o600;
  try { mode = (await fs.stat(file)).mode; } catch (error) { if (!isMissing(error)) throw error; }
  try {
    const handle = await fs.open(temp, 'wx', mode);
    try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
    // App updates and other writers are checked again immediately before rename.
    if (await currentHash(file) !== expected) throw new Error(message('File changed during update; external changes preserved.', '文件在更新期间发生变化，已保留外部修改。'));
    await fs.rename(temp, file);
    if (await currentHash(file) !== digest(data)) throw new Error(message('Write verification failed.', '写入后的校验失败。'));
  } finally { await fs.unlink(temp).catch(() => undefined); }
}
function validManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Manifest;
  return item.schema === 1 && item.owner === ADAPTER_OWNER && typeof item.enabled === 'boolean'
    && ['prepared', 'installed', 'disabled'].includes(item.stage) && ['modern', 'legacy'].includes(item.mode)
    && typeof item.ideVersion === 'string' && typeof item.applicationName === 'string'
    && typeof item.extensionRoot === 'string' && path.isAbsolute(item.extensionRoot)
    && ['originalSha256', 'patchedSha256', 'loaderSha256', 'restoreSha256', 'cssSha256'].every(key => /^[a-f0-9]{64}$/.test(String(item[key as keyof Manifest])))
    && (item.pendingCssSha256 === undefined || /^[a-f0-9]{64}$/.test(item.pendingCssSha256));
}
function validateCss(css: string): void {
  if (typeof css !== 'string' || Buffer.byteLength(css) > 512 * 1024 || css.includes('\0') || /@import\b/i.test(css)) {
    throw new Error(message('Invalid generated appearance stylesheet.', '生成的外观样式表无效。'));
  }
}
function processExists(pid: unknown): boolean {
  if (!Number.isInteger(pid) || (pid as number) <= 0) return false;
  try { process.kill(pid as number, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}

/** The second argument is an internal test seam; commands always use the audited defaults. */
export function createDesktopAdapter(options: DesktopAdapterOptions, auditedBuilds: readonly AuditedDesktopBuild[] = AUDITED_DESKTOP_BUILDS): ChatAppearanceAdapter {
  const platform = options.platform ?? process.platform;
  let chain: Promise<unknown> = Promise.resolve();
  const gate = (): string | undefined => options.web || options.remote
    ? message('Only a local desktop Antigravity installation can be modified.', '只支持本机桌面版 Antigravity，不修改浏览器或远程环境。')
    : options.appName && !/^Antigravity(?: IDE)?$/i.test(options.appName)
      ? message('This host is not Antigravity.', '此宿主不是 Antigravity。')
      : !['linux', 'win32'].includes(platform)
      ? message('This platform is not audited; signed macOS applications are not modified.', '此平台尚未审计，不修改签名的 macOS 应用。') : undefined;
  const readContext = async (): Promise<Context> => {
    const blocked = gate(); if (blocked) throw new Error(blocked);
    const root = await fs.realpath(options.appRoot);
    const product = JSON.parse((await regular(path.join(root, 'product.json'), 1024 * 1024)).toString()) as Record<string, unknown>;
    const pkg = JSON.parse((await regular(path.join(root, 'package.json'), 1024 * 1024)).toString()) as Record<string, unknown>;
    if (!['antigravity', 'antigravity-ide'].includes(String(product.applicationName)) || !['Antigravity', 'Antigravity IDE'].includes(String(product.nameLong)) || pkg.main !== './out/main.js' || pkg.type !== 'module') {
      throw new Error(message('The host is not a recognized desktop Antigravity application.', '宿主不是已识别的桌面版 Antigravity 应用。'));
    }
    const out = path.join(root, 'out'); await assertDirectory(out);
    const main = path.join(out, 'main.js'); const bytes = await regular(main);
    const mainHash = digest(bytes); const directory = path.join(out, ADAPTER_DIRECTORY); const backup = path.join(directory, 'main.original');
    const build = auditedBuilds.find(item => item.ideVersion === product.ideVersion && item.applicationName === product.applicationName && item.nameLong === product.nameLong && item.platforms.includes(platform) && item.mainSha256 === mainHash);
    let manifest: Manifest | undefined; let manifestHash: string | undefined;
    try {
      await assertDirectory(directory);
      const manifestBytes = await regular(path.join(directory, 'manifest.json'), 64 * 1024);
      const value: unknown = JSON.parse(manifestBytes.toString());
      if (!validManifest(value)) throw new Error(message('Unknown or damaged adapter manifest; files preserved.', '适配清单未知或损坏，文件已保留。'));
      manifest = value; manifestHash = digest(manifestBytes);
    } catch (error) {
      // An existing directory without a manifest may be an interrupted install.
      if (!isMissing(error)) throw error;
      try { await fs.lstat(directory); throw new Error(message('Incomplete adapter directory; inspect the retained backup before changing it.', '适配目录不完整，请先检查保留的备份。')); }
      catch (nested) { if (!isMissing(nested)) throw nested; }
    }
    return { root, out, directory, main, backup, bytes, mainHash, product, build, manifest, manifestHash };
  };
  const verifyOriginal = async (ctx: Context): Promise<AuditedDesktopBuild> => {
    const manifest = ctx.manifest!;
    const audit = auditedBuilds.find(item => item.ideVersion === manifest.ideVersion && item.applicationName === manifest.applicationName && item.mainSha256 === manifest.originalSha256 && item.platforms.includes(platform));
    if (!audit || manifest.platform !== platform || manifest.mode !== audit.mode) throw new Error(message('The recorded original is not an audited build for this platform.', '记录的原始文件不属于此平台已审计的构建。'));
    const backup = await regular(ctx.backup);
    if (digest(backup) !== manifest.originalSha256 || digest(Buffer.concat([backup, Buffer.from(BOOTSTRAP)])) !== manifest.patchedSha256) throw new Error(message('Backup or patch hash mismatch; no application file changed.', '备份或补丁哈希不匹配，未修改应用文件。'));
    return audit;
  };
  const verifyAssets = async (ctx: Context): Promise<void> => {
    const manifest = ctx.manifest!;
    if (await currentHash(path.join(ctx.directory, 'loader.mjs')) !== manifest.loaderSha256 || await currentHash(path.join(ctx.directory, 'restore.mjs')) !== manifest.restoreSha256) throw new Error(message('An adapter program changed externally; it has been preserved.', '适配程序存在外部修改，已保留该修改。'));
    const hash = await currentHash(path.join(ctx.directory, 'appearance.css'));
    if (hash !== manifest.cssSha256 && hash !== manifest.pendingCssSha256) throw new Error(message('The owned stylesheet changed externally; it has been preserved.', '受管理的样式表存在外部修改，已保留该修改。'));
  };
  const saveManifest = async (ctx: Context, value: Manifest): Promise<void> => {
    const file = path.join(ctx.directory, 'manifest.json');
    const bytes = JSON.stringify(value, null, 2) + '\n';
    await atomic(file, bytes, ctx.manifestHash);
    ctx.manifest = value; ctx.manifestHash = digest(bytes);
  };
  const runtime = async (ctx: Context): Promise<Record<string, unknown> | undefined> => {
    try {
      const value = JSON.parse((await regular(path.join(ctx.directory, 'status.json'), 64 * 1024)).toString()) as Record<string, unknown>;
      if (value.owner === ADAPTER_OWNER && value.schema === 1 && typeof value.at === 'number' && Date.now() - value.at < 65_000 && processExists(value.pid)) return value;
    } catch { /* Runtime status is diagnostic, never proof that a patch is safe. */ }
    return undefined;
  };
  const describe = async (ctx: Context): Promise<DesktopAppearanceInfo> => {
    const base = { appRoot: ctx.root, target: ctx.main, backup: ctx.backup, ideVersion: String(ctx.product.ideVersion), mode: ctx.build?.mode ?? ctx.manifest?.mode, canDisable: !!ctx.manifest };
    if (!ctx.manifest) return ctx.build
      ? { ...base, state: 'available', supported: true, installed: false, enabled: false, restartRequired: false, reason: message('Audited local installation; enhancement has not been enabled.', '本机安装已通过审计，尚未启用增强外观。') }
      : { ...base, ...unsupported(message('This application version or main entry hash has not been audited.', '此应用版本或主入口哈希尚未审计。')) };
    if (ctx.manifest.stage === 'prepared' && ctx.build?.mainSha256 === ctx.manifest.originalSha256) {
      return { ...base, state: 'available', supported: true, installed: false, enabled: false, restartRequired: false, reason: message('An installation was interrupted before the main entry changed. Explicit enable safely archives partial files and starts again.', '安装在主入口修改前中断。明确重新启用会安全归档未完成文件并重试安装。') };
    }
    try { await verifyOriginal(ctx); await verifyAssets(ctx); }
    catch (error) { return { ...base, state: 'conflict', supported: false, installed: ctx.mainHash === ctx.manifest.patchedSha256, enabled: false, restartRequired: false, reason: (error as Error).message }; }
    const installed = ctx.mainHash === ctx.manifest.patchedSha256;
    const clean = ctx.mainHash === ctx.manifest.originalSha256;
    if (!installed && !clean) return { ...base, state: ctx.build ? 'available' : 'conflict', supported: !!ctx.build, installed: false, enabled: false, restartRequired: false, reason: message(ctx.build ? 'Antigravity was updated to another audited build. Explicitly enable again to archive the old backup and install the new hook.' : 'Antigravity was updated or externally modified. No application file will be overwritten; backups are retained.', ctx.build ? 'Antigravity 已更新为另一已审计构建；请明确重新启用，以归档旧备份并安装新适配。' : 'Antigravity 已更新或被外部修改；不会覆盖应用文件，备份已保留。') };
    let disabled = false;
    try { await fs.lstat(path.join(ctx.directory, 'disabled')); disabled = true; } catch (error) { if (!isMissing(error)) disabled = true; }
    const active = await runtime(ctx);
    const enabled = installed && ctx.manifest.enabled && !disabled;
    const restartRequired = installed && !active;
    return { ...base, state: installed ? restartRequired ? 'restart-required' : 'enabled' : 'available', supported: true, installed, enabled, restartRequired,
      reason: !installed ? message('Original entry is intact; recovery backup is retained.', '原始入口完整，恢复备份已保留。')
        : restartRequired ? message('Hook installed. Restart Antigravity completely to load it; live styling is not yet verified.', '适配已安装。请完整重启 Antigravity 加载；尚未确认实时样式。')
          : Number(active?.blockedFrames) > 0 ? message('Hook is running, but a frame CSP refused the stylesheet. Its policy was preserved.', '适配正在运行，但页面 CSP 拒绝样式；已保留原策略。')
            : enabled ? message('Owned hook is running. Styles apply only to recognized conversation surfaces.', '受管理的适配正在运行；样式只应用于已识别的对话区域。')
              : message('Styles are disabled; the remaining hook can be restored.', '样式已停用，可恢复剩余适配入口。') };
  };
  const info = async (): Promise<DesktopAppearanceInfo> => {
    const blocked = gate(); if (blocked) return unsupported(blocked);
    try { return await describe(await readContext()); }
    catch (error) { return { ...unsupported((error as Error).message), state: /not a recognized|不是已识别/.test((error as Error).message) || isMissing(error) ? 'unsupported' : 'conflict' }; }
  };
  const locked = async <T>(ctx: Context, action: () => Promise<T>): Promise<T> => {
    const file = path.join(ctx.out, '.obsidian-prism-desktop.lock');
    const token = randomUUID(); let handle;
    try { handle = await fs.open(file, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const previous = JSON.parse((await regular(file, 4096)).toString()) as { owner?: string; pid?: number; token?: string };
      if (previous.owner !== ADAPTER_OWNER || processExists(previous.pid)) throw new Error(message('Another appearance operation is active; no files changed.', '另一外观操作正在执行，未修改文件。'));
      const expected = digest(JSON.stringify(previous));
      const actual = JSON.parse((await regular(file, 4096)).toString());
      if (digest(JSON.stringify(actual)) !== expected) throw new Error('Adapter lock changed');
      await fs.unlink(file); handle = await fs.open(file, 'wx', 0o600);
    }
    try { await handle.writeFile(JSON.stringify({ owner: ADAPTER_OWNER, pid: process.pid, token })); await handle.close(); return await action(); }
    finally {
      await handle.close().catch(() => undefined);
      try { const current = JSON.parse((await regular(file, 4096)).toString()); if (current.token === token) await fs.unlink(file); } catch { /* Preserve a replaced lock. */ }
    }
  };
  const serialize = <T>(task: () => Promise<T>): Promise<T> => { const next = chain.then(task, task); chain = next.catch(() => undefined); return next; };
  const stopLive = async (ctx: Context): Promise<boolean> => {
    const sentinel = path.join(ctx.directory, 'disabled');
    try { await atomic(sentinel, `${ADAPTER_OWNER}\n`, undefined); }
    catch (error) { if (await currentHash(sentinel) !== digest(`${ADAPTER_OWNER}\n`)) throw error; }
    // Wait for a positive removal acknowledgment, never pretend a disk patch is live.
    for (let attempt = 0; attempt < 12; attempt++) {
      const state = await runtime(ctx);
      if (state?.enabled === false) return true;
      if (!state) return false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  };
  const writeAppearance = async (ctx: Context, css: string, enable: boolean): Promise<void> => {
    await verifyOriginal(ctx); await verifyAssets(ctx);
    if (await currentHash(ctx.main) !== ctx.manifest!.patchedSha256) throw new Error(message('The application entry changed; automatic stylesheet updates cannot reinstall the hook.', '应用入口已变化；自动样式更新不能重新安装适配。'));
    const file = path.join(ctx.directory, 'appearance.css'); const before = await currentHash(file);
    const next: Manifest = { ...ctx.manifest!, pendingCssSha256: digest(css), extensionRoot: path.resolve(options.extensionRoot), updatedAt: new Date().toISOString() };
    await saveManifest(ctx, next);
    await atomic(file, css, before);
    await saveManifest(ctx, { ...next, cssSha256: digest(css), pendingCssSha256: undefined, enabled: enable, stage: 'installed' });
    if (enable) {
      const sentinel = path.join(ctx.directory, 'disabled'); const hash = await currentHash(sentinel);
      if (hash === digest(`${ADAPTER_OWNER}\n`)) await fs.unlink(sentinel);
      else if (hash !== undefined) throw new Error(message('Unrecognized disable marker preserved.', '已保留无法识别的停用标记。'));
    }
  };
  return {
    info,
    enable: css => serialize(async () => {
      validateCss(css); let ctx = await readContext();
      return locked(ctx, async () => {
        ctx = await readContext();
        if (ctx.manifest && ctx.mainHash === ctx.manifest.patchedSha256) {
          await writeAppearance(ctx, css, true); return info();
        }
        if (!ctx.build) throw new Error(message('Only exact audited, unmodified Antigravity builds can be enabled.', '只能在哈希完全匹配、未修改的已审计 Antigravity 构建上启用。'));
        const loader = await regular(path.join(options.extensionRoot, 'media', 'antigravity-loader.mjs'), 512 * 1024);
        const extension = JSON.parse((await regular(path.join(options.extensionRoot, 'package.json'), 1024 * 1024)).toString());
        if (extension.name !== 'obsidian-prism-vscode-theme' || extension.publisher !== 'bahayonghang') throw new Error('Unexpected appearance extension');
        if (ctx.manifest) {
          if (!(ctx.manifest.stage === 'prepared' && ctx.build.mainSha256 === ctx.manifest.originalSha256)) await verifyOriginal(ctx);
          await stopLive(ctx);
          // Preserve every old recovery file, including externally changed assets.
          const archive = path.join(ctx.out, `${ADAPTER_DIRECTORY}-backup-${ctx.manifest.ideVersion}-${randomUUID()}`);
          await fs.rename(ctx.directory, archive);
          ctx.manifestHash = undefined;
        }
        await fs.mkdir(ctx.directory, { mode: 0o700 });
        const patched = Buffer.concat([ctx.bytes, Buffer.from(BOOTSTRAP)]); const now = new Date().toISOString();
        const manifest: Manifest = { schema: 1, owner: ADAPTER_OWNER, enabled: true, stage: 'prepared', ideVersion: ctx.build.ideVersion, applicationName: ctx.build.applicationName, mode: ctx.build.mode, platform, originalSha256: ctx.mainHash, patchedSha256: digest(patched), loaderSha256: digest(loader), restoreSha256: digest(RESTORE_SOURCE), cssSha256: digest(css), extensionRoot: path.resolve(options.extensionRoot), createdAt: now, updatedAt: now };
        // Recovery metadata is created first. Until the final main rename, the
        // audited original itself is the recovery source for any missing backup.
        await saveManifest(ctx, manifest);
        await atomic(ctx.backup, ctx.bytes, undefined);
        await atomic(path.join(ctx.directory, 'loader.mjs'), loader, undefined);
        await atomic(path.join(ctx.directory, 'restore.mjs'), RESTORE_SOURCE, undefined);
        await atomic(path.join(ctx.directory, 'appearance.css'), css, undefined);
        await atomic(ctx.main, patched, ctx.mainHash);
        await saveManifest(ctx, { ...manifest, stage: 'installed' });
        return info();
      });
    }),
    update: css => serialize(async () => {
      validateCss(css);
      const observed = await info(); if (!observed.installed || !observed.enabled || !observed.supported) return observed;
      const ctx = await readContext();
      return locked(ctx, async () => {
        const latest = await readContext();
        if (latest.manifest?.enabled && latest.mainHash === latest.manifest.patchedSha256) await writeAppearance(latest, css, true);
        return info();
      });
    }),
    disable: () => serialize(async () => {
      const ctx = await readContext(); if (!ctx.manifest) return info();
      return locked(ctx, async () => {
        const latest = await readContext(); if (!latest.manifest) return info();
        const stopped = await stopLive(latest);
        if (latest.manifest.stage === 'prepared' && latest.build?.mainSha256 === latest.manifest.originalSha256) {
          await saveManifest(latest, { ...latest.manifest, enabled: false, updatedAt: new Date().toISOString() });
          return { ...(await info()), enabled: false, reason: message('The incomplete adapter was disabled. The audited original entry was never changed; partial recovery files are retained.', '已停用未完成的适配。已审计的原始入口未被修改，未完成的恢复文件已保留。') };
        }
        await verifyOriginal(latest);
        // Disable metadata even when an updater replaced main.js. Never copy an
        // old executable entry over a newer or externally changed application.
        await saveManifest(latest, { ...latest.manifest, enabled: false, updatedAt: new Date().toISOString() });
        if (latest.mainHash !== latest.manifest.patchedSha256 && latest.mainHash !== latest.manifest.originalSha256) {
          return { ...(await info()), state: 'conflict', enabled: false, restartRequired: !stopped, reason: message('Styling was disabled. The changed application entry was preserved; the original backup remains available.', '样式已停用。已保留变化后的应用入口及原始备份。') };
        }
        if (latest.mainHash === latest.manifest.patchedSha256) await atomic(latest.main, await regular(latest.backup), latest.manifest.patchedSha256);
        await saveManifest(latest, { ...latest.manifest, stage: 'disabled' });
        return { ...(await info()), enabled: false, restartRequired: !stopped, reason: message(stopped ? 'Live styling was removed and the original entry restored byte for byte. Recovery files are retained.' : 'Original entry restored byte for byte. Restart Antigravity to ensure any loaded hook is unloaded. Recovery files are retained.', stopped ? '已移除实时样式并逐字节恢复原始入口，恢复文件已保留。' : '已逐字节恢复原始入口。请重启 Antigravity，确保已加载的适配完全卸载；恢复文件已保留。') };
      });
    }),
  };
}
