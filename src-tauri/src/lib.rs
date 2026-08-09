pub mod adapters;
pub mod migration;
pub mod skills;

use adapters::{
    adapter_registry, apply_project_exposure_plan, build_project_exposure_plan,
    inspect_project_exposures, rollback_project_transaction, AgentId, ProjectExposureInspection,
    ProjectExposurePlan, ProjectSkillSelection, ProjectTransactionManifest,
};
use migration::{
    build_import_plan, execute_import, rollback_transaction, scan_inventory, validate_store,
    InventoryRoot, InventorySnapshot, MigrationError, MigrationPlan, TransactionManifest,
};
use serde::{Deserialize, Serialize};
use skills::{AppError, CommandResult, Preflight, ProjectScan, SkillInspection, StoreScan};
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
struct FirstRunSession {
    roots: Vec<InventoryRoot>,
    snapshot: Option<InventorySnapshot>,
    plan: Option<MigrationPlan>,
    manifest: Option<TransactionManifest>,
}

#[derive(Default)]
struct FirstRunState(Mutex<FirstRunSession>);

#[derive(Default)]
struct ProjectSession {
    plan: Option<ProjectExposurePlan>,
    manifest: Option<ProjectTransactionManifest>,
}

#[derive(Default)]
struct ProjectState(Mutex<ProjectSession>);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDraftSelection {
    name: String,
    selected_agents: Vec<AgentId>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectWorkspaceInspection {
    registry_version: String,
    project_root: PathBuf,
    skills: Vec<ProjectExposureInspection>,
}

fn first_run_error(code: &str, message: &str, recovery: &str) -> MigrationError {
    MigrationError::new(
        code,
        "first_run",
        message,
        None,
        None,
        None,
        recovery,
        false,
    )
}

fn lock_first_run(
    state: &FirstRunState,
) -> Result<std::sync::MutexGuard<'_, FirstRunSession>, MigrationError> {
    state.0.lock().map_err(|_| {
        first_run_error(
            "first_run_state_unavailable",
            "首次设置状态暂时不可用。",
            "重新打开 Habitat 后重新扫描。",
        )
    })
}

fn project_error(code: &str, message: &str, recovery: &str) -> MigrationError {
    MigrationError::new(code, "project", message, None, None, None, recovery, false)
}

fn lock_project(
    state: &ProjectState,
) -> Result<std::sync::MutexGuard<'_, ProjectSession>, MigrationError> {
    state.0.lock().map_err(|_| {
        project_error(
            "project_state_unavailable",
            "项目设置状态暂时不可用。",
            "重新打开 Habitat 后重新检查项目。",
        )
    })
}

fn migration_error_from_app(error: AppError) -> MigrationError {
    MigrationError::new(
        &error.code,
        "project",
        error.message,
        None,
        None,
        Some(error.stderr),
        error.recovery,
        false,
    )
}

fn project_selections(
    store_path: &str,
    drafts: &[ProjectDraftSelection],
) -> Result<Vec<ProjectSkillSelection>, MigrationError> {
    let store = skills::scan_store(store_path).map_err(migration_error_from_app)?;
    let sources = store
        .skills
        .into_iter()
        .map(|skill| (skill.name, PathBuf::from(skill.source_path)))
        .collect::<BTreeMap<_, _>>();
    drafts
        .iter()
        .map(|draft| {
            let source_path = sources.get(&draft.name).cloned().ok_or_else(|| {
                project_error(
                    "unknown_store_skill",
                    "项目草稿包含当前 Skill Store 中不存在的 Skill。",
                    "重新检查 Skill Store 后再调整项目设置。",
                )
            })?;
            Ok(ProjectSkillSelection {
                name: draft.name.clone(),
                source_path,
                selected_agents: draft.selected_agents.clone(),
            })
        })
        .collect()
}

fn agent_key(agent: AgentId) -> &'static str {
    match agent {
        AgentId::Codex => "codex",
        AgentId::ClaudeCode => "claude_code",
        AgentId::Pi => "pi",
        AgentId::Cursor => "cursor",
        AgentId::Trae => "trae",
    }
}

fn expand_known_user_root(home: &OsString, value: &str) -> Result<PathBuf, MigrationError> {
    let relative = value.strip_prefix("~/").ok_or_else(|| {
        first_run_error(
            "invalid_registry_root",
            "Agent registry 包含无法识别的用户目录。",
            "更新 Habitat 的 Agent registry 后重试。",
        )
    })?;
    Ok(PathBuf::from(home).join(relative))
}

