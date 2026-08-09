# Habitat MVP Product Contract

Status: M5 draft for prototype review  
Date: 2026-08-09  
Implementation status: not approved; this document defines behavior but does not authorize production UI work.

## 1. Outcome

Habitat helps a macOS user turn a confusing set of user-level Agent Skills exposures into
one neutral local Store, expose selected skills only to selected projects, and understand
what Codex, Claude Code, Pi, Cursor, and Trae will actually see.

The trustworthy lifecycle has two loops:

```text
first run: discover user-level state read-only
  -> explain canonical artifacts and effective exposure
  -> choose a neutral Store and machine-level migration plan
  -> preflight every operation
  -> import to a neutral Store
  -> immediately quarantine the migrated user-level entries
  -> verify Store content and recovery evidence
  -> offer exact rollback from the transaction manifest

ongoing: add or select a project
  -> choose intended Agent availability per Skill
  -> preview the minimum project target set
  -> create or remove relative project links
  -> verify and report expected versus effective state
```

Habitat never claims that a path is runtime-verified when only its discovery location is
known. It never represents bundled, plugin, system, admin, or enterprise skills as user-
managed artifacts.

## 2. MVP boundary

Included:

- read-only inventory of known user and project roots for the five target Agents;
- canonical artifact and duplicate-route detection;
- supported read-only policy and precedence interpretation;
- neutral Store validation and initial Store creation;
- explicit import through transaction staging;
- immediate, manifest-driven, reversible quarantine of successfully imported user entries;
- minimum project adapter coverage for the selected Agents;
- expected/effective comparison, support tier, transaction report, and rollback;
- local persistence of Store, known projects, and completed transaction manifests.

Excluded:

- permanent deletion of source entries or quarantine;
- automatic merge, rewrite, rename, or update of skill content;
- modification of Agent configuration;
- management of runtime-owned, MCP, Rules, cloud, team, or cross-device assets;
- wrapping or taking over Agent startup commands;
- claiming Cursor or Trae runtime support before release-version QA.

## 3. Domain model

### 3.1 AgentAdapter

An `AgentAdapter` is versioned product knowledge, not a writable Agent integration.

| Field | Contract |
| --- | --- |
| `agentId` | Stable identifier: `codex`, `claude`, `pi`, `cursor`, `trae`. |
| `edition` | Optional runtime edition; Trae uses `international` or `china`. |
| `registryVersion` | Habitat-owned adapter schema/version identifier. |
| `projectRoots` | Ordered discovery roots the Agent can read in a project. |
| `userRoots` | Ordered user roots included in read-only inventory. |
| `extraSources` | Runtime-owned sources shown as unmanaged when observable. |
| `conditions` | Trust, settings, path scoping, or manual-only conditions. |
| `precedence` | Versioned winner/loser rules; `unknown` is a valid result. |
| `symlinkBehavior` | `verified`, `documented`, `conditional`, or `unknown`. |
| `reloadBehavior` | Known reload/restart action or `unknown`. |
| `testedVersions` | Version, surface, date, fixture, and evidence reference. |
| `supportTier` | `targeted`, `path-compatible`, or `runtime-verified`. |

Minimum project target calculation:

| Selected Agent set | Required project targets |
| --- | --- |
| Any of Codex, Pi, Cursor | `.agents/skills/<name>` |
| Includes Claude Code | Add `.claude/skills/<name>` |
| Includes Trae | Add `.trae/skills/<name>` |

No unselected target is created. Cursor does not receive a separate `.cursor/skills`
target. If Cursor scans the same artifact through `.agents` and `.claude`, both routes
remain visible until the tested runtime proves realpath deduplication.

### 3.2 CanonicalArtifact

A canonical artifact represents one skill content root.

| Field | Contract |
| --- | --- |
| `artifactId` | Habitat UUID; names and paths are not identity. |
| `canonicalPath` | Canonical local path to the content root. |
| `declaredName` | Parsed `SKILL.md` name, with diagnostics when invalid. |
| `directoryName` | Directory entry name; may differ from declared name. |
| `description` | Parsed description or an explicit missing/invalid diagnostic. |
| `manifest` | Sorted relative paths, lstat kinds, modes, sizes, link text, hashes. |
| `contentFingerprint` | Versioned digest of the manifest and regular-file bytes. |
| `parseStatus` | `valid`, `warning`, or `blocked`, with structured diagnostics. |
| `storeState` | `outside-store`, `staged`, `canonical`, or `quarantined-copy`. |

The scanner does not follow a symlink outside the candidate skill root. Different paths
with the same fingerprint are duplicate copies, not automatically the same entry.
Different fingerprints with the same declared name are variants and are never merged.

### 3.3 ExposureRoute

An exposure route records how one Agent may discover one artifact.

