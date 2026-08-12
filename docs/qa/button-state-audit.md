# Habitat Button-State Audit

Date: 2026-08-12

Scope: first-run, project management, Recovery, and persistent sidebar actions.
User goal: every click must either react immediately, explain why it is unavailable, or reach a
stable success/error state without freezing the window.

## Verdict

The widespread “stuck” feeling had one systemic cause and several smaller interaction gaps.
All 23 registered Tauri commands were ordinary synchronous commands, so filesystem scans,
fingerprints, project inspection, transaction execution, and Git subprocesses could block the
main thread. Existing spinners and disabled states were present, but the WebView could not repaint
them while the command was running.

The systemic issue is fixed by scheduling all filesystem/process commands as Tauri async commands.
The UI keeps the approved Quiet Native loading pattern and now locks only controls that could alter
or abandon the active transaction. No command signature, schema, path boundary, or rollback rule
changed.

## Flow steps and health

1. **Project draft before preflight — needs improvement in the baseline.**
   The action was discoverable, but slow work could freeze the entire window and other draft/project
   controls remained operable.
   Evidence: `button-state-audit/01-project-draft-before-click.jpg`.
2. **Project review dialog — healthy structure, baseline focus risk.**
   The two-step safety review was clear, but focus remained on the obscured trigger and the dialog
   could be closed while apply was running.
   Evidence: `button-state-audit/02-project-review-dialog.jpg`.
3. **Recovery confirmation — healthy structure, baseline focus risk.**
   The destructive action used an explicit second confirmation, but focus remained behind the
   modal instead of entering it.
   Evidence: `button-state-audit/03-recovery-confirm-dialog.jpg`.
4. **Settings placeholder — broken in the baseline.**
   It looked enabled but had no handler; URL and rendered content were identical after click.
   Evidence: `button-state-audit/04-settings-no-op.jpg`.
5. **Project preflight in progress — healthy after the fix.**
   The button says “正在检查…”, spins, and disables project switching, Recovery navigation, draft
   toggles, collapse controls, and undo until the plan settles.
   Evidence: `button-state-audit/05-project-plan-progress.jpg`.
6. **Project apply in progress — healthy after the fix.**
   The dialog remains visible, says “正在应用…”, and disables close/back/apply so the transaction
   cannot be abandoned or duplicated.
   Evidence: `button-state-audit/06-project-apply-progress.jpg`.
7. **Recovery confirmation focus — healthy after the fix.**
   Focus enters the dialog on the safe “取消” action; it no longer leaves a misleading active ring
   on the obscured rollback trigger.
   Evidence: `button-state-audit/07-recovery-confirm-focus.jpg`.

## Inventory by operation

| Surface | Operation | Baseline risk | Resolution |
| --- | --- | --- | --- |
| First run | scan / rescan | full WebView could freeze | command runs off main thread; dedicated scan state remains live |
| First run | validate Store / build plan | spinner could fail to repaint; Back remained active | off-main command; button says “正在检查…”; Back locks |
| First run | execute migration | running page could freeze | off-main command; existing non-cancellable transaction state retained |
| First run | rollback | spinner could freeze; project entry remained active | off-main command; both competing actions lock; label says “正在撤销…” |
| Project | initial load / recheck / switch | spinner could freeze; selected project could drift on failed switch | off-main command; selection persists only after successful inspection |
| Project | register project | no visible registration phase | existing dialog action now reports “正在登记…” and locks its choices |
| Project | plan changes | draft/project controls remained mutable | explicit “正在检查…” plus scoped control lock |
| Project | apply changes | dialog could close during mutation | explicit “正在应用…”; close/back/apply lock |
| Recovery | inspect / re-inspect | global scan could freeze | off-main command; existing inspection state remains live |
| Recovery | execute rollback | running page could freeze | off-main command; intentionally non-cancellable transaction state retained |
| Recovery | copy diagnostics | click had no success or failure feedback | button reports copied/failed result |
| Shared | Settings | enabled no-op button | disabled with “后续版本开放” explanation |
| First run | Agent `+N` overflow | mouse click could appear to do nothing | click focus now reveals the same approved hover/focus popover |

## Accessibility findings

- Fixed: all four custom dialogs now move focus inside on open; destructive Recovery defaults to
  the safe cancel action.
- Fixed: busy state is communicated by text as well as spinner/opacity.
- Fixed: unavailable Settings is a real disabled control rather than an enabled no-op.
- Preserved: existing focus-visible token, minimum control sizing, live regions, and reduced-motion
  spinner behavior.
- Limit: this audit verifies DOM focus, accessible names, disabled states, screenshots, and console
  output; it does not claim full VoiceOver or WCAG conformance.

## Verification

- Browser fixture: plan and apply progress remain visually responsive for 1.2 seconds; conflicting
  controls are disabled and recover afterward.
- Browser fixture: dialog active element is inside the dialog; Recovery uses `取消` as the initial
  focus target.
- Browser fixture: diagnostic copy reports `已复制诊断信息`; Agent overflow tooltip becomes visible
  after mouse click; Settings is disabled.
- Browser console: 0 warnings, 0 errors.
- Rust guard: a source-level regression test fails if any plain `#[tauri::command]` is reintroduced.

Final result: passed.
