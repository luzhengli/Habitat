# Recovery directions

Status: awaiting product-owner selection

Viewport: 1440x1024 macOS desktop

Visual source: `DESIGN.md` and the approved project Skills V2 shell.

## Shared behavior contract

All three directions use the same fixture and operation boundary:

- the sidebar `恢复` action opens a Store-level Recovery surface and does not mutate files;
- the selected transaction has two recovery entries: one safe, one blocked because its original
  path has been re-created;
- `恢复原入口` is entry-scoped: it restores the original user-level directory or symlink only
  after a fresh backend preflight;
- the Store canonical copy and existing project-relative links remain unchanged;
- restoring an entry makes that Skill user-level-visible again and does not modify Agent settings;
- drift blocks the operation; Habitat never overwrites or deletes the re-created path;
- whole-transaction rollback remains a separate advanced operation and must not be the default
  meaning of the persistent sidebar entry.

This entry-scoped contract closes the post-onboarding safety gap in the current transaction-wide
rollback: a user can recover one original entry without removing a Store source that managed
projects still link to.

## Shared fixture

- Store: 43 Skills.
- Transaction: first migration, 2026-08-12 10:42, id prefix `64b7e8a1`.
- `finding-unknowns`: shared `.agents/skills` entry, exact restoration is currently safe.
- `project-harness`: Claude Code user entry, blocked because the original path exists again.
- An older transaction is already rolled back and remains visible as audit history.

## Direction A - Recovery ledger (recommended)

Artifact: `recovery-ledger-v1.png`.

Reuses the approved three-column Habitat workbench: grouped entries in the center, contextual
preflight and impact in the right inspector, and one explicit action at the bottom of that
inspector. It is the easiest direction to scan repeatedly and keeps blocked entries visible
without turning Recovery into a wizard.

Primary risk: the right inspector must remain readable at narrower desktop widths and become the
same established drawer below 1120px.

## Direction B - Transaction timeline

Artifact: `recovery-timeline-v1.png`.

Makes durable manifests and audit history the primary information architecture. A compact
transaction rail selects a report, while the main table exposes entry-level actions.

Primary risk: transaction terminology is more prominent than the user's immediate task, and the
second navigation rail consumes useful width.

## Direction C - Guided recovery

Artifact: `recovery-guided-v1.png`.

Turns each restoration into a three-step review: select, inspect impact, confirm. The before/after
path map makes the global-visibility consequence hardest to miss.

Primary risk: it is slower for users restoring several entries and makes routine recovery feel
heavier than the rest of Habitat.

## Selection gate

Do not modify production React/Tauri UI until the product owner explicitly selects A, B, or C and
confirms the shared entry-scoped restore contract above (or requests a revised contract).
