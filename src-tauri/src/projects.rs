use crate::adapters::{ProjectTransactionManifest, TargetGroupId};
use crate::migration::{FileIdentity, MigrationError};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const REGISTRY_SCHEMA_VERSION: u32 = 1;
const INTERNAL_DIRECTORY: &str = ".habitat";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProjectRecord {
    pub project_id: String,
    pub project_root: PathBuf,
    pub project_identity: FileIdentity,
    pub target_groups: Vec<TargetGroupId>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ManagedProjectRegistry {
    schema_version: u32,
    store_root: PathBuf,
    projects: Vec<ManagedProjectRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoricalProjectRoot {
    pub project_root: PathBuf,
    pub project_identity: FileIdentity,
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
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

fn real_directory(path: &Path, label: &str) -> Result<(PathBuf, FileIdentity), MigrationError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        MigrationError::io(
            "managed_project_unavailable",
            "project_registry",
            format!("无法读取{label}。"),
            path,
            error,
            "检查路径、磁盘连接和权限后重试。",
            true,
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(MigrationError::new(
            "unsafe_managed_project",
            "project_registry",
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
            "managed_project_unavailable",
            "project_registry",
            format!("无法解析{label}。"),
            path,
            error,
            "检查路径、磁盘连接和权限后重试。",
            true,
        )
    })?;
    Ok((canonical, identity(&metadata)))
}

fn registry_paths(store: &Path) -> (PathBuf, PathBuf, PathBuf) {
    let internal = store.join(INTERNAL_DIRECTORY);
    (
        internal.clone(),
        internal.join("projects.json"),
        internal.join("projects.json.tmp"),
    )
}

fn ensure_internal(store: &Path, internal: &Path) -> Result<(), MigrationError> {
    match fs::symlink_metadata(internal) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            Err(MigrationError::new(
                "unsafe_project_registry",
                "project_registry",
                "项目注册表容器必须是真实目录。",
                Some(internal.to_path_buf()),
                Some("real directory".into()),
                Some(format!("mode {:o}", metadata.mode())),
                "保留现场并人工检查 Skill Store。",
                false,
            ))
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => fs::create_dir(internal)
            .map_err(|error| {
                MigrationError::io(
                    "project_registry_write_failed",
                    "project_registry",
                    "无法创建项目注册表容器。",
                    internal,
                    error,
                    "检查 Skill Store 权限后重试。",
                    true,
                )
            }),
        Err(error) => Err(MigrationError::io(
            "project_registry_unreadable",
            "project_registry",
            "无法检查项目注册表容器。",
            &store.join(INTERNAL_DIRECTORY),
            error,
            "检查 Skill Store 权限后重试。",
            true,
        )),
    }
}

fn load(store_path: &Path) -> Result<(PathBuf, ManagedProjectRegistry), MigrationError> {
    let (store, _) = real_directory(store_path, "Skill Store")?;
    let (internal, path, _) = registry_paths(&store);
    match fs::symlink_metadata(&internal) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok((
                store.clone(),
                ManagedProjectRegistry {
                    schema_version: REGISTRY_SCHEMA_VERSION,
                    store_root: store,
                    projects: Vec::new(),
                },
            ))
        }
        Err(error) => {
            return Err(MigrationError::io(
                "project_registry_unreadable",
                "project_registry",
                "无法读取项目注册表容器。",
                &internal,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            ))
        }
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(MigrationError::new(
                "unsafe_project_registry",
                "project_registry",
                "项目注册表容器必须是真实目录。",
                Some(internal),
                Some("real directory".into()),
                Some(format!("mode {:o}", metadata.mode())),
                "保留现场并人工检查 Skill Store。",
                false,
            ))
        }
        Ok(_) => {}
    }
    let metadata = match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok((
                store.clone(),
                ManagedProjectRegistry {
                    schema_version: REGISTRY_SCHEMA_VERSION,
                    store_root: store,
                    projects: Vec::new(),
                },
            ))
        }
        Err(error) => {
            return Err(MigrationError::io(
                "project_registry_unreadable",
                "project_registry",
                "无法读取项目注册表。",
                &path,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            ))
        }
        Ok(metadata) => metadata,
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(MigrationError::new(
            "unsafe_project_registry",
            "project_registry",
            "项目注册表必须是真实文件。",
            Some(path),
            Some("regular file".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "保留现场并人工检查 Skill Store。",
            false,
        ));
    }
    let registry: ManagedProjectRegistry =
        serde_json::from_slice(&fs::read(&path).map_err(|error| {
            MigrationError::io(
                "project_registry_unreadable",
                "project_registry",
                "无法读取项目注册表。",
                &path,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            )
        })?)
        .map_err(|error| {
            MigrationError::new(
                "project_registry_invalid",
                "project_registry",
                "项目注册表格式无效。",
                Some(path),
                Some("ManagedProjectRegistry v1".into()),
                Some(error.to_string()),
                "保留现场并人工检查 Skill Store。",
                false,
            )
        })?;
    if registry.schema_version != REGISTRY_SCHEMA_VERSION || registry.store_root != store {
        return Err(MigrationError::new(
            "project_registry_mismatch",
            "project_registry",
            "项目注册表与当前 Skill Store 不一致。",
            Some(store.join(INTERNAL_DIRECTORY).join("projects.json")),
            Some(format!(
                "schema {REGISTRY_SCHEMA_VERSION} store {}",
                store.display()
            )),
            Some(format!(
                "schema {} store {}",
                registry.schema_version,
                registry.store_root.display()
            )),
            "保留现场并人工检查 Skill Store。",
            false,
        ));
    }
    Ok((store, registry))
}

