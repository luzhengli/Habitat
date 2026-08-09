# Habitat MVP Information Architecture

Status: review draft derived from the approved lifecycle
Date: 2026-08-09
Implementation status: not approved; no production UI is authorized by this document.

## 1. Product shells

Habitat uses two shells. They never appear at the same time.

### 1.1 First-run setup shell

Purpose: finish machine-level discovery and Store migration before any project exists.

Persistent regions:

- macOS title/drag region and Habitat identity;
- setup progress: `扫描本机 → 整理 Skills → 设置技能库 → 确认迁移 → 完成`;
- one main content region;
- one page-owned action footer when the current step needs actions.

Must not show:

- project sidebar or a selected project;
- per-project Agent toggles;
- project link counts;
- daily management filters or Skill inspector.

### 1.2 Project-management shell

Purpose: add projects and manage project-relative Skill links after Store setup succeeds.

Persistent regions:

- left sidebar: projects, Add project, the one Skill Store, Recovery, Settings;
- center workspace: selected project's Skills;
- optional right inspector: the selected Skill's context and diagnostics;
- global app status at the very bottom;
- a pending-change bar only while the selected project has an unapplied draft.

Must not show first-run migration progress or describe project changes as migration.

## 2. First-run screen contract

### F0. Start scan

User question: `Habitat 会检查什么，会不会修改我的文件？`

Required information:

- one-sentence outcome: find user-managed Skills and prepare one local Skill Store;
- observed surfaces represented by Agent icons, with names on hover/focus;
- plain-language trust statement: scan is local and read-only;
- collapsed `查看扫描位置` disclosure for known user roots;
- statement that no project link will be created in setup.

Actions:

- primary: `扫描本机`;
- quiet: `退出设置` only when closing is safe.

States:

- no known roots found: still allow scan and explain the empty result later;
- permission unavailable: name the unreadable location and bounded recovery action;
- unsupported/unknown source: report it without treating it as user-managed.

### F1. Scanning

User question: `扫描到哪里了？`

Required information:

- current Agent icon and readable directory label;
- deterministic progress by known roots, not a fake percentage by file count;
- live counts for candidate Skills and diagnostics;
- read-only reminder.

Actions:

- secondary: `停止扫描`; stopping leaves no partial migration state;
- no forward action until the snapshot is complete.

States:

- an unreadable root becomes a visible diagnostic and does not disappear silently;
- a source changing during scan invalidates that source and offers rescan.

### F2. Organize Skills

User question: `哪些内容会进入技能库？`

Required summary:

- unique Skills;
- automatically grouped duplicate routes;
- unresolved same-name variants;
- invalid or deferred items;
- observed Agent icon groups.

List columns:

1. selection control + Skill name + description;
2. `发现于`: Agent icon group, maximum three inline plus `+n` popover;
3. source/variant summary, not the raw path;
4. actionable state: ready, needs a decision, invalid, or deferred.

Row/inspector behavior:

- identical fingerprints are grouped automatically, with source paths in technical details;
- variants are never preselected;
- selecting a conflict opens one focused version decision in the inspector;
- `暂不导入` is explicit and reversible before confirmation;
- paths, fingerprints, and parse diagnostics remain behind `技术详情`.

Actions:

- primary: `继续设置技能库`;
- secondary: `重新扫描`;
- primary remains disabled only for selected blocking items; the user may defer them.

### F3. Choose Store

User question: `Skill 内容以后保存在哪里？`

Required information:

- recommended default path;
- custom path picker;
- validation result: writable, outside known Agent roots, outside managed projects, and not
  a symlink/reparse ambiguity;
- plain model: Store saves content; projects later save links only.

Actions:

- primary: `使用此目录`;
- secondary: `返回整理`;
- quiet: copy/show the full canonical path.

Blocked states:

- known discovery root or its ancestor/descendant;
- a managed project or its ancestor/descendant;
- unreadable, unwritable, unknown, broken-link, or conflicting target.

Blocked paths are never guessed, created elsewhere, or silently replaced.

### F4. Review first migration

User question: `这次会移动什么？`

Required information, in this order:

1. outcome: selected Skills will enter the chosen Store;
2. import count and canonical choices;
3. original user-level entries that immediately move to Recovery;
4. deferred and invalid entries that remain unchanged;
5. safety statement: no permanent delete, no Agent setting change, no project link;
6. collapsed technical manifest preview.

Do not show:

- project names;
- `适用于` project Agent toggles;
- adapter targets;
- a review stepper mixed with runtime execution states.

Actions:

- secondary: `返回整理`;
- primary: `开始迁移`;
- footer left: one sentence summarizing imports, recovery moves, and deferred items.

Any snapshot drift or unsafe destination blocks the primary action and names the affected item.

### F5. Run and verify

User question: `现在正在做什么？`

Runtime phases:

1. preparing staging;
2. importing Store content;
3. verifying Store fingerprints;
4. moving original entries to Recovery;
5. verifying the recovery manifest;
6. completing.

Required information:

- current phase and current Skill;
- completed/remaining counts;
- expandable operation log;
- whether stopping is currently safe.

Actions:

- cancellation appears only at a proven safe boundary;
- failure offers `查看问题`; rollback appears only when the manifest proves it is safe;
- closing the window never presents an unverified operation as complete.

### F6. Setup result

User question: `迁移是否完成，接下来做什么？`

Success information:

