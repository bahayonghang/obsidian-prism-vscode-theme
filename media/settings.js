/* Obsidian Prism appearance studio. Local assets only; no network or host DOM access. */
(() => {
  'use strict';
  const vscode = acquireVsCodeApi();
  const byId = id => document.getElementById(id);
  const app = byId('app');
  const paletteIds = ['obsidian', 'warm', 'crystal', 'alabaster'];
  const paletteSwatches = {
    obsidian: { background: '#0E0E11', sidebar: '#09090B', foreground: '#F2F2F5', accent: '#669DF6', border: '#dae4ff12' },
    warm: { background: '#141413', sidebar: '#10100F', foreground: '#F2EFE9', accent: '#D97757', border: '#f5f0e615' },
    crystal: { background: '#F4F7FB', sidebar: '#E8EEF6', foreground: '#0F172A', accent: '#2563EB', border: '#0f172a26' },
    alabaster: { background: '#F6F4EE', sidebar: '#EBE6DC', foreground: '#1C1814', accent: '#C25934', border: '#2a201428' }
  };
  const fonts = {
    default: "var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace)",
    jetbrains: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
    cascadia: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', Consolas, monospace",
    sfmono: "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  };
  const text = {
    en: {
      title: 'Appearance studio', nativeSettings: 'VS Code settings', introTitle: 'A different light for your workspace.', introBody: 'Four carefully balanced palettes. Your code, in focus.', nativeTheme: 'Native VS Code theme', paletteLegend: '01 / Choose your palette',
      obsidian: 'Obsidian Dark', warm: 'Warm Charcoal', crystal: 'Daylight Crystal', alabaster: 'Warm Alabaster', obsidianCaption: 'Cool · deep slate', warmCaption: 'Warm · soft charcoal', crystalCaption: 'Cool · clear daylight', alabasterCaption: 'Warm · paper tones',
      colorHeading: 'Color & syntax', accentLabel: 'Accent color', default: 'Palette', cobalt: 'Cobalt', iris: 'Iris', amber: 'Amber', mono: 'Graphite', custom: 'Custom', customAccentLabel: 'Custom accent', colorPickerLabel: 'Choose custom accent', hexHelp: 'Use a six-digit color, for example #A58AF8.', contrastLabel: 'Surface contrast', standardContrast: 'Standard — soft separation', highContrast: 'Higher — stronger borders', italicLabel: 'Italic comments', boldLabel: 'Bold keywords',
      typeHeading: 'Editor typography', typeScope: 'These are editor-wide user settings. Apply them separately; restore brings back your previous values.', fontLabel: 'Code font', fontDefault: 'Keep my editor font', fontHint: 'Fonts must already be installed. A fallback is used when unavailable.', ligaturesLabel: 'Font ligatures', caretLabel: 'Smooth cursor', scrollingLabel: 'Smooth editor scrolling', inherit: 'Keep my setting', on: 'On', off: 'Off', applyTypography: 'Apply typography', restore: 'Restore previous', managed: 'Applied', unmanaged: 'Optional',
      systemHeading: 'Day & night', systemScope: 'Use VS Code’s built-in system appearance detection with your preferred Prism pair.', lightLabel: 'Light appearance', darkLabel: 'Dark appearance', applySystem: 'Follow system appearance',
      panelHeading: 'Studio details', panelOnly: 'This panel only', panelScope: 'Corners, ambient light and motion style this settings panel. They do not change the VS Code window.', cornersLabel: 'Corners', sharp: 'Sharp', balanced: 'Balanced', soft: 'Soft', ambientLabel: 'Ambient light', ambient0: 'Off', ambient35: 'Soft · 35%', ambient70: 'Balanced · 70%', ambient100: 'Full · 100%', motionLabel: 'Motion', subtle: 'Subtle', standard: 'Standard', ultra: 'Expressive', languageLabel: 'Studio language', auto: 'Follow VS Code',
      previewTitle: 'Live palette preview', previewHint: 'Preview updates here as you explore. Apply when it feels right.', canvasToken: 'CANVAS', sidebarToken: 'SIDEBAR', accentToken: 'ACCENT', readyState: 'Ready to explore', draftState: 'Previewing your changes', savedState: 'Your palette is ready', applyTheme: 'Apply theme', applying: 'Applying…', activeTheme: 'Current theme: ', buildPreview: 'A little clarity, compiled.',
      toolsHeading: 'Keep your setup', toolsDescription: 'Export saved Prism settings, import a backup, or restore defaults.', export: 'Export', import: 'Import', reset: 'Reset Prism', isolationNote: 'Color adjustments are scoped to Prism themes. Other themes keep their own colors.',
      credit: 'Palette design by RMvdesi · Independent VS Code port', upstream: 'Upstream project', source: 'VS Code source', invalidAccent: 'Enter a complete hex color such as #A58AF8 before applying.', waiting: 'Working…', previewComment: '// A little clarity, in every detail.'
    },
    'zh-CN': {
      title: '主题外观工作室', nativeSettings: 'VS Code 设置', introTitle: '为你的工作区，换一种光。', introBody: '四套精心调校的配色，让注意力回到代码。', nativeTheme: '原生 VS Code 主题', paletteLegend: '01 / 选择配色',
      obsidian: '深空黑曜', warm: '暖炭玄岩', crystal: '白昼冷晶', alabaster: '暖白画册', obsidianCaption: '冷调 · 深色岩板', warmCaption: '暖调 · 柔和炭灰', crystalCaption: '冷调 · 清透日光', alabasterCaption: '暖调 · 细腻纸色',
      colorHeading: '颜色与代码高亮', accentLabel: '强调色', default: '跟随配色', cobalt: '钴蓝', iris: '鸢尾紫', amber: '琥珀', mono: '石墨', custom: '自定义', customAccentLabel: '自定义强调色', colorPickerLabel: '选择自定义强调色', hexHelp: '输入六位颜色值，例如 #A58AF8。', contrastLabel: '界面对比度', standardContrast: '标准 · 柔和分层', highContrast: '较高 · 清晰边框', italicLabel: '注释使用斜体', boldLabel: '关键字使用粗体',
      typeHeading: '编辑器字体与体验', typeScope: '这些是对所有主题生效的编辑器设置，需要单独应用。恢复时会找回你之前的设置。', fontLabel: '代码字体', fontDefault: '保留我的编辑器字体', fontHint: '字体需已安装在电脑上；缺少时会使用后备字体。', ligaturesLabel: '字体连字', caretLabel: '平滑光标', scrollingLabel: '编辑器平滑滚动', inherit: '保留我的设置', on: '开启', off: '关闭', applyTypography: '应用编辑器设置', restore: '恢复之前的设置', managed: '已应用', unmanaged: '可选设置',
      systemHeading: '日间与夜间', systemScope: '使用 VS Code 自带的系统明暗切换，分别选择你喜欢的浅色与深色主题。', lightLabel: '浅色外观', darkLabel: '深色外观', applySystem: '跟随系统明暗',
      panelHeading: '工作室细节', panelOnly: '仅此设置面板', panelScope: '圆角、环境光与动效只影响本设置面板，不会改变整个 VS Code 窗口。', cornersLabel: '圆角', sharp: '利落', balanced: '均衡', soft: '柔和', ambientLabel: '环境光', ambient0: '关闭', ambient35: '轻柔 · 35%', ambient70: '均衡 · 70%', ambient100: '饱满 · 100%', motionLabel: '动效', subtle: '轻微', standard: '标准', ultra: '灵动', languageLabel: '面板语言', auto: '跟随 VS Code',
      previewTitle: '配色实时预览', previewHint: '调整时先在这里预览，满意后再点击应用。', canvasToken: '编辑区', sidebarToken: '侧边栏', accentToken: '强调色', readyState: '挑选喜欢的外观', draftState: '正在预览，尚未应用', savedState: '配色已准备就绪', applyTheme: '应用主题', applying: '正在应用…', activeTheme: '当前主题：', buildPreview: '让每一行代码，都清晰一点。',
      toolsHeading: '保存你的搭配', toolsDescription: '导出已保存的 Prism 设置、导入备份，或恢复默认外观。', export: '导出', import: '导入', reset: '重置 Prism', isolationNote: '颜色调整仅对 Prism 主题生效，其他主题保留各自的配色。',
      credit: '配色设计：RMvdesi · 独立 VS Code 移植版本', upstream: '上游项目', source: 'VS Code 源码', invalidAccent: '请先输入完整颜色值，例如 #A58AF8。', waiting: '正在处理…', previewComment: '// 让每一处细节，都清晰一点。'
    }
  };
  const selectChoices = {
    contrast: [['standard', 'standardContrast'], ['high', 'highContrast']],
    codeFont: [['default', 'fontDefault'], ['jetbrains', 'JetBrains Mono'], ['cascadia', 'Cascadia Code'], ['sfmono', 'SF Mono']],
    ligatures: [['inherit', 'inherit'], ['on', 'on'], ['off', 'off']],
    smoothCaret: [['inherit', 'inherit'], ['on', 'on'], ['off', 'off']],
    smoothScrolling: [['inherit', 'inherit'], ['on', 'on'], ['off', 'off']],
    cornerStyle: [['sharp', 'sharp'], ['balanced', 'balanced'], ['soft', 'soft']],
    ambientIntensity: [[0, 'ambient0'], [35, 'ambient35'], [70, 'ambient70'], [100, 'ambient100']],
    motion: [['off', 'off'], ['subtle', 'subtle'], ['standard', 'standard'], ['ultra', 'ultra']],
    language: [['auto', 'auto'], ['zh-CN', '简体中文'], ['en', 'English']],
    preferredDark: [['obsidian', 'obsidian'], ['warm', 'warm']],
    preferredLight: [['crystal', 'crystal'], ['alabaster', 'alabaster']]
  };
  let hostState;
  let draft = {};
  let palette = 'obsidian';
  let dirtyPalette = false;
  const dirtyKeys = new Set();
  let renderedLanguage = '';
  let activeLanguage = 'en';
  let latestPreviewRequest = 0;
  let invalidAccent = false;
  let applying = false;
  let previewTimer;
  const t = key => text[activeLanguage][key] || text.en[key] || key;
  const post = message => vscode.postMessage(message);
  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const dirty = () => dirtyPalette || dirtyKeys.size > 0;

  function translate() {
    activeLanguage = draft.language && draft.language !== 'auto' ? draft.language : (hostState.autoLanguage || hostState.language);
    if (!text[activeLanguage]) activeLanguage = 'en';
    if (activeLanguage === renderedLanguage) return;
    renderedLanguage = activeLanguage;
    document.documentElement.lang = activeLanguage;
    document.title = `Obsidian Prism — ${t('title')}`;
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria)); });
    document.querySelectorAll('select[data-setting]').forEach(select => {
      select.replaceChildren(...selectChoices[select.dataset.setting].map(([value, label]) => {
        const option = element('option', '', t(label));
        option.value = String(value);
        return option;
      }));
    });
    renderPalettes();
    renderAccents();
  }

  function renderPalettes() {
    byId('palette-grid').replaceChildren(...paletteIds.map(id => {
      const colors = paletteSwatches[id];
      const choice = element('div', 'palette-choice');
      const input = element('input', 'visually-hidden');
      input.type = 'radio'; input.name = 'palette'; input.id = `palette-${id}`; input.value = id;
      const label = element('label', 'palette-card');
      label.htmlFor = input.id;
      label.style.setProperty('--card-bg', colors.background);
      label.style.setProperty('--card-side', colors.sidebar);
      label.style.setProperty('--card-fg', colors.foreground);
      label.style.setProperty('--card-accent', colors.accent);
      label.style.setProperty('--card-border', colors.border);
      const mini = element('div', 'mini-window'); mini.setAttribute('aria-hidden', 'true');
      const side = element('div', 'mini-sidebar');
      const code = element('div', 'mini-code');
      for (let i = 0; i < 4; i += 1) side.append(element('i'));
      for (let i = 0; i < 5; i += 1) code.append(element('i'));
      mini.append(side, code);
      const row = element('div', 'palette-name-row');
      const check = element('span', 'palette-check', '✓'); check.setAttribute('aria-hidden', 'true');
      row.append(element('span', 'palette-name', t(id)), check);
      label.append(mini, row, element('div', 'palette-caption', t(`${id}Caption`)));
      input.addEventListener('change', () => {
        if (!input.checked) return;
        palette = id;
        dirtyPalette = palette !== hostState.palette;
        syncForm();
        requestPreview();
      });
      choice.append(input, label);
      return choice;
    }));
  }

  function renderAccents() {
    const swatches = { default: '#669DF6', cobalt: '#669DF6', iris: '#A58AF8', amber: '#F2B84B', mono: '#9BA1B0', custom: '#A58AF8' };
    byId('accent-grid').replaceChildren(...Object.keys(swatches).map(value => {
      const choice = element('div', 'accent-choice');
      const input = element('input', 'visually-hidden');
      input.type = 'radio'; input.name = 'accent'; input.id = `accent-${value}`; input.value = value;
      const label = element('label'); label.htmlFor = input.id;
      const dot = element('span', `accent-dot ${value}`); dot.style.setProperty('--swatch', swatches[value]); dot.setAttribute('aria-hidden', 'true');
      label.append(dot, element('span', '', t(value)));
      input.addEventListener('change', () => { if (input.checked) changeSetting('accent', value); });
      choice.append(input, label);
      return choice;
    }));
  }

  function changeSetting(key, value) {
    draft[key] = value;
    if (value === hostState.settings[key]) dirtyKeys.delete(key); else dirtyKeys.add(key);
    if (key === 'accent' && value !== 'custom') invalidAccent = false;
    translate();
    syncForm();
    requestPreview();
  }

  function syncForm() {
    if (!hostState) return;
    document.querySelectorAll('[data-setting]').forEach(control => {
      const value = draft[control.dataset.setting];
      if (control.type === 'checkbox') control.checked = !!value;
      else control.value = String(value);
    });
    document.querySelectorAll('input[name="palette"]').forEach(input => { input.checked = input.value === palette; });
    document.querySelectorAll('input[name="accent"]').forEach(input => { input.checked = input.value === draft.accent; });
    byId('custom-accent-row').hidden = draft.accent !== 'custom';
    if (!invalidAccent) {
      byId('custom-accent').value = draft.customAccent;
      if (/^#[0-9a-f]{6}$/i.test(draft.customAccent)) byId('custom-accent-picker').value = draft.customAccent;
    }
    byId('custom-accent').setAttribute('aria-invalid', String(invalidAccent));
    byId('apply').disabled = applying || (invalidAccent && draft.accent === 'custom');
    byId('apply').textContent = applying ? t('applying') : t('applyTheme');
    byId('draft-state').textContent = dirty() ? t('draftState') : t('savedState');
    byId('active-theme').textContent = t('activeTheme') + hostState.activeTheme;
    byId('typography-state').textContent = t(hostState.typographyApplied ? 'managed' : 'unmanaged');
    byId('system-state').textContent = t(hostState.systemApplied ? 'managed' : 'unmanaged');
    byId('restore-typography').disabled = !hostState.typographyApplied;
    byId('restore-system').disabled = !hostState.systemApplied;
    byId('preview-theme-name').textContent = t(palette);
    app.dataset.motion = draft.motion;
    const radii = { sharp: [2, 4, 6], balanced: [4, 6, 10], soft: [6, 10, 14] }[draft.cornerStyle] || [4, 6, 10];
    ['sm', 'md', 'lg'].forEach((size, index) => app.style.setProperty(`--radius-${size}`, `${radii[index]}px`));
    app.style.setProperty('--ambient-opacity', String(Number(draft.ambientIntensity) / 100));
    byId('live-preview').style.setProperty('--preview-font', fonts[draft.codeFont] || fonts.default);
    byId('code-preview').style.fontVariantLigatures = draft.ligatures === 'on' ? 'common-ligatures contextual' : draft.ligatures === 'off' ? 'none' : 'normal';
  }

  function requestPreview() {
    clearTimeout(previewTimer);
    const requestId = ++latestPreviewRequest;
    previewTimer = setTimeout(() => {
      post({ type: 'preview', palette, settings: { ...draft }, requestId });
    }, 45);
  }

  const safeColor = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
  function syntaxColor(theme, type, fallback) {
    const semantic = theme.semanticTokenColors && theme.semanticTokenColors[type];
    if (typeof semantic === 'string') return safeColor(semantic, fallback);
    if (semantic && typeof semantic.foreground === 'string') return safeColor(semantic.foreground, fallback);
    const scopePatterns = {
      comment: /(^|\.)comment($|\.)/, keyword: /(^|\.)keyword($|\.)/, string: /(^|\.)string($|\.)/, number: /constant\.numeric/,
      function: /entity\.name\.function|support\.function/, type: /entity\.name\.type|support\.type/, property: /variable\.other\.property|support\.type\.property-name/, variable: /variable\.other/
    };
    for (const rule of theme.tokenColors || []) {
      const scopes = Array.isArray(rule.scope) ? rule.scope : typeof rule.scope === 'string' ? rule.scope.split(',') : [];
      if (scopes.some(scope => scopePatterns[type].test(scope)) && rule.settings) return safeColor(rule.settings.foreground, fallback);
    }
    return fallback;
  }

  function showPreview(theme) {
    if (!theme || !theme.colors || typeof theme.colors !== 'object') return;
    const colors = theme.colors;
    const base = paletteSwatches[palette];
    const preview = byId('live-preview');
    const vars = {
      bg: safeColor(colors['editor.background'], base.background), fg: safeColor(colors['editor.foreground'], base.foreground),
      side: safeColor(colors['sideBar.background'], base.sidebar), muted: safeColor(colors.descriptionForeground, base.foreground),
      border: safeColor(colors['panel.border'], base.border), accent: safeColor(colors.focusBorder, base.accent),
      selection: safeColor(colors['list.activeSelectionBackground'], `${base.accent}28`),
      line: safeColor(colors['editorLineNumber.foreground'], base.foreground), green: safeColor(colors['terminal.ansiGreen'], '#50A37B'),
      'status-bg': safeColor(colors['statusBar.background'], base.sidebar), 'status-fg': safeColor(colors['statusBar.foreground'], base.foreground)
    };
    Object.entries(vars).forEach(([key, value]) => preview.style.setProperty(`--preview-${key}`, value));
    ['keyword', 'string', 'function', 'type', 'number', 'comment', 'property', 'variable'].forEach(type => {
      preview.style.setProperty(`--syntax-${type}`, syntaxColor(theme, type, type === 'comment' ? vars.muted : vars.fg));
    });
    preview.style.setProperty('--comment-style', draft.italicComments ? 'italic' : 'normal');
    preview.style.setProperty('--keyword-weight', draft.boldKeywords ? '700' : '400');
    byId('token-background').textContent = vars.bg.toUpperCase();
    byId('token-sidebar').textContent = vars.side.toUpperCase();
    byId('token-accent').textContent = vars.accent.toUpperCase();
    renderCode();
  }

  function renderCode() {
    const code = byId('code-preview').querySelector('code');
    const token = (type, value) => ({ type, value });
    const lines = [
      [token('comment', t('previewComment'))], [],
      [token('keyword', 'const'), ' ', token('variable', 'profile'), ' = {'],
      ['  ', token('property', 'palette'), ': ', token('string', `"${palette}"`), ','],
      ['  ', token('property', 'accent'), ': ', token('string', `"${draft.accent}"`), ','],
      ['  ', token('property', 'clarity'), ': ', token('number', '100')],
      ['};'], [],
      [token('keyword', 'function'), ' ', token('function', 'illuminate'), '(theme: ', token('type', 'Theme'), ') {'],
      ['  ', token('keyword', 'return'), ' prism.', token('function', 'refract'), '(theme, {'],
      ['    ', token('property', 'surface'), ': ', token('string', '"quiet"'), ','],
      ['    ', token('property', 'focus'), ': ', token('keyword', 'true')],
      ['  });'], ['}'], [],
      [token('function', 'illuminate'), '(profile);']
    ];
    code.replaceChildren(...lines.map((parts, index) => {
      const line = element('span', 'code-line');
      const number = element('span', 'line-no', String(index + 1)); number.setAttribute('aria-hidden', 'true');
      const content = element('span', 'line-content');
      if (parts.length === 0) content.textContent = ' ';
      parts.forEach(part => content.append(typeof part === 'string' ? document.createTextNode(part) : element('span', `tok-${part.type}`, part.value)));
      line.append(number, content);
      return line;
    }));
  }

  function setStatus(message, level = 'info') {
    const status = byId('status');
    status.textContent = message;
    status.dataset.level = level;
    status.setAttribute('role', level === 'error' ? 'alert' : 'status');
    if (level === 'error') { applying = false; syncForm(); }
  }

  function receiveState(message) {
    if (!message.settings || !message.palette || !paletteIds.includes(message.palette)) return;
    if (!hostState || message.resetDraft) {
      clearTimeout(previewTimer);
      latestPreviewRequest += 1;
      draft = { ...message.settings };
      palette = message.palette;
      dirtyKeys.clear();
      dirtyPalette = false;
      invalidAccent = false;
      applying = false;
    } else {
      Object.entries(message.settings).forEach(([key, value]) => {
        if (!dirtyKeys.has(key)) draft[key] = value;
        else if (draft[key] === value) dirtyKeys.delete(key);
      });
      if (!dirtyPalette) palette = message.palette;
      else if (palette === message.palette) dirtyPalette = false;
    }
    hostState = message;
    translate();
    syncForm();
    if (!dirty() && message.preview) showPreview(message.preview);
    else requestPreview();
    app.setAttribute('aria-busy', 'false');
  }

  document.querySelectorAll('[data-setting]').forEach(control => {
    control.addEventListener('change', () => {
      if (!hostState) return;
      const key = control.dataset.setting;
      const value = control.type === 'checkbox' ? control.checked : key === 'ambientIntensity' ? Number(control.value) : control.value;
      changeSetting(key, value);
    });
  });
  byId('custom-accent').addEventListener('input', event => {
    if (!hostState) return;
    const value = event.target.value.trim();
    invalidAccent = !/^#[0-9a-f]{6}$/i.test(value);
    if (!invalidAccent) changeSetting('customAccent', value.toUpperCase());
    else syncForm();
  });
  byId('custom-accent-picker').addEventListener('input', event => {
    if (!hostState) return;
    invalidAccent = false;
    changeSetting('customAccent', event.target.value.toUpperCase());
  });
  byId('apply').addEventListener('click', () => {
    if (!hostState || applying) return;
    if (invalidAccent && draft.accent === 'custom') { setStatus(t('invalidAccent'), 'error'); byId('custom-accent').focus(); return; }
    applying = true;
    syncForm();
    setStatus(t('waiting'));
    post({ type: 'apply', palette, settings: { ...draft } });
  });
  byId('apply-typography').addEventListener('click', () => { if (hostState) { setStatus(t('waiting')); post({ type: 'applyTypography', settings: { ...draft } }); } });
  byId('apply-system').addEventListener('click', () => { if (hostState) { setStatus(t('waiting')); post({ type: 'applySystem', settings: { ...draft } }); } });
  const actions = {
    'restore-typography': 'restoreTypography', 'restore-system': 'restoreSystem', 'open-settings': 'openSettings', export: 'export', import: 'import', reset: 'reset'
  };
  Object.entries(actions).forEach(([id, type]) => byId(id).addEventListener('click', () => { if (hostState) post({ type }); }));
  byId('upstream-source').addEventListener('click', () => post({ type: 'openSource', source: 'upstream' }));
  byId('port-source').addEventListener('click', () => post({ type: 'openSource', source: 'port' }));
  window.addEventListener('message', event => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state') receiveState(message);
    else if (message.type === 'preview') {
      if (message.requestId !== undefined && message.requestId !== latestPreviewRequest) return;
      showPreview(message.preview);
    } else if (message.type === 'status' && typeof message.message === 'string') {
      setStatus(message.message, message.level === 'error' ? 'error' : 'info');
      if (applying && message.level !== 'error') { applying = false; syncForm(); }
    }
  });
  post({ type: 'ready' });
})();
