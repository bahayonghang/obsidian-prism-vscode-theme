// Run the actual VS Code extension host with a disposable profile. GPL-3.0-only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const root = path.resolve(__dirname, '..');
const scope = '[Obsidian Prism — Obsidian Dark]';
const baseline = {
  // These built-in IDs are identical in VS Code 1.96 and current stable.
  // "Default Dark Modern" is migrated to "Dark Modern" by newer VS Code,
  // which would look like an extension mutation in the activation assertion.
  'workbench.colorTheme': 'Monokai',
  'workbench.preferredDarkColorTheme': 'Monokai',
  'workbench.preferredLightColorTheme': 'Solarized Light',
  'workbench.preferredHighContrastColorTheme': 'Default High Contrast',
  'workbench.preferredHighContrastLightColorTheme': 'Default High Contrast Light',
  'window.autoDetectColorScheme': false,
  'window.autoDetectHighContrast': true,
  'editor.fontFamily': 'Prism Smoke Baseline Mono, monospace',
  'editor.fontLigatures': "'calt' off",
  'editor.cursorSmoothCaretAnimation': 'off',
  'editor.smoothScrolling': false,
  'editor.tabSize': 7,
  'workbench.colorCustomizations': {
    'editorLineNumber.activeForeground': '#EEDDAA',
    [scope]: { 'editor.background': '#191923', 'button.background': '#AABBCC' },
    '[Monokai]': { 'editor.lineHighlightBorder': '#664422' },
  },
  'editor.tokenColorCustomizations': {
    textMateRules: [{ name: 'User global function color', scope: 'entity.name.function', settings: { foreground: '#55DDCC' } }],
    [scope]: { textMateRules: [{ name: 'User Prism numeric color', scope: 'constant.numeric', settings: { foreground: '#FFCC77' } }] },
    '[Monokai]': { comments: '#88AA99' },
  },
  'editor.semanticTokenColorCustomizations': {
    enabled: true,
    rules: { 'variable.readonly': '#ABCDEF' },
    [scope]: { rules: { property: '#112233' } },
    '[Monokai]': { rules: { function: '#CCAA77' } },
  },
  'telemetry.telemetryLevel': 'off',
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'update.mode': 'none',
  'workbench.startupEditor': 'none',
};

async function main() {
  if (!fs.existsSync(path.join(root, 'out', 'extension.js'))) {
    throw new Error('Build the extension first: npm run build');
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-vscode-host-'));
  const userData = path.join(temp, 'user-data');
  const extensions = path.join(temp, 'extensions');
  const workspace = path.join(temp, 'workspace');
  fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
  fs.mkdirSync(extensions);
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(userData, 'User', 'settings.json'), JSON.stringify(baseline, null, 2));

  const launchArgs = [
    workspace,
    `--user-data-dir=${userData}`,
    `--extensions-dir=${extensions}`,
    '--disable-extensions',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--locale=en',
  ];
  // CI uses xvfb-run. Ozone headless is a best-effort fallback on Linux without
  // a display; an Electron platform failure is reported as failure, never skip.
  if (process.platform === 'linux' && !process.env.DISPLAY) launchArgs.push('--ozone-platform=headless');

  console.log(`[host] Testing VS Code ${process.env.VSCODE_TEST_VERSION || 'stable'} with an isolated profile.`);
  let passed = false;
  try {
    await runTests({
      version: process.env.VSCODE_TEST_VERSION || 'stable',
      ...(process.env.VSCODE_EXECUTABLE_PATH ? { vscodeExecutablePath: path.resolve(process.env.VSCODE_EXECUTABLE_PATH) } : {}),
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(root, 'test', 'host', 'index.js'),
      extensionTestsEnv: {
        PRISM_HOST_TEST_BASELINE: JSON.stringify(baseline),
        PRISM_HOST_TEST_ISOLATED: '1',
      },
      launchArgs,
    });
    passed = true;
  } finally {
    if (passed || process.env.PRISM_KEEP_TEST_PROFILE !== '1') {
      fs.rmSync(temp, { recursive: true, force: true });
    } else {
      console.error(`[host] Failed test profile retained for diagnosis: ${temp}`);
    }
  }
}

main().catch((error) => {
  console.error('[host] Extension-host smoke test failed:', error);
  process.exitCode = 1;
});
