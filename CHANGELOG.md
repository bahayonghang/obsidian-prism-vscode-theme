# Changelog

## 0.3.0 — 2026-11-22

Tracking: [real chat appearance #3](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/3) and [settings language #4](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/4).

- Add an explicitly enabled desktop Antigravity appearance adapter with verified startup-file fingerprints, original backups, conflict detection and restoration. This optional path modifies an application file; native themes remain independently usable.
- Add appearance-only aurora/texture backgrounds, composer surfaces, model pills and portaled model menu styling for audited modern/legacy structures. Keep native interactions, icons, popup placement and model behavior.
- Add five separate chat preferences. Saving or importing settings cannot install the adapter; switching away from Prism removes its stylesheet.
- Add bilingual native Settings descriptions and friendly option labels while retaining stored values and old settings exports.
- Move the independent extension language control to the top of Theme Studio and native settings. Save language changes immediately without applying other theme drafts. Add a language-selection command.
- Separate the desktop file adapter from the Node-free browser bundle. Document full-restart, update, shared-installation, uninstall and recovery boundaries.
- Add file recovery tests, actual Electron cross-frame/CSP tests, host startup checks and Studio command/language interaction checks. Final execution evidence is recorded in the linked issues; fixture renders are not authenticated chat screenshots.

## 0.2.0 — 2026-11-21

Antigravity IDE is now the primary host, with standard VS Code compatibility retained. Tracking: [issue #2](https://github.com/bahayonghang/obsidian-prism-vscode-theme/issues/2).

### Added

- Shared sidebar/conversation surfaces: original Prism layers, editor-matched canvas, or a subtle accent tint.
- A conversation color schematic based on the inspected Google client’s actual card/frame derivation, with an editor preview toggle.
- Read-only host compatibility report with separate IDE/VS Code engine/Google extension versions, limited color diagnostics, and conservative source-reference classification.
- A separate native input outline preference, explicitly outside the Antigravity composer.
- Official distribution evidence for IDE 1.23.2, IDE 2.8.0, bundled/Marketplace bridges, and modern frontend consumers.
- Pinned official Antigravity distribution checks and isolated real-IDE extension-host CI jobs alongside the existing VS Code and Chromium suites.

### Fixed and clarified

- Shared text/link/icon contrast now considers sidebar and composer-adjacent surfaces instead of only the editor canvas.
- Corrected the original assumption that no chat host exists: Antigravity already consumes native theme colors.
- Modern composer cards derive from sidebar colors; legacy composer fill mixes editor background with fixed gray. Neither inspected composer uses `input.border`, even when the bridge forwards it.
- Theme Studio glow/corner controls remain local to the Studio; they do not imply a changed chat geometry.
- Existing 0.1.0 settings exports import with the new options at their defaults. Exact theme scopes and manual-edit-preserving restoration remain in place.
- Failed appearance commands report and reject the original error instead of resolving as if they succeeded. Background actions remain handled, and interrupted writes retain their restoration journal for a later retry.
- Keep the current ownership journal in memory during an activation. Delayed VS Code storage notifications can no longer roll the live journal back and misclassify extension-owned colors as later manual edits.

### Validation scope

Source inspection, theme-model/unit tests, actual extension-host API tests, and schematic Chromium previews are recorded separately. None is presented as an authenticated screenshot of the user’s Antigravity session. Final CI evidence and artifacts are linked from issue #2.


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
