# Project Skills Visual Round 2

Status: direction A selected; icon-scale refinement awaiting final confirmation
Date: 2026-08-09
Implementation status: static visual exploration only; production UI is not authorized.

## Shared screen contract

All three directions show the same P2 project-management task after first-run migration has
completed:

- current project: `media`;
- Skills: `explain-and-quiz`, `finding-unknowns`, `sharpen`, `habit-store`, `media-kit`, and
  `project-harness`;
- `Codex + Pi + Cursor` are one coupled common-target control;
- Claude Code and Trae are independent controls;
- icon states cover verified, pending add, pending removal, off, and warning;
- clicks only edit a project draft;
- the only commit path is `查看并应用`;
- no migration, policy, priority, linked-state, raw-path, fingerprint, adapter, or precedence
  concepts appear in the primary surface.

The preferred earlier three-pane prototype and the actual Spike screenshot were attached to each
generation as visual references. All repository copies are normalized to `1440×1024`.

## Direction A — Quiet three-pane workbench

File: `project-skills-round2-three-pane.png`

Preserves the familiar sidebar + list + inspector structure. Agent controls stay inline, while one
popover explains the coupled common target. A pending-change bar sits above a separate global status
bar.

## Direction B — Inline disclosure ledger

File: `project-skills-round2-inline.png`

Moves selected-Skill explanation into an expanded list row and uses the right rail only for the
project draft. The intended motion is row choice → immediate inline explanation → review the draft.

## Direction C — Agent availability matrix

File: `project-skills-round2-matrix.png`

Turns the three target controls into stable columns for faster scanning across many Skills. The
right inspector keeps selected-Skill explanation and diagnostics without adding a redundant link
column.

## Selected direction revision V1

File: `project-skills-round2-selected-v1.png`

The first revision keeps Direction A's three-pane structure and applies the product-owner feedback:

- removes the persistent global status strip at the bottom;
- renames `恢复中心` to `恢复`;
- treats the pending-change region as a conditional draft commit bar, not a status footer;
- limits the right inspector to incremental information: pending effects, checks, project-relative
  targets, and collapsed technical details;
- replaces placeholder Agent marks with brand-shape references from
  [Lobe Icons](https://icons.lobehub.com/) and the official
  [Pi press kit](https://pi.dev/press-kit);
- keeps business state markers separate from each Agent logo.

The revision still awaits visual confirmation and does not authorize production implementation.

## Selected direction revision V2

File: `project-skills-round2-selected-v2.png`

V2 is a scoped visual-density correction. Agent brand marks are reduced to approximately 14–16px
inside approximately 28px controls, while the shared Codex/Pi/Cursor control, status markers, layout,
copy, inspector information, and draft commit boundary remain unchanged. This is the current visual
target awaiting final confirmation.

## Evaluation axes

The product owner should compare:

1. whether the Agent toggle state is understandable without reading internal concepts;
2. whether one Skill can be changed without losing context;
3. whether pending changes and the commit boundary are unmistakable;
4. whether the layout remains calm with dozens of Skills;
5. whether a future 1120px layout can collapse the inspector without breaking the main task.