| Field | Contract |
| --- | --- |
| `routeId` | Stable snapshot-local identifier. |
| `agentId` / `edition` | Consumer represented by this route. |
| `scope` | `user`, `project`, or `runtime-owned`. |
| `entryPath` | Exact path scanned by the adapter. |
| `entryKind` | `directory`, `symlink`, `broken-symlink`, `file`, or `unreadable`. |
| `canonicalTarget` | Resolved target when safe and available. |
| `artifactId` | Matched artifact, otherwise absent with a diagnostic. |
| `condition` | `active`, `disabled`, `manual-only`, `path-conditional`, or `unknown`. |
| `precedenceState` | `winner`, `shadowed`, `duplicate-route`, `conflict`, or `unknown`. |
| `managedState` | `managed`, `user-manageable`, or `runtime-owned`. |
| `evidence` | Filesystem/config/runtime evidence that produced the route. |

### 3.4 EffectiveExposure

An effective exposure is computed for one Agent, one edition, one project, and one skill
name. It contains all candidate routes and a winner only when the adapter has enough
evidence to determine one.

```text
available       a route is expected to be discoverable
manual-only     user invocation is possible but model invocation is disabled
path-conditional visibility depends on the active file/path
shadowed        a higher-precedence route wins
duplicate       multiple routes resolve to the same canonical artifact
conflict        same name resolves to different artifacts without a safe winner
unknown         runtime/config evidence is insufficient
```

The UI must show `unknown` rather than infer success. `Expected` describes Habitat's
filesystem plan; `effective` describes the adapter interpretation; `runtime verified`
requires actual supported-runtime evidence.

### 3.5 InventorySnapshot

An inventory snapshot is immutable evidence used to draft a migration.

```text
snapshotId
capturedAt
adapterRegistryVersion
projects[]
artifacts[]
routes[]
effectiveExposures[]
diagnostics[]
catalogMeasurements[]
```

Refreshing inventory creates a new snapshot. A transaction must reject execution when a
selected source no longer matches the snapshot lstat identity or fingerprint.

### 3.6 FirstRunMigrationPlan

A migration plan is editable until confirmation and immutable afterward.

Each discovered artifact has one decision:

- `import`: import one selected canonical variant to Store and move its migrated user entries
  to recovery after the Store fingerprint is verified;
- `defer`: make no change;
- `variant-review`: choose one canonical variant; leave others untouched or quarantine
  them only through separate explicit selections.

The plan records the inventory snapshot, observed Agents, selected source entries, canonical
variant choices, Store destination, expected recovery operations, warnings, and blocking
conflicts. It contains no project and no project adapter target. The review states explicitly
that no project links will be created and that migrated user-level entries become unavailable
from their former global roots after completion.

### 3.7 MigrationTransaction and manifest

Transaction states:

```text
draft -> preflighting -> ready -> confirmed -> staging -> imported
      -> quarantined -> verifying -> completed

Any executing state may enter:
failed-partial -> rollback-ready -> rolling-back -> rolled-back
                                       \-> rollback-partial
```

Before any user entry is quarantined, its canonical Store copy must match the captured
fingerprint and the recovery destination must pass canonical-boundary and lstat preflight.
No project link is required or permitted in this transaction.

The manifest records, for every operation:

- requested path and canonical parent;
- pre-operation lstat kind, inode/file identity where available, mode, link text, target,
  and fingerprint;
- staging path and final Store path;
- quarantine path;
- project target, relative link text, and expected canonical Store target;
- operation result, timestamp, structured error, and whether Habitat may safely undo it.

Rollback is exact and conservative. Habitat restores an entry only when the destination
is still absent or still matches the transaction-created entry. Drift stops rollback and
reports partial state; it never triggers overwrite or broader cleanup.

### 3.8 ProjectExposurePlan

A ProjectExposurePlan is drafted only after first-run migration completes. It records one
project, its selected Agent families, and each Skill's intended Agent availability. Icon-toggle
changes update this draft and never write immediately.

Codex, Pi, and Cursor are one coupled UI toggle group because they share `.agents/skills`.
Claude Code maps independently to `.claude/skills`; Trae maps independently to
`.trae/skills`. The UI must not promise that one Agent in a shared target group can be disabled
while another remains enabled.

The plan contains a complete preflight for every required adapter target before writing:

- project and Store canonical boundaries;
- real adapter container directories using lstat semantics;
- safe single-segment skill name;
- target absent or already linked to the expected canonical source;
- relative link text resolves to the Store source from the target parent;
- no unknown, broken, ordinary-file, real-directory, or foreign-link collision.

If a multi-target write fails, Habitat removes only links created by this transaction
that still match the expected relative link and canonical target. All other states remain
and are reported as partial.

