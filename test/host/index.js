// Actual VS Code API integration tests; no mocked configuration store. GPL-3.0-only.
const assert = require('node:assert/strict');
const vscode = require('vscode');

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
    assert.equal(extension.packageJSON.contributes.commands.length, 10);
    const registered = await vscode.commands.getCommands(true);
    for (const item of extension.packageJSON.contributes.commands) assert.ok(registered.includes(item.command), item.command);
    // Drain the extension's activation queue through an intentionally empty
    // restore. This must return without waiting for a notification dismissal.
    await command('restoreTypography');
    sameValues(['workbench.colorTheme', ...typographyKeys, ...systemKeys, ...highContrastKeys], baseline);
    sameValues(['workbench.colorCustomizations', 'editor.tokenColorCustomizations', 'editor.semanticTokenColorCustomizations'], baseline);
  });

  await check('native Settings applies accent overrides only inside four exact Prism scopes', async () => {
    await write('obsidianPrism.accent', 'iris');
    await until(() => labels.every((label, index) => read('workbench.colorCustomizations')?.[`[${label}]`]?.['button.background'] === (index < 2 ? '#A58AF8' : '#7C3AED')), 'all four iris accent scopes');
    const colors = read('workbench.colorCustomizations');
    assert.equal(colors['editorLineNumber.activeForeground'], '#EEDDAA');
    assert.equal(colors[scope]['editor.background'], '#191923');
    assert.deepEqual(colors['[Default Dark Modern]'], baseline['workbench.colorCustomizations']['[Default Dark Modern]']);
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
