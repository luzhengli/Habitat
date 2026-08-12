# Recovery directions

Status: awaiting product-owner selection

Viewport: 1440x1024 macOS desktop

Visual source: `DESIGN.md` and the approved project Skills V2 shell.

## Shared behavior contract

All three directions use the same fixture and operation boundary:

- the sidebar `恢复` action opens a Store-level Recovery surface and does not mutate files;
- Recovery is one transaction-wide rollback with no Skill picker or per-entry action;
- after one fresh all-target preflight, Habitat restores every quarantined original user entry,
  removes every unchanged Store import created by that migration, and returns to first setup;
- any Store, recovery, original-destination, manifest-boundary, or identity drift blocks the whole
  operation before mutation;
- any known managed-project link that still resolves to a transaction Store import blocks the
  whole operation; Habitat does not silently delete links created by later project transactions;
- after the user removes every reported project link and rechecks, one explicit confirmation runs
  the existing exact rollback;
- Agent settings are never changed and permanent recovery deletion remains outside MVP.

The product owner confirmed this whole-transaction contract on 2026-08-12. The earlier
entry-scoped artifacts (`recovery-ledger-v1.png`, `recovery-timeline-v1.png`, and
`recovery-guided-v1.png`) remain rejected decision history.

## Shared fixture

- Store: 43 Skills.
- Transaction: first migration, 2026-08-12 10:42, id prefix `64b7e8a1`.
- 43 Store imports and 2 original user entries are individually fingerprint-safe.
- Habitat still has one managed `.agents/skills/finding-unknowns` link resolving into the Store;
  this single link blocks the entire rollback.
- An older transaction is already rolled back and remains visible as audit history.

## Direction A - Transaction summary with inspector (recommended)

Artifact: `recovery-transaction-summary-v1.png`.

Reuses the approved three-column Habitat workbench. The center shows the two fixed rollback phases
and blockers rather than Skills; the inspector explains the whole-transaction result and owns the
single final action. It is the clearest continuation of the current app and keeps the scope visible
without looking like a picker.

Primary risk: the right inspector must remain readable at narrower desktop widths and become the
same established drawer below 1120px.

## Direction B - Transaction report

Artifact: `recovery-transaction-report-v1.png`.

Makes durable manifests and audit history the primary information architecture. A compact
transaction rail selects the authoritative first-run record; the report shows the two fixed
rollback phases, aggregate counts, and the single project-link blocker. It exposes no per-Skill
actions.

Primary risk: transaction terminology is more prominent than the user's immediate task, and the
second navigation rail consumes useful width.

## Direction C - Guided transaction rollback

Artifact: `recovery-transaction-guided-v1.png`.

Turns the one rollback into three steps: inspect the fixed scope, resolve all blockers, and confirm
once. The focused blocker map makes the cross-transaction project-link boundary hardest to miss.

Primary risk: the stepper makes a single rollback feel heavier than the rest of Habitat.

## Selection gate

Do not modify production React UI until the product owner explicitly selects A, B, or C. The
transaction-wide behavior contract is already confirmed, so backend manifest discovery, preflight,
and blocker tests may proceed independently of the visual selection.
