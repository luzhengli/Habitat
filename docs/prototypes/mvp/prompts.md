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