### 3.9 SupportEvidence

Support is shown per Agent and runtime surface:

| Tier | Meaning |
| --- | --- |
| `targeted` | Included in Habitat's product model; discovery or symlink behavior may be unknown. |
| `path-compatible` | The discovery path is documented, but the release runtime contract is incomplete. |
| `runtime-verified` | A named version/surface passed add, reload, discover, duplicate, conflict, and unlink QA. |

Codex, Claude Code, and Pi may be presented as runtime-verified only for tested versions.
Cursor and Trae remain path-compatible/Beta until their release-version matrices pass.

## 4. User-visible states

The MVP flow must make these states observable:

1. No Store: machine-level read-only discovery can start; mutation cannot.
2. Unsafe Store proposal: block and explain the conflicting discovery/project root.
3. Inventory ready: show unique artifacts, observed Agents, duplicate routes, variants, and
   unresolved diagnostics without requiring a project.
4. Duplicate route: group routes under one artifact; do not inflate the Skill count.
5. Variant conflict: require explicit canonical choice; do not preselect.
6. First-run migration ready: show exact Store imports, immediate recovery moves, deferrals,
   and the explicit absence of project links.
7. First-run plan blocked: identify the operation and recovery; confirmation remains disabled.
8. First-run running: show staging, import, recovery, and verification phases; cancellation is
   offered only at a safe boundary and never implies rollback succeeded.
9. First-run completed: prove Store and recovery fingerprints, state that no project has access,
   and offer `添加第一个项目`.
10. Project draft changed: icon toggles show selected, pending, blocked, and verified states;
    the filesystem remains unchanged until apply.
11. Project plan ready: show exact relative link additions/removals and shared Agent target
    effects, with collisions blocking apply.
12. Project apply partial or failed: preserve evidence, keep failed rows actionable, and never
    remove a pre-existing, foreign, or drifted entry.
13. Rollback completed or partial: prove restored fingerprints or show exact drift.

## 5. Persistence boundary

Habitat may persist only app-owned data:

- Store path and validation record;
- known project paths and selected Agent profiles;
- adapter registry version used for a snapshot;
- inventory snapshots needed by an active transaction;
- confirmed transaction manifests and rollback reports;
- UI preferences that do not change Agent behavior.

Agent configuration is never written. Credentials, Agent prompts, and skill body content
are not duplicated into app state; the Store contains the imported canonical content.

## 6. Error contract

Every blocked or failed operation returns:

```text
code             stable Habitat error identifier
phase            discovery, preflight, staging, import, link, quarantine, verify, rollback
message          user-facing statement of what happened
path             exact affected path when safe to disclose
expected         lstat/fingerprint/link state expected by the plan
actual           observed state
recovery         bounded next action; never a guessed overwrite/delete
retryable        whether retry is safe without a new snapshot
transactionId    present after confirmation
```

Unknown filesystem state, permission loss, source drift, schema drift, and output
truncation are blocking or explicitly partial states. They are not converted to success.

## 7. Prototype comparison contract

The next comparable prototype set must use two explicitly separate fixtures.

First-run fixture:

- 44 user-root entries resolving to 31 canonical artifacts;
- 6 duplicate routes and 2 same-name/different-content variant conflicts;
- observed Agents: Codex, Claude Code, Pi, Cursor, and Trae China;
- no selected or managed project;
- selected imports move their former user-level entries immediately to recovery;
- Cursor and Trae shown as `预计兼容`, not runtime-verified;
- one unsafe Store proposal or source drift that blocks confirmation until resolved.

Project-management fixture, shown only after first-run completion:

- selected project `media` and the same five Agent families;
- Codex, Pi, and Cursor shown as one coupled icon-toggle group;
- Claude Code and Trae shown as independent target groups;
- icon toggles create a draft rather than immediate filesystem writes;
- no redundant `是否已经链接` column;
- one simulated target collision that blocks apply until resolved.

Each visual direction must cover the same task and lifecycle boundary. Existing migration-plan
images that include a selected project during first-run migration are decision history, not
valid candidates for implementation.

## 8. M6-M8 acceptance hooks

- Temporary fixtures reproduce every state in section 4 without touching real user roots.
- The same artifact is not counted twice when multiple routes resolve to its canonical path.
- Same-name/different-fingerprint variants never receive an automatic winner.
- Unsafe Store ancestry/descendency relationships are blocked before mutation.
- Confirmed manifests are sufficient to prove completed operations and exact rollback.
- An unselected Agent adapter never creates a project target.
- A failed multi-target link never removes a pre-existing or drifted entry.
- Expected, effective, and runtime-verified are distinct in data and UI.
- Production UI implementation begins only after the product owner selects one M5 visual
  direction and the selected scope is recorded in PLAN and JOURNAL.
