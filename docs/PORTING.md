# 可行性与移植边界

修改日期：2026-11-21。上游：RMvdesi / Obsidian Prism `v1.0.7-beta.1`，固定提交 [`5dac53bfa7cf917d40101dad2579f32dd1b1b587`](https://github.com/RMvdesi/obsidian-prism/tree/5dac53bfa7cf917d40101dad2579f32dd1b1b587)。规划见 [issue #1](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/1)。

## 结论

**主题配色和对应设置可以移植；原应用的整套界面样式不能原封不动搬进标准 VS Code 扩展。** 本项目采用四个原生颜色主题和一个设置扩展。原生主题负责编辑器、侧栏、标签栏、终端与代码颜色；Theme Studio 负责设置和预览。上游的业务模块不在范围内。

这项区别来自 VS Code 的公开接口：[颜色主题](https://code.visualstudio.com/api/extension-guides/color-theme)支持工作台色值、TextMate 与语义高亮；[扩展限制](https://code.visualstudio.com/api/extension-capabilities/overview#restrictions)明确说明扩展不能访问工作台 DOM 或加入任意自定义样式表。修改安装目录、注入 Electron、启用调试端口不属于本项目采用的实现方式。

## 原生与面板的区别

“原生主题”指 VS Code 本身的编辑器和工作台。“仅面板”指通过 `WebviewPanel` 打开的 Theme Studio 页面。面板能设置自己的圆角、阴影和过渡效果；这些 CSS 不能影响编辑器外壳，也不会替其他扩展重做界面。

| 上游项目或设置 | 上游含义 | 本项目处理 |
| --- | --- | --- |
| `palette: obsidian` + dark | Obsidian Dark | 原生深色主题 |
| `palette: warm` + dark | Warm Charcoal | 原生深色主题 |
| `lightPreset: crystal` | Daylight Crystal | 原生浅色主题 |
| `lightPreset: alabaster` | Warm Alabaster | 原生浅色主题 |
| `palette: host` | 跟随宿主自身配色 | 使用 VS Code 原生主题选择器选择其他主题；不创建第五个重复主题 |
| `accentTone: follow` | 跟随模型/宿主强调色 | 改为各配色的默认强调色；主题扩展不读取模型状态 |
| `accentTone: cobalt/iris/amber/mono` | 强调色色组 | 原生配色设置，分别适配深浅背景 |
| 自定义强调色 | 本移植版新增 | 校验十六进制色值后映射原生颜色 token |
| 对比度 | 本移植版新增 | Standard / High；增强分界和可读性，不替代系统辅助功能 |
| 注释斜体、关键字加粗 | 本移植版新增 | TextMate/语义高亮样式 |
| `cornerStyle` | 全局控件圆角 | Sharp / Balanced / Soft，**仅 Theme Studio** |
| `ambientIntensity` | 环境光强度 | 0 / 35 / 70 / 100，**仅 Theme Studio** |
| `motionLevel` | 全局动效等级 | Off / Subtle / Standard / Ultra，**仅 Theme Studio**；不是上游物理引擎的逐帧复刻 |
| `targetFps` | 上游动画渲染调度 | 不移植全局 FPS 控制；面板依赖浏览器渲染并尊重减少动态效果设置 |
| `codeFont` | 代码字体栈 | Default / JetBrains / Cascadia / SF Mono；显式写入原生编辑器设置 |
| `codeLigatures` | 字体连字 | Inherit / On / Off；与字体一起显式应用 |
| `smoothCaret` | 上游自定义光标跟随 | 映射 VS Code 原生平滑光标选项；不移植 DOM 光标追踪器 |
| `scrollBottomMotion` | 聊天滚动到底部的动画 | 适配为 VS Code 原生编辑器平滑滚动开关，不复刻聊天自动滚动 |
| 自动浅色/深色 | 跟随宿主主题状态 | 显式应用 VS Code 系统明暗检测与深浅偏好组合；提供恢复 |
| `language` | 设置面板语言 | Theme Studio 提供中文和英文；不翻译整个 VS Code |
| `homeLayout/homeRipple/logoInk` | 聊天首页与水波、标志效果 | 不移植宿主首页；面板的主题预览不代表聊天首页功能 |
| `composerRestyle/placeholderStyle` | 聊天输入框和占位文字 | 无对应宿主，排除 |
| `sidebarRestyle/sidebarCompact/sidebarNavFold` | 对话栏布局 | 只映射原生侧栏颜色；不改写 VS Code 资源管理器布局 |
| `mascot` | 像素宠物 | 排除 |
| `telemetryModule`、额度/context vial | 模型使用统计 | 排除 |
| `effortSliderModule` | 推理强度和模型控制 | 排除 |
| `thoughtTranslate/thoughtView/thoughtTrigger` | 思维内容翻译与展示 | 排除 |
| `omniModule/linkTarget/contextMenu` | 浏览器、文件预览、上下文操作 | 排除；保持 VS Code 自身行为 |
| `sidebarStudio/hostLocalization/autoUpdate` | 聊天侧栏、宿主翻译、上游更新器 | 排除；更新通过正常 VSIX/扩展分发流程进行 |

来源：[上游配置](https://github.com/RMvdesi/obsidian-prism/blob/5dac53bfa7cf917d40101dad2579f32dd1b1b587/config.example.json)、[设置选项定义](https://github.com/RMvdesi/obsidian-prism/blob/5dac53bfa7cf917d40101dad2579f32dd1b1b587/settings-panel.js)、[颜色与字体定义](https://github.com/RMvdesi/obsidian-prism/blob/5dac53bfa7cf917d40101dad2579f32dd1b1b587/style.css)。

## 颜色映射

| 上游变量或语义 | VS Code 对应区域 |
| --- | --- |
| `--content` | `editor.background` |
| `--sidebar` | `sideBar.background`、Activity Bar 等外侧表面 |
| `--card` / `--secondary` | 浮层、输入框、选项卡和列表层次 |
| `--foreground` / `--secondary-foreground` | 编辑器与工作台前景 |
| `--muted-foreground` | 注释、次要文字及辅助标签的基础色 |
| `--primary` / `--link` | 按钮、焦点、链接、活动状态 |
| `--error` / `--warning` / `--success` | 诊断、版本控制和终端语义颜色 |
| 上游明暗调色板 | TextMate 语法类别、语义 token、ANSI 终端色组 |

上游没有提供完整 VS Code `tokenColors` 规则。代码语法和语义映射是本项目新增的适配；浅色背景下按可读性调整部分强调色。颜色参考：[Theme Color](https://code.visualstudio.com/api/references/theme-color)、[Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)、[Semantic Highlight Guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)。

## 设置保存与恢复

### 颜色自定义

动态颜色写入 VS Code 支持的 `workbench.colorCustomizations`、`editor.tokenColorCustomizations` 等设置，并放入四个**完整主题名称**对应的块中。因此，主题切换本身即可隔离这些配色，不需要给其他主题重新涂色。官方语法见 [Customize a Color Theme](https://code.visualstudio.com/docs/configure/themes#_customize-a-color-theme)。

写入用户设置时读取 `inspect(...).globalValue`，保留原用户值，而非将 `.get()` 返回的默认值、工作区值合并结果再写回用户文件。每个受管理的设置保留修改前的状态和最后写入值。恢复时只回退仍由本扩展拥有的值，保留后续手工更改；无关主题和未知字段不被整体替换。[WorkspaceConfiguration API](https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration)说明了配置层级和持久化更新机制。

### 字体与系统明暗

字体、连字、平滑光标、平滑滚动以及自动明暗模式是**用户级 VS Code 设置**，不能用颜色主题名称限定它们的作用范围。Theme Studio 将“修改面板中的选项”与“应用到 VS Code”分开，并提供对应恢复动作。

切换其他主题、关闭窗口、禁用或卸载扩展均不承诺自动恢复这些设置。需要原样退回时，卸载前分别执行 Restore Typography 和 Restore System Appearance。语言专属设置、工作区设置和系统高对比偏好仍可能覆盖用户值。系统主题设置指 VS Code 对操作系统明暗偏好的跟随，不修改操作系统自身设置。

`deactivate()` 也会在正常关闭扩展宿主时触发，不能将它当作仅在卸载时执行的钩子；因此不在关闭窗口时反复重置用户配置。见 [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)。

Restore Typography 和 Restore System Appearance 分别恢复各自的设置。Reset Customizations（面板中的 Reset Prism）则是**完整重置**：恢复仍受管理的颜色、字体和系统明暗值，并清除本扩展偏好；仍保留其他设置及后续手工改动。

### 导入与导出

导出用于保存本扩展的外观选择。导入必须校验格式、版本、允许的键、枚举和颜色值；它不接受任意 VS Code 设置、路径、命令或脚本。导入字体/系统明暗选项后仍使用各自显式应用流程。面板内外的设置变更使用同一组配置定义，避免显示值与实际值各自保存一份。

## 面板实现与可访问性

Theme Studio 使用本地资源和 VS Code Webview 消息通信，限制本地资源目录，采用 CSP，并在扩展端验证消息和值。不从 CDN 引入脚本，不访问远程服务。所有控件提供文字标签、可见焦点和键盘操作；动态效果响应 `prefers-reduced-motion`。参考 [Webview API](https://code.visualstudio.com/api/extension-guides/webview)。

运行时不读取聊天记录、凭据或模型状态。没有遥测、上传、代理、调试端口或后台守护进程。高对比度和自定义强调色仍需人工检查实际使用场景，文档不把单项数值检查说成完整的可访问性认证。

## 兼容性与构建

目标 API 为 VS Code `^1.96.0`。原生主题为静态 JSON。扩展分别提供桌面和浏览器 bundle；共享代码使用 VS Code URI/配置 API，不通过 Node 文件系统或子进程修改应用。浏览器扩展入口运行在 Web Worker，除了 `vscode` 以外的依赖需要打进 bundle。见 [Web Extensions](https://code.visualstudio.com/api/extension-guides/web-extensions)。

桌面安装使用 `npm run package` 生成的 `artifacts/obsidian-prism-vscode-theme-0.1.0.vsix`。在浏览器宿主中验证需要 VS Code 官方侧载或 `@vscode/test-web` 流程；不能把桌面安装成功当作浏览器验收通过。打包工具为 [`@vscode/vsce`](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)，构建和打包不自动发布 Marketplace。

## 验收重点

- 四个静态主题可选择，主要颜色与上游色表一致。
- 自定义强调色、对比度和代码样式只影响 Prism 主题。
- 已有的其他主题设置、用户手工修改和工作区配置不会被误覆盖。
- 连续应用、恢复、重启及无已有配置的场景行为一致。
- 导入拒绝未知字段、错误类型和非法颜色；导出可重新导入。
- 中文、英文、窄窗口、键盘、减少动态效果和高对比使用场景可用。
- VSIX 内含主题、运行文件、资源、许可证和来源声明。
- 明确区分纯函数/模拟 API 测试与真实桌面、浏览器宿主测试，并在 issue 记录实际结果。

## 许可证与来源

本移植版遵循上游 GPL-3.0-only，保留 `LICENSE`、`NOTICE` 与 `THIRD_PARTY_NOTICES.md` 原文。原始调色板和主题设计归 RMvdesi / Obsidian Prism 及列出的上游贡献者所有。原生 token 映射、扩展运行时、设置面板、恢复逻辑、测试和文档是本移植版的修改。详见 [UPSTREAM.md](../UPSTREAM.md)。
