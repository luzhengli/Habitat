use crate::migration::{FileIdentity, MigrationError};
use pathdiff::diff_paths;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsStr;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::os::unix::fs::{symlink, MetadataExt};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub const ADAPTER_REGISTRY_VERSION: &str = "2026-08-10.1";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum AgentId {
    Codex,
    ClaudeCode,
    Pi,
    Cursor,
    Trae,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum SupportTier {
    Targeted,
    PathCompatible,
    RuntimeVerified,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum TargetGroupId {
    AgentsShared,
    Claude,
    Trae,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEvidence {
    pub version: String,
    pub surface: String,
    pub verified_behaviors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentAdapter {
    pub agent_id: AgentId,
    pub editions: Vec<String>,
    pub user_roots: Vec<String>,
    pub project_discovery_paths: Vec<String>,
    pub habitat_target_group: TargetGroupId,
    pub condition: String,
    pub precedence: String,
    pub support_tier: SupportTier,
    pub runtime_evidence: Option<RuntimeEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdapterRegistry {
    pub version: String,
    pub adapters: Vec<AgentAdapter>,
}

pub fn adapter_registry() -> AdapterRegistry {
    AdapterRegistry {
        version: ADAPTER_REGISTRY_VERSION.into(),
        adapters: vec![
            AgentAdapter {
                agent_id: AgentId::Codex,
                editions: Vec::new(),
                user_roots: vec!["~/.agents/skills".into(), "~/.codex/skills".into()],
                project_discovery_paths: vec![".agents/skills".into()],
                habitat_target_group: TargetGroupId::AgentsShared,
                condition: "从当前工作目录向项目根查找；项目入口无需额外开关。".into(),
                precedence: "更深层项目目录优先；跨作用域同名规则由命名版本 QA 解释。".into(),
                support_tier: SupportTier::RuntimeVerified,
                runtime_evidence: Some(RuntimeEvidence {
                    version: "0.139.0".into(),
                    surface: "Codex CLI".into(),
                    verified_behaviors: vec![
                        "relative-directory-symlink".into(),
                        "discover".into(),
                        "read-skill-md".into(),
                    ],
                }),
            },
            AgentAdapter {
                agent_id: AgentId::ClaudeCode,
                editions: Vec::new(),
                user_roots: vec!["~/.claude/skills".into()],
                project_discovery_paths: vec![".claude/skills".into()],
                habitat_target_group: TargetGroupId::Claude,
                condition: "项目原生 Skills 路径；不读取 .agents/skills。".into(),
                precedence: "2.1.207：同 realpath 跨用户/项目 scope 去重；同名不同 realpath 的 slash invocation 使用用户级来源。".into(),
                support_tier: SupportTier::RuntimeVerified,
                runtime_evidence: Some(RuntimeEvidence {
                    version: "2.1.207".into(),
                    surface: "Claude Code CLI with local Anthropic-protocol mock".into(),
                    verified_behaviors: vec![
                        "relative-directory-symlink".into(),
                        "discover-and-invoke".into(),
                        "cross-scope-realpath-dedupe".into(),
                        "user-scope-shadows-project-conflict".into(),
                        "unlink-and-reload".into(),
                    ],
                }),
            },
            AgentAdapter {
                agent_id: AgentId::Pi,
                editions: Vec::new(),
                user_roots: vec!["~/.agents/skills".into(), "~/.pi/agent/skills".into()],
                project_discovery_paths: vec![".agents/skills".into(), ".pi/skills".into()],
                habitat_target_group: TargetGroupId::AgentsShared,
                condition: "Habitat 使用共享 .agents/skills，不额外创建 .pi/skills。".into(),
                precedence: "按 canonical real path 去重；同名不同 realpath 的优先级需显式报告。"
                    .into(),
                support_tier: SupportTier::RuntimeVerified,
                runtime_evidence: Some(RuntimeEvidence {
                    version: "0.81.1".into(),
                    surface: "Pi CLI and local source".into(),
                    verified_behaviors: vec![
                        "relative-directory-symlink".into(),
                        "canonical-realpath-dedupe".into(),
                        "discover".into(),
                    ],
                }),
            },
            AgentAdapter {
                agent_id: AgentId::Cursor,
                editions: Vec::new(),
                user_roots: vec![
                    "~/.agents/skills".into(),
                    "~/.cursor/skills".into(),
                    "~/.claude/skills".into(),
                    "~/.codex/skills".into(),
                ],
                project_discovery_paths: vec![
                    ".agents/skills".into(),
                    ".cursor/skills".into(),
                    ".claude/skills".into(),
                    ".codex/skills".into(),
                ],
                habitat_target_group: TargetGroupId::AgentsShared,
                condition:
                    "Habitat 不创建 .cursor/skills；与 Claude 同选时 Cursor 可能看到双入口。".into(),
                precedence: "跨 .agents/.claude 的 realpath 去重与同名优先级未知。".into(),
                support_tier: SupportTier::PathCompatible,
                runtime_evidence: None,
            },
            AgentAdapter {
                agent_id: AgentId::Trae,
                editions: vec!["international".into(), "china".into()],
                user_roots: vec!["~/.trae/skills".into(), "~/.trae-cn/skills".into()],
                project_discovery_paths: vec![".trae/skills".into(), ".agents/skills".into()],
                habitat_target_group: TargetGroupId::Trae,
                condition: "Habitat 使用原生 .trae/skills，不读取或修改 .agents 开关。".into(),
                precedence: ".trae/skills 高于可选的 .agents/skills；符号链接 runtime 合同待验证。"
                    .into(),
                support_tier: SupportTier::PathCompatible,
                runtime_evidence: None,
            },
        ],
    }
}

pub fn minimum_target_groups(selected_agents: &[AgentId]) -> Vec<TargetGroupId> {
    let selected = selected_agents.iter().copied().collect::<BTreeSet<_>>();
    let mut groups = BTreeSet::new();
    if selected.contains(&AgentId::Codex)
        || selected.contains(&AgentId::Pi)
        || selected.contains(&AgentId::Cursor)
    {
        groups.insert(TargetGroupId::AgentsShared);
    }
    if selected.contains(&AgentId::ClaudeCode) {
        groups.insert(TargetGroupId::Claude);
    }
    if selected.contains(&AgentId::Trae) {
        groups.insert(TargetGroupId::Trae);
    }
    groups.into_iter().collect()
}

fn target_relative_path(group: TargetGroupId) -> &'static str {
    match group {
        TargetGroupId::AgentsShared => ".agents/skills",
        TargetGroupId::Claude => ".claude/skills",
        TargetGroupId::Trae => ".trae/skills",
    }
}

pub fn find_managed_links_to_sources(
    store_path: &Path,
    project_paths: &[PathBuf],
    source_paths: &[PathBuf],
) -> Result<Vec<PathBuf>, MigrationError> {
    let (store_root, _) = canonical_real_directory(store_path, "Skill Store")?;
    let mut sources = Vec::new();
    for source_path in source_paths {
        let (source, _) = canonical_real_directory(source_path, "Store Skill")?;
        let name = source.file_name().and_then(OsStr::to_str).ok_or_else(|| {
            MigrationError::new(
                "invalid_skill_name",
                "preflight",
                "Store Skill 名称不是有效路径段。",
                Some(source.clone()),
                Some("safe UTF-8 path segment".into()),
                None,
                "保留现场并人工检查 Skill Store。",
                false,
            )
        })?;
        if source.parent() != Some(store_root.as_path()) || !safe_name(name) {
            return Err(MigrationError::new(
                "store_boundary",
                "preflight",
                "待恢复事务引用了 Skill Store 边界外的内容。",
                Some(source),
                Some("direct canonical Store child".into()),
                Some(source_path.display().to_string()),
                "保留现场并人工检查事务清单。",
                false,
            ));
        }
        sources.push((name.to_owned(), source));
    }

    let mut links = Vec::new();
    for project_path in project_paths {
        let (project, _) = canonical_real_directory(project_path, "受管项目")?;
        if store_root == project
            || store_root.starts_with(&project)
            || project.starts_with(&store_root)
        {
            return Err(MigrationError::new(
                "unsafe_store_relationship",
                "preflight",
                "Skill Store 与受管项目不能互为祖先或后代。",
                Some(project),
                Some("disjoint canonical paths".into()),
                Some(store_root.display().to_string()),
                "重新选择 Skill Store 或项目。",
                false,
            ));
        }
        for group in [
            TargetGroupId::AgentsShared,
            TargetGroupId::Claude,
            TargetGroupId::Trae,
        ] {
            let container = project.join(target_relative_path(group));
            inspect_container_chain(&project, &container)?;
            for (name, source) in &sources {
                let target = container.join(name);
                let metadata = match fs::symlink_metadata(&target) {
                    Ok(metadata) => metadata,
                    Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                    Err(error) => {
                        return Err(MigrationError::io(
                            "target_inspection_failed",
                            "preflight",
                            "无法检查受管项目 Skill 入口。",
                            &target,
                            error,
                            "检查项目权限后重试。",
                            true,
                        ))
                    }
                };
                if !metadata.file_type().is_symlink() {
                    continue;
                }
                let raw = fs::read_link(&target).map_err(|error| {
                    MigrationError::io(
                        "target_inspection_failed",
                        "preflight",
                        "无法读取受管项目 Skill 链接。",
                        &target,
                        error,
                        "检查项目权限后重试。",
                        true,
                    )
                })?;
                let resolved = match fs::canonicalize(target_absolute(&target, &raw)) {
                    Ok(resolved) => resolved,
                    Err(_) => continue,
                };
                if &resolved == source {
                    links.push(target);
                }
            }
        }
    }
    links.sort();
    links.dedup();
    Ok(links)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn identity(metadata: &fs::Metadata) -> FileIdentity {
    FileIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
        mode: metadata.mode(),
    }
}

fn safe_name(name: &str) -> bool {
    !name.is_empty()
        && name != "."
        && name != ".."
        && Path::new(name).components().count() == 1
        && Path::new(name).file_name() == Some(OsStr::new(name))
}

fn canonical_real_directory(
    path: &Path,
    label: &str,
) -> Result<(PathBuf, FileIdentity), MigrationError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        MigrationError::io(
            "path_unavailable",
            "preflight",
            format!("无法检查{label}。"),
            path,
            error,
            "确认目录存在且可读取后重试。",
            true,
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(MigrationError::new(
            "unsafe_directory",
            "preflight",
            format!("{label}必须是真实目录。"),
            Some(path.to_path_buf()),
            Some("real directory".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "选择真实目录后重试。",
            false,
        ));
    }
    let canonical = fs::canonicalize(path).map_err(|error| {
        MigrationError::io(
            "path_unavailable",
            "preflight",
            format!("无法规范化{label}。"),
            path,
            error,
            "确认目录存在且可读取后重试。",
            true,
        )
    })?;
    Ok((canonical, identity(&metadata)))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSkillSelection {
    pub name: String,
    pub source_path: PathBuf,
    pub selected_agents: Vec<AgentId>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum ProjectAction {
    Create,
    Remove,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectOperationResult {
    Pending,
    Created,
    Removed,
    RolledBack,
    Drifted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOperation {
    pub skill_name: String,
    pub target_group: TargetGroupId,
    pub action: ProjectAction,
    pub source_path: PathBuf,
    pub source_identity: FileIdentity,
    pub target_path: PathBuf,
    pub relative_link: PathBuf,
    pub expected_target_identity: Option<FileIdentity>,
    pub expected_link_text: Option<PathBuf>,
    pub result: ProjectOperationResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectExposurePlan {
    pub transaction_id: String,
    pub registry_version: String,
    pub store_root: PathBuf,
    pub store_identity: FileIdentity,
    pub project_root: PathBuf,
    pub project_identity: FileIdentity,
    pub manifest_path: PathBuf,
    pub operations: Vec<ProjectOperation>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectTransactionState {
    Confirmed,
    Applying,
    Completed,
    RollingBack,
    RolledBack,
    RollbackPartial,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTransactionManifest {
    pub schema_version: u32,
    pub transaction_id: String,
    pub registry_version: String,
    pub store_root: PathBuf,
    pub store_identity: FileIdentity,
    pub project_root: PathBuf,
    pub project_identity: FileIdentity,
    pub state: ProjectTransactionState,
    pub operations: Vec<ProjectOperation>,
    pub created_containers: Vec<PathBuf>,
    pub created_at: u64,
    pub updated_at: u64,
}

fn target_absolute(link_path: &Path, raw_target: &Path) -> PathBuf {
    let base = link_path.parent().unwrap_or(Path::new("/"));
    if raw_target.is_absolute() {
        raw_target.to_path_buf()
    } else {
        base.join(raw_target)
    }
}

fn inspect_link(
    path: &Path,
    source: &Path,
) -> Result<Option<(FileIdentity, PathBuf)>, MigrationError> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(MigrationError::io(
            "target_inspection_failed",
            "preflight",
            "无法检查项目 Skill 目标。",
            path,
            error,
            "检查项目权限后重试。",
            true,
        )),
        Ok(metadata) if !metadata.file_type().is_symlink() => Err(MigrationError::new(
            "project_target_conflict",
            "preflight",
            "项目 Skill 目标已存在且不是符号链接。",
            Some(path.to_path_buf()),
            Some("absent or link to selected Store skill".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "移走冲突内容后重新检查；Habitat 不会覆盖。",
            false,
        )),
        Ok(metadata) => {
            let raw = fs::read_link(path).map_err(|error| {
                MigrationError::io(
                    "target_inspection_failed",
                    "preflight",
                    "无法读取项目 Skill 链接。",
                    path,
                    error,
                    "检查项目权限后重试。",
                    true,
                )
            })?;
            let resolved = fs::canonicalize(target_absolute(path, &raw)).map_err(|error| {
                MigrationError::io(
                    "project_target_conflict",
                    "preflight",
                    "项目 Skill 链接已失效或目标不可读。",
                    path,
                    error,
                    "人工处理该链接后重新检查；Habitat 不会覆盖。",
                    false,
                )
            })?;
            if resolved != source {
                return Err(MigrationError::new(
                    "project_target_conflict",
                    "preflight",
                    "项目 Skill 链接指向其他内容。",
                    Some(path.to_path_buf()),
                    Some(source.display().to_string()),
                    Some(resolved.display().to_string()),
                    "人工确认并处理该链接；Habitat 不会覆盖。",
                    false,
                ));
            }
            Ok(Some((identity(&metadata), raw)))
        }
    }
}

fn inspect_container_chain(project: &Path, container: &Path) -> Result<(), MigrationError> {
    let relative = container.strip_prefix(project).map_err(|_| {
        MigrationError::new(
            "project_boundary",
            "preflight",
            "项目 adapter 容器越过项目边界。",
            Some(container.to_path_buf()),
            Some(project.display().to_string()),
            Some(container.display().to_string()),
            "重新选择项目。",
            false,
        )
    })?;
    let mut current = project.to_path_buf();
    for component in relative.components() {
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                return Err(MigrationError::new(
                    "unsafe_project_layout",
                    "preflight",
                    "项目 adapter 容器必须是真实目录。",
                    Some(current),
                    Some("real directory or absent".into()),
                    Some(format!("mode {:o}", metadata.mode())),
                    "移走冲突内容后重新检查。",
                    false,
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => break,
            Err(error) => {
                return Err(MigrationError::io(
                    "target_inspection_failed",
                    "preflight",
                    "无法检查项目 adapter 容器。",
                    &current,
                    error,
                    "检查项目权限后重试。",
                    true,
                ))
            }
        }
    }
    Ok(())
}

pub fn build_project_exposure_plan(
    store_path: &Path,
    project_path: &Path,
    selections: &[ProjectSkillSelection],
) -> Result<ProjectExposurePlan, MigrationError> {
    let (store_root, store_identity) = canonical_real_directory(store_path, "Skill Store")?;
    let (project_root, project_identity) = canonical_real_directory(project_path, "项目")?;
    if store_root == project_root
        || store_root.starts_with(&project_root)
        || project_root.starts_with(&store_root)
    {
        return Err(MigrationError::new(
            "unsafe_store_relationship",
            "preflight",
            "Skill Store 与项目不能互为祖先或后代。",
            Some(store_root),
            Some("disjoint canonical paths".into()),
            Some(project_root.display().to_string()),
            "重新选择 Skill Store 或项目。",
            false,
        ));
    }
    let transaction_id = Uuid::new_v4().to_string();
    let manifest_path = store_root
        .join(".habitat/transactions")
        .join(format!("{transaction_id}.project.json"));
    let mut operations = Vec::new();
    let all_groups = [
        TargetGroupId::AgentsShared,
        TargetGroupId::Claude,
        TargetGroupId::Trae,
    ];
    let mut seen_names = BTreeSet::new();
    for selection in selections {
        if !safe_name(&selection.name) {
            return Err(MigrationError::new(
                "invalid_skill_name",
                "preflight",
                "Skill 名称不是安全的单一路径段。",
                Some(selection.source_path.clone()),
                Some("safe path segment".into()),
                Some(selection.name.clone()),
                "修正 Skill name 后重新扫描。",
                false,
            ));
        }
        if !seen_names.insert(selection.name.clone()) {
            return Err(MigrationError::new(
                "duplicate_project_selection",
                "preflight",
                "同一个 Skill 在项目方案中出现了多次。",
                Some(selection.source_path.clone()),
                Some("one selection per skill".into()),
                Some(selection.name.clone()),
                "合并该 Skill 的 Agent 选择后重新检查。",
                false,
            ));
        }
        let (source, source_identity) =
            canonical_real_directory(&selection.source_path, "Store Skill")?;
        if source.parent() != Some(store_root.as_path())
            || source.file_name() != Some(OsStr::new(&selection.name))
        {
            return Err(MigrationError::new(
                "store_boundary",
                "preflight",
                "所选 Skill 不是 Skill Store 的直接 canonical 条目。",
                Some(source),
                Some(store_root.join(&selection.name).display().to_string()),
                Some(selection.source_path.display().to_string()),
                "从当前 Skill Store 重新选择。",
                false,
            ));
        }
        let desired = minimum_target_groups(&selection.selected_agents)
            .into_iter()
            .collect::<BTreeSet<_>>();
        for group in all_groups {
            let container = project_root.join(target_relative_path(group));
            if let Err(error) = inspect_container_chain(&project_root, &container) {
                if desired.contains(&group) {
                    return Err(error);
                }
                continue;
            }
            let target = container.join(&selection.name);
            let existing = match inspect_link(&target, &source) {
                Ok(existing) => existing,
                Err(error)
                    if !desired.contains(&group) && error.code == "project_target_conflict" =>
                {
                    None
                }
                Err(error) => return Err(error),
            };
            let action = match (desired.contains(&group), &existing) {
                (true, None) => Some(ProjectAction::Create),
                (true, Some(_)) | (false, None) => None,
                (false, Some(_)) => Some(ProjectAction::Remove),
            };
            let Some(action) = action else {
                continue;
            };
            let relative_link = diff_paths(&source, &container).ok_or_else(|| {
                MigrationError::new(
                    "relative_link_unavailable",
                    "preflight",
                    "无法计算项目到 Skill Store 的相对链接。",
                    Some(target.clone()),
                    Some(source.display().to_string()),
                    None,
                    "将项目和 Skill Store 放在同一可寻址卷后重试。",
                    false,
                )
            })?;
            operations.push(ProjectOperation {
                skill_name: selection.name.clone(),
                target_group: group,
                action,
                source_path: source.clone(),
                source_identity: source_identity.clone(),
                target_path: target,
                relative_link,
                expected_target_identity: existing.as_ref().map(|(identity, _)| identity.clone()),
                expected_link_text: existing.map(|(_, raw)| raw),
                result: ProjectOperationResult::Pending,
            });
        }
    }
    operations.sort_by_key(|operation| {
        (
            operation.skill_name.clone(),
            operation.target_group,
            operation.action,
        )
    });
    Ok(ProjectExposurePlan {
        transaction_id,
        registry_version: ADAPTER_REGISTRY_VERSION.into(),
        store_root,
        store_identity,
        project_root,
        project_identity,
        manifest_path,
        operations,
    })
}

fn verify_root(
    path: &Path,
    expected: &FileIdentity,
    label: &str,
    transaction_id: &str,
) -> Result<(), MigrationError> {
    let (canonical, actual) = canonical_real_directory(path, label)
        .map_err(|error| error.for_transaction(transaction_id))?;
    if canonical != path || &actual != expected {
        return Err(MigrationError::new(
            "root_drift",
            "preflight",
            format!("{label}在确认后已被替换或改道。"),
            Some(path.to_path_buf()),
            Some(format!("{} {expected:?}", path.display())),
            Some(format!("{} {actual:?}", canonical.display())),
            "重新检查项目并创建新的方案。",
            false,
        )
        .for_transaction(transaction_id));
    }
    Ok(())
}

fn preflight_operation(
    operation: &ProjectOperation,
    transaction_id: &str,
) -> Result<(), MigrationError> {
    let (source, source_identity) = canonical_real_directory(&operation.source_path, "Store Skill")
        .map_err(|error| error.for_transaction(transaction_id))?;
    if source != operation.source_path || source_identity != operation.source_identity {
        return Err(MigrationError::new(
            "source_drift",
            "preflight",
            "Store Skill 在确认后已变化。",
            Some(operation.source_path.clone()),
            Some(format!("{:?}", operation.source_identity)),
            Some(format!("{source_identity:?}")),
            "重新扫描项目并创建新的方案。",
            false,
        )
        .for_transaction(transaction_id));
    }
    let existing = inspect_link(&operation.target_path, &operation.source_path)
        .map_err(|error| error.for_transaction(transaction_id))?;
    match operation.action {
        ProjectAction::Create if existing.is_none() => Ok(()),
        ProjectAction::Remove => {
            let Some((actual_identity, actual_link)) = existing else {
                return Err(MigrationError::new(
                    "target_drift",
                    "preflight",
                    "待移除项目链接已缺失。",
                    Some(operation.target_path.clone()),
                    Some("captured symlink".into()),
                    Some("absent".into()),
                    "重新检查项目并创建新的方案。",
                    false,
                )
                .for_transaction(transaction_id));
            };
            if Some(&actual_identity) != operation.expected_target_identity.as_ref()
                || Some(&actual_link) != operation.expected_link_text.as_ref()
            {
                return Err(MigrationError::new(
                    "target_drift",
                    "preflight",
                    "待移除项目链接已变化。",
                    Some(operation.target_path.clone()),
                    operation
                        .expected_link_text
                        .as_ref()
                        .map(|path| path.display().to_string()),
                    Some(actual_link.display().to_string()),
                    "重新检查项目并创建新的方案。",
                    false,
                )
                .for_transaction(transaction_id));
            }
            Ok(())
        }
        ProjectAction::Create => Err(MigrationError::new(
            "target_drift",
            "preflight",
            "待创建项目链接位置已被占用。",
            Some(operation.target_path.clone()),
            Some("absent".into()),
            Some("symlink".into()),
            "重新检查项目并创建新的方案。",
            false,
        )
        .for_transaction(transaction_id)),
    }
}

fn ensure_container(
    project: &Path,
    container: &Path,
    created_containers: &mut Vec<PathBuf>,
) -> Result<(), MigrationError> {
    inspect_container_chain(project, container)?;
    let relative = container
        .strip_prefix(project)
        .expect("preflight checks boundary");
    let mut current = project.to_path_buf();
    for component in relative.components() {
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                fs::create_dir(&current).map_err(|error| {
                    MigrationError::io(
                        "container_create_failed",
                        "link",
                        "无法创建项目 adapter 容器。",
                        &current,
                        error,
                        "停止应用并检查事务报告。",
                        false,
                    )
                })?;
                if !created_containers.contains(&current) {
                    created_containers.push(current.clone());
                }
            }
            Err(error) => {
                return Err(MigrationError::io(
                    "target_inspection_failed",
                    "link",
                    "无法检查项目 adapter 容器。",
                    &current,
                    error,
                    "停止应用并检查事务报告。",
                    false,
                ))
            }
        }
    }
    Ok(())
}

fn write_manifest(
    path: &Path,
    manifest: &ProjectTransactionManifest,
) -> Result<(), MigrationError> {
    let parent = path.parent().expect("manifest path has parent");
    let store = &manifest.store_root;
    let relative = parent.strip_prefix(store).map_err(|_| {
        MigrationError::new(
            "store_boundary",
            "verify",
            "项目事务清单越过 Skill Store。",
            Some(path.to_path_buf()),
            Some(store.display().to_string()),
            Some(path.display().to_string()),
            "停止操作并检查 Skill Store。",
            false,
        )
    })?;
    let mut current = store.to_path_buf();
    for component in relative.components() {
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                return Err(MigrationError::new(
                    "unsafe_store_layout",
                    "verify",
                    "项目事务容器必须是真实目录。",
                    Some(current),
                    Some("real directory".into()),
                    Some(format!("mode {:o}", metadata.mode())),
                    "移走冲突内容后重新应用。",
                    false,
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                fs::create_dir(&current).map_err(|error| {
                    MigrationError::io(
                        "manifest_write_failed",
                        "verify",
                        "无法创建项目事务容器。",
                        &current,
                        error,
                        "检查 Skill Store 权限后重试。",
                        true,
                    )
                })?;
            }
            Err(error) => {
                return Err(MigrationError::io(
                    "manifest_write_failed",
                    "verify",
                    "无法检查项目事务容器。",
                    &current,
                    error,
                    "检查 Skill Store 权限后重试。",
                    true,
                ))
            }
        }
    }
    let temporary = path.with_extension("project.json.tmp");
    match fs::symlink_metadata(&temporary) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(MigrationError::io(
                "manifest_write_failed",
                "verify",
                "无法检查项目事务临时文件。",
                &temporary,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            ))
        }
        Ok(_) => {
            return Err(MigrationError::new(
                "manifest_temp_conflict",
                "verify",
                "项目事务临时文件已存在。",
                Some(temporary),
                Some("absent".into()),
                Some("existing entry".into()),
                "保留现场并检查上一事务。",
                false,
            ))
        }
    }
    let encoded = serde_json::to_vec_pretty(manifest).map_err(|error| {
        MigrationError::new(
            "manifest_encoding_failed",
            "verify",
            "无法编码项目事务清单。",
            Some(path.to_path_buf()),
            None,
            Some(error.to_string()),
            "保留现场并重试。",
            true,
        )
    })?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| {
            MigrationError::io(
                "manifest_write_failed",
                "verify",
                "无法创建项目事务临时文件。",
                &temporary,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            )
        })?;
    file.write_all(&encoded).map_err(|error| {
        MigrationError::io(
            "manifest_write_failed",
            "verify",
            "无法写入项目事务清单。",
            &temporary,
            error,
            "保留现场并重试。",
            true,
        )
    })?;
    file.sync_all().map_err(|error| {
        MigrationError::io(
            "manifest_write_failed",
            "verify",
            "无法同步项目事务清单。",
            &temporary,
            error,
            "保留现场并重试。",
            true,
        )
    })?;
    fs::rename(&temporary, path).map_err(|error| {
        MigrationError::io(
            "manifest_write_failed",
            "verify",
            "无法提交项目事务清单。",
            path,
            error,
            "保留现场并重试。",
            true,
        )
    })
}

fn persist(
    path: &Path,
    manifest: &mut ProjectTransactionManifest,
    state: ProjectTransactionState,
) -> Result<(), MigrationError> {
    manifest.state = state;
    manifest.updated_at = now_millis();
    write_manifest(path, manifest).map_err(|error| error.for_transaction(&manifest.transaction_id))
}

fn rollback_manifest(
    manifest_path: &Path,
    manifest: &mut ProjectTransactionManifest,
) -> Result<(), MigrationError> {
    let transaction_id = manifest.transaction_id.clone();
    persist(
        manifest_path,
        manifest,
        ProjectTransactionState::RollingBack,
    )?;
    let mut drifted = false;
    for index in (0..manifest.operations.len()).rev() {
        let operation = &manifest.operations[index];
        if inspect_container_chain(
            &manifest.project_root,
            operation.target_path.parent().expect("target parent"),
        )
        .is_err()
        {
            if matches!(
                operation.result,
                ProjectOperationResult::Created | ProjectOperationResult::Removed
            ) {
                manifest.operations[index].result = ProjectOperationResult::Drifted;
                drifted = true;
            }
            continue;
        }
        match operation.result {
            ProjectOperationResult::Created => {
                let current = inspect_link(&operation.target_path, &operation.source_path);
                match current {
                    Ok(Some((_identity, raw))) if raw == operation.relative_link => {
                        fs::remove_file(&operation.target_path).map_err(|error| {
                            MigrationError::io(
                                "project_rollback_failed",
                                "rollback",
                                "无法移除本事务创建的项目链接。",
                                &operation.target_path,
                                error,
                                "保留现场并检查事务清单。",
                                false,
                            )
                            .for_transaction(&transaction_id)
                        })?;
                        manifest.operations[index].result = ProjectOperationResult::RolledBack;
                    }
                    _ => {
                        manifest.operations[index].result = ProjectOperationResult::Drifted;
                        drifted = true;
                    }
                }
            }
            ProjectOperationResult::Removed => match fs::symlink_metadata(&operation.target_path) {
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    if let Some(raw) = &operation.expected_link_text {
                        symlink(raw, &operation.target_path).map_err(|error| {
                            MigrationError::io(
                                "project_rollback_failed",
                                "rollback",
                                "无法恢复本事务移除的项目链接。",
                                &operation.target_path,
                                error,
                                "保留现场并检查事务清单。",
                                false,
                            )
                            .for_transaction(&transaction_id)
                        })?;
                        manifest.operations[index].result = ProjectOperationResult::RolledBack;
                    }
                }
                Ok(_) | Err(_) => {
                    manifest.operations[index].result = ProjectOperationResult::Drifted;
                    drifted = true;
                }
            },
            _ => {}
        }
        persist(
            manifest_path,
            manifest,
            ProjectTransactionState::RollingBack,
        )?;
    }
    for container in manifest.created_containers.iter().rev() {
        match fs::remove_dir(container) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) if error.kind() == io::ErrorKind::DirectoryNotEmpty => {}
            Err(error) => {
                return Err(MigrationError::io(
                    "project_rollback_failed",
                    "rollback",
                    "无法清理本事务创建的空容器。",
                    container,
                    error,
                    "保留现场并检查事务清单。",
                    false,
                )
                .for_transaction(&transaction_id))
            }
        }
    }
    let state = if drifted {
        ProjectTransactionState::RollbackPartial
    } else {
        ProjectTransactionState::RolledBack
    };
    persist(manifest_path, manifest, state)
}

fn apply_project_plan_internal(
    plan: &ProjectExposurePlan,
    fail_after: Option<usize>,
) -> Result<ProjectTransactionManifest, MigrationError> {
    verify_root(
        &plan.store_root,
        &plan.store_identity,
        "Skill Store",
        &plan.transaction_id,
    )?;
    verify_root(
        &plan.project_root,
        &plan.project_identity,
        "项目",
        &plan.transaction_id,
    )?;
    for operation in &plan.operations {
        inspect_container_chain(
            &plan.project_root,
            operation.target_path.parent().expect("target parent"),
        )?;
        preflight_operation(operation, &plan.transaction_id)?;
    }
    let timestamp = now_millis();
    let mut manifest = ProjectTransactionManifest {
        schema_version: 1,
        transaction_id: plan.transaction_id.clone(),
        registry_version: plan.registry_version.clone(),
        store_root: plan.store_root.clone(),
        store_identity: plan.store_identity.clone(),
        project_root: plan.project_root.clone(),
        project_identity: plan.project_identity.clone(),
        state: ProjectTransactionState::Confirmed,
        operations: plan.operations.clone(),
        created_containers: Vec::new(),
        created_at: timestamp,
        updated_at: timestamp,
    };
    write_manifest(&plan.manifest_path, &manifest)
        .map_err(|error| error.for_transaction(&plan.transaction_id))?;
    persist(
        &plan.manifest_path,
        &mut manifest,
        ProjectTransactionState::Applying,
    )?;

    let apply_result = (|| {
        for index in 0..manifest.operations.len() {
            if fail_after == Some(index) {
                return Err(MigrationError::new(
                    "simulated_project_failure",
                    "link",
                    "测试注入的项目事务失败。",
                    None,
                    None,
                    None,
                    "检查事务清单中的回滚结果。",
                    false,
                )
                .for_transaction(&plan.transaction_id));
            }
            let operation = &manifest.operations[index];
            inspect_container_chain(
                &manifest.project_root,
                operation.target_path.parent().expect("target parent"),
            )?;
            preflight_operation(operation, &plan.transaction_id)?;
            let result = match operation.action {
                ProjectAction::Create => {
                    ensure_container(
                        &manifest.project_root,
                        operation.target_path.parent().expect("target parent"),
                        &mut manifest.created_containers,
                    )?;
                    symlink(&operation.relative_link, &operation.target_path).map_err(|error| {
                        MigrationError::io(
                            "project_link_failed",
                            "link",
                            "无法创建项目 Skill 相对链接。",
                            &operation.target_path,
                            error,
                            "检查事务清单中的自动回滚结果。",
                            false,
                        )
                        .for_transaction(&plan.transaction_id)
                    })?;
                    ProjectOperationResult::Created
                }
                ProjectAction::Remove => {
                    fs::remove_file(&operation.target_path).map_err(|error| {
                        MigrationError::io(
                            "project_unlink_failed",
                            "link",
                            "无法移除已确认的项目 Skill 链接。",
                            &operation.target_path,
                            error,
                            "检查事务清单中的自动回滚结果。",
                            false,
                        )
                        .for_transaction(&plan.transaction_id)
                    })?;
                    ProjectOperationResult::Removed
                }
            };
            manifest.operations[index].result = result;
            persist(
                &plan.manifest_path,
                &mut manifest,
                ProjectTransactionState::Applying,
            )?;
        }
        persist(
            &plan.manifest_path,
            &mut manifest,
            ProjectTransactionState::Completed,
        )?;
        Ok(())
    })();

    match apply_result {
        Ok(()) => Ok(manifest),
        Err(error) => {
            if let Err(rollback_error) = rollback_manifest(&plan.manifest_path, &mut manifest) {
                return Err(MigrationError::new(
                    "project_apply_and_rollback_failed",
                    "rollback",
                    "项目更改失败，自动回滚也未能完整完成。",
                    rollback_error.path.clone(),
                    Some(error.to_string()),
                    Some(rollback_error.to_string()),
                    "保留现场并按事务清单逐项检查；不要覆盖未知条目。",
                    false,
                )
                .for_transaction(&plan.transaction_id));
            }
            Err(error)
        }
    }
}

pub fn apply_project_exposure_plan(
    plan: &ProjectExposurePlan,
) -> Result<ProjectTransactionManifest, MigrationError> {
    apply_project_plan_internal(plan, None)
}

pub fn rollback_project_transaction(
    manifest_path: &Path,
) -> Result<ProjectTransactionManifest, MigrationError> {
    let contents = fs::read(manifest_path).map_err(|error| {
        MigrationError::io(
            "manifest_unreadable",
            "rollback",
            "无法读取项目事务清单。",
            manifest_path,
            error,
            "选择有效的项目事务清单。",
            false,
        )
    })?;
    let mut manifest: ProjectTransactionManifest =
        serde_json::from_slice(&contents).map_err(|error| {
            MigrationError::new(
                "manifest_invalid",
                "rollback",
                "项目事务清单格式无效。",
                Some(manifest_path.to_path_buf()),
                Some("ProjectTransactionManifest v1".into()),
                Some(error.to_string()),
                "保留现场并人工检查事务清单。",
                false,
            )
        })?;
    verify_root(
        &manifest.store_root,
        &manifest.store_identity,
        "Skill Store",
        &manifest.transaction_id,
    )?;
    verify_root(
        &manifest.project_root,
        &manifest.project_identity,
        "项目",
        &manifest.transaction_id,
    )?;
    rollback_manifest(manifest_path, &mut manifest)?;
    Ok(manifest)
}

pub fn effective_target_summary(
    selections: &[ProjectSkillSelection],
) -> BTreeMap<String, Vec<TargetGroupId>> {
    selections
        .iter()
        .map(|selection| {
            (
                selection.name.clone(),
                minimum_target_groups(&selection.selected_agents),
            )
        })
        .collect()
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RouteCondition {
    Active,
    SettingControlled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExposureScope {
    User,
    Project,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ObservedRouteState {
    Absent,
    Matching,
    Conflicting,
    Broken,
    Unsafe,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RouteObservation {
    pub scope: ExposureScope,
    pub relative_root: String,
    pub entry_path: PathBuf,
    pub condition: RouteCondition,
    pub state: ObservedRouteState,
    pub canonical_target: Option<PathBuf>,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EffectiveExposureState {
    Unavailable,
    Available,
    Duplicate,
    Shadowed,
    Conflict,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserExposureRoute {
    pub agent_id: AgentId,
    pub entry_path: PathBuf,
    pub state: ObservedRouteState,
    pub canonical_target: Option<PathBuf>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentExposureInspection {
    pub agent_id: AgentId,
    pub targeted: bool,
    pub expected_target: PathBuf,
    pub expected_satisfied: bool,
    pub effective_state: EffectiveExposureState,
    pub support_tier: SupportTier,
    pub runtime_verified: bool,
    pub routes: Vec<RouteObservation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectExposureInspection {
    pub registry_version: String,
    pub project_root: PathBuf,
    pub skill_name: String,
    pub source_path: PathBuf,
    pub agents: Vec<AgentExposureInspection>,
}

fn route_condition(agent: AgentId, relative_root: &str) -> RouteCondition {
    if agent == AgentId::Trae && relative_root == ".agents/skills" {
        RouteCondition::SettingControlled
    } else {
        RouteCondition::Active
    }
}

fn observe_route(
    project: &Path,
    source: &Path,
    skill_name: &str,
    relative_root: &str,
    condition: RouteCondition,
) -> RouteObservation {
    let container = project.join(relative_root);
    if let Err(error) = inspect_container_chain(project, &container) {
        return RouteObservation {
            scope: ExposureScope::Project,
            relative_root: relative_root.into(),
            entry_path: container.join(skill_name),
            condition,
            state: ObservedRouteState::Unsafe,
            canonical_target: None,
            detail: error.message,
        };
    }
    let entry_path = container.join(skill_name);
    let metadata = match fs::symlink_metadata(&entry_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return RouteObservation {
                scope: ExposureScope::Project,
                relative_root: relative_root.into(),
                entry_path,
                condition,
                state: ObservedRouteState::Absent,
                canonical_target: None,
                detail: "入口不存在。".into(),
            }
        }
        Err(error) => {
            return RouteObservation {
                scope: ExposureScope::Project,
                relative_root: relative_root.into(),
                entry_path,
                condition,
                state: ObservedRouteState::Unsafe,
                canonical_target: None,
                detail: error.to_string(),
            }
        }
    };
    if !metadata.file_type().is_symlink() {
        return RouteObservation {
            scope: ExposureScope::Project,
            relative_root: relative_root.into(),
            entry_path,
            condition,
            state: ObservedRouteState::Conflicting,
            canonical_target: None,
            detail: "同名入口存在，但不是 Habitat 可验证的符号链接。".into(),
        };
    }
    match fs::canonicalize(&entry_path) {
        Ok(target) if target == source => RouteObservation {
            scope: ExposureScope::Project,
            relative_root: relative_root.into(),
            entry_path,
            condition,
            state: ObservedRouteState::Matching,
            canonical_target: Some(target),
            detail: "入口指向当前 Store Skill。".into(),
        },
        Ok(target) => RouteObservation {
            scope: ExposureScope::Project,
            relative_root: relative_root.into(),
            entry_path,
            condition,
            state: ObservedRouteState::Conflicting,
            canonical_target: Some(target),
            detail: "同名入口指向其他内容。".into(),
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => RouteObservation {
            scope: ExposureScope::Project,
            relative_root: relative_root.into(),
            entry_path,
            condition,
            state: ObservedRouteState::Broken,
            canonical_target: None,
            detail: "入口是失效符号链接。".into(),
        },
        Err(error) => RouteObservation {
            scope: ExposureScope::Project,
            relative_root: relative_root.into(),
            entry_path,
            condition,
            state: ObservedRouteState::Unsafe,
            canonical_target: None,
            detail: error.to_string(),
        },
    }
}

pub fn inspect_project_exposures(
    store_path: &Path,
    project_path: &Path,
    selection: &ProjectSkillSelection,
) -> Result<ProjectExposureInspection, MigrationError> {
    inspect_project_exposures_with_user_routes(store_path, project_path, selection, &[])
}

pub fn inspect_project_exposures_with_user_routes(
    store_path: &Path,
    project_path: &Path,
    selection: &ProjectSkillSelection,
    user_routes: &[UserExposureRoute],
) -> Result<ProjectExposureInspection, MigrationError> {
    if !safe_name(&selection.name) {
        return Err(MigrationError::new(
            "invalid_skill_name",
            "discovery",
            "Skill 名称不是安全的单一路径段。",
            Some(selection.source_path.clone()),
            Some("safe path segment".into()),
            Some(selection.name.clone()),
            "修正 Skill name 后重新扫描。",
            false,
        ));
    }
    let (store, _) = canonical_real_directory(store_path, "Skill Store")?;
    let (project, _) = canonical_real_directory(project_path, "项目")?;
    let (source, _) = canonical_real_directory(&selection.source_path, "Store Skill")?;
    if source.parent() != Some(store.as_path())
        || source.file_name() != Some(OsStr::new(&selection.name))
    {
        return Err(MigrationError::new(
            "store_boundary",
            "discovery",
            "所选 Skill 不是 Skill Store 的直接 canonical 条目。",
            Some(source),
            Some(store.join(&selection.name).display().to_string()),
            Some(selection.source_path.display().to_string()),
            "从当前 Skill Store 重新选择。",
            false,
        ));
    }

    let desired_groups = minimum_target_groups(&selection.selected_agents)
        .into_iter()
        .collect::<BTreeSet<_>>();
    let registry = adapter_registry();
    let mut agents = Vec::new();
    for adapter in &registry.adapters {
        let targeted = desired_groups.contains(&adapter.habitat_target_group);
        let expected_root = target_relative_path(adapter.habitat_target_group);
        let expected_target = project.join(expected_root).join(&selection.name);
        let mut routes = adapter
            .project_discovery_paths
            .iter()
            .map(|relative_root| {
                observe_route(
                    &project,
                    &source,
                    &selection.name,
                    relative_root,
                    route_condition(adapter.agent_id, relative_root),
                )
            })
            .collect::<Vec<_>>();
        routes.extend(
            user_routes
                .iter()
                .filter(|route| route.agent_id == adapter.agent_id)
                .map(|route| RouteObservation {
                    scope: ExposureScope::User,
                    relative_root: "user".into(),
                    entry_path: route.entry_path.clone(),
                    condition: RouteCondition::Active,
                    state: route.state,
                    canonical_target: route.canonical_target.clone(),
                    detail: route.detail.clone(),
                }),
        );
        let expected_satisfied = routes.iter().any(|route| {
            route.scope == ExposureScope::Project
                && route.relative_root == expected_root
                && route.state == ObservedRouteState::Matching
        });
        let active_routes = routes
            .iter()
            .filter(|route| route.condition == RouteCondition::Active)
            .collect::<Vec<_>>();
        let active_matching = active_routes
            .iter()
            .filter(|route| route.state == ObservedRouteState::Matching)
            .count();
        let has_active_conflict = active_routes.iter().any(|route| {
            matches!(
                route.state,
                ObservedRouteState::Conflicting
                    | ObservedRouteState::Broken
                    | ObservedRouteState::Unsafe
            )
        });
        let conditional_matching = routes.iter().any(|route| {
            route.condition == RouteCondition::SettingControlled
                && route.state == ObservedRouteState::Matching
        });
        let user_conflict_shadows_project = adapter.agent_id == AgentId::ClaudeCode
            && expected_satisfied
            && routes.iter().any(|route| {
                route.scope == ExposureScope::User
                    && route.condition == RouteCondition::Active
                    && route.state == ObservedRouteState::Conflicting
            });
        let effective_state = if user_conflict_shadows_project {
            EffectiveExposureState::Shadowed
        } else if has_active_conflict {
            EffectiveExposureState::Conflict
        } else if active_matching > 1 {
            EffectiveExposureState::Duplicate
        } else if active_matching == 1 {
            EffectiveExposureState::Available
        } else if conditional_matching {
            EffectiveExposureState::Unknown
        } else {
            EffectiveExposureState::Unavailable
        };
        agents.push(AgentExposureInspection {
            agent_id: adapter.agent_id,
            targeted,
            expected_target,
            expected_satisfied,
            effective_state,
            support_tier: adapter.support_tier,
            runtime_verified: adapter.support_tier == SupportTier::RuntimeVerified,
            routes,
        });
    }
    Ok(ProjectExposureInspection {
        registry_version: registry.version,
        project_root: project,
        skill_name: selection.name.clone(),
        source_path: source,
        agents,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_skill(path: &Path, name: &str) {
        fs::create_dir_all(path).unwrap();
        fs::write(
            path.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: test\nversion: 1\n---\n"),
        )
        .unwrap();
    }

    fn selection(source: &Path, agents: Vec<AgentId>) -> ProjectSkillSelection {
        ProjectSkillSelection {
            name: "alpha".into(),
            source_path: source.to_path_buf(),
            selected_agents: agents,
        }
    }

    #[test]
    fn registry_has_five_agents_and_preserves_support_boundaries() {
        let registry = adapter_registry();
        assert_eq!(registry.version, ADAPTER_REGISTRY_VERSION);
        assert_eq!(registry.adapters.len(), 5);
        let tiers = registry
            .adapters
            .iter()
            .map(|adapter| (adapter.agent_id, adapter.support_tier))
            .collect::<BTreeMap<_, _>>();
        assert_eq!(tiers[&AgentId::Codex], SupportTier::RuntimeVerified);
        assert_eq!(tiers[&AgentId::ClaudeCode], SupportTier::RuntimeVerified);
        assert_eq!(tiers[&AgentId::Pi], SupportTier::RuntimeVerified);
        assert_eq!(tiers[&AgentId::Cursor], SupportTier::PathCompatible);
        assert_eq!(tiers[&AgentId::Trae], SupportTier::PathCompatible);
    }

    #[test]
    fn minimum_targets_couple_agents_and_leave_unselected_groups_out() {
        assert_eq!(
            minimum_target_groups(&[AgentId::Codex, AgentId::Pi, AgentId::Cursor]),
            vec![TargetGroupId::AgentsShared]
        );
        assert_eq!(
            minimum_target_groups(&[AgentId::ClaudeCode, AgentId::Trae]),
            vec![TargetGroupId::Claude, TargetGroupId::Trae]
        );
        assert_eq!(
            minimum_target_groups(&[AgentId::Trae]),
            vec![TargetGroupId::Trae]
        );
    }

    #[test]
    fn only_selected_target_is_created_as_relative_link() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        let plan = build_project_exposure_plan(
            &store,
            &project,
            &[selection(&source, vec![AgentId::Trae])],
        )
        .unwrap();
        assert_eq!(plan.operations.len(), 1);
        assert_eq!(plan.operations[0].target_group, TargetGroupId::Trae);

        let manifest = apply_project_exposure_plan(&plan).unwrap();
        assert_eq!(manifest.state, ProjectTransactionState::Completed);
        let target = project.join(".trae/skills/alpha");
        assert!(fs::symlink_metadata(&target)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(!fs::read_link(target).unwrap().is_absolute());
        assert!(fs::symlink_metadata(project.join(".agents")).is_err());
        assert!(fs::symlink_metadata(project.join(".claude")).is_err());
    }

    #[test]
    fn any_target_collision_blocks_the_entire_plan_before_mutation() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir_all(project.join(".claude/skills")).unwrap();
        write_skill(&source, "alpha");
        fs::write(project.join(".claude/skills/alpha"), "conflict").unwrap();

        let error = build_project_exposure_plan(
            &store,
            &project,
            &[selection(
                &source,
                vec![AgentId::Codex, AgentId::ClaudeCode],
            )],
        )
        .unwrap_err();
        assert_eq!(error.code, "project_target_conflict");
        assert!(fs::symlink_metadata(project.join(".agents")).is_err());
    }

    #[test]
    fn conflict_in_an_unselected_group_is_left_untouched() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir_all(project.join(".agents/skills")).unwrap();
        write_skill(&source, "alpha");
        let conflict = project.join(".agents/skills/alpha");
        fs::write(&conflict, "belongs to the user").unwrap();

        let plan = build_project_exposure_plan(
            &store,
            &project,
            &[selection(&source, vec![AgentId::Trae])],
        )
        .unwrap();
        assert_eq!(plan.operations.len(), 1);
        assert_eq!(plan.operations[0].target_group, TargetGroupId::Trae);
        apply_project_exposure_plan(&plan).unwrap();
        assert_eq!(fs::read_to_string(conflict).unwrap(), "belongs to the user");
    }

    #[test]
    fn multi_target_failure_rolls_back_only_transaction_created_links() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        let plan = build_project_exposure_plan(
            &store,
            &project,
            &[selection(
                &source,
                vec![AgentId::Codex, AgentId::ClaudeCode, AgentId::Trae],
            )],
        )
        .unwrap();

        let error = apply_project_plan_internal(&plan, Some(1)).unwrap_err();
        assert_eq!(error.code, "simulated_project_failure");
        assert!(fs::symlink_metadata(project.join(".agents/skills/alpha")).is_err());
        assert!(fs::symlink_metadata(project.join(".claude/skills/alpha")).is_err());
        assert!(fs::symlink_metadata(project.join(".trae/skills/alpha")).is_err());
    }

    #[test]
    fn rollback_reports_drift_and_does_not_remove_the_drifted_entry() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        let other = store.join("other");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        write_skill(&other, "other");
        let plan = build_project_exposure_plan(
            &store,
            &project,
            &[selection(
                &source,
                vec![AgentId::Codex, AgentId::ClaudeCode],
            )],
        )
        .unwrap();
        apply_project_exposure_plan(&plan).unwrap();
        let drifted = project.join(".agents/skills/alpha");
        fs::remove_file(&drifted).unwrap();
        symlink(&other, &drifted).unwrap();

        let manifest = rollback_project_transaction(&plan.manifest_path).unwrap();
        assert_eq!(manifest.state, ProjectTransactionState::RollbackPartial);
        assert_eq!(
            fs::canonicalize(&drifted).unwrap(),
            fs::canonicalize(&other).unwrap()
        );
        assert!(fs::symlink_metadata(project.join(".claude/skills/alpha")).is_err());
    }

    #[test]
    fn changing_desired_groups_can_remove_and_rollback_an_existing_valid_link() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir_all(project.join(".agents/skills")).unwrap();
        write_skill(&source, "alpha");
        let existing = project.join(".agents/skills/alpha");
        let relative = diff_paths(&source, existing.parent().unwrap()).unwrap();
        symlink(&relative, &existing).unwrap();
        let plan = build_project_exposure_plan(
            &store,
            &project,
            &[selection(&source, vec![AgentId::ClaudeCode])],
        )
        .unwrap();
        assert_eq!(
            plan.operations
                .iter()
                .map(|operation| operation.action)
                .collect::<BTreeSet<_>>(),
            BTreeSet::from([ProjectAction::Create, ProjectAction::Remove])
        );

        apply_project_exposure_plan(&plan).unwrap();
        assert!(fs::symlink_metadata(&existing).is_err());
        assert!(fs::symlink_metadata(project.join(".claude/skills/alpha")).is_ok());
        let manifest = rollback_project_transaction(&plan.manifest_path).unwrap();
        assert_eq!(manifest.state, ProjectTransactionState::RolledBack);
        assert!(fs::symlink_metadata(&existing).is_ok());
        assert!(fs::symlink_metadata(project.join(".claude/skills/alpha")).is_err());
    }

    #[test]
    fn recovery_scan_finds_only_managed_links_to_transaction_store_sources() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        let other = store.join("other");
        fs::create_dir(&store).unwrap();
        fs::create_dir_all(project.join(".agents/skills")).unwrap();
        fs::create_dir_all(project.join(".claude/skills")).unwrap();
        write_skill(&source, "alpha");
        write_skill(&other, "other");
        let managed = project.join(".agents/skills/alpha");
        let unrelated = project.join(".claude/skills/other");
        symlink(
            diff_paths(&source, managed.parent().unwrap()).unwrap(),
            &managed,
        )
        .unwrap();
        symlink(
            diff_paths(&other, unrelated.parent().unwrap()).unwrap(),
            &unrelated,
        )
        .unwrap();

        let links = find_managed_links_to_sources(
            &store,
            std::slice::from_ref(&project),
            std::slice::from_ref(&source),
        )
        .unwrap();

        assert_eq!(
            links,
            vec![fs::canonicalize(&project)
                .unwrap()
                .join(".agents/skills/alpha")]
        );
        assert!(fs::symlink_metadata(unrelated).is_ok());
    }

    #[test]
    fn inspection_keeps_expected_effective_and_runtime_states_distinct() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        let selected = selection(
            &source,
            vec![
                AgentId::Codex,
                AgentId::ClaudeCode,
                AgentId::Pi,
                AgentId::Cursor,
                AgentId::Trae,
            ],
        );
        let plan = build_project_exposure_plan(&store, &project, &[selected.clone()]).unwrap();
        apply_project_exposure_plan(&plan).unwrap();

        let inspection = inspect_project_exposures(&store, &project, &selected).unwrap();
        let agents = inspection
            .agents
            .iter()
            .map(|agent| (agent.agent_id, agent))
            .collect::<BTreeMap<_, _>>();
        assert_eq!(
            agents[&AgentId::Codex].effective_state,
            EffectiveExposureState::Available
        );
        assert_eq!(
            agents[&AgentId::ClaudeCode].effective_state,
            EffectiveExposureState::Available
        );
        assert_eq!(
            agents[&AgentId::Pi].effective_state,
            EffectiveExposureState::Available
        );
        assert_eq!(
            agents[&AgentId::Cursor].effective_state,
            EffectiveExposureState::Duplicate
        );
        assert_eq!(
            agents[&AgentId::Trae].effective_state,
            EffectiveExposureState::Available
        );
        assert!(agents.values().all(|agent| agent.targeted));
        assert!(agents[&AgentId::Codex].runtime_verified);
        assert!(agents[&AgentId::Pi].runtime_verified);
        assert!(agents[&AgentId::ClaudeCode].runtime_verified);
        assert!(!agents[&AgentId::Cursor].runtime_verified);
        assert!(!agents[&AgentId::Trae].runtime_verified);
    }

    #[test]
    fn trae_agents_route_is_unknown_when_its_setting_is_not_observed() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        let selected = selection(&source, vec![AgentId::Codex]);
        let plan = build_project_exposure_plan(&store, &project, &[selected.clone()]).unwrap();
        apply_project_exposure_plan(&plan).unwrap();

        let inspection = inspect_project_exposures(&store, &project, &selected).unwrap();
        let trae = inspection
            .agents
            .iter()
            .find(|agent| agent.agent_id == AgentId::Trae)
            .unwrap();
        assert!(!trae.targeted);
        assert!(!trae.expected_satisfied);
        assert_eq!(trae.effective_state, EffectiveExposureState::Unknown);
        assert!(trae.routes.iter().any(|route| {
            route.relative_root == ".agents/skills"
                && route.condition == RouteCondition::SettingControlled
                && route.state == ObservedRouteState::Matching
        }));
    }

    #[test]
    fn conflicting_secondary_cursor_route_is_reported_without_guessing_a_winner() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        let other = store.join("other");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        write_skill(&other, "other");
        let selected = selection(&source, vec![AgentId::Cursor]);
        let plan = build_project_exposure_plan(&store, &project, &[selected.clone()]).unwrap();
        apply_project_exposure_plan(&plan).unwrap();
        let cursor_root = project.join(".cursor/skills");
        fs::create_dir_all(&cursor_root).unwrap();
        symlink(&other, cursor_root.join("alpha")).unwrap();

        let inspection = inspect_project_exposures(&store, &project, &selected).unwrap();
        let cursor = inspection
            .agents
            .iter()
            .find(|agent| agent.agent_id == AgentId::Cursor)
            .unwrap();
        assert!(cursor.targeted);
        assert!(cursor.expected_satisfied);
        assert_eq!(cursor.effective_state, EffectiveExposureState::Conflict);
        assert!(!cursor.runtime_verified);
    }

    #[test]
    fn claude_user_conflict_shadows_the_expected_project_entry() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let source = store.join("alpha");
        let user_variant = fixture.path().join("user-variant");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        write_skill(&source, "alpha");
        write_skill(&user_variant, "alpha");
        fs::write(user_variant.join("variant.txt"), "different").unwrap();
        let selected = selection(&source, vec![AgentId::ClaudeCode]);
        let plan = build_project_exposure_plan(&store, &project, &[selected.clone()]).unwrap();
        apply_project_exposure_plan(&plan).unwrap();
        let user_route = UserExposureRoute {
            agent_id: AgentId::ClaudeCode,
            entry_path: fixture.path().join("claude-user/alpha"),
            state: ObservedRouteState::Conflicting,
            canonical_target: Some(fs::canonicalize(&user_variant).unwrap()),
            detail: "2.1.207 user-level route with the same command name".into(),
        };

        let inspection =
            inspect_project_exposures_with_user_routes(&store, &project, &selected, &[user_route])
                .unwrap();
        let claude = inspection
            .agents
            .iter()
            .find(|agent| agent.agent_id == AgentId::ClaudeCode)
            .unwrap();
        assert!(claude.targeted);
        assert!(claude.expected_satisfied);
        assert_eq!(claude.effective_state, EffectiveExposureState::Shadowed);
        assert!(claude.runtime_verified);
    }
}
