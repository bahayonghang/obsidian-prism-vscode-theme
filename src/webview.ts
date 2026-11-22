import { Uri, type Webview } from 'vscode';

/** Local, sandboxed appearance studio. No host DOM or external resources. */
export function getWebviewHtml(webview: Webview, extensionUri: Uri): string {
  const nonce = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
  const stylesheet = escapeAttribute(webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', 'settings.css')).toString());
  const script = escapeAttribute(webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', 'settings.js')).toString());
  const source = escapeAttribute(webview.cspSource);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${source}; style-src ${source}; script-src 'nonce-${nonce}'; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none';">
  <link rel="stylesheet" href="${stylesheet}">
  <title>Obsidian Prism — Appearance Studio</title>
</head>
<body>
  <main id="app" class="studio" aria-busy="true">
    <header class="masthead">
      <div class="brand">
        <svg class="brand-mark" width="44" height="48" viewBox="0 0 44 48" aria-hidden="true"><path d="M22 2 41 13v22L22 46 3 35V13Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m22 2 9 22-9 22-9-22Z" fill="currentColor" opacity=".18"/><path d="m3 13 28 11L3 35m38-22L13 24l28 11M22 2v44" fill="none" stroke="currentColor" stroke-width="1" opacity=".8"/></svg>
        <div><span class="eyebrow">OBSIDIAN PRISM <span class="brand-separator">/</span> VS CODE</span><h1 data-i18n="title">Appearance studio</h1></div>
      </div>
      <button id="open-settings" class="button quiet" data-i18n="nativeSettings">VS Code settings</button>
    </header>

    <section class="intro" aria-labelledby="intro-title">
      <div><h2 id="intro-title" data-i18n="introTitle">A different light for your workspace.</h2><p data-i18n="introBody">Four carefully balanced palettes. Your code, in focus.</p></div>
      <span class="pill" data-i18n="nativeTheme">Native VS Code theme</span>
    </section>

    <fieldset class="palette-fieldset"><legend class="section-label" data-i18n="paletteLegend">01 / Choose your palette</legend><div id="palette-grid" class="palette-grid"></div></fieldset>

    <div class="studio-columns">
      <div class="controls-column">
        <section class="control-section" aria-labelledby="color-heading">
          <div class="section-heading"><span class="section-number">02</span><h2 id="color-heading" data-i18n="colorHeading">Color & syntax</h2></div>
          <fieldset class="accent-fieldset"><legend data-i18n="accentLabel">Accent color</legend><div id="accent-grid" class="accent-grid"></div></fieldset>
          <div id="custom-accent-row" class="custom-accent-row" hidden><label for="custom-accent" data-i18n="customAccentLabel">Custom accent</label><div class="color-inputs"><input id="custom-accent-picker" type="color" value="#A58AF8" data-i18n-aria="colorPickerLabel" aria-label="Choose custom accent"><input id="custom-accent" type="text" maxlength="7" value="#A58AF8" spellcheck="false" pattern="#[0-9a-fA-F]{6}" aria-describedby="accent-help" placeholder="#A58AF8"></div><span id="accent-help" class="field-hint" data-i18n="hexHelp">Use a six-digit color, for example #A58AF8.</span></div>
          <label class="field" for="contrast"><span data-i18n="contrastLabel">Surface contrast</span><select id="contrast" data-setting="contrast"></select></label>
          <div class="checkbox-row"><input id="italic-comments" type="checkbox" data-setting="italicComments"><label for="italic-comments" data-i18n="italicLabel">Italic comments</label></div>
          <div class="checkbox-row"><input id="bold-keywords" type="checkbox" data-setting="boldKeywords"><label for="bold-keywords" data-i18n="boldLabel">Bold keywords</label></div>
        </section>

        <section class="control-section" aria-labelledby="type-heading">
          <div class="section-heading"><span class="section-number">03</span><h2 id="type-heading" data-i18n="typeHeading">Editor typography</h2><span id="typography-state" class="mini-state"></span></div>
          <p class="scope-note" data-i18n="typeScope">These are editor-wide user settings. Apply them separately; restore brings back your previous values.</p>
          <label class="field" for="code-font"><span data-i18n="fontLabel">Code font</span><select id="code-font" data-setting="codeFont"></select></label>
          <p class="field-hint" data-i18n="fontHint">Fonts must already be installed. A fallback is used when unavailable.</p>
          <div class="field-grid"><label class="field" for="ligatures"><span data-i18n="ligaturesLabel">Font ligatures</span><select id="ligatures" data-setting="ligatures"></select></label><label class="field" for="smooth-caret"><span data-i18n="caretLabel">Smooth cursor</span><select id="smooth-caret" data-setting="smoothCaret"></select></label></div>
          <label class="field" for="smooth-scrolling"><span data-i18n="scrollingLabel">Smooth editor scrolling</span><select id="smooth-scrolling" data-setting="smoothScrolling"></select></label>
          <div class="button-row"><button id="apply-typography" class="button secondary" data-i18n="applyTypography">Apply typography</button><button id="restore-typography" class="button quiet" data-i18n="restore">Restore previous</button></div>
        </section>

        <section class="control-section" aria-labelledby="system-heading">
          <div class="section-heading"><span class="section-number">04</span><h2 id="system-heading" data-i18n="systemHeading">Day & night</h2><span id="system-state" class="mini-state"></span></div>
          <p class="scope-note" data-i18n="systemScope">Use VS Code’s built-in system appearance detection with your preferred Prism pair.</p>
          <div class="field-grid"><label class="field" for="preferred-light"><span data-i18n="lightLabel">Light appearance</span><select id="preferred-light" data-setting="preferredLight"></select></label><label class="field" for="preferred-dark"><span data-i18n="darkLabel">Dark appearance</span><select id="preferred-dark" data-setting="preferredDark"></select></label></div>
          <div class="button-row"><button id="apply-system" class="button secondary" data-i18n="applySystem">Follow system appearance</button><button id="restore-system" class="button quiet" data-i18n="restore">Restore previous</button></div>
        </section>

        <section class="control-section" aria-labelledby="panel-heading">
          <div class="section-heading"><span class="section-number">05</span><h2 id="panel-heading" data-i18n="panelHeading">Studio details</h2><span class="pill small" data-i18n="panelOnly">This panel only</span></div>
          <p class="scope-note" data-i18n="panelScope">Corners, ambient light and motion style this settings panel. They do not change the VS Code window.</p>
          <div class="field-grid"><label class="field" for="corner-style"><span data-i18n="cornersLabel">Corners</span><select id="corner-style" data-setting="cornerStyle"></select></label><label class="field" for="ambient-intensity"><span data-i18n="ambientLabel">Ambient light</span><select id="ambient-intensity" data-setting="ambientIntensity"></select></label></div>
          <div class="field-grid"><label class="field" for="motion"><span data-i18n="motionLabel">Motion</span><select id="motion" data-setting="motion"></select></label><label class="field" for="language"><span data-i18n="languageLabel">Studio language</span><select id="language" data-setting="language"></select></label></div>
        </section>
      </div>

      <aside class="preview-column" aria-labelledby="preview-heading">
        <div class="preview-sticky">
          <div class="preview-heading"><h2 id="preview-heading" data-i18n="previewTitle">Live palette preview</h2><span id="preview-theme-name"></span></div>
          <div id="live-preview" class="live-preview">
            <div class="preview-titlebar"><div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div><span>prism / workspace</span><span class="preview-split" aria-hidden="true">◫</span></div>
            <div class="preview-workspace">
              <div class="preview-activity" aria-hidden="true"><span class="active">▤</span><span>⌕</span><span>⑂</span><span>▦</span><span class="activity-bottom">⚙</span></div>
              <div class="preview-explorer" aria-hidden="true"><span class="explorer-heading">EXPLORER <b>···</b></span><span class="explorer-folder">⌄ &nbsp; PRISM</span><span class="explorer-item">⌄ &nbsp; src</span><span class="explorer-item selected"><i>TS</i> theme.ts</span><span class="explorer-item"><i>TS</i> palette.ts</span><span class="explorer-item">◇ &nbsp; settings.json</span><span class="explorer-item">≡ &nbsp; README.md</span></div>
              <div class="preview-editor"><div class="preview-tabs"><span class="preview-tab"><b>TS</b> theme.ts <span>×</span></span><span class="preview-tab inactive">palette.ts</span></div><div class="preview-breadcrumb">src &nbsp; › &nbsp; theme.ts &nbsp; › &nbsp; illuminate</div><pre id="code-preview" aria-label="TypeScript syntax color preview"><code></code></pre><div class="preview-terminal"><div class="terminal-tabs"><span>TERMINAL</span><span>PROBLEMS <i>0</i></span></div><div><span class="terminal-success">❯</span> npm run build</div><div class="terminal-output"><span class="terminal-success">✓</span> <span data-i18n="buildPreview">A little clarity, compiled.</span></div></div></div>
            </div><div class="preview-statusbar"><span>⑂ main &nbsp; ✓ 0 &nbsp; ⚠ 0</span><span>UTF-8 &nbsp; TypeScript &nbsp; ◇ Prism</span></div>
          </div>
          <p class="preview-caption" data-i18n="previewHint">Preview updates here as you explore. Apply when it feels right.</p>
          <div class="palette-values"><div><span data-i18n="canvasToken">CANVAS</span><b id="token-background">—</b></div><div><span data-i18n="sidebarToken">SIDEBAR</span><b id="token-sidebar">—</b></div><div><span data-i18n="accentToken">ACCENT</span><b id="token-accent">—</b></div></div>
          <div class="apply-card"><div><strong id="draft-state" data-i18n="readyState">Ready to explore</strong><p id="active-theme"></p></div><button id="apply" class="button primary" data-i18n="applyTheme">Apply theme</button></div>
          <div id="status" class="status-message" role="status" aria-live="polite" aria-atomic="true"></div>
          <section class="utility-card" aria-labelledby="settings-tools"><h3 id="settings-tools" data-i18n="toolsHeading">Keep your setup</h3><p data-i18n="toolsDescription">Export saved Prism settings, import a backup, or restore defaults.</p><div class="button-row"><button id="export" class="button quiet" data-i18n="export">Export</button><button id="import" class="button quiet" data-i18n="import">Import</button><button id="reset" class="button quiet danger" data-i18n="reset">Reset Prism</button></div></section>
          <p class="isolation-note" data-i18n="isolationNote">Color adjustments are scoped to Prism themes. Other themes keep their own colors.</p>
        </div>
      </aside>
    </div>

    <footer class="studio-footer"><div><strong>Obsidian Prism</strong><span data-i18n="credit">Palette design by RMvdesi · Independent VS Code port</span></div><nav aria-label="Project links"><button id="upstream-source" class="text-link" data-i18n="upstream">Upstream project</button><button id="port-source" class="text-link" data-i18n="source">VS Code source</button><span>GPL-3.0-only</span></nav></footer>
  </main>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
