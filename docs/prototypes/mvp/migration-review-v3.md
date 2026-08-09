# Migration Review V3

Status: rejected after lifecycle correction; retained as decision history

## Audit scope

Surface: the dedicated migration-plan page generated in Option 2.1.

User goal: understand the destination and impact of a reversible migration, verify that the
current project receives the intended Skill links, and start the operation without needing to
understand Habitat's internal data model.

Evidence: the product-owner-provided `exec-609f9493-2215-456b-9a21-7c2381560583.png`, inspected
at its original dimensions during the 2026-08-09 review.

## Findings

1. The page gives import, project-only, global, and recovery results equal visual weight. It
   behaves like an implementation report rather than a confirmation task, so the intended
   outcome and next decision are not the first things the eye finds.
2. Agent types and compatibility are exposed as mixed text, tiny logos, and a footer sentence.
   The representation has no reusable component boundary, no stable overflow behavior, and no
   obvious relationship to the current project destination.
3. The bottom of the page contains a completion summary, safety statement, compatibility note,
   global status, and action buttons across multiple competing horizontal regions. Ownership is
   unclear and alignment breaks because unrelated concerns share the footer.
4. The four-stage progress indicator mixes review states (`选择 Skill`, `检查更改`) with runtime
   states (`正在执行`, `完成`). It does not answer whether the user is navigating a review wizard
   or observing a transaction.
5. Paths, entry counts, support caveats, and technical-detail affordances appear before the user
   understands the simple model: content is stored once; the current project receives links;
   obsolete entries remain recoverable.
6. Screenshot-only accessibility risks include icon-only controls without visible names, small
   low-contrast secondary copy, status distinctions that rely heavily on color, and an uncertain
   reading order across the wide result rows. Keyboard, focus, and assistive-technology behavior
   still require implementation testing.

## V3 design contract

- Preserve Habitat Quiet Native and the existing project sidebar.
- Represent Agent types with a reusable icon-tile group, a three-item inline limit, `+n`
  overflow, and a named hover/focus/click popover. Never use a comma-separated Agent sentence.
- Use plain support labels: `已验证` and `预计兼容`; keep adapter/path terminology in technical
  details.
- Separate review navigation from transaction progress.
- Give the page one fixed footer owned by the main workflow: one summary or progress indicator,
  one secondary action, and one primary action. Compatibility and safety details stay in content.
- Prefer outcome-first grouping, a guided review, or a source-to-destination map over equal-weight
  result enumeration.

## Generated directions

- `migration-review-v3-a.png`: outcome-first confirmation with expandable grouped details.
- `migration-review-v3-b.png`: three-step guided review, separate from execution progress.
- `migration-review-v3-c.png`: source-to-Store-to-project change map with a dedicated check rail.

All are 1440×1024 static decision artifacts. The product owner subsequently clarified that
first-run migration is machine-level and precedes all project linking; because these directions
retain project context, none is a valid implementation target.

## External design-method reference

The revision used the public `baoyu-design` repository as a methodology reference rather than
as a visual theme. Applicable practices were: ground work in real screenshots and source code;
treat the local design system as a binding constraint; create materially different options;
preserve prior versions; and favor interactive, verifiable prototypes after visual selection.

Source: <https://github.com/JimLiu/baoyu-design>
