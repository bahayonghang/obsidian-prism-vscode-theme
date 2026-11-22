// Local, appearance-only Electron entry. It never inspects conversation text,
// credentials, model state, network responses, or the Antigravity RPC bridge.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const OWNER = 'obsidian-prism-desktop-adapter';
export const STYLE_ID = 'obsidian-prism-chat-style';
export const ATTRIBUTE = 'data-prism-host-appearance';
export const PALETTE_ATTRIBUTE = 'data-prism-host-palette';
export const THEME_MARKER = '--vscode-obsidianPrism-themeMarker';
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function parseThemeMarker(value) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  const colors = ['obsidian', 'warm', 'crystal', 'alabaster'];
  const hex = /^#50520([1-4])(?:ff)?$/.exec(text);
  if (hex) return colors[Number(hex[1]) - 1];
  const rgb = /^rgba?\(\s*80(?:\s*,\s*|\s+)82(?:\s*,\s*|\s+)([1-4])(?:\s*(?:,|\/)\s*(?:1(?:\.0+)?|100%))?\s*\)$/.exec(text);
  return rgb ? colors[Number(rgb[1]) - 1] : undefined;
}

function readThemeMarker(mode) {
  // This reads one public theme color, never renderer text, settings or storage.
  if (mode === 'modern' && document.getElementById('jetski-frame')?.tagName !== 'IFRAME') return '';
  const target = mode === 'legacy' ? document.querySelector('.monaco-workbench') : document.body || document.documentElement;
  return target ? getComputedStyle(target).getPropertyValue('--vscode-obsidianPrism-themeMarker').trim() : '';
}

export function createPaletteScript(mode) {
  return `(${readThemeMarker.toString()})(${JSON.stringify(mode)})`;
}

export function isEligibleFrameUrl(value, mode) {
  try {
    const url = new URL(value);
    if (mode === 'modern') {
      return ['http:', 'https:'].includes(url.protocol)
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        && url.searchParams.get('extensionView') === 'true'
        && url.searchParams.get('extensionVariant') === 'vs-code'
        && url.searchParams.get('hostVariant') === 'antigravity-ide'
        && url.searchParams.get('platform') === 'electron';
    }
    return mode === 'legacy' && ['file:', 'vscode-file:'].includes(url.protocol)
      && url.pathname.endsWith('/vs/code/electron-browser/workbench/workbench.html');
  } catch { return false; }
}

/** The serialized function has no dependency on Node or on the host application. */
function installStyle(css, mode, palette) {
  const key = '__obsidianPrismChatStyleV1';
  const styleId = 'obsidian-prism-chat-style';
  const attribute = 'data-prism-host-appearance';
  const paletteAttribute = 'data-prism-host-palette';
  if (!['obsidian', 'warm', 'crystal', 'alabaster'].includes(palette)) css = '';
  const old = window[key];
  // Rechecking unchanged files must not replace the style node or restart its
  // animations. A new document has its own window, so navigation still reapplies.
  if (css && old?.css === css && old.mode === mode && old.palette === palette && typeof old.refresh === 'function') return old.refresh();
  if (old && typeof old.dispose === 'function') old.dispose();
  const remove = () => {
    document.getElementById(styleId)?.remove();
    document.documentElement.removeAttribute(attribute);
    document.documentElement.removeAttribute(paletteAttribute);
  };
  remove();
  if (!css) { delete window[key]; return 'removed'; }
  let disposed = false;
  let queued;
  let outcome = 'waiting-for-chat';
  const matches = () => {
    const composer = document.getElementById('antigravity.agentSidePanelInputBox');
    if (!composer) return false;
    if (mode === 'legacy') return !!composer.closest('.antigravity-agent-side-panel');
    return mode === 'modern' && composer.classList.contains('surface-composer')
      && !!composer.querySelector('.surface-composer-card')
      && !!document.querySelector('.agy-home, [data-testid="conversation-view"]');
  };
  const apply = () => {
    if (disposed || outcome === 'csp-blocked') return;
    if (!matches()) { remove(); outcome = 'waiting-for-chat'; return; }
    if (document.getElementById(styleId)) return;
    document.documentElement.setAttribute(attribute, mode);
    document.documentElement.setAttribute(paletteAttribute, palette);
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `html[${attribute}][${paletteAttribute}] { --obsidian-prism-adapter-active: 1; }\n${css}`;
    (document.head || document.documentElement).appendChild(style);
    // A script may run while the page's CSP refuses an inline style. Respect
    // that boundary, remove our markers, and report the blocked application.
    if (!style.sheet || getComputedStyle(document.documentElement).getPropertyValue('--obsidian-prism-adapter-active').trim() !== '1') {
      remove(); outcome = 'csp-blocked'; observer.disconnect(); return;
    }
    outcome = 'applied';
  };
  const observer = new MutationObserver(() => {
    if (disposed || queued !== undefined || outcome === 'csp-blocked') return;
    queued = setTimeout(() => { queued = undefined; apply(); }, 80);
  });
  window[key] = {
    css, mode, palette,
    refresh() { apply(); return outcome; },
    dispose() { disposed = true; observer.disconnect(); clearTimeout(queued); remove(); },
  };
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();
  return outcome;
}

