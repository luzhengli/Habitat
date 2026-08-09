# Habitat MVP User Flow

Status: product-owner approved flow; visual direction not yet approved
Date: 2026-08-09

## 1. Lifecycle boundary

Habitat has two separate user journeys. They must not share a migration stepper or imply that
project links are created during first use.

### First run: machine-level Store migration

```text
scan known Agent user roots (read-only)
  -> group duplicate content and surface variants
  -> select canonical Skills and Store location
  -> review one machine-level migration plan
  -> import through transaction staging
  -> immediately move migrated user-level entries to the recovery area
  -> verify Store fingerprints and recovery manifest
  -> offer Add first project
```

The first-run flow does not select a project and does not create project links. After it
completes, migrated Skills are not globally discoverable through their previous user-level
entries. The recovery area is reversible and never a permanent delete.

### Ongoing use: project-level Skill links

```text
add or select a project
  -> choose the Agents used by that project
  -> toggle per-Skill Agent availability
  -> review pending link additions and removals
  -> apply relative project links
  -> verify and return to project management
```

Project link operations never copy Skill content. The Store remains the only managed content
source.

## 2. First-run screens

1. **Start scan** — explain that discovery is read-only and scan known Agent user roots.
2. **Scan result** — report unique Skills, duplicate entries, variants, invalid entries, and
   observed Agents without inflating counts by path.
3. **Organize migration** — automatically group identical content; require an explicit variant
   choice; allow exclusion or deferral.
4. **Choose Store** — validate the custom Store outside all known discovery and managed-project
   roots.
5. **Review migration** — show Store imports, canonical choices, immediate recovery moves, and
   deferred diagnostics. State explicitly that no project link will be created.
6. **Run and verify** — prepare, stage, import, move old entries to recovery, verify fingerprints,
   and report rollback evidence.
7. **Complete setup** — state that the Store is ready and no project has access yet. Primary
   action: `添加第一个项目`; secondary action: `查看恢复区`.

## 3. Project-management screens

1. **Add project** — choose a directory and the Agent families used in it.
2. **Skills list** — show Skill identity, source/version, actionable diagnostics, and an `适用于`
   Agent icon-toggle group. Do not add a redundant `是否已经链接` column.
3. **Draft changes** — icon clicks update a draft; they never write immediately. A single pending
   bar shows the number of changes and offers `撤销更改` and `查看并应用`.
4. **Review project settings** — show only link additions/removals and blocking collisions.
   Primary action: `应用项目设置`.
5. **Apply and verify** — create/remove only expected relative links, then return to the list.
   Normal success is reflected by icon state; partial or failed items remain visible with a
   bounded recovery action.

## 4. Agent icon-toggle contract

The icons express intended and verified project-level availability, not one physical link per
Agent.

- dim outline: not selected;
- lit with check: selected and verified;
- lit with dot: pending apply;
- error marker: selected target is blocked or failed.

Brightness is not the only carrier. Every icon has a visible focus state, tooltip, accessible
name, and text status in its popover.

Codex, Pi, and Cursor share `.agents/skills`; they are one coupled toggle group. Clicking any
member toggles the group, and the UI explains in plain language that they share one project
entry. Claude Code and Trae remain independent target groups. Cursor and Trae may show
`预计兼容`, but internal adapter/path terminology stays in technical details.

## 5. Current visual gate

All existing migration-plan images that include a selected project during first-run migration
are rejected as lifecycle references. No production UI is authorized. A later visual pass must
compare at least three directions using this approved flow before M5 can complete.
