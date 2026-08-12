# Habitat Design QA

## Project Skills 状态分组 target and evidence

**Source visual truth**

- `docs/prototypes/mvp/project-skills-grouped-selected-v1.png`.
- Source pixels: 1487×1058；对比时仅做等比例语义画布归一到 1440×1024，不做密度转换。
- State: `media` 项目、`explain-and-quiz` 选中；“当前可用 4”在前、“尚未添加 2”在后，
  两组均展开；没有“记住折叠状态”或“收起”文字。

**Rendered implementation**

- `docs/qa/project-skills-grouped-default.png`.
- CSS viewport and capture: 1440×1024 at device scale factor 1；文档与 body 均无横纵溢出。
- Full-view normalized comparison: `docs/qa/project-skills-grouped-comparison.png`，确认稿在左，
  实现在右。
- Folded interaction evidence: `docs/qa/project-skills-grouped-current-collapsed.png`.
- State: `?qa=project-grouped` 开发 fixture，使用同一 6 Skill / 4 当前可用 / 2 尚未添加数据。

### Findings

No actionable P0/P1/P2 findings remain for the approved grouping surface or its expand/collapse
behavior.

- [P3] 生成确认稿使用约 98px 高行，当前实现沿用既有生产 V2 的同一 98px token，但浏览器
  字体栅格化与图像生成结果存在轻微字重、图标轮廓差异。
  - Impact: 不改变层级、扫描密度或交互；生产实现继续使用真实 Lucide/Lobe SVG 资产。
  - Disposition: accepted implementation-truth difference.
- [P3] 确认稿将未添加行状态画成加号，生产合同仍使用现有低对比 Agent 控件与“—”状态。
  - Impact: 不影响通过 Agent 控件形成草稿；避免把非独立行级操作画成可点击加号。
  - Disposition: accepted product-contract preservation.

### Required fidelity surfaces

- Fonts and typography: macOS system UI 字体、12–24px 层级、14px 分组标题、13px 计数/说明
  保持现有 Habitat token；中英文没有额外字距，行名与描述按现有规则截断。
- Spacing and layout rhythm: 264px / flexible / 380px 三栏、46px 列头、48px 分组标题与 98px
  Skill 行保持确认稿的信息顺序和密度；分组依赖留白与 1px 分隔线，没有卡片或阴影。
- Colors and visual tokens: 暖白 canvas、石灰侧栏、炭黑文字、珊瑚红只用于选中项，绿色只用于
  已验证状态；未新增 token、渐变、玻璃或装饰色。
- Image quality and asset fidelity: Agent 使用既有 Lobe 静态 SVG，功能图标使用 Lucide；没有
  raster 占位、CSS art、手绘 SVG 或 emoji。
- Copy and content: 分组仅使用“当前可用 / 尚未添加 / 从 Skill Store 选择并添加”和结果数量；
  已按批注删除“记住折叠状态”整行与所有“收起”文字。
- Icons and behavior: 每组仅左侧 ChevronDown 作为 disclosure 标志；折叠态旋转为向右，整行
  32px 以上可点击并有 `aria-expanded`、`aria-controls`、focus ring 和 reduced-motion 覆盖。
- Responsiveness: 沿用 1180px 检查器抽屉与 1024px 紧凑栏宽；分组标题复用中栏左右 padding，
  不引入横向滚动。

### Interaction and runtime checks

- 初始 DOM：`当前可用 4` 与 `尚未添加 2 从 Skill Store 选择并添加` 均为
  `aria-expanded=true`，六个 Skill 行均可见。
- 点击“当前可用”：该组变为 `aria-expanded=false`、其 4 行隐藏；“尚未添加”仍展开且 2 行
  可见。再次点击恢复。
- 点击“尚未添加”：该组变为 `aria-expanded=false`、其 2 行隐藏；“当前可用”仍展开且 4 行
  可见。再次点击恢复。
- “当前可用”筛选只渲染对应分组和 4 行；未添加分组不渲染。
- 对 `project-harness` 建立 Agent 草稿后出现待应用栏，但其仍留在“尚未添加”，两个分组数量
  保持 4 / 2，证明归组依据最近验证状态而非未提交草稿。
- 浏览器 console：0 warnings、0 errors。

### Comparison history

- Pass 1 — passed: 首次浏览器实现已满足确认稿的结构、密度和文案删减要求；全视图对比未发现
  P0/P1/P2，因此没有为视觉 QA 进行代码修复。折叠态另行捕获以证明交互，不以静态截图代替
  行为验证。