fn write(store: &Path, registry: &ManagedProjectRegistry) -> Result<(), MigrationError> {
    let (internal, path, temporary) = registry_paths(store);
    ensure_internal(store, &internal)?;
    if fs::symlink_metadata(&temporary).is_ok() {
        return Err(MigrationError::new(
            "project_registry_temp_conflict",
            "project_registry",
            "项目注册表临时文件已存在。",
            Some(temporary),
            Some("absent".into()),
            None,
            "保留现场并人工检查 Skill Store。",
            false,
        ));
    }
    let bytes = serde_json::to_vec_pretty(registry).expect("registry serializes");
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| {
            MigrationError::io(
                "project_registry_write_failed",
                "project_registry",
                "无法创建项目注册表临时文件。",
                &temporary,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            )
        })?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| {
            MigrationError::io(
                "project_registry_write_failed",
                "project_registry",
                "无法写入项目注册表。",
                &temporary,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            )
        })?;
    fs::rename(&temporary, &path).map_err(|error| {
        MigrationError::io(
            "project_registry_write_failed",
            "project_registry",
            "无法提交项目注册表。",
            &path,
            error,
            "检查 Skill Store 权限后重试。",
            true,
        )
    })
}

pub fn list_managed_projects(
    store_path: &Path,
) -> Result<Vec<ManagedProjectRecord>, MigrationError> {
    let (_, registry) = load(store_path)?;
    Ok(registry.projects)
}

pub fn register_managed_project(
    store_path: &Path,
    project_path: &Path,
    mut target_groups: Vec<TargetGroupId>,
) -> Result<ManagedProjectRecord, MigrationError> {
    let (store, mut registry) = load(store_path)?;
    let (project_root, project_identity) = real_directory(project_path, "受管项目")?;
    if project_root == store || project_root.starts_with(&store) || store.starts_with(&project_root)
    {
        return Err(MigrationError::new(
            "unsafe_store_relationship",
            "project_registry",
            "Skill Store 与受管项目不能互为祖先或后代。",
            Some(project_root),
            Some("disjoint canonical paths".into()),
            Some(store.display().to_string()),
            "重新选择 Skill Store 或项目。",
            false,
        ));
    }
    target_groups.sort();
    target_groups.dedup();
    let timestamp = now_millis();
    let record = if let Some(existing) = registry
        .projects
        .iter_mut()
        .find(|record| record.project_root == project_root)
    {
        existing.project_identity = project_identity;
        existing.target_groups = target_groups;
        existing.updated_at = timestamp;
        existing.clone()
    } else {
        let record = ManagedProjectRecord {
            project_id: Uuid::new_v4().to_string(),
            project_root,
            project_identity,
            target_groups,
            created_at: timestamp,
            updated_at: timestamp,
        };
        registry.projects.push(record.clone());
        record
    };
    registry
        .projects
        .sort_by(|a, b| a.project_root.cmp(&b.project_root));
    write(&store, &registry)?;
    Ok(record)
}