export function createStyleScript(css, mode, palette) {
  return `(${installStyle.toString()})(${JSON.stringify(css)},${JSON.stringify(mode)},${JSON.stringify(palette)})`;
}

/** The directory is fixed beside the installed main entry; no renderer input is accepted. */
export async function startAppearanceLoader({ directory = path.dirname(fileURLToPath(import.meta.url)) } = {}) {
  const { app, webContents, webFrameMain } = await import('electron');
  const watched = new WeakSet();
  const listeners = [];
  const touched = new Map();
  const palettes = new Map();
  let disposed = false;
  let timer;
  let watcher;
  let extensionWatcher;
  let watchedExtension;
  let last = { css: '', mode: 'modern', enabled: false, revision: '' };
  let refreshing = Promise.resolve();
  let themeCheckQueued = false;
  const statusFile = path.join(directory, 'status.json');
  const regular = async file => {
    const stat = await fsp.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unexpected adapter file');
    return fsp.readFile(file);
  };
  const status = async result => {
    try {
      const value = JSON.stringify({ schema: 1, owner: OWNER, pid: process.pid, at: Date.now(), enabled: last.enabled, cssSha256: last.revision, ...result });
      const temp = `${statusFile}.${process.pid}.tmp`;
      await fsp.writeFile(temp, value, { mode: 0o600 });
      await fsp.rename(temp, statusFile);
    } catch { /* Appearance must never interrupt IDE startup or navigation. */ }
  };
  const read = async () => {
    try {
      await fsp.lstat(path.join(directory, 'disabled'));
      return { css: '', mode: last.mode, enabled: false, revision: '' };
    } catch (error) { if (error?.code !== 'ENOENT') return { css: '', mode: last.mode, enabled: false, revision: '' }; }
    try {
      const manifest = JSON.parse((await regular(path.join(directory, 'manifest.json'))).toString());
      if (manifest.schema !== 1 || manifest.owner !== OWNER || !manifest.enabled || !['modern', 'legacy'].includes(manifest.mode) || typeof manifest.extensionRoot !== 'string') throw new Error('Inactive adapter');
      const extension = JSON.parse((await regular(path.join(manifest.extensionRoot, 'package.json'))).toString());
      if (extension.name !== 'obsidian-prism-vscode-theme' || extension.publisher !== 'bahayonghang') throw new Error('Extension removed');
      const data = await regular(path.join(directory, 'appearance.css'));
      if (data.length > 512 * 1024 || sha256(data) !== manifest.cssSha256) throw new Error('Stylesheet changed outside the adapter');
      if (watchedExtension !== manifest.extensionRoot) {
        extensionWatcher?.close(); watchedExtension = manifest.extensionRoot;
        try { extensionWatcher = fs.watch(manifest.extensionRoot, (_event, name) => { if (!name || String(name) === 'package.json') schedule(); }); }
        catch { extensionWatcher = undefined; }
      }
      return { css: data.toString(), mode: manifest.mode, enabled: true, revision: manifest.cssSha256 };
    } catch { return { css: '', mode: last.mode, enabled: false, revision: '' }; }
  };
  const framePalette = async (frame, mode) => {
    try {
      const source = mode === 'legacy' ? frame : frame.parent;
      if (!source || source.isDestroyed?.() || source.detached) return undefined;
      return parseThemeMarker(await source.executeJavaScript(createPaletteScript(mode)));
    } catch { return undefined; }
  };
  const applyFrame = async frame => {
    let id;
    try {
      id = `${frame.processId}:${frame.routingId}`;
      if (frame.isDestroyed?.() || frame.detached) { touched.delete(id); palettes.delete(id); return 'gone'; }
      const eligible = isEligibleFrameUrl(frame.url, last.mode);
      // Revisit previously styled frames to remove our state after navigation.
      if (!eligible && !touched.has(id)) return 'unrelated';
      const palette = eligible && last.enabled ? await framePalette(frame, last.mode) : undefined;
      const result = await frame.executeJavaScript(createStyleScript(eligible && last.enabled ? last.css : '', last.mode, palette));
      if (eligible) { touched.set(id, frame); palettes.set(id, palette ?? null); }
      else { touched.delete(id); palettes.delete(id); }
      return typeof result === 'string' ? result : 'unknown';
    } catch { if (id) { touched.delete(id); palettes.delete(id); } return 'gone'; }
  };
  const collect = () => {
    const frames = new Map();
    for (const [id, frame] of touched) {
      try {
        if (!frame.isDestroyed?.() && !frame.detached) { frames.set(id, frame); continue; }
      } catch { /* A destroyed frame can also reject property reads. */ }
      touched.delete(id); palettes.delete(id);
    }
    for (const contents of webContents.getAllWebContents()) {
      attach(contents);
      try { for (const frame of contents.mainFrame.framesInSubtree) frames.set(`${frame.processId}:${frame.routingId}`, frame); }
      catch { /* A closed or navigating webContents can lose its frame tree. */ }
    }
    return [...frames.values()];
  };
  const perform = async () => {
    if (disposed) return { disposed: true };
    last = await read();
    const results = await Promise.all(collect().map(applyFrame));
    const summary = { appliedFrames: results.filter(value => value === 'applied').length, blockedFrames: results.filter(value => value === 'csp-blocked').length, removedFrames: results.filter(value => value === 'removed').length };
    await status(summary);
    return summary;
  };
  const refresh = () => { const next = refreshing.then(perform, perform); refreshing = next.catch(() => undefined); return next; };
  const checkThemes = async () => {
    if (disposed || !last.enabled) return;
    // The stylesheet is shared by the installation. This small read keeps each
    // window's own public theme marker authoritative, even without an extension
    // host event. The full CSS is resent only when a marker actually changes.
    for (const frame of collect()) {
      try {
        if (!isEligibleFrameUrl(frame.url, last.mode)) continue;
        const id = `${frame.processId}:${frame.routingId}`;
        const palette = await framePalette(frame, last.mode) ?? null;
        if (!palettes.has(id) || palettes.get(id) !== palette) { await perform(); return; }
      } catch { /* A navigation will be picked up by its frame-finish event. */ }
    }
  };
  const scheduleThemeCheck = () => {
    if (disposed || themeCheckQueued) return;
    themeCheckQueued = true;
    const next = refreshing.then(checkThemes, checkThemes).finally(() => { themeCheckQueued = false; });
    refreshing = next.catch(() => undefined);
  };
  function schedule() {
    if (disposed || timer) return;
    timer = setTimeout(() => { timer = undefined; void refresh(); }, 80);
  }
  function attach(contents) {
    if (watched.has(contents)) return;
    watched.add(contents);
    const listener = (_event, _main, processId, routingId) => {
      const frame = webFrameMain.fromId(processId, routingId);
      if (frame) { const next = refreshing.then(() => applyFrame(frame)); refreshing = next.catch(() => undefined); }
    };
    contents.on('did-frame-finish-load', listener);
    listeners.push(() => { if (!contents.isDestroyed()) contents.removeListener('did-frame-finish-load', listener); });
  }
  const onCreated = (_event, contents) => attach(contents);
  app.on('web-contents-created', onCreated);
  try {
    watcher = fs.watch(directory, (_event, name) => {
      // Ignore our own status/temporary files to avoid a watch feedback loop.
      if (!name || ['manifest.json', 'appearance.css', 'disabled'].includes(String(name))) schedule();
    });
  } catch { /* A periodic refresh still removes styles when files disappear. */ }
  const interval = setInterval(schedule, 30_000);
  interval.unref?.();
  const themeInterval = setInterval(scheduleThemeCheck, 1_000);
  themeInterval.unref?.();
  await app.whenReady();
  await refresh();
  return {
    refresh,
    async dispose() {
      if (disposed) return;
      disposed = true; clearTimeout(timer); clearInterval(interval); clearInterval(themeInterval); watcher?.close(); extensionWatcher?.close();
      app.removeListener('web-contents-created', onCreated); for (const remove of listeners) remove();
      await refreshing;
      last = { ...last, css: '', enabled: false, revision: '' };
      await Promise.all([...touched.values()].map(applyFrame));
      await status({ appliedFrames: 0, blockedFrames: 0, removedFrames: touched.size });
      touched.clear(); palettes.clear();
    },
  };
}