final result: passed

## Project Skills V2 target and evidence

**Source visual truth**

- `docs/prototypes/mvp/project-skills-round2-selected-v2.png`.
- Source pixels: 1440×1024.
- State: `media` project selected, `project-harness` focused, common and Claude entries pending
  addition, one Trae entry pending removal, common-entry explanation visible, and the conditional
  draft bar ready to review.

**Rendered implementation**

- `docs/qa/project-skills-v2-pass2.png`.
- CSS viewport and capture: 1440×1024 at device scale factor 1.
- Exact original-pixel comparison: `docs/qa/project-skills-v2-comparison-final.png`, source on the
  left and implementation on the right.
- Review surface: `docs/qa/project-skills-v2-review.png`.
- Add-project surface: `docs/qa/project-add-dialog.png`.
- Responsive evidence: `docs/qa/project-skills-v2-1024.png` at 1024×768.

No actionable P0/P1/P2 findings remain for the approved project-management surface or its core
draft → review → apply journey.

- [P3] The implementation fixture contains one managed project instead of the reference image's
  three sidebar examples.
  - Impact: none on the selected project's task; it avoids implying that unverified projects are
    already managed.
  - Disposition: accepted content-fixture difference.
- [P3] Browser captures omit the macOS traffic lights while the selected reference includes them.
  - Impact: none on the app-owned layout; the packaged Tauri window retains native window chrome.
  - Disposition: expected capture-surface difference.

Required fidelity checks passed:

- Layout: 264px sidebar, flexible project ledger, 380px incremental inspector, 98px stable rows,
  and a project-owned conditional draft bar. No global bottom status strip is present.
- Visual system: warm canvas, stone separators, coral only for selection/pending primary action,
  no gradients, glass, card wall, or decorative texture.
- Agent controls: Lobe static SVG assets render at 14–15px; Codex/Pi/Cursor remain one coupled
  control, Claude Code and Trae remain independent; state markers are separate from brand marks.
- Copy: primary surfaces use `适用于`, `本次更改`, `检查结果`, `项目入口`, `检查并应用`, and
  `应用项目设置`; adapter, exposure, route, canonical, precedence, and fingerprint stay hidden.
- Inspector: only incremental information appears—pending effects, checks, relative targets, and
  collapsed technical details. It repeats neither description nor Store/version table columns.
- Commit boundary: Agent clicks edit a draft only. The only filesystem path is the conditional
  `检查并应用` action followed by the separate `应用项目设置` confirmation.
- Responsiveness: at 1024×768 the inspector becomes an overlay drawer and the ledger has zero
  horizontal overflow; its closed state leaves the full list task usable.
- Accessibility: Agent buttons have action-and-state labels, brand images are not the only status
  carrier, buttons keep visible focus rings, and the review surface uses modal dialog semantics.

Interaction and runtime checks:

- The deterministic browser fixture starts with 2 affected Skills, 2 additions, and 1 removal.
- The add-project confirmation exposes the three Agent target groups, explicitly says no links are
  created yet, and disables `添加项目` when all Agent groups are deselected.
- `检查并应用` opens the review surface grouped into additions and removals with 3 concrete target
  paths; `应用项目设置` closes the review, clears the pending bar, and reports local-link success.
- Main ledger and body both report zero horizontal overflow at 1440×1024 and 1024×768.
- Fresh browser execution reported no console errors.
- Rust command-boundary fixtures use real temporary Store/project directories. They pass a
  name-only project draft through the same source-resolution and adapter plan used by Tauri,
  create three relative links, inspect all five Agents as satisfied, remove the three links, and
  prove the Store source remains intact. Unknown Store names are rejected before planning.

### Project comparison history

- Pass 1 established the three-pane proportions, icon scale, pending bar, responsive drawer, and
  review flow. Evidence: `docs/qa/project-skills-v2-pass1.png` and
  `docs/qa/project-skills-v2-review.png`.
- Pass 2 forced the common-target explanation into the exact selected comparison state and was
  compared at original 1440×1024 pixels. Evidence: `docs/qa/project-skills-v2-pass2.png` and
  `docs/qa/project-skills-v2-comparison-final.png`.

## First-run target and evidence

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
- Keep the first-run and project-management Agent icon assets synchronized when package versions
  change; business-state markers must remain independent from the brand SVGs.

final result: passed