pub fn discover_historical_project_roots(
    store_path: &Path,
    sources: &[PathBuf],
) -> Result<Vec<HistoricalProjectRoot>, MigrationError> {
    let (store, _) = real_directory(store_path, "Skill Store")?;
    let transaction_dir = store.join(INTERNAL_DIRECTORY).join("transactions");
    let metadata = match fs::symlink_metadata(&transaction_dir) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(MigrationError::io(
                "transactions_unreadable",
                "recovery",
                "无法检查项目事务目录。",
                &transaction_dir,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            ))
        }
        Ok(metadata) => metadata,
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(MigrationError::new(
            "unsafe_transactions_directory",
            "recovery",
            "项目事务容器必须是真实目录。",
            Some(transaction_dir),
            Some("real directory".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "保留现场并人工检查 Skill Store。",
            false,
        ));
    }
    let source_set = sources.iter().collect::<std::collections::BTreeSet<_>>();
    let mut roots = BTreeMap::new();
    for entry in fs::read_dir(&transaction_dir)
        .map_err(|error| {
            MigrationError::io(
                "transactions_unreadable",
                "recovery",
                "无法枚举项目事务。",
                &transaction_dir,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            )
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            MigrationError::io(
                "transactions_unreadable",
                "recovery",
                "无法读取项目事务目录项。",
                &transaction_dir,
                error,
                "检查 Skill Store 权限后重试。",
                true,
            )
        })?
    {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(OsStr::to_str) else {
            continue;
        };
        let Some(transaction_id) = name.strip_suffix(".project.json").map(str::to_owned) else {
            continue;
        };
        if Uuid::parse_str(&transaction_id).is_err() {
            continue;
        }
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            MigrationError::io(
                "project_manifest_unreadable",
                "recovery",
                "无法检查项目事务清单。",
                &path,
                error,
                "保留现场并人工检查项目事务。",
                false,
            )
        })?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(MigrationError::new(
                "unsafe_project_manifest",
                "recovery",
                "项目事务清单必须是真实文件。",
                Some(path),
                Some("regular file".into()),
                Some(format!("mode {:o}", metadata.mode())),
                "保留现场并人工检查项目事务。",
                false,
            ));
        }
        let manifest: ProjectTransactionManifest =
            serde_json::from_slice(&fs::read(&path).map_err(|error| {
                MigrationError::io(
                    "project_manifest_unreadable",
                    "recovery",
                    "无法读取项目事务清单。",
                    &path,
                    error,
                    "保留现场并人工检查项目事务。",
                    false,
                )
            })?)
            .map_err(|error| {
                MigrationError::new(
                    "project_manifest_invalid",
                    "recovery",
                    "项目事务清单格式无效。",
                    Some(path.clone()),
                    Some("ProjectTransactionManifest v1".into()),
                    Some(error.to_string()),
                    "保留现场并人工检查项目事务。",
                    false,
                )
            })?;
        if manifest.schema_version != 1
            || manifest.transaction_id != transaction_id
            || manifest.store_root != store
            || !manifest.project_root.is_absolute()
        {
            return Err(MigrationError::new(
                "project_manifest_mismatch",
                "recovery",
                "项目事务清单与当前位置不一致。",
                Some(path),
                Some(format!(
                    "transaction {transaction_id} in {}",
                    store.display()
                )),
                None,
                "保留现场并人工检查项目事务。",
                false,
            ));
        }
        if manifest
            .operations
            .iter()
            .any(|operation| source_set.contains(&operation.source_path))
        {
            match roots.get(&manifest.project_root) {
                Some(identity) if identity != &manifest.project_identity => {
                    return Err(MigrationError::new(
                        "project_history_identity_conflict",
                        "recovery",
                        "历史项目事务对同一路径记录了不同身份。",
                        Some(manifest.project_root),
                        None,
                        None,
                        "保留现场并人工检查项目事务。",
                        false,
                    ))
                }
                _ => {
                    roots.insert(manifest.project_root, manifest.project_identity);
                }
            }
        }
    }
    Ok(roots
        .into_iter()
        .map(|(project_root, project_identity)| HistoricalProjectRoot {
            project_root,
            project_identity,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn registry_round_trips_canonical_project_and_updates_groups() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        let first = register_managed_project(
            &store,
            &project,
            vec![TargetGroupId::AgentsShared, TargetGroupId::Claude],
        )
        .unwrap();
        let updated =
            register_managed_project(&store, &project, vec![TargetGroupId::Trae]).unwrap();
        assert_eq!(first.project_id, updated.project_id);
        assert_eq!(updated.target_groups, vec![TargetGroupId::Trae]);
        assert_eq!(list_managed_projects(&store).unwrap(), vec![updated]);
    }

    #[test]
    fn registry_rejects_symlinked_project() {
        let fixture = TempDir::new().unwrap();
        let store = fixture.path().join("store");
        let project = fixture.path().join("project");
        let link = fixture.path().join("project-link");
        fs::create_dir(&store).unwrap();
        fs::create_dir(&project).unwrap();
        std::os::unix::fs::symlink(&project, &link).unwrap();
        let error = register_managed_project(&store, &link, Vec::new()).unwrap_err();
        assert_eq!(error.code, "unsafe_managed_project");
    }
}
