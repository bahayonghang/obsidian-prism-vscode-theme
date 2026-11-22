const test = require('node:test');
const assert = require('node:assert/strict');
const { formatDesktopAppearanceReport } = require('../out/chat-adapter.js');

test('shareable adapter reports omit absolute paths and raw filesystem errors on every platform', () => {
  for (const appRoot of ['/home/private-user/Antigravity/resources/app', 'C:\\Users\\private-user\\Antigravity\\resources\\app', '\\\\private-server\\share\\Antigravity\\resources\\app']) {
    for (const language of ['en', 'zh-CN']) {
      const report = formatDesktopAppearanceReport({
        state: 'conflict', supported: false, installed: true, enabled: false, restartRequired: false,
        appRoot, target: `${appRoot}/out/main.js`, backup: `${appRoot}/out/obsidian-prism-desktop/main.original`,
        reason: `EACCES: permission denied, open '${appRoot}/out/main.js'`,
      }, language);
      assert.match(report, /conflict/);
      assert.match(report, /false \/ true \/ false/);
      assert.match(report, /out\/obsidian-prism-desktop\//);
      assert.doesNotMatch(report, /private-user|private-server|EACCES|permission denied/);
      assert.ok(!report.includes(appRoot));
    }
  }
});

test('early filesystem failures cannot leak paths when adapter metadata is unavailable', () => {
  const report = formatDesktopAppearanceReport({
    state: 'unsupported', supported: false, installed: false, enabled: false, restartRequired: false,
    reason: "ENOENT: no such file or directory, realpath '/private/renamed-application'",
  }, 'en');
  assert.match(report, /unsupported/);
  assert.match(report, /Local paths and detailed filesystem errors are omitted/);
  assert.doesNotMatch(report, /ENOENT|private|renamed-application/);
});

test('adapter report localizes guidance without claiming a real conversation was visually verified', () => {
  const report = formatDesktopAppearanceReport({
    state: 'restart-required', supported: true, installed: true, enabled: true, restartRequired: true,
    reason: 'Local diagnostic',
  }, 'zh-CN');
  assert.match(report, /状态: restart-required/);
  assert.match(report, /需要重启: true/);
  assert.match(report, /不代表已验证当前对话页的实际显示/);
  assert.match(report, /省略本地路径/);
  assert.doesNotMatch(report, /Local diagnostic/);
});
