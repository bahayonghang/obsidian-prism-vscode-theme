# Changelog

## 0.1.0 — 2026-11-21

Initial independent VS Code port based on RMvdesi / Obsidian Prism `v1.0.7-beta.1` at `5dac53bfa7cf917d40101dad2579f32dd1b1b587`.

### Added

- Four native themes: Obsidian Dark, Warm Charcoal, Daylight Crystal and Warm Alabaster.
- VS Code workbench, terminal, TextMate and semantic-token color mappings.
- Theme-specific accent, contrast, italic-comment and bold-keyword customization.
- Chinese/English Theme Studio with scoped corner, ambient-glow and motion controls.
- Validated extension settings import/export.
- Explicit, restorable editor typography and native system-appearance actions.
- Owned-setting restoration that preserves unrelated values and later manual edits.
- Desktop/browser extension entries, repeatable builds and VSIX packaging.
- Porting matrix, implementation plan, upstream provenance and preserved license notices.

### Scope

- Corners, ambient glow and custom motion apply only inside Theme Studio.
- Optional typography and automatic appearance are user-level settings; restore them before uninstall if no longer wanted.
- Upstream telemetry, thought translation, model controls, mascots, chat features, browser/file viewer, injection and background services are excluded.
- Marketplace publication is not part of this release record. Verification evidence is tracked in [issue #1](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/1).
