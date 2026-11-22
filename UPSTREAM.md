# Upstream provenance and modification notice

**This is an independently maintained, unofficial modified distribution for VS Code. It is not an official Obsidian Prism release and is not affiliated with or endorsed by RMvdesi, Microsoft or Google.**

## Original work

- Project: **Obsidian Prism (黑曜棱镜)**
- Author: **RMvdesi**
- Copyright: **Copyright (C) 2026 RMvdesi**
- Repository: <https://github.com/RMvdesi/obsidian-prism>
- Baseline version: `1.0.7-beta.1`
- Pinned commit: [`5dac53bfa7cf917d40101dad2579f32dd1b1b587`](https://github.com/RMvdesi/obsidian-prism/tree/5dac53bfa7cf917d40101dad2579f32dd1b1b587)
- License: **GPL-3.0-only**, with the upstream attribution and non-endorsement notices preserved in [NOTICE](NOTICE).

Original upstream contributors and component notices remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). In particular, upstream credits **0DNANCY / agy-claude-style** for the optical theme foundation. These preserved notices describe the upstream project; they do not mean this theme-only extension bundles its telemetry, translators, mascots, browser or other excluded modules.

## Downstream work

- Project: **Obsidian Prism for VS Code**
- Repository: <https://github.com/bahayonghang/obsidian-prism-vscode-theme>
- Maintainer: **bahayonghang**
- Downstream copyright: **Copyright (C) 2026 bahayonghang and contributors**
- Modification date: **2026-11-21**
- License of the derivative work: **GPL-3.0-only**

Modified/adapted material and additions:

1. Extracted the four base palettes, accent families, font-stack choices and appearance-option concepts from upstream [`style.css`](https://github.com/RMvdesi/obsidian-prism/blob/5dac53bfa7cf917d40101dad2579f32dd1b1b587/style.css), [`settings-panel.js`](https://github.com/RMvdesi/obsidian-prism/blob/5dac53bfa7cf917d40101dad2579f32dd1b1b587/settings-panel.js) and [`config.example.json`](https://github.com/RMvdesi/obsidian-prism/blob/5dac53bfa7cf917d40101dad2579f32dd1b1b587/config.example.json).
2. Adapted those colors into native VS Code workbench, editor, terminal, TextMate and semantic-token definitions. These mappings are downstream work; the upstream project did not provide these complete VS Code theme files.
3. Reimplemented appearance controls with VS Code configuration APIs and a local settings webview. Replaced model-dependent accent following with a palette default. Added custom accent, contrast and syntax-style options.
4. Limited corners, glow and custom motion to the settings panel because supported VS Code extensions cannot inject arbitrary workbench CSS. Added explicit apply/restore flows for editor typography and system appearance.
5. Added setting ownership/restoration, validated import/export, localization, desktop/browser bundles, packaging, tests and documentation.
6. Excluded upstream application injection, background services, telemetry, thought translation, model controls, chat features, mascots, browser and file viewers.

The complete [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) are copied **verbatim** from the pinned upstream commit. The notices here supplement them; they do not replace or alter them. New source files and generated artifacts should retain a clear derivation/modification notice where their format permits it, with this document included in the distribution.

## Corresponding source and distribution

The corresponding source, build scripts, dependency lockfile and documentation are available in this repository. Build the same version with `npm ci`, `npm test` and `npm run package`. When distributing a VSIX, retain its version's matching source and all license/attribution files, and provide the source repository/commit alongside the download. A binary package must not be presented as an official upstream release.

This project and the upstream work are provided without warranty, as detailed in the license. Fonts named in the settings are references to user-installed fonts; font files are not redistributed by this extension.

## Updating the upstream baseline

Before changing the pinned baseline, compare upstream theme tokens, settings options and license notices. Update this document, the [porting matrix](docs/PORTING.md), and the affected source notices together. Preserve all required upstream credits, document the new modification date, and rerun theme/configuration/package checks. Do not import unrelated upstream features merely because they share the same release.
