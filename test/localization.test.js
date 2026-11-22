/* Native Settings remain bilingual without changing the IDE display language. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SETTINGS, SETTING_KEYS, CHAT_APPEARANCE_KEYS, validateSettings, parseSettings } = require('../out/config.js');
const manifest = require('../package.json');
const english = require('../package.nls.json');
const chinese = require('../package.nls.zh-cn.json');
const properties = manifest.contributes.configuration.properties;

function resolve(value, messages) {
  const match = /^%([^%]+)%$/.exec(value);
  assert.ok(match, `Expected a manifest localization reference: ${value}`);
  const result = messages[match[1]] ?? english[match[1]];
  assert.equal(typeof result, 'string', `Missing manifest translation: ${value}`);
  assert.doesNotMatch(result, /%setting\./, 'Nested unresolved placeholders cannot be displayed');
  return result;
}

test('native descriptions include Chinese in an English IDE and English in a Chinese IDE', () => {
  assert.deepEqual(new Set(Object.keys(properties)), new Set(SETTING_KEYS.map(key => `obsidianPrism.${key}`)));
  for (const [key, property] of Object.entries(properties)) {
    for (const messages of [english, chinese]) {
      const paragraphs = resolve(property.markdownDescription, messages).split('\n\n');
      assert.equal(paragraphs.length, 2, `${key}: each language has its own paragraph`);
      assert.match(paragraphs[messages === english ? 1 : 0], /\p{Script=Han}/u, `${key}: Chinese description`);
      assert.match(paragraphs[messages === english ? 0 : 1], /[A-Za-z]{3}/, `${key}: English description`);
    }
    assert.equal(property.scope, 'application');
    assert.equal(Object.hasOwn(property, 'enumLabels'), false, 'Build-only label metadata must not enter the native schema');
    assert.equal(Object.hasOwn(property, 'zh'), false);
  }
});

test('native option labels are readable while saved enum values retain their types and identifiers', () => {
  for (const [name, property] of Object.entries(properties)) {
    const key = name.slice('obsidianPrism.'.length);
    if (!property.enum) {
      assert.equal(Object.hasOwn(property, 'enumItemLabels'), false);
      continue;
    }
    assert.equal(property.enumItemLabels.length, property.enum.length, `${name}: labels must align with values`);
    for (let index = 0; index < property.enum.length; index++) {
      const value = property.enum[index];
      assert.equal(typeof value, typeof DEFAULT_SETTINGS[key], `${name}: stored value type`);
      assert.deepEqual(validateSettings({ [key]: value }), { [key]: value });
      for (const messages of [english, chinese]) {
        const label = resolve(property.enumItemLabels[index], messages);
        assert.ok(label.length > 0, `${name}: empty option label`);
        if (key !== 'codeFont' || value === 'default') assert.match(label, /\p{Script=Han}/u, `${name}: Chinese option label`);
      }
    }
  }
  assert.deepEqual(properties['obsidianPrism.language'].enum, ['auto', 'zh-CN', 'en']);
  assert.deepEqual(properties['obsidianPrism.ambientIntensity'].enum, [0, 35, 70, 100]);
  assert.throws(() => validateSettings({ language: resolve(properties['obsidianPrism.language'].enumItemLabels[1], english) }), /Invalid value/);
});

test('language is first in Native Settings and explains the separate native and extension UI behavior', () => {
  const language = properties['obsidianPrism.language'];
  assert.equal(Object.entries(properties).sort((a, b) => a[1].order - b[1].order)[0][0], 'obsidianPrism.language');
  const description = resolve(language.markdownDescription, english);
  assert.match(description, /Theme Studio/);
  assert.match(description, /bilingual/);
  assert.match(description, /headings from setting IDs/);
  assert.match(description, /does not change the IDE display language/);
  const imported = parseSettings(JSON.stringify({
    format: 'obsidian-prism-vscode-theme', version: 1,
    settings: { language: 'zh-CN', accent: 'iris', ambientIntensity: 35 },
  }));
  assert.equal(imported.language, 'zh-CN');
  assert.equal(imported.accent, 'iris');
  assert.equal(imported.ambientIntensity, 35);
});

test('optional chat preferences explain the separate enable action and offer localized commands', () => {
  for (const key of CHAT_APPEARANCE_KEYS) {
    const description = resolve(properties[`obsidianPrism.${key}`].markdownDescription, english);
    assert.match(description, /separate Enable Chat Appearance command/, key);
    assert.match(description, /saving or importing this preference never enables the adapter/, key);
    assert.match(description, /保存或导入此偏好不会启用适配器/u, key);
  }
  for (const command of ['chooseLanguage', 'enableChatAppearance', 'updateChatAppearance', 'disableChatAppearance']) {
    const contribution = manifest.contributes.commands.find(item => item.command === `obsidianPrism.${command}`);
    assert.ok(contribution, command);
    assert.match(resolve(contribution.title, english), /[A-Za-z]{3}/, command);
    assert.match(resolve(contribution.title, chinese), /\p{Script=Han}/u, command);
    if (command === 'chooseLanguage') assert.match(resolve(contribution.title, english), /选择扩展语言/u);
  }
});
