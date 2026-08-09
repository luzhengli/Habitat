# Habitat MVP Product Contract

Status: M5 draft for prototype review  
Date: 2026-08-09  
Implementation status: not approved; this document defines behavior but does not authorize production UI work.

## 1. Outcome

Habitat helps a macOS user turn a confusing set of user-level Agent Skills exposures into
one neutral local Store, expose selected skills only to selected projects, and understand
what Codex, Claude Code, Pi, Cursor, and Trae will actually see.

The trustworthy loop is:

```text
discover read-only state
  -> explain canonical artifacts and effective exposure
  -> let the user choose a migration plan
  -> preflight every operation
  -> import to a neutral Store
  -> optionally quarantine confirmed user-level entries
  -> create the minimum project adapter links
  -> verify and report expected versus effective state
  -> offer exact rollback from the transaction manifest
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
- optional, item-by-item, reversible quarantine of selected user entries;
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

### 3.6 MigrationPlan

A migration plan is editable until confirmation and immutable afterward.

Each selected artifact has one decision:

- `project-managed`: import to Store and expose to selected projects;
- `keep-global`: do not move the selected user entries;
- `defer`: make no change;
- `variant-review`: choose one canonical variant; leave others untouched or quarantine
  them only through separate explicit selections.

The plan records selected Agents, projects, source entries, destination name, expected
quarantine operations, expected adapter targets, warnings, and blocking conflicts. It
must preview the post-transaction effective exposure for all five Agents.

### 3.7 MigrationTransaction and manifest

Transaction states:

```text
draft -> preflighting -> ready -> confirmed -> staging -> imported
      -> project-linked -> quarantined -> verifying -> completed

Any executing state may enter:
failed-partial -> rollback-ready -> rolling-back -> rolled-back
                                       \-> rollback-partial
```

The implementation may reorder `project-linked` and `quarantined` only if the preflight
and rollback proof remains equivalent. Before any user entry is quarantined, at least one
selected project must have a verified expected link plan and the canonical Store copy
must match the captured fingerprint.

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

1. No Store: read-only discovery can start; mutation cannot.
2. Unsafe Store proposal: block and explain the conflicting discovery/project root.
3. Inventory ready: show artifacts, routes, effective state, and unresolved diagnostics.
4. Duplicate route: group routes under one artifact; do not inflate the skill count.
5. Variant conflict: require explicit canonical choice; do not preselect.
6. Migration plan ready: show exact copies, quarantines, project links, and support limits.
7. Plan blocked: identify the operation and recovery; confirmation remains disabled.
8. Running: show the current transaction phase; cancellation is offered only at a safe
   boundary and never implies an automatic rollback succeeded.
9. Partial failure: preserve evidence, distinguish completed/unchanged/unknown operations,
   and offer rollback when the manifest proves it is safe.
10. Completed: compare before/expected/effective counts and show required Agent reloads.
11. Rollback completed or partial: prove restored fingerprints or show exact drift.

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

All three M5 directions use the same fixture:

- 44 user-root entries resolving to 31 canonical artifacts;
- 6 duplicate routes;
- 2 same-name/different-content variant conflicts;
- 3 disabled/manual-only policies;
- one selected project, `media`;
- selected Agents: Codex, Claude Code, Pi, Cursor, and Trae China;
- 12 proposed project-managed skills, 8 retained globally, the rest deferred;
- Cursor and Trae shown as path-compatible/Beta, not runtime-verified;
- one simulated target-directory conflict that blocks confirmation until resolved.

Each direction must show the same primary task: review inventory, resolve a variant,
inspect the migration plan, and reach a trustworthy confirmation point. Visual options
may differ in hierarchy and navigation, not in feature scope or truthfulness.

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
