# Recovery directions

Status: awaiting product-owner selection of the global, no-project-sidebar set

Viewport: 1440x1024 macOS desktop

Visual source: `DESIGN.md`. Recovery deliberately exits the project Skills V2 shell because it is
a Store-wide operation rather than a current-project task.

## Shared behavior contract

All three directions use the same fixture and operation boundary:

- the sidebar `恢复` action exits project navigation and opens a full-window Store-level Recovery
  surface; the Recovery surface itself has no project sidebar or current-project selection;
- Recovery is one transaction-wide rollback with no Skill picker or per-entry action;
- "all projects" means every project in Habitat's durable managed-project registry, not an
  unbounded whole-disk scan and not only the project that was selected before entering Recovery;
- each registered project must receive an explicit readable/no-related-link result; an unavailable,
  unreadable, missing, or otherwise unverified project blocks the whole operation;
- after one fresh all-target preflight, Habitat restores every quarantined original user entry,
  removes every unchanged Store import created by that migration, and returns to first setup;
- any Store, recovery, original-destination, manifest-boundary, or identity drift blocks the whole
  operation before mutation;
- any known managed-project link that still resolves to a transaction Store import blocks the
  whole operation; Habitat does not silently delete links created by later project transactions;
- after the user removes every reported project link and rechecks, one explicit confirmation runs
  the existing exact rollback;
- Agent settings are never changed and permanent recovery deletion remains outside MVP.

The product owner confirmed this whole-transaction contract on 2026-08-12, then rejected the first
two visual sets because both retained project navigation and implied a current-project scope. Those
six artifacts remain decision history. The three directions below are the replacement reaction set.

The current implementation only persists projects in WebView local storage and passes a caller-
supplied project list to Rust. That list is useful for scanning but cannot prove it is complete.
Production execution therefore remains blocked until Habitat owns a durable authoritative registry
that the Recovery backend reads directly; the selected prototype will define how registry problems
are surfaced.

## Shared fixture

- Store: 43 Skills.
- Transaction: first migration, 2026-08-12 10:42, id prefix `64b7e8a1`.
- 43 Store imports and 2 original user entries are individually fingerprint-safe.
- Four projects are registered with Habitat: Habitat, media, blog, and archive-lab.
- Habitat has one and media has two adapter links resolving into transaction Store imports; blog has
  none.
- archive-lab is registered under a currently unavailable volume, so its result is unknown and it
  independently blocks recovery.
- Three of four projects were checked, three relevant links were found, and two blocker categories
  remain. All directions show the same state and final disabled action.

## Direction A - Global impact overview

Artifact: `recovery-global-overview-v1.png`.

Uses a full-window Store-level page with aggregate coverage metrics, one row for every managed
project, and a fixed recovery summary. It balances the global audit surface and the transaction
result without turning projects into navigation.

Primary risk: the recovery summary becomes narrow at smaller desktop widths and needs to stack below
the project table.

## Direction B - Project impact matrix (recommended)

Artifact: `recovery-global-matrix-v1.png`.

Makes completeness easiest to audit: every registered project is a row and every Habitat-managed
adapter container is a column. Related link counts, inaccessible routes, and the final whole-
transaction blocker are visible in one scan. This best matches the corrected global mental model.

Primary risk: adapter columns expose more implementation detail than most users need; responsive
layouts should collapse them into a per-project detail disclosure.

## Direction C - Guided global audit

Artifact: `recovery-global-guided-v1.png`.

Turns the rollback into three global stages and groups blockers by action: remove relevant links,
then repair or explicitly remove an unavailable project registration. A compact checklist still
proves that all registered projects are included.

Primary risk: the stepper makes a rare one-time rollback feel heavier and shows less cross-project
comparison than the matrix.

## Selection gate

Do not modify production React UI or add the durable project-registry schema until the product owner
explicitly selects A, B, or C. Existing backend manifest discovery and bounded link scanning remain
safe foundations, but caller-supplied project lists are not accepted as proof of global completeness.
