# Habitat MVP Prototype Brief

Status: Option 2.1 revision awaiting product-owner confirmation before implementation
Viewport: 1440×1024 macOS desktop  
Visual source: `DESIGN.md`, `docs/references/habitat-prototype.png`, and the current
`docs/qa/habitat-1440x1024.png` implementation evidence.

## Shared outcome

A first-time Habitat user understands which canonical skills each local Agent can see,
resolves ambiguous variants, reviews a reversible migration plan, and reaches an informed
confirmation without Habitat modifying Agent configuration or overstating runtime support.

## Shared fixture and required visible truth

- 44 entries / 31 canonical skills / 6 duplicate routes / 2 variant conflicts.
- Current project: `media`; five Agent profiles selected.
- Cursor and Trae are visibly Beta/path-compatible.
- Neutral Store target is visible and described as outside Agent discovery roots.
- The focused state contains one blocking same-name variant or target conflict.
- The primary action names the real consequence and remains unavailable while blocked.
- Coral is reserved for selection and the single primary action; warning and danger use
  semantic amber/red with text and icons.

## Direction: Guided migration

A calm, bounded onboarding sequence. The main workspace focuses on one decision at a time,
with a persistent progress rail for Discover, Resolve, Plan, Confirm, and Verify. The frame
shows the conflict-resolution step with enough before/after exposure context to make the
choice safe. Best for first-use confidence; weakest for expert scanning across many skills.

## Direction: Inventory workbench

A dense, desktop-native inventory table is the primary surface. Artifacts are grouped by
canonical identity, with route/policy/support columns and a right inspector for the selected
variant. A compact migration tray summarizes the proposed plan. Best for explainability and
expert control; risks a steeper first-use learning curve.

## Direction: Project exposure

The selected project's effective Agent exposure is the primary surface. Agent columns or a
matrix make expected/effective differences visible, while a left source rail groups global,
Store, and quarantine candidates. Best for reinforcing Habitat's project-level value; risks
making the initial global cleanup model less immediately obvious.

## Selection gate

The three generated images are independent visual targets. Do not mix them or modify the
production UI until the product owner selects one direction or requests a revised composite.

## Generated artifacts

- `guided-migration.png` — 1440×1024.
- `inventory-workbench.png` — 1440×1024.
- `inventory-workbench-v2r.png` — 1440×1024 revision after product-owner preference and
  read-only UX review; superseded by the narrower 2.1 revision below.
- `inventory-workbench-v2-1-management.png` — 1440×1024 stable management page.
- `inventory-workbench-v2-1-plan.png` — 1440×1024 dedicated migration-plan page.
- `inventory-workbench-v2-1-complete.png` — 1440×1024 migration result and return path.
- `project-exposure.png` — 1440×1024.
- `prompts.md` — shared grounding, direction deltas, and generation references.

All three are static decision artifacts. They are not proof of implemented behavior or
runtime compatibility.

## Comparison

| Direction | Primary strength | Primary risk | Best fit |
| --- | --- | --- | --- |
| Guided migration | Makes irreversible-looking decisions feel bounded and recoverable | Slower for experts reviewing many artifacts | First-run migration and trust |
| Inventory workbench | Highest exposure/precedence explainability and batch scanning density | Steeper learning curve and more concepts on first view | Advanced review and conflict cleanup |
| Project exposure | Makes Habitat's project-level value immediately concrete | Global cleanup and canonicalization are less prominent | Repeat use after Store setup |

Working recommendation: use Guided migration for the first-run MVP shell, then reuse the
Inventory workbench's grouped table as the post-onboarding management surface. This is not
an implementation decision until the product owner selects or requests a composite.

## Option 2R review revision

The product owner preferred the Inventory workbench structure but requested more natural
interaction and less internal terminology. The 2R revision therefore preserves the existing
three-column Habitat shell while changing the primary experience to:

- problem-first groups: needs a decision, only for the current project, all projects, and
  no change;
- plain-language version choice with no default selection;
- technical paths and fingerprints behind a collapsed detail control;
- one contextual action that resolves the remaining decision, followed later by a separate
  review step rather than immediate migration;
- text labels for Agent availability instead of unexplained status icons.

## Option 2.1 focused revision

The product owner retained the original Inventory workbench rather than the broader 2R
simplification. Option 2.1 therefore makes only the requested local changes:

- remove the opaque top count summary and the priority column;
- keep every collapsed Skill row at one fixed height;
- rename `暴露给` to `适用于`, show at most three Agents inline, and reveal the rest in a
  hover/focus/click popover;
- explain `策略` on demand instead of exposing more internal terminology;
- use the exact project-neutral copy `仅用于当前项目`;
- keep the three-column management page stable, but move review, execution, and completion
  into a dedicated migration flow that preserves the project sidebar;
- after completion, return through `查看当前项目中的 Skills` to the selected project's
  three-column management state.

The three Option 2.1 images are one connected flow and the current candidate visual target.
Production UI remains blocked until the product owner explicitly confirms this set or asks
for another revision.
