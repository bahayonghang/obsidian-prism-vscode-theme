# Obsidian Prism for VS Code

[English](README.en.md) · [移植范围](docs/PORTING.md) · [实施规划](docs/PLAN.md) · [规划 issue #1](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/1)

将 [RMvdesi / Obsidian Prism](https://github.com/RMvdesi/obsidian-prism) 的四套配色和外观设置带到 VS Code。这个独立移植版只包含主题相关功能：编辑器、侧栏、终端、语法配色，以及中英文 Theme Studio 设置面板。

**这是基于上游的非官方修改版，与 RMvdesi、Microsoft 或 Google 没有隶属或背书关系。** 原项目版权归 RMvdesi 及其上游贡献者所有；本项目采用 GPL-3.0-only。修改日期：2026-11-21。来源、修改说明及完整声明见 [UPSTREAM.md](UPSTREAM.md)、[LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

![四套主题的配色示意图](media/preview.png)

上图为配色与布局示意，不是真实 VS Code 截图。[矢量版本](media/preview.svg)

## 安装与开始使用

需要 **VS Code 1.96.0 或以上**。本项目尚未发布到 Marketplace，可以从源码构建 VSIX：

```bash
git clone https://github.com/bahayonghang/obsidian-prism-vscode-theme.git
cd obsidian-prism-vscode-theme
npm ci
npm test
npm run package
code --install-extension artifacts/obsidian-prism-vscode-theme-0.1.0.vsix
```

也可以在 VS Code 扩展页面的 `…` 菜单中选择 **Install from VSIX… / 从 VSIX 安装…**，打开上述文件。安装完成后：

1. 打开命令面板，执行 **Preferences: Color Theme**，选择任意一个 `Obsidian Prism — …` 主题。
2. 执行 **Obsidian Prism: Open Theme Studio**，调整强调色、对比度、注释和关键字样式。
3. 字体和跟随系统明暗模式各有单独的应用、恢复按钮，需要时再使用。

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
- 主题专属自定义可能在卸载后留在用户设置中；它们只匹配上述 Prism 主题，不影响其他主题。需要清理时，在卸载前执行恢复命令；已卸载时也可在用户 `settings.json` 中检查这些明确命名的块。
- 工作区、语言专属设置或其他扩展可能优先覆盖用户设置；若某项看起来没生效，请检查 VS Code 原生设置中的覆盖来源。

## 命令

所有命令均在命令面板中以 `Obsidian Prism` 为前缀，可通过以下稳定 ID 绑定快捷键：

| ID | 用途 |
| --- | --- |
| `obsidianPrism.openSettings` | 打开 Theme Studio |
| `obsidianPrism.chooseTheme` | 选择四套主题 |
| `obsidianPrism.openNativeSettings` | 打开 VS Code 原生设置 |
| `obsidianPrism.resetCustomizations` | 重置全部 Prism 偏好及仍受管理的外观设置 |
| `obsidianPrism.exportSettings` / `obsidianPrism.importSettings` | 导出 / 导入设置 |
| `obsidianPrism.applyTypography` / `obsidianPrism.restoreTypography` | 应用 / 恢复编辑器字体与动态设置 |
| `obsidianPrism.applySystemAppearance` / `obsidianPrism.restoreSystemAppearance` | 应用 / 恢复系统明暗跟随 |

## 移植边界

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

验证记录和提交结果以 [issue #1](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/1) 为准。文档不把未执行的宿主测试写成已通过。
