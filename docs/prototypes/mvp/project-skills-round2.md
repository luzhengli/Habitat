# Project Skills Visual Round 2

Status: awaiting product-owner selection
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

## Evaluation axes

The product owner should compare:

1. whether the Agent toggle state is understandable without reading internal concepts;
2. whether one Skill can be changed without losing context;
3. whether pending changes and the commit boundary are unmistakable;
4. whether the layout remains calm with dozens of Skills;
5. whether a future 1120px layout can collapse the inspector without breaking the main task.
