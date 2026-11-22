# Antigravity IDE 对话侧栏适配

**本文记录 0.2.0 的原生颜色路径。0.3.0 新增的可选安装文件适配层与恢复说明见 [CHAT_APPEARANCE.md](CHAT_APPEARANCE.md)。**

对应 [Issue #2](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/2)，目标版本 **0.2.0**。证据检查日期：2026-11-21（America/New_York；UTC 日期为 2026-11-22）。

## 结论

**可以用普通 VS Code 主题改变 Antigravity IDE 对话侧栏的主要配色。** 本版通过原生颜色接口统一侧栏背景、欢迎文字、顶部按钮和输入卡片的配色。输入卡片的颜色由 Antigravity 根据侧栏颜色计算；它没有在本次检查中暴露独立的主题颜色接口。

这意味着顶部、欢迎区和底部输入框能够一起跟随 Prism，但不能承诺用三个独立颜色分别控制它们。`sideBar.*` 同时影响资源管理器等侧栏；`input.border` 可以改变原生输入框边框，**不能据此声称改变 Antigravity 对话输入卡片的边框**。

本结论来自官方发行包的静态检查，已经追踪到实际前端的颜色使用处。未登录 Antigravity，也未获取真实对话界面的安装后截图。Theme Studio 中的对话预览是按已检查公式绘制的示意，不能替代用户安装版本的视觉验证。

## 适用产品与版本

Antigravity App、Antigravity IDE 和 `Google.google-antigravity` 扩展有各自的版本号。此项目适配的是 **Antigravity IDE / VS Code 主题接口**，不向独立 Antigravity App 安装主题。

| 检查对象 | 版本 | 用途 |
| --- | --- | --- |
| Antigravity IDE，Linux x64 官方包 | 2.8.0，基于 VS Code 1.107.0 | 检查侧栏渲染位置、内置扩展及主题桥接 |
| 上述 IDE 内置 `google.google-antigravity` | 1.12.0 | 检查允许传给前端的颜色和实时更新机制 |
| Marketplace `Google.google-antigravity` 官方扩展 | 1.13.0 | 交叉检查同一侧栏位置和主题桥接机制；与 IDE 内置扩展分开记录 |
| 扩展所用官方 CLI 更新渠道中的前端资源 | CLI 1.5.14 | 检查 `setTheme` 接收端、欢迎区、顶栏和实际输入卡片 |
| 旧版 Antigravity IDE，Linux x64 官方包 | 1.23.2，基于 VS Code 1.107.0 | 检查历史原生工作台侧栏实现，避免套用新版结论 |

官方更新记录说明：VS Code 扩展 1.0.0 于 2026-08-18 加入主题颜色和编辑器字体同步；1.1.0 于 2026-08-27 修复浅色/深色背景不匹配；IDE 2.6.0 于 2026-10-26 引入由内置扩展提供的新版 Agent 界面。IDE 2.8.0 和独立 App 2.34.0 是两个产品版本。[来源：官方更新记录](https://antigravity.google/docs/changelog)、[官方 VS Code 扩展介绍](https://antigravity.google/docs/ide/extensions/vscode/)、[官方 Agent Side Panel 文档](https://antigravity.google/docs/ide/agent-side-panel/)。

**IDE 版本不能唯一确定对话前端版本。** 2.8.0 中的扩展使用官方 CLI 更新服务；本次额外检查该服务当日提供的 1.5.14，并没有假设其永久与 IDE 2.8.0 绑定。该前端包含截图中的 “Good to see you” 欢迎文案，但这只能证明组件对应，不能从图片确定用户安装的版本。

## 使用方式

1. 在 Antigravity IDE 的扩展界面安装本项目的 VSIX，选择一个 Obsidian Prism 主题。
2. 运行 `Obsidian Prism: Open Theme Studio`（命令 ID：`obsidianPrism.openSettings`），选择侧栏风格并查看对话示意。
3. 如需检查宿主识别结果，运行兼容性报告命令 `obsidianPrism.showCompatibilityReport`。报告与预览都不读取对话内容。

| 设置 | 选项 / 默认值 | 实际范围 |
| --- | --- | --- |
| `obsidianPrism.sidebarSurface` | `layered`（默认）、`unified`、`tinted` | 调整共享侧栏配色，影响对话侧栏及资源管理器等原生侧栏；现代对话卡片继续由这些颜色派生 |
| `obsidianPrism.inputBorder` | `subtle`（默认）、`accent` | 调整原生 `input.border`；不作为对话卡片边框开关 |

主题功能通过 VS Code 主题与配置接口工作。0.2.0 不修改 Antigravity 安装目录，也不注入第三方工作台 CSS/JavaScript。

## 现代侧栏：颜色如何到达实际组件

证据链分为三步。第一步，内置扩展把主对话页面放在 `location: "sideBar"` 的 Webview 中，并将宿主的 `sideBar.background` / `sideBar.foreground` 设为内部背景、前景别名。缺少相应变量时分别退回编辑器背景、前景。

第二步，`bridge.js` 读取允许转发的 CSS 变量，把上述别名覆盖到传给 `setTheme` 的 `editor.background`、`editor.foreground` 和 `foreground`。它监听主题和样式变化，所以侧栏可以跟随主题切换更新。`agy.background` 和 `agy.foreground` 是这个桥接过程中的内部别名，**不是主题扩展可以直接填写的已注册颜色 ID**。

第三步，CLI 前端的 `setTheme` 接收端保存颜色，主题函数再生成 `--background`、`--foreground`、`--card`、`--card-border` 等内部变量。实际组件使用这些变量。仅在桥接列表里看到一个颜色，并不能证明某个按钮或输入框使用它。

这与 [VS Code Webview 主题机制](https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content) 一致；每个 Webview 的最终效果仍取决于其自己的 CSS。完整文件指纹、源文件路径、定位字符串和颜色列表见 [antigravity-evidence.json](./antigravity-evidence.json)。

### 截图三个区域的对应关系

下表适用于本次检查的现代前端、普通桌面对话模式。`B` 是桥接后的侧栏背景，`F` 是桥接后的侧栏前景。百分比表示 CSS 的 `color-mix(in srgb, ...)` 混色。

| 区域 | 实际使用方式 | 可由主题控制的内容 | 不能承诺的内容 |
| --- | --- | --- | --- |
| 顶部工具栏背景 | 工具栏容器透明，露出 `B` | 跟随 `sideBar.background` | 单独的工具栏背景色 |
| 顶部常态按钮/文字 | `--secondary-foreground`：`75% F + 25% B` | 跟随 `sideBar.foreground` 和背景 | `icon.foreground` 或 `sideBarTitle.foreground` 独立控制内部图标 |
| 顶部按钮悬停 | 前景 `F`；背景 `--secondary` | 跟随共享侧栏颜色 | `toolbar.hoverBackground` 独立控制这些按钮 |
| 欢迎区底色与标题 | 基础画布 `--background = B`；标题 `text-foreground = F` | 跟随侧栏背景、前景 | 独立的欢迎区背景色 |
| 欢迎标志 | 使用 `F`，组件另外应用透明度和遮罩 | 标志的基础颜色 | 通过主题改变标志形状、遮罩或尺寸 |
| 对话输入卡片填充 | `.surface-composer-card` 使用 `bg-card` | 根据 `B/F` 派生 | `input.background` 直接控制卡片 |
| 对话输入卡片边框 | 外层 `.surface-composer` 使用 `bg-card-border` | 根据 `B/F` 和卡片色派生 | `input.border` / `focusBorder` 独立控制边框 |
| 输入文字 | 编辑区继承 `--foreground = F` | 跟随侧栏前景 | `input.foreground` 独立控制该编辑区 |
| 输入占位文字 | `text-foreground opacity-60` | `F` 以 60% 不透明度覆盖卡片底色 | `input.placeholderForeground` 或内部通用 `--placeholder` 直接控制它 |
| 主按钮与链接 | `--primary` / `--primary-foreground` / `--link` | 分别使用 `button.background`、`button.foreground`、`textLink.foreground` | 保证每个操作按钮都采用主按钮样式 |

### 可复核的派生公式

以 Antigravity 内部标准对比度（值 `1`，前端初始值）为例：

| 内部变量 | 深色模式 | 浅色模式 |
| --- | --- | --- |
| `--background`、`--content` | `B` | `B` |
| `--foreground` | `F` | `F` |
| `--primary` | `button.background` | 相同 |
| `--primary-foreground` | `button.foreground` | 相同 |
| `--link` | `textLink.foreground`，缺少时使用前端默认色 | 相同 |
| `--secondary` | `12% F + 88% B` | `6% F + 94% B` |
| `--secondary-foreground` | `75% F + 25% B` | 相同 |
| `--muted`、`--sidebar` | `2.5% F + 97.5% B` | 相同 |
| `--muted-foreground` | `50% F + 50% B` | 相同 |
| 通用 `--placeholder` | `30% F + 70% B` | 相同；**对话占位文字未使用此变量** |
| `--card` | `5% F + 95% B` | `70% B + 30% #ffffff` |
| `--card-border` | `5% F + 95% card` | `7.5% F + 92.5% card` |
| 通用 `--border` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.075)` |

`--sidebar-secondary` 将相同模式下的 secondary 百分比与 `--sidebar` 混合；`--sidebar-muted` 将 muted 百分比与 `--sidebar` 混合。`--shell` 引用背景，`--glass` 引用 card，`--glass-border` 引用通用 border。在宿主主题模式下，独立 App 的 `data-agy-theme` 玻璃效果选择器不会启用。

Antigravity 内部高对比度（值 `2`）另外使用：深色 secondary 14%、浅色 secondary 8%、muted 4%、深色 card 6.5%、深色 card-border 前景 10%、浅色 card-border 前景 12%，以及通用边框透明度 0.10 / 0.12。此设置属于 Antigravity 内部状态，与 `obsidianPrism.contrast` 不是同一个开关。预览若使用标准公式，应明确其示意性质。

因此，原生主题可以通过 `B/F` 改变卡片及边框的最终颜色，但无法在保持侧栏不变时任意单独指定卡片色。把 `input.border` 加进主题，只能证明原生输入框颜色已配置。

### 为什么不直接使用 `chat.*`

VS Code 的[主题颜色参考](https://code.visualstudio.com/api/references/theme-color)包含 `chat.*`、`inlineChat.*` 等颜色，这些属于相应的 VS Code 界面。检查到的 Antigravity 桥接列表没有转发它们，也没有转发 `input.placeholderForeground`；实际对话组件采用上述语义变量。因此本项目不会把配置标准 VS Code Chat 的颜色，当作已经适配 Antigravity 的证据。

另一个容易误读的片段是前端中 `--vscode-input-background` → `--secondary` 的映射。它由前端向嵌套的 sidecar iframe 发送 `theme-change` 消息，方向是**从内部语义颜色导出**；不是 Antigravity 对话输入框读取宿主 `input.background` 的证据。

## 旧版 IDE 1.23.2 的差异

官方旧版包中的对话侧栏直接使用工作台内的 `.antigravity-agent-side-panel`。其局部 CSS 把 `.bg-agent-convo-background` 改为 `sideBar.background`；不能只检查同名全局工具类，因为全局默认值使用的是 `editor.background`。

实际输入框仍有 `antigravity.agentSidePanelInputBox` ID，但其内部 `.bg-input` 使用 **90% `editor.background` + 10% `#6b7280`**。外层 `.bg-gray-500/20` 是固定半透明灰 `#6b728033`。这里的类名 `bg-input` 同样不表示它读取 `input.background`，也不能通过 `input.border` 替换这个外层灰色。

旧版可以随主题改变主要背景和文字，但输入框与新版的联动关系不同。旧包不包含这次截图中的完整欢迎文案，不能仅凭截图给用户指定旧版版本号。该包的地址、构建信息和文件哈希也收录在证据文件中。

历史项目 [Antigravity-Better](https://github.com/016/Antigravity-Better) 通过改写工作台文件并注入样式来覆盖旧版选择器，说明额外定制可以依赖内部实现。这不是原生主题 API 的承诺。0.2.0 没有引入该方式；0.3.0 的独立实现见前述新文档，仍不引入主题以外功能。

## 验证范围与复核办法

本次研究已完成官方发行包校验、桥接颜色列表检查和前端实际组件追踪。现代 CLI 压缩包还与官方更新清单中的 SHA-512 校验值一致。证据文件对这些检查标记为静态源契约验证，**不把它们等同于已登录 Agent 的运行截图验证**。

维护者更新适配时：

1. 从下方官方入口取得明确版本的发行包与 CLI 更新清单；保留版本、构建号和压缩包指纹。CLI 可以独立更新，需同时记录。
2. 只解包，不运行安装脚本或 CLI。IDE 重点检查 `resources/app/product.json`、`extensions/agy/package.json`、`extensions/agy/vscode/extension.js` 和 `extensions/agy/bridge.js`。
3. CLI 当前把前端保存在二进制中的 ZIP 本地文件条目。静态读取 `main.js`、`compiled_tailwind.css`、`jetbox.css`、`index.html`，按 ZIP 长度、CRC-32 和证据文件中的 SHA-256 复核。偏移只适用于该文件指纹；不要假设下次构建仍相同。
4. 重新追踪 `setTheme` → 语义变量 → 实际组件。特别检查 `antigravity.agentSidePanelInputBox`、`surface-composer-card`、`home-greeting` 和 `HeaderButtonIcon`，不能停在允许转发的变量列表。
5. 在可登录的 Antigravity IDE 中手动切换四个 Prism 主题及三种侧栏风格，确认顶部、欢迎区、输入区、已有对话和悬停状态的可读性；再确认 Explorer 共享变化、原生输入框边框和恢复设置。记录 IDE、内置扩展及实际 CLI 版本。遇到独立升级的前端，应重新验证。

仓库只保存研究结论和指纹，不分发 Google 安装包或提取出的专有代码。测试、打包及具体完成状态以 [Issue #2](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/2) 和项目 CI 为准。

## 官方材料

- [Antigravity 更新记录](https://antigravity.google/docs/changelog)
- [VS Code 扩展说明](https://antigravity.google/docs/ide/extensions/vscode/)及 [Marketplace 页面](https://marketplace.visualstudio.com/items?itemName=Google.google-antigravity)
- [Agent Side Panel 文档](https://antigravity.google/docs/ide/agent-side-panel/)
- [IDE 下载入口](https://antigravity.google/download)与 [1.23.2 历史版本入口](https://antigravity.google/releases?tab=ide&version=1.23.2)
- [IDE 2.8.0 Linux x64 官方归档](https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/2.8.0-6733682917113856/linux-x64/Antigravity%20IDE.tar.gz)
- [IDE 1.23.2 Linux x64 官方归档](https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/1.23.2-4781536860569600/linux-x64/Antigravity.tar.gz)
- [CLI 官方安装脚本文本](https://antigravity.google/cli/install.sh)及 [Linux amd64 官方更新清单](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/linux_amd64.json)
- [CLI 1.5.14 官方归档](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.14-5302690847260672/linux-x64/cli_linux_x64.tar.gz)
- [VS Code Webview 主题机制](https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content)与[主题颜色参考](https://code.visualstudio.com/api/references/theme-color)
