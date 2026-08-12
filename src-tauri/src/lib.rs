pub mod adapters;
pub mod migration;
pub mod projects;
pub mod skills;

use adapters::{
    adapter_registry, apply_project_exposure_plan, build_project_exposure_plan,
    find_managed_links_to_sources, inspect_project_exposures, rollback_project_transaction,
    AgentId, ProjectExposureInspection, ProjectExposurePlan, ProjectSkillSelection,
    ProjectTransactionManifest,
};
use migration::{
    build_import_plan, discover_recovery_transaction, execute_import,
    preflight_rollback_transaction, rollback_transaction, scan_inventory, validate_store,
    InventoryRoot, InventorySnapshot, MigrationError, MigrationPlan, TransactionManifest,
};
use projects::{
    discover_historical_project_roots, list_managed_projects, register_managed_project,
    ManagedProjectRecord,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use skills::{AppError, CommandResult, Preflight, ProjectScan, SkillInspection, StoreScan};
use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::os::unix::fs::MetadataExt;
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

#[derive(Debug, Clone)]
struct RecoverySession {
    transaction_id: String,
    audit_revision: String,
    store_root: PathBuf,
    known_user_roots: Vec<PathBuf>,
    manifest_path: PathBuf,
}

#[derive(Default)]
struct RecoveryState(Mutex<Option<RecoverySession>>);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RecoveryBlocker {
    code: String,
    message: String,
    path: Option<PathBuf>,
    recovery: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RecoveryProjectAudit {
    project_id: Option<String>,
    project_root: PathBuf,
    provenance: Vec<String>,
    state: String,
    related_links: Vec<PathBuf>,
    blocker: Option<RecoveryBlocker>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RecoveryCoverage {
    expected: usize,
    inspected: usize,
    passed: usize,
    blocked: usize,
    unknown: usize,
}

impl From<MigrationError> for RecoveryBlocker {
    fn from(error: MigrationError) -> Self {
        Self {
            code: error.code,
            message: error.message,
            path: error.path,
            recovery: error.recovery,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RecoveryPlan {
    transaction_id: String,
    audit_revision: String,
    store_root: PathBuf,
    state: migration::TransactionState,
    created_at: u64,
    updated_at: u64,
    import_count: usize,
    recovery_count: usize,
    project_links: Vec<PathBuf>,
    projects: Vec<RecoveryProjectAudit>,
    coverage: RecoveryCoverage,
    blockers: Vec<RecoveryBlocker>,
    ready: bool,
}

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

fn lock_recovery(
    state: &RecoveryState,
) -> Result<std::sync::MutexGuard<'_, Option<RecoverySession>>, MigrationError> {
    state.0.lock().map_err(|_| {
        first_run_error(
            "recovery_state_unavailable",
            "恢复状态暂时不可用。",
            "重新打开恢复页并重新检查。",
        )
    })
}

fn prepare_recovery_plan(
    store_path: &std::path::Path,
    known_user_roots: &[PathBuf],
) -> Result<Option<(PathBuf, RecoveryPlan)>, MigrationError> {
    let Some((manifest_path, manifest)) = discover_recovery_transaction(store_path)? else {
        return Ok(None);
    };
    let mut blockers = Vec::new();
    if let Err(error) = preflight_rollback_transaction(&manifest_path) {
        blockers.push(error.into());
    }
    let known_user_roots = known_user_roots
        .iter()
        .filter_map(|root| std::fs::canonicalize(root).ok())
        .collect::<std::collections::BTreeSet<_>>();
    for recovery in manifest
        .recoveries
        .iter()
        .filter(|operation| operation.result == migration::OperationResult::Quarantined)
    {
        if !known_user_roots.contains(&recovery.original_parent) {
            blockers.push(RecoveryBlocker {
                code: "unknown_recovery_root".into(),
                message: "迁移事务引用了当前 Agent registry 之外的用户入口。".into(),
                path: Some(recovery.original_path.clone()),
                recovery: "保留现场并人工检查事务清单；Habitat 不会恢复到未知目录。".into(),
            });
        }
    }
    let sources = manifest
        .imports
        .iter()
        .filter(|operation| operation.result == migration::OperationResult::Imported)
        .map(|operation| operation.final_path.clone())
        .collect::<Vec<_>>();
    let registered = list_managed_projects(&manifest.store_root)?;
    let historical = discover_historical_project_roots(&manifest.store_root, &sources)?;
    let mut candidates =
        BTreeMap::<PathBuf, (Option<String>, migration::FileIdentity, BTreeSet<String>)>::new();
    for project in registered {
        candidates.insert(
            project.project_root,
            (
                Some(project.project_id),
                project.project_identity,
                BTreeSet::from(["registry".into()]),
            ),
        );
    }
    for project in historical {
        match candidates.get_mut(&project.project_root) {
            Some((_, expected, provenance)) if expected == &project.project_identity => {
                provenance.insert("project_transaction".into());
            }
            Some(_) => blockers.push(RecoveryBlocker {
                code: "project_history_identity_conflict".into(),
                message: "项目注册表与历史事务对同一路径记录了不同身份。".into(),
                path: Some(project.project_root),
                recovery: "保留现场并人工检查项目注册表和历史事务。".into(),
            }),
            None => {
                candidates.insert(
                    project.project_root,
                    (
                        None,
                        project.project_identity,
                        BTreeSet::from(["project_transaction".into()]),
                    ),
                );
            }
        }
    }
    let mut projects = Vec::new();
    let mut project_links = Vec::new();
    for (project_root, (project_id, expected_identity, provenance)) in candidates {
        let actual = std::fs::symlink_metadata(&project_root);
        let audit = match actual {
            Err(error) => RecoveryProjectAudit {
                project_id,
                project_root: project_root.clone(),
                provenance: provenance.into_iter().collect(),
                state: "unknown".into(),
                related_links: Vec::new(),
                blocker: Some(RecoveryBlocker {
                    code: "managed_project_unavailable".into(),
                    message: format!("无法检查项目：{error}"),
                    path: Some(project_root),
                    recovery: "重新连接磁盘或修复权限后重新检查；不能通过移除项目记录绕过。".into(),
                }),
            },
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                RecoveryProjectAudit {
                    project_id,
                    project_root: project_root.clone(),
                    provenance: provenance.into_iter().collect(),
                    state: "unknown".into(),
                    related_links: Vec::new(),
                    blocker: Some(RecoveryBlocker {
                        code: "managed_project_replaced".into(),
                        message: "受管项目路径已不是真实目录。".into(),
                        path: Some(project_root),
                        recovery: "恢复原项目路径后重新检查；Habitat 不会自动绑定到新目录。".into(),
                    }),
                }
            }
            Ok(metadata) => {
                let canonical = std::fs::canonicalize(&project_root).ok();
                let actual_identity = migration::FileIdentity {
                    device: metadata.dev(),
                    inode: metadata.ino(),
                    mode: metadata.mode(),
                };
                if canonical.as_ref() != Some(&project_root) || actual_identity != expected_identity
                {
                    RecoveryProjectAudit {
                        project_id,
                        project_root: project_root.clone(),
                        provenance: provenance.into_iter().collect(),
                        state: "replaced".into(),
                        related_links: Vec::new(),
                        blocker: Some(RecoveryBlocker {
                            code: "managed_project_identity_drift".into(),
                            message: "受管项目在记录后已被替换或改道。".into(),
                            path: Some(project_root),
                            recovery: "通过独立的项目迁移流程确认新位置后再重新检查。".into(),
                        }),
                    }
                } else {
                    match find_managed_links_to_sources(
                        &manifest.store_root,
                        std::slice::from_ref(&project_root),
                        &sources,
                    ) {
                        Ok(links) => {
                            project_links.extend(links.iter().cloned());
                            let blocker = (!links.is_empty()).then(|| RecoveryBlocker {
                                code: "managed_project_link_active".into(),
                                message: "受管项目仍有入口指向本次迁移的 Skill Store 内容。".into(),
                                path: links.first().cloned(),
                                recovery: "前往对应项目，使用正常项目设置流程解除链接后重新检查。"
                                    .into(),
                            });
                            RecoveryProjectAudit {
                                project_id,
                                project_root,
                                provenance: provenance.into_iter().collect(),
                                state: if blocker.is_some() {
                                    "blocked"
                                } else {
                                    "passed"
                                }
                                .into(),
                                related_links: links,
                                blocker,
                            }
                        }
                        Err(error) => RecoveryProjectAudit {
                            project_id,
                            project_root,
                            provenance: provenance.into_iter().collect(),
                            state: "unknown".into(),
                            related_links: Vec::new(),
                            blocker: Some(error.into()),
                        },
                    }
                }
            }
        };
        if let Some(blocker) = audit.blocker.clone() {
            blockers.push(blocker);
        }
        projects.push(audit);
    }
    project_links.sort();
    projects.sort_by(|a, b| a.project_root.cmp(&b.project_root));
    let coverage = RecoveryCoverage {
        expected: projects.len(),
        inspected: projects
            .iter()
            .filter(|project| project.state != "unknown")
            .count(),
        passed: projects
            .iter()
            .filter(|project| project.state == "passed")
            .count(),
        blocked: projects
            .iter()
            .filter(|project| project.state == "blocked")
            .count(),
        unknown: projects
            .iter()
            .filter(|project| matches!(project.state.as_str(), "unknown" | "replaced"))
            .count(),
    };
    let mut plan = RecoveryPlan {
        transaction_id: manifest.transaction_id,
        audit_revision: String::new(),
        store_root: manifest.store_root,
        state: manifest.state,
        created_at: manifest.created_at,
        updated_at: manifest.updated_at,
        import_count: manifest
            .imports
            .iter()
            .filter(|operation| operation.result == migration::OperationResult::Imported)
            .count(),
        recovery_count: manifest
            .recoveries
            .iter()
            .filter(|operation| operation.result == migration::OperationResult::Quarantined)
            .count(),
        project_links,
        projects,
        coverage,
        ready: blockers.is_empty(),
        blockers,
    };
    let revision_bytes = serde_json::to_vec(&(
        &plan.transaction_id,
        plan.updated_at,
        plan.import_count,
        plan.recovery_count,
        &plan.projects,
        &plan.blockers,
    ))
    .expect("recovery revision serializes");
    plan.audit_revision = format!("{:x}", Sha256::digest(revision_bytes));
    Ok(Some((manifest_path, plan)))
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
fn inspect_recovery_command(
    store_path: String,
    state: State<'_, RecoveryState>,
) -> Result<Option<RecoveryPlan>, MigrationError> {
    let store_root = PathBuf::from(store_path);
    let known_user_roots = known_inventory_roots()?
        .into_iter()
        .map(|root| root.path)
        .collect::<Vec<_>>();
    let prepared = prepare_recovery_plan(&store_root, &known_user_roots)?;
    let mut session = lock_recovery(&state)?;
    let Some((manifest_path, plan)) = prepared else {
        *session = None;
        return Ok(None);
    };
    *session = Some(RecoverySession {
        transaction_id: plan.transaction_id.clone(),
        audit_revision: plan.audit_revision.clone(),
        store_root: plan.store_root.clone(),
        known_user_roots,
        manifest_path,
    });
    Ok(Some(plan))
}

#[tauri::command]
fn execute_recovery_command(
    transaction_id: String,
    audit_revision: String,
    state: State<'_, RecoveryState>,
) -> Result<TransactionManifest, MigrationError> {
    let session = lock_recovery(&state)?.clone().ok_or_else(|| {
        first_run_error(
            "recovery_plan_required",
            "当前没有已检查的恢复计划。",
            "重新打开恢复页并重新检查。",
        )
    })?;
    if session.transaction_id != transaction_id || session.audit_revision != audit_revision {
        return Err(first_run_error(
            "recovery_plan_mismatch",
            "恢复计划已经变化。",
            "重新打开恢复页并重新检查。",
        ));
    }
    let (_, refreshed) = prepare_recovery_plan(&session.store_root, &session.known_user_roots)?
        .ok_or_else(|| {
            first_run_error(
                "recovery_transaction_missing",
                "迁移事务已不存在或已经恢复。",
                "重新检查 Skill Store 当前状态。",
            )
        })?;
    if refreshed.transaction_id != transaction_id {
        return Err(first_run_error(
            "recovery_plan_mismatch",
            "当前可恢复事务已经变化。",
            "重新打开恢复页并重新检查。",
        ));
    }
    if refreshed.audit_revision != audit_revision {
        return Err(first_run_error(
            "recovery_audit_changed",
            "恢复检查结果已经变化，未修改任何文件。",
            "返回全局恢复页面并重新检查全部项目。",
        ));
    }
    if !refreshed.ready {
        let first = refreshed.blockers.first();
        return Err(MigrationError::new(
            "recovery_blocked",
            "recovery",
            "整笔恢复仍有阻断项，未修改任何文件。",
            first.and_then(|blocker| blocker.path.clone()),
            Some("zero recovery blockers".into()),
            Some(refreshed.blockers.len().to_string()),
            "处理全部阻断项后重新检查恢复。",
            false,
        )
        .for_transaction(&transaction_id));
    }
    let result = rollback_transaction(&session.manifest_path)?;
    *lock_recovery(&state)? = None;
    Ok(result)
}

#[tauri::command]
fn list_managed_projects_command(
    store_path: String,
) -> Result<Vec<ManagedProjectRecord>, MigrationError> {
    list_managed_projects(PathBuf::from(store_path).as_path())
}

#[tauri::command]
fn register_managed_project_command(
    store_path: String,
    project_path: String,
    target_groups: Vec<adapters::TargetGroupId>,
) -> Result<ManagedProjectRecord, MigrationError> {
    register_managed_project(
        PathBuf::from(store_path).as_path(),
        PathBuf::from(project_path).as_path(),
        target_groups,
    )
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
        .manage(RecoveryState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_known_inventory_command,
            validate_first_run_store_command,
            plan_first_run_migration_command,
            execute_first_run_migration_command,
            rollback_first_run_migration_command,
            inspect_recovery_command,
            execute_recovery_command,
            list_managed_projects_command,
            register_managed_project_command,
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

    #[test]
    fn transaction_wide_recovery_is_blocked_until_managed_project_links_are_removed() {
        let fixture = TempDir::new().unwrap();
        let discovery = fixture.path().join("user-skills");
        let store = fixture.path().join("Skill Store");
        let project = fixture.path().join("Habitat");
        let original = discovery.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&original, "alpha");
        let roots = vec![InventoryRoot {
            root_id: "codex".into(),
            agent_id: "codex".into(),
            edition: None,
            path: discovery,
        }];
        let snapshot = scan_inventory(&roots).unwrap();
        let migration_plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();
        execute_import(&migration_plan).unwrap();
        let store_source = store.join("alpha");
        let project_plan = build_project_exposure_plan(
            &store,
            &project,
            &[ProjectSkillSelection {
                name: "alpha".into(),
                source_path: store_source.clone(),
                selected_agents: vec![AgentId::Codex],
            }],
        )
        .unwrap();
        apply_project_exposure_plan(&project_plan).unwrap();

        let known_roots = vec![roots[0].path.clone()];
        let (_, blocked) = prepare_recovery_plan(&store, &known_roots)
            .unwrap()
            .unwrap();

        assert!(!blocked.ready);
        assert_eq!(blocked.project_links.len(), 1);
        assert!(blocked
            .blockers
            .iter()
            .any(|blocker| blocker.code == "managed_project_link_active"));
        assert_eq!(blocked.projects.len(), 1);
        assert_eq!(blocked.projects[0].provenance, vec!["project_transaction"]);
        assert!(store_source.join("SKILL.md").is_file());
        assert!(fs::symlink_metadata(&original).is_err());

        fs::remove_file(&blocked.project_links[0]).unwrap();
        let offline = fixture.path().join("Habitat-offline");
        fs::rename(&project, &offline).unwrap();
        let (_, unavailable) = prepare_recovery_plan(&store, &known_roots)
            .unwrap()
            .unwrap();
        assert!(!unavailable.ready);
        assert_eq!(unavailable.coverage.unknown, 1);
        assert_eq!(unavailable.projects[0].state, "unknown");
        assert!(unavailable
            .blockers
            .iter()
            .any(|blocker| blocker.code == "managed_project_unavailable"));
        fs::rename(&offline, &project).unwrap();
        let (manifest_path, ready) = prepare_recovery_plan(&store, &known_roots)
            .unwrap()
            .unwrap();
        assert!(ready.ready);
        assert!(ready.blockers.is_empty());
        assert_ne!(blocked.audit_revision, ready.audit_revision);

        let restored = rollback_transaction(&manifest_path).unwrap();
        assert_eq!(restored.state, migration::TransactionState::RolledBack);
        assert!(original.join("SKILL.md").is_file());
        assert!(fs::symlink_metadata(store_source).is_err());
    }

    #[test]
    fn restart_recovery_rejects_manifest_original_paths_outside_known_agent_roots() {
        let fixture = TempDir::new().unwrap();
        let discovery = fixture.path().join("user-skills");
        let store = fixture.path().join("Skill Store");
        let outside = fixture.path().join("unrelated");
        let original = discovery.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&outside).unwrap();
        write_skill(&original, "alpha");
        let roots = vec![InventoryRoot {
            root_id: "codex".into(),
            agent_id: "codex".into(),
            edition: None,
            path: discovery,
        }];
        let snapshot = scan_inventory(&roots).unwrap();
        let migration_plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();
        let mut manifest = execute_import(&migration_plan).unwrap();
        let canonical_outside = fs::canonicalize(&outside).unwrap();
        manifest.recoveries[0].original_parent = canonical_outside.clone();
        manifest.recoveries[0].original_path = canonical_outside.join("alpha");
        fs::write(
            &migration_plan.manifest_path,
            serde_json::to_vec_pretty(&manifest).unwrap(),
        )
        .unwrap();

        let (_, plan) = prepare_recovery_plan(&store, std::slice::from_ref(&roots[0].path))
            .unwrap()
            .unwrap();

        assert!(!plan.ready);
        assert_eq!(plan.blockers.len(), 1);
        assert_eq!(plan.blockers[0].code, "unknown_recovery_root");
        assert!(store.join("alpha/SKILL.md").is_file());
        assert!(fs::symlink_metadata(canonical_outside.join("alpha")).is_err());
    }
}
