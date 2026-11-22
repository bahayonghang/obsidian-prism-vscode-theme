// Actual VS Code API integration tests; no mocked configuration store. GPL-3.0-only.
const assert = require('node:assert/strict');
const vscode = require('vscode');
const { detectHostAppearance } = require('../../out/host.js');

const extensionId = 'bahayonghang.obsidian-prism-vscode-theme';
const scope = '[Obsidian Prism — Obsidian Dark]';
const labels = [
  'Obsidian Prism — Obsidian Dark',
  'Obsidian Prism — Warm Charcoal',
  'Obsidian Prism — Daylight Crystal',
  'Obsidian Prism — Warm Alabaster',
];
const typographyKeys = ['editor.fontFamily', 'editor.fontLigatures', 'editor.cursorSmoothCaretAnimation', 'editor.smoothScrolling'];
const systemKeys = ['workbench.preferredDarkColorTheme', 'workbench.preferredLightColorTheme', 'window.autoDetectColorScheme'];
const highContrastKeys = ['workbench.preferredHighContrastColorTheme', 'workbench.preferredHighContrastLightColorTheme', 'window.autoDetectHighContrast'];
const read = (key) => vscode.workspace.getConfiguration().inspect(key)?.globalValue;
const write = (key, value) => vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);

async function until(predicate, description, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function command(name) {
  let timer;
  try {
    await Promise.race([
      vscode.commands.executeCommand(`obsidianPrism.${name}`),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Command did not finish: ${name}`)), 5000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sameValues(keys, baseline) {
  for (const key of keys) assert.deepEqual(read(key), baseline[key], `${key} should retain/restore its previous explicit value`);
}

function prismRules() {
  return read('editor.tokenColorCustomizations')?.[scope]?.textMateRules || [];
}

exports.run = async function run() {
  assert.equal(process.env.PRISM_HOST_TEST_ISOLATED, '1', 'Run through scripts/test-host.cjs to protect real user settings');
  const baseline = JSON.parse(process.env.PRISM_HOST_TEST_BASELINE);
  let checks = 0;
  async function check(name, body) {
    await body();
    checks += 1;
    console.log(`[host] PASS ${name}`);
  }

  await check('extension activation and contributions preserve the user environment', async () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, 'extension must be installed as the development extension');
    await extension.activate();
    assert.equal(extension.isActive, true);
    assert.equal(extension.packageJSON.contributes.themes.length, 4);
    assert.deepEqual(extension.packageJSON.contributes.themes.map((theme) => theme.label), labels);
    assert.equal(extension.packageJSON.contributes.commands.length, 11);
    const registered = await vscode.commands.getCommands(true);
    for (const item of extension.packageJSON.contributes.commands) assert.ok(registered.includes(item.command), item.command);
    // Drain the extension's activation queue through an intentionally empty
    // restore. This must return without waiting for a notification dismissal.
    await command('restoreTypography');
    sameValues(['workbench.colorTheme', ...typographyKeys, ...systemKeys, ...highContrastKeys], baseline);
    sameValues(['workbench.colorCustomizations', 'editor.tokenColorCustomizations', 'editor.semanticTokenColorCustomizations'], baseline);
  });

  await check('host metadata reports the actual IDE product version separately from its engine', async () => {
    const host = await detectHostAppearance();
    assert.equal(host.appName, vscode.env.appName);
    assert.equal(host.vscodeVersion, vscode.version);
    if (process.env.PRISM_EXPECTED_IDE_VERSION) {
      assert.equal(host.kind, 'antigravity-ide');
      assert.equal(host.ideVersion, process.env.PRISM_EXPECTED_IDE_VERSION, 'the test must run against the requested actual Antigravity IDE product');
    }
    console.log(`[host] Appearance metadata: ${host.appName}; IDE ${host.ideVersion || 'n/a'}; engine ${host.vscodeVersion}; bridge ${host.bridgeVersion || 'unavailable'}; path ${host.colorPath}.`);
    // Agent extensions can be disabled in these API tests. Their missing bridge
    // metadata must stay unverified instead of inferring a bridge from the IDE version.
    if (host.ideVersion === '2.8.0' && !host.bridgeVersion) assert.equal(host.colorPath, 'unverified');
  });

  await check('compatibility report opens read-only metadata without changing settings', async () => {
    const keys = ['workbench.colorTheme', 'workbench.colorCustomizations', ...typographyKeys, ...systemKeys];
    const before = Object.fromEntries(keys.map(key => [key, read(key)]));
    await command('showCompatibilityReport');
    const document = vscode.window.activeTextEditor?.document;
    assert.ok(document, 'a compatibility report editor must be visible');
    assert.equal(document.uri.scheme, 'obsidian-prism-report', 'content-provider documents are read-only');
    assert.equal(document.isUntitled, false, 'the report must not open as an editable untitled document');
    assert.equal(document.languageId, 'plaintext');
    assert.ok(document.getText().includes(vscode.env.appName));
    assert.ok(document.getText().includes(vscode.version));
    assert.match(document.getText(), /Source reference match|源码样本匹配/);
    if (vscode.env.appRoot) assert.ok(!document.getText().includes(vscode.env.appRoot), 'local installation paths must not be included');
    sameValues(keys, before);
  });

  await check('sidebar and input preferences cover all four palettes and preserve native user overrides', async () => {
    const originalColors = JSON.parse(JSON.stringify(read('workbench.colorCustomizations')));
    const seeded = JSON.parse(JSON.stringify(originalColors));
    const lightScope = `[${labels[2]}]`;
    seeded['sideBar.background'] = '#343434';
    seeded[scope]['sideBar.background'] = '#171A1F';
    seeded[scope]['input.border'] = '#3C4859';
    seeded[lightScope] = { 'sideBar.background': '#EFEDEE', 'input.border': '#CCAABB' };
    await write('workbench.colorCustomizations', seeded);
    await write('obsidianPrism.sidebarSurface', 'unified');
    await write('obsidianPrism.inputBorder', 'accent');

    const editorBackgrounds = ['#0E0E11', '#141413', '#F4F7FB', '#F6F4EE'];
    const accents = ['#669DF6', '#D97757', '#2563EB', '#C25934'];
    await until(() => labels.every((label, index) => {
      const colors = read('workbench.colorCustomizations')?.[`[${label}]`];
      return colors?.['sideBar.background'] === editorBackgrounds[index] && colors?.['input.border'] === accents[index];
    }), 'four unified sidebar and accented input scopes');
    let colors = read('workbench.colorCustomizations');
    assert.equal(colors['sideBar.background'], '#343434', 'a global native override must not be rewritten');
    assert.deepEqual(colors['[Monokai]'], originalColors['[Monokai]']);
    assert.equal(colors[scope]['editor.background'], originalColors[scope]['editor.background'], 'the user editor canvas remains independent');
    assert.equal(read('workbench.colorTheme'), baseline['workbench.colorTheme']);

    await write('obsidianPrism.sidebarSurface', 'tinted');
    await until(() => labels.every((label, index) => {
      const background = read('workbench.colorCustomizations')?.[`[${label}]`]?.['sideBar.background'];
      return /^#[0-9A-F]{6}$/.test(background || '') && background !== editorBackgrounds[index];
    }), 'tinted backgrounds in both dark and light palettes');
    colors = JSON.parse(JSON.stringify(read('workbench.colorCustomizations')));
    colors[scope]['sideBar.background'] = '#123456';
    colors[scope]['input.border'] = '#654321';
    await write('workbench.colorCustomizations', colors);
    await write('obsidianPrism.accent', 'iris');
    await write('obsidianPrism.sidebarSurface', 'unified');
    await until(() => labels.slice(1).every((label, index) => {
      const values = read('workbench.colorCustomizations')?.[`[${label}]`];
      return values?.['sideBar.background'] === editorBackgrounds[index + 1]
        && values?.['input.border'] === (index === 0 ? '#A58AF8' : '#7C3AED');
    }), 'unmodified sidebar scopes follow later preferences');
    colors = read('workbench.colorCustomizations');
    assert.equal(colors[scope]['sideBar.background'], '#123456', 'later manual sidebar edits remain authoritative');
    assert.equal(colors[scope]['input.border'], '#654321', 'later manual input border edits remain authoritative');

    await command('resetCustomizations');
    const expected = JSON.parse(JSON.stringify(seeded));
    expected[scope]['sideBar.background'] = '#123456';
    expected[scope]['input.border'] = '#654321';
    assert.deepEqual(read('workbench.colorCustomizations'), expected, 'reset restores light-palette originals and removes owned new leaves while keeping manual dark-palette edits');
    assert.deepEqual(read('editor.tokenColorCustomizations'), baseline['editor.tokenColorCustomizations']);
    assert.deepEqual(read('editor.semanticTokenColorCustomizations'), baseline['editor.semanticTokenColorCustomizations']);
    // Remove only this scenario's seeded and manual values for the later checks.
    await write('workbench.colorCustomizations', originalColors);
  });

  await check('native Settings applies accent overrides only inside four exact Prism scopes', async () => {
    await write('obsidianPrism.accent', 'iris');
    await until(() => labels.every((label, index) => read('workbench.colorCustomizations')?.[`[${label}]`]?.['button.background'] === (index < 2 ? '#A58AF8' : '#7C3AED')), 'all four iris accent scopes');
    const colors = read('workbench.colorCustomizations');
    assert.equal(colors['editorLineNumber.activeForeground'], '#EEDDAA');
    assert.equal(colors[scope]['editor.background'], '#191923');
    assert.deepEqual(colors['[Monokai]'], baseline['workbench.colorCustomizations']['[Monokai]']);
    assert.equal(read('workbench.colorTheme'), baseline['workbench.colorTheme'], 'changing a preference must not select a theme');
  });

  await check('repeated native settings changes preserve user syntax rules without duplicates', async () => {
    await write('obsidianPrism.italicComments', true);
    await until(() => prismRules().some((rule) => rule.name === 'Comments' && rule.settings.fontStyle === 'italic'), 'italic TextMate rules');
    await until(() => read('editor.semanticTokenColorCustomizations')?.[scope]?.rules?.comment?.italic === true, 'semantic comment style');
    const initialCount = prismRules().length;
    for (const [accent, expected] of [['amber', '#F2B84B'], ['iris', '#A58AF8']]) {
      await write('obsidianPrism.accent', accent);
      await until(() => read('workbench.colorCustomizations')?.[scope]?.['button.background'] === expected, `${accent} accent`);
      await until(() => prismRules().length === initialCount, 'stable TextMate rule count');
    }
    assert.equal(prismRules().filter((rule) => rule.name === 'Comments').length, 1);
    assert.deepEqual(prismRules()[0], baseline['editor.tokenColorCustomizations'][scope].textMateRules[0]);
    assert.deepEqual(read('editor.tokenColorCustomizations').textMateRules, baseline['editor.tokenColorCustomizations'].textMateRules);
    assert.equal(read('editor.semanticTokenColorCustomizations')[scope].rules.property, '#112233');
  });

  await check('editor typography is explicit and reversible through real commands', async () => {
    await write('obsidianPrism.codeFont', 'jetbrains');
    await write('obsidianPrism.ligatures', 'on');
    await write('obsidianPrism.smoothCaret', 'on');
    await write('obsidianPrism.smoothScrolling', 'on');
    sameValues(typographyKeys, baseline);
    await command('applyTypography');
    assert.match(read('editor.fontFamily'), /JetBrains Mono/);
    assert.equal(read('editor.fontLigatures'), true);
    assert.equal(read('editor.cursorSmoothCaretAnimation'), 'on');
    assert.equal(read('editor.smoothScrolling'), true);
    await command('restoreTypography');
    sameValues(typographyKeys, baseline);
  });

  await check('restoring typography respects a later manual font edit', async () => {
    await command('applyTypography');
    await write('editor.fontFamily', 'My Later Font, monospace');
    await command('restoreTypography');
    assert.equal(read('editor.fontFamily'), 'My Later Font, monospace');
    sameValues(typographyKeys.filter((key) => key !== 'editor.fontFamily'), baseline);
    // Restore only this test's manual edit before the final reset scenario.
    await write('editor.fontFamily', baseline['editor.fontFamily']);
  });

  await check('system appearance changes are reversible and preserve High Contrast preferences', async () => {
    await write('obsidianPrism.preferredDark', 'warm');
    await write('obsidianPrism.preferredLight', 'alabaster');
    sameValues(systemKeys, baseline);
    await command('applySystemAppearance');
    assert.equal(read('workbench.preferredDarkColorTheme'), labels[1]);
    assert.equal(read('workbench.preferredLightColorTheme'), labels[3]);
    assert.equal(read('window.autoDetectColorScheme'), true);
    sameValues(highContrastKeys, baseline);
    await command('restoreSystemAppearance');
    sameValues([...systemKeys, ...highContrastKeys], baseline);
  });

  await check('Theme Studio opens in a real webview', async () => {
    await command('openSettings');
    await until(() => vscode.window.tabGroups.all.flatMap((group) => group.tabs).some((tab) => tab.label === 'Obsidian Prism · Theme Studio'), 'Theme Studio tab');
  });

  await check('reset restores owned values and preferences while preserving other settings and manual edits', async () => {
    await command('applyTypography');
    await command('applySystemAppearance');
    await write('editor.tabSize', 11);
    const manualColors = JSON.parse(JSON.stringify(read('workbench.colorCustomizations')));
    manualColors[scope]['button.background'] = '#123456';
    await write('workbench.colorCustomizations', manualColors);
    await command('resetCustomizations');

    const expectedColors = JSON.parse(JSON.stringify(baseline['workbench.colorCustomizations']));
    expectedColors[scope]['button.background'] = '#123456';
    assert.deepEqual(read('workbench.colorCustomizations'), expectedColors);
    assert.deepEqual(read('editor.tokenColorCustomizations'), baseline['editor.tokenColorCustomizations']);
    assert.deepEqual(read('editor.semanticTokenColorCustomizations'), baseline['editor.semanticTokenColorCustomizations']);
    sameValues([...typographyKeys, ...systemKeys, ...highContrastKeys], baseline);
    assert.equal(read('editor.tabSize'), 11);
    const extension = vscode.extensions.getExtension(extensionId);
    for (const [key, definition] of Object.entries(extension.packageJSON.contributes.configuration.properties)) {
      assert.equal(read(key), undefined, `${key} explicit preference should be cleared`);
      assert.deepEqual(vscode.workspace.getConfiguration().get(key), definition.default, `${key} should use its shipped default`);
    }
  });

  console.log(`[host] ${checks} integration checks passed in VS Code ${vscode.version}.`);
};
