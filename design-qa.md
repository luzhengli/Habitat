# Habitat Design QA

## Current target and evidence

**Source visual truth**

- `docs/prototypes/mvp/first-run-organize-selected-v1.png`.
- Source pixels: 1440×1024 after archival normalization; no density conversion during QA.
- State: first-run scan complete, `整理 Skills`, one unresolved same-name variant focused, Agent
  overflow popover open, primary action disabled.

**Rendered implementation**

- `docs/qa/first-run-organize-pass2.png`.
- CSS viewport: 1440×1024; capture pixels: 1440×1024; device scale factor: 1.
- State matches the source task and interaction state above.
- Original-size side-by-side evidence:
  `docs/qa/first-run-organize-comparison-pass2.png`.
- Responsive evidence: `docs/qa/first-run-organize-1024.png` at a 1024×768 CSS viewport after
  closing the version drawer.

The earlier project-management baseline remains preserved in `docs/qa/habitat-1440x1024.png`
and the previous comparison captures. This report's current pass covers the newly approved
first-run direction.

## Findings

No actionable P0/P1/P2 findings remain for the approved first-run F2 screen and its core setup
journey.

- [P3] The implementation keeps both same-name decisions visible instead of hiding the already
  resolved second item.
  - Location: `需要你决定` group.
  - Evidence: the source image shows the selected unresolved row only; the implementation also
    keeps `planning-board` visible with `已选择版本`.
  - Impact: slightly higher list density, but users can revisit an earlier choice without losing
    context.
  - Disposition: accepted because it preserves the approved two-conflict fixture and does not add
    a new concept.

- [P3] The browser capture does not include macOS traffic lights.
  - Location: top-left window chrome.
  - Evidence: the source is a framed macOS window; the browser comparison captures only app-owned
    content. The Tauri window retains its native title/drag region.
  - Impact: none on app-owned layout or interaction fidelity.
  - Disposition: expected capture-surface difference.

## Required fidelity surfaces

- Fonts and typography: macOS system UI and Display stacks, 12–24px hierarchy, weights, line
  heights, truncation, and mixed Chinese/English copy match the approved token system. Dense table
  metadata remains readable without using sub-12px text.
- Spacing and layout rhythm: 260px setup rail, 132px page header, issue-first list, contextual
  inspector, fixed-height rows, 1px dividers, and one page-owned footer preserve the source
  composition. At 1440×1024 the list has no horizontal overflow.
- Colors and visual tokens: warm white/stone surfaces, charcoal text, coral selection and primary
  action, and semantic green/amber/red states derive from `DESIGN.md`. There are no gradients,
  glass surfaces, decorative shadows, or card-wall treatment.
- Image quality and asset fidelity: Codex, Claude Code, Pi, Cursor, and Trae use source SVG assets
  from the Lobe static icon package at 14–16px inside 28px targets. No brand mark is recreated with
  CSS, text, emoji, or handcrafted SVG.
- Copy and content: the primary UI uses `扫描本机`, `整理 Skills`, `设置技能库`, `确认迁移`,
  `完成`, `发现于`, `暂不导入`, and `技术详情`. Internal terms such as canonical, fingerprint,
  adapter, exposure, policy, route, and precedence remain out of the primary surface.
- Icons: functional UI icons stay within one Lucide family; Agent brands use the dedicated SVG
  assets. The `+2` control exposes Cursor and Trae names on hover/focus, and the visible icon size
  remains deliberately smaller than the rejected prototype.
- States and interactions: unresolved variants disable continuation; selecting a version enables
  it; directory selection, plan review, migration completion, and rollback were exercised through
  the development fixture. Loading, error, selected, deferred, completed, and rolled-back states
  are implemented.
- Responsiveness: at 1024×768 the inspector becomes a 420px overlay drawer with backdrop and close
  control. Closing it leaves an 834px main surface with no horizontal overflow; selecting a row
  reopens it.
- Accessibility: steps use an ordered list; rows are keyboard-selectable; version choices and
  overflow details have accessible names; buttons have visible focus states; status is not carried
  by color alone; reduced-motion behavior remains enabled.

## Full-view and focused comparison

`docs/qa/first-run-organize-comparison-pass2.png` places both 1440×1024 images at their original
pixel size in one 2880px-wide comparison surface. This preserves readable type, row alignment,
Agent icons, popover content, version cards, and footer states, so a separate lossy crop was not
needed. The 1024×768 screenshot is the focused responsive evidence for drawer behavior and list
width.

## Interaction and runtime checks

- Initial `继续设置技能库` was disabled; choosing `project-harness` 版本 A enabled it.
- The development path continued through `设置技能库` → `确认首次迁移` → `技能库已准备完成`.
- Review truth: 29 Store imports, 40 original-entry recovery moves, and 2 unchanged items for the
  deterministic visual fixture.
- `撤销本次迁移` reached `本次迁移已撤销`.
- `查看其余 22 个 Skills` expands and collapses the ready group.
- The responsive drawer closes and reopens from a selected row.
- Fresh browser tabs reported no console errors.
- Rust fixtures exercise real temporary directories only; the new same-content-copy test proves
  one Store import with every equivalent original route represented in Recovery.

## Comparison history

### Pass 1 — blocked

- [P2] The first column allocation could produce horizontal list overflow at a narrower calibrated
  viewport.
- [P2] A focusable Agent overflow button was nested inside the row's native button, producing an
  invalid-interactive-content console error.
- [P2] Version choices were materially shorter than the reference and weakened the inspector's
  decision hierarchy.
- Evidence: `docs/qa/first-run-organize-comparison-pass1.png` and
  `docs/qa/first-run-organize-pass1.png`.
- Fixes: tightened table columns, changed the row to a keyboard-operable non-native row control,
  preserved the independent overflow button, increased version-choice height, and added the
  responsive inspector drawer.

### Pass 2 — passed

- Evidence: `docs/qa/first-run-organize-comparison-pass2.png`,
  `docs/qa/first-run-organize-pass2.png`, and `docs/qa/first-run-organize-1024.png`.
- Result: exact 1440×1024 state has no horizontal overflow or console errors; 1024×768 uses the
  bounded drawer; no actionable P0/P1/P2 mismatch remains.

## Follow-up polish

- Keep the selected-count wording tied to safely importable logical Skills rather than forcing the
  generated image's internally inconsistent count before its last conflict is resolved.
- When project-management V2 replaces the old Spike shell, reuse the same Agent icon group and
  focus behavior rather than adding another representation.

final result: passed
