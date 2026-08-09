# Habitat MVP ImageGen Prompt Set

Generated: 2026-08-09  
Mode: built-in ImageGen, three independent generations  
Use case: `ui-mockup`

## References attached to every generation

- `docs/references/habitat-prototype.png` — approved structural/visual reference.
- `docs/qa/habitat-1440x1024.png` — current real implementation reference.
- `docs/qa/habitat-conflict-error.png` — current conflict-state reference.

The references were used as design-system and proportion grounding, not as edit targets.

## Shared prompt

Create a realistic, production-quality desktop prototype for Habitat, a macOS-only local
Agent Skills manager. Target a 1440×1024 app surface. Preserve Habitat Quiet Native: warm
white `#FAFAF8`, stone `#F6F6F3`, charcoal `#202124`, coral `#FF5A49` only for selection and
the single primary action, system typography, 4px spacing grid, 6–10px radii, thin dividers,
and Lucide-like linear icons. Preserve native traffic lights. Avoid card walls, gradients,
glass, neon, dark tech-dashboard styling, browser chrome, device frames, and unrelated
Marketplace, sync, cloud, or arbitrary-command features.

Use readable Chinese and the same fixture in every direction: 44 entries, 31 canonical
skills, 6 duplicate routes, 2 same-name conflicts, project `media`, five selected Agents,
and neutral Store `~/Library/Application Support/Habitat/Skill Store`. Show Codex, Claude
Code, and Pi as runtime-verified only where tested; Cursor and Trae as `Beta / 路径兼容`.
Agent settings are read-only, rollback is available, and a blocking conflict disables the
one concrete migration action. Current date anchor: 2026-08-09.

## Guided migration delta

Show a focused same-name variant decision within a persistent five-step rail: Discover,
Resolve, Plan, Confirm, Verify. Compare two `project-harness` variants with paths,
fingerprints, affected Agents, and a compact before/after exposure summary. Prioritize
first-use confidence and one decision at a time.

Output: `guided-migration.png`.

## Inventory workbench delta

Make a grouped canonical-artifact inventory table the main surface, with exposure, policy,
precedence, and migration-decision columns. Open the selected conflict in a right inspector
and show a compact migration tray with 12 project-managed, 8 global, 11 deferred, and one
blocking item. Prioritize scanning, explainability, and expert control.

Output: `inventory-workbench.png`.

## Project exposure delta

Make project `media` and its expected-versus-effective Agent exposure the main surface.
Show aligned Agent lanes or a matrix with current source, expected target, adapter path,
policy/precedence, and support tier. Include the minimum targets `.agents/skills`,
`.claude/skills`, and `.trae/skills`, plus a blocking conflict inspector. Prioritize the
project-level value and the effect on connected versus unconnected projects.

Output: `project-exposure.png`.

## Inventory workbench 2R revision delta

Edit target: `inventory-workbench.png`.

Preserve the three-column shell, but replace internal concepts with user tasks. Group the
list by `需要你决定`, `将只用于 media`, `继续供所有项目使用`, and `本次不更改`. Replace
the conflict inspector with the question `media 应使用哪个版本？`, offer the two human-
readable sources plus `稍后决定`, preselect nothing, and move paths/fingerprints into a
collapsed `技术详情`. Replace the dashboard-like migration tray and dead migration button
with a quiet sentence summary and the contextual action `处理 1 个待决定项`; a later screen
owns `查看更改`, and migration never starts directly from this inventory state. Use text for
Agent support and the label `重新扫描` for local discovery.

Output: `inventory-workbench-v2r.png`.

## Inventory workbench 2.1 connected-flow revision

Mode: built-in ImageGen edits grounded in the original `inventory-workbench.png`. Preserve
the original three-column visual system and project sidebar; do not use the broader 2R
reframing.

### Management page

Remove the top count pill and priority column. Use fixed-height collapsed Skill rows. Rename
`暴露给` to `适用于`; render no more than three Agent names inline and demonstrate the
overflow popover. Add an on-demand explanation to `策略`. Keep the conflict inspector and
replace the bottom dashboard with a compact draft sentence plus `处理 1 个待决定项`.

Output: `inventory-workbench-v2-1-management.png`.

### Dedicated migration-plan page

Retain the left project sidebar and replace the center/right workbench with one calm review
page: select, review, execute, complete. Group planned effects as import to Store, `仅用于当前
项目`, continue for all projects, and move old entries to recovery. State that no file is
changed before confirmation, Agent settings stay unchanged, and rollback remains available.

Output: `inventory-workbench-v2-1-plan.png`.

### Completion page

Use the same shell and progress model. Summarize imported, linked to current project, retained
global, moved to recovery, and unfinished results. The primary action is `查看当前项目中的
Skills`, returning to the selected project's stable three-column page; rollback and technical
report remain secondary actions. Use the exact outcome copy `仅用于当前项目` and avoid
embedding the project name in that policy label or explanatory sentence.

Output: `inventory-workbench-v2-1-complete.png`.
