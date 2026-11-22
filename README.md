# Obsidian Prism for Antigravity & VS Code

[English](README.en.md) · [Antigravity 适配](docs/ANTIGRAVITY.md) · [移植范围](docs/PORTING.md) · [实施规划](docs/PLAN.md) · [规划 issue #2](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/2)

将 [RMvdesi / Obsidian Prism](https://github.com/RMvdesi/obsidian-prism) 的四套配色和外观设置带到 **Antigravity IDE**，同时兼容标准 VS Code。这个独立移植版只包含主题相关功能：对话侧栏、编辑器、终端、语法配色，以及中英文 Theme Studio 设置面板。

**0.2.0 优先适配 Antigravity 对话外观。** 顶部工具栏与欢迎/对话区域跟随侧栏颜色；新版聊天输入框再由该底色生成卡片层次。设置面板提供对应的配色示意与宿主兼容性报告。不同版本的限制和逐项源码证据见 [Antigravity 适配说明](docs/ANTIGRAVITY.md)。

**这是基于上游的非官方修改版，与 RMvdesi、Microsoft 或 Google 没有隶属或背书关系。** 原项目版权归 RMvdesi 及其上游贡献者所有；本项目采用 GPL-3.0-only。修改日期：2026-11-21。来源、修改说明及完整声明见 [UPSTREAM.md](UPSTREAM.md)、[LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

![四套主题的配色示意图](media/preview.png)

上图为配色与布局示意，不是真实 VS Code 截图。[矢量版本](media/preview.svg)

## 安装与开始使用

使用 **Antigravity IDE**，或 **VS Code 1.96.0 或以上**。本项目尚未发布到 Marketplace，可以从源码构建 VSIX：

```bash
git clone https://github.com/bahayonghang/obsidian-prism-vscode-theme.git
cd obsidian-prism-vscode-theme
npm ci
npm test
npm run package
code --install-extension artifacts/obsidian-prism-vscode-theme-0.2.0.vsix
```

在 **Antigravity 的扩展页面**（或 VS Code）打开 `…` 菜单，选择 **Install from VSIX… / 从 VSIX 安装…**，打开上述文件。上面的 `code` 命令只安装到 VS Code；Antigravity 请使用自己的扩展页面。安装完成后：

1. 打开命令面板，执行 **Preferences: Color Theme**，选择任意一个 `Obsidian Prism — …` 主题。
2. 执行 **Obsidian Prism: Open Theme Studio**，在“Antigravity 与侧栏”中选择底色：原始分层、与编辑区一致、淡强调色。先看对话配色示意，再点击应用。
3. 调整强调色、对比度和代码样式。宿主信息卡可打开 **Show Antigravity Compatibility Report**，区分 IDE 产品版本与 VS Code 基础版本。
4. 字体和跟随系统明暗模式各有单独的应用、恢复按钮，需要时再使用。

安装本身不会替你切换主题。四个静态主题不依赖设置面板或扩展代码激活；设置面板及动态自定义由扩展运行时提供。项目包含桌面和浏览器运行入口；浏览器宿主的侧载方式与桌面 VSIX 安装不同，见 [移植说明](docs/PORTING.md#兼容性与构建)。

## 四套主题

| VS Code 中的名称 | 观感 | 侧栏 | 编辑区 |
| --- | --- | --- | --- |
| Obsidian Prism — Obsidian Dark | 冷色黑曜石深色 | `#09090B` | `#0E0E11` |
| Obsidian Prism — Warm Charcoal | 暖灰深色，橙色点缀 | `#10100F` | `#141413` |
| Obsidian Prism — Daylight Crystal | 清亮的蓝灰浅色 | `#E8EEF6` | `#F4F7FB` |
| Obsidian Prism — Warm Alabaster | 暖纸白浅色 | `#EBE6DC` | `#F6F4EE` |

基础色取自固定版本的上游 `style.css`；VS Code 的语法、语义 token 与界面颜色映射由本项目补充，不是直接把原 CSS 注入编辑器。

## 设置能改变哪里？

| 设置 | 选项 | 生效范围 |
| --- | --- | --- |
| 强调色 | 默认、Cobalt、Iris、Amber、石墨单色、自定义十六进制颜色 | 四套 Prism 主题的原生界面 |
| 对比度 | 标准、高 | Prism 主题；“高”是本项目配色选项，不是 VS Code 系统高对比主题 |
| 侧栏与对话底色 | 原始分层、与编辑区一致、淡强调色 | Antigravity 对话背景、资源管理器与活动栏共用的原生颜色；不是仅聊天区域的覆盖 |
| 原生输入边框 | 柔和、强调色 | 普通原生输入控件；**不控制 Antigravity 聊天输入框**，后者由宿主自行生成 |
| 代码样式 | 斜体注释、加粗关键字 | Prism 主题的代码配色 |
| 圆角 | Sharp / Balanced / Soft | **仅 Theme Studio 面板** |
| 环境光 | 0 / 35 / 70 / 100 | **仅 Theme Studio 面板** |
| 动效 | Off / Subtle / Standard / Ultra | **仅 Theme Studio 面板**，遵循减少动态效果偏好 |
| 面板语言 | 自动跟随 VS Code、中文、English | Theme Studio |
| 字体 | Default（保持/恢复原设置）、JetBrains Mono、Cascadia Code、SF Mono | 显式应用后，修改 VS Code 用户级编辑器设置 |
| 连字、平滑光标、平滑滚动 | 保持原设置 / 开 / 关 | 与字体一起显式应用，可恢复 |
| 跟随系统明暗 | 选择深色、浅色主题组合后应用 | VS Code 原生的自动明暗模式，可恢复 |
| 导入 / 导出 | 本扩展的设置 JSON | 校验允许的字段和值；不导入任意 VS Code 设置 |

字体需要自行安装；扩展只配置字体栈，不下载字体。Prism 的配色通过各主题名称限定作用范围，切换到其他主题后不会继续套用 Prism 配色。字体与系统明暗选项是 VS Code **用户级设置**，会继续影响其他主题，禁用或卸载扩展也不会自动恢复。

自定义颜色使用 `#RRGGBB` 格式，例如 `#A58AF8`。在应用字体选项时，`Default` 或 `Inherit` 会保留未受管理的原值，或恢复此前由本扩展替换的值。

### 恢复与卸载

- **Reset Customizations / Reset Prism** 是完整重置：清除本扩展的偏好，并恢复仍由本扩展管理的配色、字体及系统明暗设置；它不会把整个 `settings.json` 清空。只需恢复字体或系统明暗时，使用下列对应命令。
- 如使用过字体或系统明暗应用按钮，先分别执行 **Restore Typography**、**Restore System Appearance**，再卸载。
- 恢复只处理仍等于本扩展上次写入值的设置。你之后手工改动的值会保留。
- 应用或恢复失败时会报告错误，并保留恢复记录；解决提示中的设置写入问题后，可以再次执行相同操作。
- 主题专属自定义可能在卸载后留在用户设置中；它们只匹配上述 Prism 主题，不影响其他主题。需要清理时，在卸载前执行恢复命令；已卸载时也可在用户 `settings.json` 中检查这些明确命名的块。
- 工作区、语言专属设置或其他扩展可能优先覆盖用户设置；若某项看起来没生效，请检查 VS Code 原生设置中的覆盖来源。

## 命令

所有命令均在命令面板中以 `Obsidian Prism` 为前缀，可通过以下稳定 ID 绑定快捷键：

| ID | 用途 |
| --- | --- |
| `obsidianPrism.openSettings` | 打开 Theme Studio |
| `obsidianPrism.chooseTheme` | 选择四套主题 |
| `obsidianPrism.openNativeSettings` | 打开 VS Code 原生设置 |
| `obsidianPrism.showCompatibilityReport` | 查看只读 Antigravity 版本、颜色路径与适配范围报告 |
| `obsidianPrism.resetCustomizations` | 重置全部 Prism 偏好及仍受管理的外观设置 |
| `obsidianPrism.exportSettings` / `obsidianPrism.importSettings` | 导出 / 导入设置 |
| `obsidianPrism.applyTypography` / `obsidianPrism.restoreTypography` | 应用 / 恢复编辑器字体与动态设置 |
| `obsidianPrism.applySystemAppearance` / `obsidianPrism.restoreSystemAppearance` | 应用 / 恢复系统明暗跟随 |

## 移植边界

Antigravity **IDE**、独立 **App** 与 Google 的 **VS Code 扩展**是不同产品。上游针对 App 的安装方式不适用于这个 VSIX。已检查的新版 Google 前端从侧栏颜色生成聊天卡片；旧版 IDE 1.23.2 的输入背景则由编辑区颜色混合固定灰色生成。两者的聊天输入框都不直接使用 `input.border`，所以本项目不会把普通输入控件的边框选项宣传成聊天输入框控制。

对话预览是根据检查过的客户端颜色公式绘制的**配色示意**，不是用户会话截图。它模拟新版的默认内部对比度；宿主自己的外观设置、其他主题覆盖或后续版本可改变实际结果。主题插件不读取聊天内容、凭据或模型状态。

VS Code 的标准扩展 API 可以改变颜色和代码样式，但不允许主题直接改写整个工作台的 DOM 或 CSS。因此，全局玻璃模糊、悬浮面板圆角、全局光效与弹簧动画没有伪装成“已移植”：圆角、光效和动效明确限定在 Theme Studio 内。详见 [可行性分析与逐项映射](docs/PORTING.md)。

本扩展不包含上游的额度统计、思维翻译、模型控制、聊天管理、宠物、内置浏览器或文件查看器，也不注入宿主文件、不启用调试端口、不启动后台服务。运行时不发起网络请求。

## 开发与验证

建议使用 Node.js 22 LTS 或更新的受支持版本。

```bash
npm ci
npm test
npm run package
```

在 VS Code 中打开仓库并按 F5，可以启动独立的 Extension Development Host 检查主题和面板。应重点检查：四套主题、中文与英文、窄窗口、键盘操作、导入导出、主题切换，以及修改已有设置后的应用与恢复。构建命令不等于 Marketplace 发布；发布需要维护者自己的 publisher 和发布权限。

CI 除标准 VS Code 外，还会从官方固定版本包启动 **Antigravity IDE 1.23.2 / 2.8.0** 的隔离扩展宿主，验证主题设置、恢复与报告。旧版用三个全新配置重复检查，任何一次失败都会使任务失败。启动参数请求禁用 Agent 扩展，但旧版仍可能启动内置服务；测试不会登录或发送对话，因此不等同于聊天界面的截图验收。可复现的发行包颜色检查：

```bash
python3 scripts/prepare-antigravity.py --version 2.8.0
```

该开发脚本只把校验过 SHA-256 的官方包放进忽略的测试目录，不安装或修改你正在使用的 IDE。结果写入 `artifacts/antigravity-source-2.8.0.json`。

当前验证记录和提交结果见 [issue #2](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/2)，初版见 [issue #1](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/1)。文档不把未执行的宿主测试写成已通过。
