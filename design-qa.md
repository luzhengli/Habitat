# Habitat Design QA

**Source visual truth**

- `docs/references/habitat-prototype.png`
- Original pixels: 1487×1058.
- Normalization: Lanczos scaled to 1440×1024 for the full-view comparison; no browser chrome or device frame.

**Rendered implementation evidence**

- `docs/qa/habitat-1440x1024.png`
- CSS viewport: 1440×1024; capture pixels: 1440×1024; density normalization: 1 CSS px to 1 output px.
- State: real temporary Store and project snapshot, 3 valid links and project-harness selected as available.
- Side-by-side evidence: `docs/qa/comparison-pass-2.png`.
- Responsive evidence: `docs/qa/habitat-1024-drawer.png` at a 1024×1024 CSS viewport.
- Success evidence: `docs/qa/habitat-add-success.png`.
- Error evidence: `docs/qa/habitat-conflict-error.png` from a real target directory conflict.

The exact-size QA snapshots use JSON emitted by the Rust `capture_state` binary from the same real temporary directories, symlinks, Git repository and preflight code exercised by Tauri. The native Tauri interaction evidence is also preserved as `docs/qa/preflight-ready-native.png` and `docs/qa/add-success-native.png` (1148×768, constrained by the available display).

## Findings

No actionable P0/P1/P2 findings remain.

- [P3] Real temporary paths wrap more than the visual reference.
  - Location: inspector path boxes and project row.
  - Evidence: the source uses short `/Users/luyao/Project/...` paths; the implementation truthfully shows canonical `/private/var/folders/...` fixture paths.
  - Impact: the inspector uses more vertical space, but paths remain selectable, copyable and readable.
  - Disposition: accepted for the Spike; do not shorten or fake canonical paths for visual fidelity.

- [P3] Skill glyphs are intentionally uniform.
  - Location: skill rows and inspector identity.
  - Evidence: the source uses several bespoke per-skill symbols; the implementation uses one Lucide family and status glyphs.
  - Impact: slightly less visual differentiation, but stronger icon consistency and no unsupported custom asset system.
  - Disposition: accepted under the single-linear-icon requirement.

## Required fidelity surfaces

- Fonts and typography: macOS system UI/Display/Mono stacks, weights, 12–24px scale, line heights and truncation follow DESIGN tokens. Long dynamic paths wrap rather than lose critical segments.
- Spacing and layout: 268px sidebar, 700px minimum workspace, 368px inspector, 100px topbar, 76px toolbar, 88px rows and 52px status bar are represented. Persistent regions use dividers and whitespace, not a card wall.
- Colors and tokens: warm canvas, stone sidebar, charcoal type and coral `#FF5A49` selection/primary action match the approved direction. Success/warning/error states also include icons and text. No gradients, glass, neon or decorative shadows are present.
- Image quality and assets: the interface has no required photographic or illustrative assets. Visible UI icons come from Lucide. The generated macOS bundle icon is a separate raster app asset and does not replace UI icons.
- Copy and content: mandated domain language is present: 技能库、当前项目、已链接、可添加到此项目、源路径、符号链接目标、添加到、解除链接，以及“仅创建或解除符号链接，不复制文件”。
- Responsiveness: 1024px switches the inspector to a 368px overlay drawer with backdrop and close control; the central list is not collapsed into a third narrow column.
- Accessibility: semantic table, labeled controls, tooltips, keyboard-selectable rows, live regions, reduced motion and a visible coral focus ring were verified. Focus evidence showed a 4px `rgba(255, 90, 73, 0.28)` ring.

## Full-view and focused comparison

The full-view side-by-side comparison verifies column proportions, hierarchy, table grouping, selection treatment, quiet surfaces, inspector order and persistent action. A separate crop was unnecessary because the 2880×1024 comparison preserves both 1440px views at readable original resolution. The 1024 drawer and state screenshots provide focused evidence for responsive structure, success feedback and conflict semantics.

## Interaction and runtime checks

- Native Tauri: selected Store and project, observed 3/1, inspected project-harness, linked to 4/0, unlinked to 3/1, and confirmed source `SKILL.md` remained.
- Native Tauri: `npx skills list --project --json` completed with exit code 0 and visible JSON stdout; `git status --short` and `git diff` completed with exit code 0.
- Browser QA: search reduced the visible rows, status filter changed to available, 1024 drawer close worked, focus ring was visible, and console error log was empty.

## Comparison history

### Pass 1 — blocked

- [P2] The inspector's real Git and preflight content pushed the safe primary action below the initial viewport.
- Evidence: `docs/qa/comparison-pass-1.png`.
- Fix: made the safety note and current action a persistent inspector dock, reserved scroll space for it, and kept the information sections in DOM reading order.

### Pass 2 — passed

- Evidence: `docs/qa/comparison-pass-2.png` and the refreshed four acceptance screenshots.
- Result: the current safe action remains visible at 1440×1024 and in the 1024px drawer while detailed Git/preflight content remains scrollable. No actionable P0/P1/P2 mismatch remains.

## Follow-up polish

- If a future MVP introduces persisted known projects, restore the multi-project sidebar density shown in the source without changing the single-Store model.
- Consider skill-specific icons only after defining a maintainable asset contract; do not add ad hoc SVGs.

final result: passed