fn known_inventory_roots() -> Result<Vec<InventoryRoot>, MigrationError> {
    let home = std::env::var_os("HOME").ok_or_else(|| {
        first_run_error(
            "home_unavailable",
            "无法确定当前用户目录。",
            "重新登录 macOS 后再打开 Habitat。",
        )
    })?;
    let mut roots = Vec::new();
    for adapter in adapter_registry().adapters {
        for (index, value) in adapter.user_roots.iter().enumerate() {
            let path = expand_known_user_root(&home, value)?;
            match std::fs::symlink_metadata(&path) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(error) => {
                    return Err(MigrationError::io(
                        "root_unavailable",
                        "discovery",
                        "无法检查已知 Agent Skill 目录。",
                        &path,
                        error,
                        "检查目录权限后重新扫描。",
                        true,
                    ));
                }
                Ok(_) => {}
            }
            let edition = if adapter.agent_id == AgentId::Trae {
                adapter.editions.get(index).cloned()
            } else {
                None
            };
            roots.push(InventoryRoot {
                root_id: format!("{}:{index}", agent_key(adapter.agent_id)),
                agent_id: agent_key(adapter.agent_id).into(),
                edition,
                path,
            });
        }
    }
    Ok(roots)
}

#[tauri::command]
fn scan_known_inventory_command(
    state: State<'_, FirstRunState>,
) -> Result<InventorySnapshot, MigrationError> {
    let roots = known_inventory_roots()?;
    let snapshot = scan_inventory(&roots)?;
    let mut session = lock_first_run(&state)?;
    session.roots = roots;
    session.snapshot = Some(snapshot.clone());
    session.plan = None;
    session.manifest = None;
    Ok(snapshot)
}

#[tauri::command]
fn validate_first_run_store_command(
    store_path: String,
    state: State<'_, FirstRunState>,
) -> Result<PathBuf, MigrationError> {
    let session = lock_first_run(&state)?;
    if session.snapshot.is_none() {
        return Err(first_run_error(
            "inventory_required",
            "需要先完成本机扫描。",
            "返回第一步重新扫描。",
        ));
    }
    let protected = session
        .roots
        .iter()
        .map(|root| root.path.clone())
        .collect::<Vec<_>>();
    validate_store(PathBuf::from(store_path).as_path(), &protected)
}

#[tauri::command]
fn plan_first_run_migration_command(
    store_path: String,
    selected_artifact_ids: Vec<String>,
    state: State<'_, FirstRunState>,
) -> Result<MigrationPlan, MigrationError> {
    let mut session = lock_first_run(&state)?;
    let snapshot = session.snapshot.as_ref().ok_or_else(|| {
        first_run_error(
            "inventory_required",
            "需要先完成本机扫描。",
            "返回第一步重新扫描。",
        )
    })?;
    let plan = build_import_plan(
        snapshot,
        PathBuf::from(store_path).as_path(),
        &session.roots,
        &[],
        &selected_artifact_ids,
    )?;
    session.plan = Some(plan.clone());
    session.manifest = None;
    Ok(plan)
}

#[tauri::command]
fn execute_first_run_migration_command(
    transaction_id: String,
    state: State<'_, FirstRunState>,
) -> Result<TransactionManifest, MigrationError> {
    let plan = {
        let session = lock_first_run(&state)?;
        let plan = session.plan.as_ref().ok_or_else(|| {
            first_run_error(
                "migration_plan_required",
                "当前没有可执行的迁移计划。",
                "返回确认页重新生成计划。",
            )
        })?;
        if plan.transaction_id != transaction_id {
            return Err(first_run_error(
                "migration_plan_mismatch",
                "迁移计划已经变化。",
                "返回确认页重新检查计划。",
            ));
        }
        plan.clone()
    };
    let manifest = execute_import(&plan)?;
    let mut session = lock_first_run(&state)?;
    session.manifest = Some(manifest.clone());
    Ok(manifest)
}

#[tauri::command]
fn rollback_first_run_migration_command(
    transaction_id: String,
    state: State<'_, FirstRunState>,
) -> Result<TransactionManifest, MigrationError> {
    let manifest_path = {
        let session = lock_first_run(&state)?;
        let manifest = session.manifest.as_ref().ok_or_else(|| {
            first_run_error(
                "migration_manifest_required",
                "当前没有可回滚的迁移记录。",
                "打开恢复区并重新检查迁移记录。",
            )
        })?;
        if manifest.transaction_id != transaction_id {
            return Err(first_run_error(
                "migration_manifest_mismatch",
                "恢复记录与当前迁移不一致。",
                "重新打开恢复区并检查记录。",
            ));
        }
        session
            .plan
            .as_ref()
            .map(|plan| plan.manifest_path.clone())
            .ok_or_else(|| {
                first_run_error(
                    "migration_plan_required",
                    "无法定位当前迁移记录。",
                    "打开恢复区并重新检查迁移记录。",
                )
            })?
    };
    let manifest = rollback_transaction(&manifest_path)?;
    let mut session = lock_first_run(&state)?;
    session.manifest = Some(manifest.clone());
    Ok(manifest)
}