- Store import count and verified fingerprint result;
- Recovery count and explicit reversibility;
- deferred/unchanged count;
- explicit statement: no project can use the migrated Skills yet.

Success actions:

- primary: `添加第一个项目`;
- secondary: `查看恢复区`;
- quiet: `查看技术报告`.

Partial/failure information:

- completed, rolled-back, unchanged, and unknown operations are separate groups;
- each unresolved item has one bounded recovery action;
- success styling is forbidden while unknown or partial operations remain.

## 3. Project-management screen contract

### P0. No projects

User question: `如何让一个项目开始使用技能库？`

Required information:

- Store is ready and contains the verified Skill count;
- adding a project does not link any Skill automatically;
- one short explanation of project-relative links.

Action: primary `添加项目`.

### P1. Add project

User question: `哪个项目要使用哪些 Agent 入口？`

Required information:

- project directory picker and canonical path result;
- three target controls represented by Agent icons:
  - one coupled `通用入口` control containing Codex, Pi, and Cursor icons;
  - one Claude Code control;
  - one Trae control;
- plain explanation that members of the common group share one project entry;
- `预计兼容` status on Cursor and Trae where applicable;
- statement that adding the project creates no Skill links yet.

Actions:

- primary: `添加项目`;
- secondary: `取消`.

Blocked states: unsafe project boundary, unreadable target, already-managed canonical path, or
unknown adapter container state.

### P2. Project Skills

User question: `这个项目的每个 Skill 可供哪些 Agent 使用？`

Header:

- project name and path;
- search;
- filter: all, available in project, not added, pending changes, needs attention;
- secondary `重新检查`.

List columns:

1. Skill name + description;
2. `适用于`: target icon toggles;
3. source + version/update summary;
4. state, shown only for pending changes, updates, conflicts, broken links, or failures.

There is no `是否已经链接`, policy, priority, or raw-path column.

Agent toggle controls:

- one common-target control contains Codex, Pi, and Cursor icons and toggles them together;
- Claude Code and Trae are independent controls;
- dim outline: not selected and not linked;
- lit + check: linked and verified;
- lit + dot: pending add;
- dim + dot/minus: pending removal;
- error marker: blocked or failed;
- every state has a tooltip, accessible name, keyboard behavior, and text in its popover.

Click behavior:

- changes only the selected project's draft;
- never performs a filesystem write immediately;
- a blocked target opens the relevant inspector diagnosis instead of pretending to toggle;
- switching project with a dirty draft asks to discard or remain; it never silently applies.

Inspector order:

1. Skill identity, version, and description;
2. Agent availability and pending changes;
3. update/conflict diagnostics;
4. Store source;
5. project link targets;
6. technical details.

### P3. Pending-change bar

Appears only when the selected project draft differs from verified state.

Required information:

- number of affected Skills and link operations;
- blocking count, if any;
- no compatibility essay or global app status.

Actions:

- quiet: `撤销更改`;
- primary: `查看并应用`;
- primary is disabled when a blocking collision remains.

This is one aligned component owned by the selected project workspace.

### P4. Review project settings

User question: `将给当前项目增加或移除哪些入口？`

Required information:

- additions grouped by Skill and target group;
- removals grouped separately;
- shared common-target effect explained once;
- preflight result and blocking collisions;
- statement: Skill content and Agent settings do not change.

Actions:

- secondary: `返回调整`;
- primary: `应用项目设置`.

This is not called migration and does not repeat first-run Store information.

### P5. Apply project settings

Normal success returns directly to P2 and changes pending icons into verified icons.

During execution:

- lock only affected Skill/target controls;
- show concise progress in the review surface or a bounded modal;
- do not replace the entire app with a first-run progress page.

Partial/failure:

- successful targets remain verified;
- safely rolled-back targets return to their previous state;
- unresolved targets show an error marker and one recovery action;
- never delete a pre-existing, foreign, or drifted path.

## 4. Recovery surface

Recovery is Store-level, not project-level.

Required information:

- first-run migration transaction and completion time;
- original Agent/source label represented by icon + readable name;
- original path in technical details;
- content fingerprint verification state;
- whether exact restoration is currently safe.

Actions:

- `查看内容`;
- `恢复原入口` only after current-state preflight;
- `查看迁移报告`.

Permanent deletion is outside MVP. Restore never overwrites a changed or re-created path.

## 5. User-facing terminology

Use in primary UI:

- 技能库;
- 恢复区;
- 当前项目;
- 适用于;
- 已验证;
- 预计兼容;
- 待应用;
- 技术详情.

Keep out of primary UI:

- canonical artifact;
- exposure/effective exposure;
- adapter/target;
- quarantine;
- fingerprint;
- entry kind;
- precedence.

The internal terms may appear only in technical reports or developer diagnostics.

## 6. Acceptance checks before visual exploration

- Every first-run screen works without a project in the fixture.
- First-run review contains no project link or per-project Agent control.
- Migrated user-level entries are shown as immediate Recovery moves.
- Setup completion says that no project has access yet.
- Adding a project creates no Skill link automatically.
- Codex/Pi/Cursor appear and behave as one shared target control.
- Every toggle produces a draft, not an immediate write.
- Project Skills has no redundant linked-state column.
- Only one pending-change bar can appear, and it never competes with global status.
- Review/apply copy refers to project settings, not migration.
- Brightness is never the only Agent state cue.
- Unknown, blocked, partial, and rollback-partial states cannot look successful.