#[tauri::command]
fn inspect_project_workspace_command(
    store_path: String,
    project_path: String,
) -> Result<ProjectWorkspaceInspection, MigrationError> {
    let store = skills::scan_store(&store_path).map_err(migration_error_from_app)?;
    let all_agents = vec![
        AgentId::Codex,
        AgentId::ClaudeCode,
        AgentId::Pi,
        AgentId::Cursor,
        AgentId::Trae,
    ];
    let selections = store
        .skills
        .iter()
        .map(|skill| ProjectSkillSelection {
            name: skill.name.clone(),
            source_path: PathBuf::from(&skill.source_path),
            selected_agents: all_agents.clone(),
        })
        .collect::<Vec<_>>();

    // The empty plan is also the project/store boundary preflight when a Store has no Skills.
    let validation = build_project_exposure_plan(
        PathBuf::from(&store_path).as_path(),
        PathBuf::from(&project_path).as_path(),
        &[],
    )?;
    let skills = selections
        .iter()
        .map(|selection| {
            inspect_project_exposures(
                PathBuf::from(&store_path).as_path(),
                PathBuf::from(&project_path).as_path(),
                selection,
            )
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ProjectWorkspaceInspection {
        registry_version: validation.registry_version,
        project_root: validation.project_root,
        skills,
    })
}

#[tauri::command]
fn plan_project_settings_command(
    store_path: String,
    project_path: String,
    selections: Vec<ProjectDraftSelection>,
    state: State<'_, ProjectState>,
) -> Result<ProjectExposurePlan, MigrationError> {
    let selections = project_selections(&store_path, &selections)?;
    let plan = build_project_exposure_plan(
        PathBuf::from(store_path).as_path(),
        PathBuf::from(project_path).as_path(),
        &selections,
    )?;
    let mut session = lock_project(&state)?;
    session.plan = Some(plan.clone());
    session.manifest = None;
    Ok(plan)
}

#[tauri::command]
fn apply_project_settings_command(
    transaction_id: String,
    state: State<'_, ProjectState>,
) -> Result<ProjectTransactionManifest, MigrationError> {
    let plan = {
        let session = lock_project(&state)?;
        let plan = session.plan.as_ref().ok_or_else(|| {
            project_error(
                "project_plan_required",
                "当前没有可应用的项目设置。",
                "返回项目页面重新检查更改。",
            )
        })?;
        if plan.transaction_id != transaction_id {
            return Err(project_error(
                "project_plan_mismatch",
                "项目设置已经变化。",
                "返回项目页面重新检查更改。",
            ));
        }
        plan.clone()
    };
    let manifest = apply_project_exposure_plan(&plan)?;
    let mut session = lock_project(&state)?;
    session.manifest = Some(manifest.clone());
    Ok(manifest)
}

#[tauri::command]
fn rollback_project_settings_command(
    transaction_id: String,
    state: State<'_, ProjectState>,
) -> Result<ProjectTransactionManifest, MigrationError> {
    let manifest_path = {
        let session = lock_project(&state)?;
        let manifest = session.manifest.as_ref().ok_or_else(|| {
            project_error(
                "project_manifest_required",
                "当前没有可撤销的项目设置记录。",
                "重新检查项目状态。",
            )
        })?;
        if manifest.transaction_id != transaction_id {
            return Err(project_error(
                "project_manifest_mismatch",
                "项目设置记录与当前事务不一致。",
                "重新检查项目状态。",
            ));
        }
        session
            .plan
            .as_ref()
            .map(|plan| plan.manifest_path.clone())
            .ok_or_else(|| {
                project_error(
                    "project_plan_required",
                    "无法定位当前项目设置记录。",
                    "重新检查项目状态。",
                )
            })?
    };
    let manifest = rollback_project_transaction(&manifest_path)?;
    let mut session = lock_project(&state)?;
    session.manifest = Some(manifest.clone());
    Ok(manifest)
}

#[tauri::command]
fn scan_store(store_path: String) -> Result<StoreScan, AppError> {
    skills::scan_store(&store_path)
}

#[tauri::command]
fn scan_project(project_path: String, store_path: String) -> Result<ProjectScan, AppError> {
    skills::scan_project(&project_path, &store_path)
}

#[tauri::command]
fn inspect_skill(
    store_path: String,
    project_path: String,
    skill_name: String,
) -> Result<SkillInspection, AppError> {
    skills::inspect_skill(&store_path, &project_path, &skill_name)
}

#[tauri::command]
fn preflight_link(
    store_path: String,
    project_path: String,
    skill_name: String,
) -> Result<Preflight, AppError> {
    skills::preflight_link(&store_path, &project_path, &skill_name)
}

#[tauri::command]
fn link_skill(
    store_path: String,
    project_path: String,
    skill_name: String,
) -> Result<Preflight, AppError> {
    skills::link_skill(&store_path, &project_path, &skill_name)
}

#[tauri::command]
fn unlink_skill(
    store_path: String,
    project_path: String,
    skill_name: String,
) -> Result<(), AppError> {
    skills::unlink_skill(&store_path, &project_path, &skill_name)
}

#[tauri::command]
fn validate_links(project_path: String, store_path: String) -> Result<ProjectScan, AppError> {
    skills::scan_project(&project_path, &store_path)
}

#[tauri::command]
fn list_project_skills(project_path: String) -> Result<CommandResult, AppError> {
    skills::run_project_command(
        &project_path,
        "npx",
        &["skills", "list", "--project", "--json"],
    )
}

#[tauri::command]
fn inspect_git_status(project_path: String) -> Result<CommandResult, AppError> {
    skills::run_project_command(&project_path, "git", &["status", "--short"])
}

#[tauri::command]
fn preview_git_diff(project_path: String) -> Result<CommandResult, AppError> {
    skills::run_project_command(&project_path, "git", &["diff"])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FirstRunState::default())
        .manage(ProjectState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_known_inventory_command,
            validate_first_run_store_command,
            plan_first_run_migration_command,
            execute_first_run_migration_command,
            rollback_first_run_migration_command,
            inspect_project_workspace_command,
            plan_project_settings_command,
            apply_project_settings_command,
            rollback_project_settings_command,
            scan_store,
            scan_project,
            inspect_skill,
            preflight_link,
            link_skill,
            unlink_skill,
            validate_links,
            list_project_skills,
            inspect_git_status,
            preview_git_diff,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Habitat");
}

#[cfg(test)]
mod project_command_tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_skill(path: &std::path::Path, name: &str) {
        fs::create_dir_all(path).unwrap();
        fs::write(
            path.join("SKILL.md"),
            format!(
                "---\nname: {name}\ndescription: project command fixture\nversion: 1.0.0\n---\n"
            ),
        )
        .unwrap();
    }

    #[test]
    fn project_command_selection_reaches_all_targets_and_can_remove_them() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("Skill Store");
        let project = fixture.path().join("media");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&store.join("project-harness"), "project-harness");

        let enabled = vec![ProjectDraftSelection {
            name: "project-harness".into(),
            selected_agents: vec![
                AgentId::Codex,
                AgentId::Pi,
                AgentId::Cursor,
                AgentId::ClaudeCode,
                AgentId::Trae,
            ],
        }];
        let selections = project_selections(store.to_str().unwrap(), &enabled).unwrap();
        let plan = build_project_exposure_plan(&store, &project, &selections).unwrap();
        assert_eq!(plan.operations.len(), 3);
        apply_project_exposure_plan(&plan).unwrap();
        for relative in [
            ".agents/skills/project-harness",
            ".claude/skills/project-harness",
            ".trae/skills/project-harness",
        ] {
            let target = project.join(relative);
            assert!(fs::symlink_metadata(&target)
                .unwrap()
                .file_type()
                .is_symlink());
            assert!(!fs::read_link(target).unwrap().is_absolute());
        }

        let inspection = inspect_project_exposures(&store, &project, &selections[0]).unwrap();
        assert!(inspection
            .agents
            .iter()
            .all(|agent| agent.expected_satisfied));

        let disabled = vec![ProjectDraftSelection {
            name: "project-harness".into(),
            selected_agents: Vec::new(),
        }];
        let selections = project_selections(store.to_str().unwrap(), &disabled).unwrap();
        let plan = build_project_exposure_plan(&store, &project, &selections).unwrap();
        assert_eq!(plan.operations.len(), 3);
        apply_project_exposure_plan(&plan).unwrap();
        assert!(fs::symlink_metadata(project.join(".agents/skills/project-harness")).is_err());
        assert!(fs::symlink_metadata(project.join(".claude/skills/project-harness")).is_err());
        assert!(fs::symlink_metadata(project.join(".trae/skills/project-harness")).is_err());
        assert!(store.join("project-harness/SKILL.md").is_file());
    }

    #[test]
    fn project_command_rejects_names_not_present_in_current_store_scan() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        fs::create_dir(&store).unwrap();
        let error = project_selections(
            store.to_str().unwrap(),
            &[ProjectDraftSelection {
                name: "unknown".into(),
                selected_agents: vec![AgentId::Codex],
            }],
        )
        .unwrap_err();
        assert_eq!(error.code, "unknown_store_skill");
    }
}
