use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::ffi::{CString, OsStr};
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::{symlink, MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const FINGERPRINT_VERSION: &str = "habitat-tree-v1";
const INTERNAL_DIRECTORY: &str = ".habitat";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MigrationError {
    pub code: String,
    pub phase: String,
    pub message: String,
    pub path: Option<PathBuf>,
    pub expected: Option<String>,
    pub actual: Option<String>,
    pub recovery: String,
    pub retryable: bool,
    pub transaction_id: Option<String>,
}

impl MigrationError {
    pub(crate) fn new(
        code: &str,
        phase: &str,
        message: impl Into<String>,
        path: Option<PathBuf>,
        expected: Option<String>,
        actual: Option<String>,
        recovery: impl Into<String>,
        retryable: bool,
    ) -> Self {
        Self {
            code: code.into(),
            phase: phase.into(),
            message: message.into(),
            path,
            expected,
            actual,
            recovery: recovery.into(),
            retryable,
            transaction_id: None,
        }
    }

    pub(crate) fn io(
        code: &str,
        phase: &str,
        message: impl Into<String>,
        path: &Path,
        error: io::Error,
        recovery: impl Into<String>,
        retryable: bool,
    ) -> Self {
        Self::new(
            code,
            phase,
            message,
            Some(path.to_path_buf()),
            None,
            Some(error.to_string()),
            recovery,
            retryable,
        )
    }

    pub(crate) fn for_transaction(mut self, transaction_id: &str) -> Self {
        self.transaction_id = Some(transaction_id.into());
        self
    }
}

impl fmt::Display for MigrationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for MigrationError {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ParseStatus {
    Valid,
    Warning,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: String,
    pub message: String,
    pub blocking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ManifestKind {
    Directory,
    File,
    Symlink,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestItem {
    pub relative_path: PathBuf,
    pub kind: ManifestKind,
    pub mode: u32,
    pub size: u64,
    pub link_text: Option<PathBuf>,
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalArtifact {
    pub artifact_id: String,
    pub canonical_path: PathBuf,
    pub declared_name: Option<String>,
    pub directory_name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub manifest: Vec<ManifestItem>,
    pub content_fingerprint: String,
    pub parse_status: ParseStatus,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    Directory,
    Symlink,
    BrokenSymlink,
    File,
    Unreadable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileIdentity {
    pub device: u64,
    pub inode: u64,
    pub mode: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExposureRoute {
    pub route_id: String,
    pub root_id: String,
    pub agent_id: String,
    pub edition: Option<String>,
    pub entry_path: PathBuf,
    pub entry_kind: EntryKind,
    pub canonical_target: Option<PathBuf>,
    pub artifact_id: Option<String>,
    pub identity: Option<FileIdentity>,
    pub link_text: Option<PathBuf>,
    pub diagnostic: Option<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryRoot {
    pub root_id: String,
    pub agent_id: String,
    pub edition: Option<String>,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InventorySnapshot {
    pub snapshot_id: String,
    pub captured_at: u64,
    pub artifacts: Vec<CanonicalArtifact>,
    pub routes: Vec<ExposureRoute>,
    pub duplicate_fingerprint_groups: Vec<Vec<String>>,
    pub variant_groups: Vec<Vec<String>>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationResult {
    Pending,
    Staged,
    Imported,
    Quarantined,
    Restored,
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportOperation {
    pub artifact_id: String,
    pub source_path: PathBuf,
    pub expected_fingerprint: String,
    pub staging_path: PathBuf,
    pub final_path: PathBuf,
    pub result: OperationResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryOperation {
    pub route_id: String,
    pub original_path: PathBuf,
    pub original_parent: PathBuf,
    pub entry_kind: EntryKind,
    pub expected_identity: FileIdentity,
    pub expected_link_text: Option<PathBuf>,
    pub expected_fingerprint: String,
    pub recovery_path: PathBuf,
    pub result: OperationResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransactionState {
    Confirmed,
    Staging,
    Imported,
    Quarantined,
    Verifying,
    Completed,
    FailedPartial,
    RollingBack,
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MigrationPlan {
    pub transaction_id: String,
    pub snapshot_id: String,
    pub store_root: PathBuf,
    pub store_identity: FileIdentity,
    pub manifest_path: PathBuf,
    pub imports: Vec<ImportOperation>,
    pub recoveries: Vec<RecoveryOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TransactionManifest {
    pub schema_version: u32,
    pub transaction_id: String,
    pub snapshot_id: String,
    pub store_root: PathBuf,
    pub store_identity: FileIdentity,
    pub state: TransactionState,
    pub imports: Vec<ImportOperation>,
    pub recoveries: Vec<RecoveryOperation>,
    pub created_at: u64,
    pub updated_at: u64,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn safe_segment(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && Path::new(value).components().count() == 1
        && Path::new(value).file_name() == Some(OsStr::new(value))
}

fn identity(metadata: &fs::Metadata) -> FileIdentity {
    FileIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
        mode: metadata.mode(),
    }
}

fn to_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

fn hash_file(path: &Path) -> Result<String, MigrationError> {
    let mut file = File::open(path).map_err(|error| {
        MigrationError::io(
            "artifact_unreadable",
            "discovery",
            "无法读取 Skill 文件。",
            path,
            error,
            "检查文件权限后重新扫描。",
            true,
        )
    })?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            MigrationError::io(
                "artifact_unreadable",
                "discovery",
                "读取 Skill 文件时失败。",
                path,
                error,
                "检查文件权限后重新扫描。",
                true,
            )
        })?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(to_hex(&digest.finalize()))
}

fn collect_manifest(
    root: &Path,
    current: &Path,
    items: &mut Vec<ManifestItem>,
) -> Result<(), MigrationError> {
    let mut entries = fs::read_dir(current)
        .map_err(|error| {
            MigrationError::io(
                "artifact_unreadable",
                "discovery",
                "无法枚举 Skill 目录。",
                current,
                error,
                "检查目录权限后重新扫描。",
                true,
            )
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            MigrationError::io(
                "artifact_unreadable",
                "discovery",
                "读取 Skill 目录项时失败。",
                current,
                error,
                "检查目录权限后重新扫描。",
                true,
            )
        })?;
    entries.sort_by_key(|entry| entry.file_name());

    for entry in entries {
        let path = entry.path();
        let relative = path.strip_prefix(root).map_err(|_| {
            MigrationError::new(
                "artifact_boundary",
                "discovery",
                "Skill 清单路径越过内容根目录。",
                Some(path.clone()),
                Some(root.display().to_string()),
                Some(path.display().to_string()),
                "移除越界路径后重新扫描。",
                false,
            )
        })?;
        if relative.to_str().is_none() {
            return Err(MigrationError::new(
                "unsupported_path_encoding",
                "discovery",
                "Skill 包含无法安全记录的路径名称。",
                Some(path),
                Some("UTF-8 path".into()),
                Some("non-UTF-8 path".into()),
                "重命名该路径后重新扫描。",
                false,
            ));
        }
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            MigrationError::io(
                "artifact_unreadable",
                "discovery",
                "无法读取 Skill 条目状态。",
                &path,
                error,
                "检查权限后重新扫描。",
                true,
            )
        })?;
        let file_type = metadata.file_type();
        let (kind, link_text, content_hash) = if file_type.is_dir() {
            (ManifestKind::Directory, None, None)
        } else if file_type.is_file() {
            (ManifestKind::File, None, Some(hash_file(&path)?))
        } else if file_type.is_symlink() {
            let target = fs::read_link(&path).map_err(|error| {
                MigrationError::io(
                    "artifact_unreadable",
                    "discovery",
                    "无法读取 Skill 内部符号链接。",
                    &path,
                    error,
                    "检查链接后重新扫描。",
                    true,
                )
            })?;
            if target.to_str().is_none() {
                return Err(MigrationError::new(
                    "unsupported_link_encoding",
                    "discovery",
                    "Skill 包含无法安全记录的符号链接。",
                    Some(path),
                    Some("UTF-8 link text".into()),
                    Some("non-UTF-8 link text".into()),
                    "重建该链接后重新扫描。",
                    false,
                ));
            }
            (ManifestKind::Symlink, Some(target), None)
        } else {
            return Err(MigrationError::new(
                "unsupported_entry_kind",
                "discovery",
                "Skill 包含不支持的文件类型。",
                Some(path),
                Some("directory, regular file, or symlink".into()),
                Some(format!("mode {:o}", metadata.mode())),
                "移除特殊文件后重新扫描。",
                false,
            ));
        };
        items.push(ManifestItem {
            relative_path: relative.to_path_buf(),
            kind: kind.clone(),
            mode: metadata.mode(),
            size: metadata.len(),
            link_text,
            content_hash,
        });
        if kind == ManifestKind::Directory {
            collect_manifest(root, &path, items)?;
        }
    }
    Ok(())
}

fn fingerprint_tree(path: &Path) -> Result<(Vec<ManifestItem>, String), MigrationError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        MigrationError::io(
            "artifact_unreadable",
            "discovery",
            "无法检查 Skill 内容根目录。",
            path,
            error,
            "检查目录后重新扫描。",
            true,
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(MigrationError::new(
            "invalid_artifact_root",
            "discovery",
            "Skill 内容根目录必须是真实目录。",
            Some(path.to_path_buf()),
            Some("real directory".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "选择真实 Skill 目录后重新扫描。",
            false,
        ));
    }
    let mut items = Vec::new();
    collect_manifest(path, path, &mut items)?;
    let encoded = serde_json::to_vec(&(FINGERPRINT_VERSION, &items)).map_err(|error| {
        MigrationError::new(
            "manifest_encoding_failed",
            "discovery",
            "无法编码 Skill 内容清单。",
            Some(path.to_path_buf()),
            None,
            Some(error.to_string()),
            "重新扫描；若问题持续，请保留诊断信息。",
            true,
        )
    })?;
    let mut digest = Sha256::new();
    digest.update(encoded);
    Ok((
        items,
        format!("{FINGERPRINT_VERSION}:{}", to_hex(&digest.finalize())),
    ))
}

fn parse_scalar(value: &str) -> Result<String, &'static str> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(String::new());
    }
    if let Some(inner) = value.strip_prefix('"').and_then(|v| v.strip_suffix('"')) {
        return serde_json::from_str::<String>(&format!("\"{inner}\""))
            .map_err(|_| "invalid double-quoted scalar");
    }
    if let Some(inner) = value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')) {
        return Ok(inner.replace("''", "'"));
    }
    if value.starts_with(['\'', '"']) || value.ends_with(['\'', '"']) {
        return Err("unclosed quoted scalar");
    }
    Ok(value.into())
}

fn parse_frontmatter(contents: &str) -> Result<BTreeMap<String, String>, String> {
    let mut lines = contents.lines();
    if lines.next().map(str::trim) != Some("---") {
        return Err("missing opening delimiter".into());
    }
    let mut fields = BTreeMap::new();
    let mut closed = false;
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            closed = true;
            break;
        }
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let (key, raw_value) = trimmed
            .split_once(':')
            .ok_or_else(|| format!("invalid mapping entry: {trimmed}"))?;
        let key = key.trim();
        if key.is_empty() || key.chars().any(char::is_whitespace) {
            return Err(format!("invalid key: {key}"));
        }
        if fields.contains_key(key) {
            return Err(format!("duplicate key: {key}"));
        }
        let value = parse_scalar(raw_value).map_err(|reason| format!("{key}: {reason}"))?;
        fields.insert(key.into(), value);
    }
    if !closed {
        return Err("missing closing delimiter".into());
    }
    Ok(fields)
}

fn inspect_declaration(
    path: &Path,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    ParseStatus,
    Vec<Diagnostic>,
) {
    let skill_file = path.join("SKILL.md");
    let contents = match fs::read_to_string(&skill_file) {
        Ok(contents) => contents,
        Err(error) => {
            return (
                None,
                None,
                None,
                ParseStatus::Blocked,
                vec![Diagnostic {
                    code: "skill_declaration_unreadable".into(),
                    message: error.to_string(),
                    blocking: true,
                }],
            )
        }
    };
    let fields = match parse_frontmatter(&contents) {
        Ok(fields) => fields,
        Err(reason) => {
            return (
                None,
                None,
                None,
                ParseStatus::Blocked,
                vec![Diagnostic {
                    code: "invalid_frontmatter".into(),
                    message: reason,
                    blocking: true,
                }],
            )
        }
    };
    let name = fields
        .get("name")
        .filter(|value| !value.is_empty())
        .cloned();
    let description = fields
        .get("description")
        .filter(|value| !value.is_empty())
        .cloned();
    let version = fields
        .get("version")
        .filter(|value| !value.is_empty())
        .cloned();
    let mut diagnostics = Vec::new();
    match &name {
        None => diagnostics.push(Diagnostic {
            code: "missing_skill_name".into(),
            message: "SKILL.md 缺少 name。".into(),
            blocking: true,
        }),
        Some(name) if !safe_segment(name) => diagnostics.push(Diagnostic {
            code: "unsafe_skill_name".into(),
            message: format!("name 不是安全的单一路径段：{name}"),
            blocking: true,
        }),
        Some(_) => {}
    }
    if description.is_none() {
        diagnostics.push(Diagnostic {
            code: "missing_description".into(),
            message: "SKILL.md 缺少 description。".into(),
            blocking: false,
        });
    }
    if version.is_none() {
        diagnostics.push(Diagnostic {
            code: "missing_version".into(),
            message: "SKILL.md 缺少 version。".into(),
            blocking: false,
        });
    }
    let status = if diagnostics.iter().any(|item| item.blocking) {
        ParseStatus::Blocked
    } else if diagnostics.is_empty() {
        ParseStatus::Valid
    } else {
        ParseStatus::Warning
    };
    (name, description, version, status, diagnostics)
}

fn canonical_real_directory(
    path: &Path,
    phase: &str,
    label: &str,
) -> Result<PathBuf, MigrationError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        MigrationError::io(
            "path_unavailable",
            phase,
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
            phase,
            format!("{label}必须是真实目录。"),
            Some(path.to_path_buf()),
            Some("real directory".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "选择不经过符号链接的真实目录。",
            false,
        ));
    }
    fs::canonicalize(path).map_err(|error| {
        MigrationError::io(
            "path_unavailable",
            phase,
            format!("无法规范化{label}。"),
            path,
            error,
            "确认目录存在且可读取后重试。",
            true,
        )
    })
}

pub fn validate_store(
    store_path: &Path,
    protected_roots: &[PathBuf],
) -> Result<PathBuf, MigrationError> {
    let store = canonical_real_directory(store_path, "preflight", "Skill Store")?;
    for protected in protected_roots {
        let protected = canonical_real_directory(protected, "preflight", "已知扫描根目录或项目")?;
        if store == protected || store.starts_with(&protected) || protected.starts_with(&store) {
            return Err(MigrationError::new(
                "unsafe_store_relationship",
                "preflight",
                "Skill Store 与已知扫描根目录或项目存在祖先/后代关系。",
                Some(store.clone()),
                Some("disjoint canonical paths".into()),
                Some(protected.display().to_string()),
                "选择与所有扫描根目录和项目互不包含的目录。",
                false,
            ));
        }
    }
    Ok(store)
}

pub fn scan_inventory(roots: &[InventoryRoot]) -> Result<InventorySnapshot, MigrationError> {
    let mut artifacts = Vec::new();
    let mut routes = Vec::new();
    let mut canonical_to_artifact = HashMap::<PathBuf, String>::new();
    let mut diagnostics = Vec::new();

    for root in roots {
        let canonical_root =
            canonical_real_directory(&root.path, "discovery", "Agent Skill 根目录")?;
        let mut entries = fs::read_dir(&canonical_root)
            .map_err(|error| {
                MigrationError::io(
                    "root_unreadable",
                    "discovery",
                    "无法扫描 Agent Skill 根目录。",
                    &canonical_root,
                    error,
                    "检查目录权限后重新扫描。",
                    true,
                )
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| {
                MigrationError::io(
                    "root_unreadable",
                    "discovery",
                    "无法读取 Agent Skill 目录项。",
                    &canonical_root,
                    error,
                    "检查目录权限后重新扫描。",
                    true,
                )
            })?;
        entries.sort_by_key(|entry| entry.file_name());

        for entry in entries {
            let entry_path = entry.path();
            let route_id = Uuid::new_v4().to_string();
            let metadata = match fs::symlink_metadata(&entry_path) {
                Ok(metadata) => metadata,
                Err(error) => {
                    let diagnostic = Diagnostic {
                        code: "entry_unreadable".into(),
                        message: error.to_string(),
                        blocking: true,
                    };
                    diagnostics.push(diagnostic.clone());
                    routes.push(ExposureRoute {
                        route_id,
                        root_id: root.root_id.clone(),
                        agent_id: root.agent_id.clone(),
                        edition: root.edition.clone(),
                        entry_path,
                        entry_kind: EntryKind::Unreadable,
                        canonical_target: None,
                        artifact_id: None,
                        identity: None,
                        link_text: None,
                        diagnostic: Some(diagnostic),
                    });
                    continue;
                }
            };
            let observed_identity = Some(identity(&metadata));
            let mut link_text = None;
            let (entry_kind, canonical_target, route_diagnostic) =
                if metadata.file_type().is_symlink() {
                    match fs::read_link(&entry_path) {
                        Ok(target) => {
                            link_text = Some(target);
                            match fs::canonicalize(&entry_path) {
                                Ok(target) if target.is_dir() => {
                                    (EntryKind::Symlink, Some(target), None)
                                }
                                Ok(target) => (
                                    EntryKind::Symlink,
                                    None,
                                    Some(Diagnostic {
                                        code: "symlink_target_not_directory".into(),
                                        message: format!("链接目标不是目录：{}", target.display()),
                                        blocking: true,
                                    }),
                                ),
                                Err(error) if error.kind() == io::ErrorKind::NotFound => (
                                    EntryKind::BrokenSymlink,
                                    None,
                                    Some(Diagnostic {
                                        code: "broken_symlink".into(),
                                        message: error.to_string(),
                                        blocking: true,
                                    }),
                                ),
                                Err(error) => (
                                    EntryKind::Unreadable,
                                    None,
                                    Some(Diagnostic {
                                        code: "symlink_unreadable".into(),
                                        message: error.to_string(),
                                        blocking: true,
                                    }),
                                ),
                            }
                        }
                        Err(error) => (
                            EntryKind::Unreadable,
                            None,
                            Some(Diagnostic {
                                code: "symlink_unreadable".into(),
                                message: error.to_string(),
                                blocking: true,
                            }),
                        ),
                    }
                } else if metadata.is_dir() {
                    match fs::canonicalize(&entry_path) {
                        Ok(target) => (EntryKind::Directory, Some(target), None),
                        Err(error) => (
                            EntryKind::Unreadable,
                            None,
                            Some(Diagnostic {
                                code: "entry_unreadable".into(),
                                message: error.to_string(),
                                blocking: true,
                            }),
                        ),
                    }
                } else {
                    (
                        EntryKind::File,
                        None,
                        Some(Diagnostic {
                            code: "entry_not_directory".into(),
                            message: "Agent Skill 入口不是目录或目录链接。".into(),
                            blocking: true,
                        }),
                    )
                };

            let artifact_id = if let Some(target) = &canonical_target {
                if let Some(existing) = canonical_to_artifact.get(target) {
                    Some(existing.clone())
                } else {
                    let (manifest, content_fingerprint) = fingerprint_tree(target)?;
                    let (declared_name, description, version, parse_status, artifact_diagnostics) =
                        inspect_declaration(target);
                    let artifact_id = Uuid::new_v4().to_string();
                    artifacts.push(CanonicalArtifact {
                        artifact_id: artifact_id.clone(),
                        canonical_path: target.clone(),
                        declared_name,
                        directory_name: target
                            .file_name()
                            .and_then(OsStr::to_str)
                            .unwrap_or("unnamed")
                            .into(),
                        description,
                        version,
                        manifest,
                        content_fingerprint,
                        parse_status,
                        diagnostics: artifact_diagnostics,
                    });
                    canonical_to_artifact.insert(target.clone(), artifact_id.clone());
                    Some(artifact_id)
                }
            } else {
                None
            };
            if let Some(diagnostic) = &route_diagnostic {
                diagnostics.push(diagnostic.clone());
            }
            routes.push(ExposureRoute {
                route_id,
                root_id: root.root_id.clone(),
                agent_id: root.agent_id.clone(),
                edition: root.edition.clone(),
                entry_path,
                entry_kind,
                canonical_target,
                artifact_id,
                identity: observed_identity,
                link_text,
                diagnostic: route_diagnostic,
            });
        }
    }

    let mut by_fingerprint = BTreeMap::<String, Vec<String>>::new();
    let mut by_name = BTreeMap::<String, Vec<String>>::new();
    for artifact in &artifacts {
        by_fingerprint
            .entry(artifact.content_fingerprint.clone())
            .or_default()
            .push(artifact.artifact_id.clone());
        if let Some(name) = &artifact.declared_name {
            by_name
                .entry(name.clone())
                .or_default()
                .push(artifact.artifact_id.clone());
        }
    }
    let duplicate_fingerprint_groups = by_fingerprint
        .into_values()
        .filter(|group| group.len() > 1)
        .collect();
    let variant_groups = by_name
        .into_values()
        .filter(|group| {
            let fingerprints = group
                .iter()
                .filter_map(|id| {
                    artifacts
                        .iter()
                        .find(|artifact| &artifact.artifact_id == id)
                })
                .map(|artifact| &artifact.content_fingerprint)
                .collect::<std::collections::BTreeSet<_>>();
            fingerprints.len() > 1
        })
        .collect();

    Ok(InventorySnapshot {
        snapshot_id: Uuid::new_v4().to_string(),
        captured_at: now_millis(),
        artifacts,
        routes,
        duplicate_fingerprint_groups,
        variant_groups,
        diagnostics,
    })
}

pub fn build_import_plan(
    snapshot: &InventorySnapshot,
    store_path: &Path,
    roots: &[InventoryRoot],
    managed_projects: &[PathBuf],
    selected_artifact_ids: &[String],
) -> Result<MigrationPlan, MigrationError> {
    let mut protected = roots
        .iter()
        .map(|root| root.path.clone())
        .collect::<Vec<_>>();
    protected.extend_from_slice(managed_projects);
    let store_root = validate_store(store_path, &protected)?;
    let store_identity = identity(&fs::symlink_metadata(&store_root).map_err(|error| {
        MigrationError::io(
            "path_unavailable",
            "preflight",
            "无法记录 Skill Store 身份。",
            &store_root,
            error,
            "重新选择 Skill Store。",
            true,
        )
    })?);
    let transaction_id = Uuid::new_v4().to_string();
    let internal = store_root.join(INTERNAL_DIRECTORY);
    let staging_root = internal.join("staging").join(&transaction_id);
    let recovery_root = internal.join("recovery").join(&transaction_id);
    let manifest_path = internal
        .join("transactions")
        .join(format!("{transaction_id}.json"));
    let selected = selected_artifact_ids
        .iter()
        .map(|id| {
            snapshot
                .artifacts
                .iter()
                .find(|artifact| &artifact.artifact_id == id)
                .ok_or_else(|| {
                    MigrationError::new(
                        "artifact_not_in_snapshot",
                        "preflight",
                        "所选 Skill 不在当前扫描快照中。",
                        None,
                        Some(snapshot.snapshot_id.clone()),
                        Some(id.clone()),
                        "重新扫描后重新选择。",
                        false,
                    )
                })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let mut choices = BTreeMap::<String, (&CanonicalArtifact, String)>::new();
    let mut imports = Vec::new();
    let mut recoveries = Vec::new();
    for artifact in selected {
        if artifact.parse_status == ParseStatus::Blocked {
            return Err(MigrationError::new(
                "blocked_skill_declaration",
                "preflight",
                "所选 Skill 的声明无法安全导入。",
                Some(artifact.canonical_path.clone()),
                Some("valid or warning frontmatter".into()),
                Some("blocked frontmatter".into()),
                "修正 SKILL.md 后重新扫描。",
                false,
            ));
        }
        let name = artifact.declared_name.as_ref().expect("non-blocked name");
        if let Some((existing, fingerprint)) = choices.get(name) {
            if fingerprint != &artifact.content_fingerprint {
                return Err(MigrationError::new(
                    "variant_requires_choice",
                    "preflight",
                    "同名不同内容的 Skill 不能同时导入。",
                    Some(artifact.canonical_path.clone()),
                    Some(existing.artifact_id.clone()),
                    Some(artifact.artifact_id.clone()),
                    "只选择一个明确的内容变体。",
                    false,
                ));
            }
            continue;
        }
        choices.insert(
            name.clone(),
            (artifact, artifact.content_fingerprint.clone()),
        );
    }

    for (name, (artifact, fingerprint)) in choices {
        imports.push(ImportOperation {
            artifact_id: artifact.artifact_id.clone(),
            source_path: artifact.canonical_path.clone(),
            expected_fingerprint: artifact.content_fingerprint.clone(),
            staging_path: staging_root.join(&name),
            final_path: store_root.join(&name),
            result: OperationResult::Pending,
        });
        let equivalent_ids = snapshot
            .artifacts
            .iter()
            .filter(|candidate| {
                candidate.declared_name.as_deref() == artifact.declared_name.as_deref()
                    && candidate.content_fingerprint == fingerprint
            })
            .map(|candidate| candidate.artifact_id.as_str())
            .collect::<std::collections::BTreeSet<_>>();
        for route in snapshot.routes.iter().filter(|route| {
            route
                .artifact_id
                .as_deref()
                .is_some_and(|id| equivalent_ids.contains(id))
        }) {
            let Some(expected_identity) = route.identity.clone() else {
                continue;
            };
            if !matches!(route.entry_kind, EntryKind::Directory | EntryKind::Symlink) {
                continue;
            }
            recoveries.push(RecoveryOperation {
                route_id: route.route_id.clone(),
                original_path: route.entry_path.clone(),
                original_parent: route
                    .entry_path
                    .parent()
                    .expect("inventory entries have a parent")
                    .to_path_buf(),
                entry_kind: route.entry_kind.clone(),
                expected_identity,
                expected_link_text: route.link_text.clone(),
                expected_fingerprint: artifact.content_fingerprint.clone(),
                recovery_path: recovery_root.join(&route.route_id),
                result: OperationResult::Pending,
            });
        }
    }
    recoveries.sort_by_key(|operation| match operation.entry_kind {
        EntryKind::Symlink => 0,
        EntryKind::Directory => 1,
        _ => 2,
    });
    Ok(MigrationPlan {
        transaction_id,
        snapshot_id: snapshot.snapshot_id.clone(),
        store_root,
        store_identity,
        manifest_path,
        imports,
        recoveries,
    })
}

fn inspect_absent(path: &Path, phase: &str, code: &str) -> Result<(), MigrationError> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(MigrationError::io(
            "target_inspection_failed",
            phase,
            "无法检查目标位置。",
            path,
            error,
            "检查父目录权限后重试。",
            true,
        )),
        Ok(metadata) => Err(MigrationError::new(
            code,
            phase,
            "目标位置已存在，Habitat 不会覆盖。",
            Some(path.to_path_buf()),
            Some("absent".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "移走冲突内容并创建新快照。",
            false,
        )),
    }
}

fn verify_recovery_source(
    operation: &RecoveryOperation,
    transaction_id: &str,
) -> Result<(), MigrationError> {
    let actual_parent = canonical_real_directory(
        &operation.original_parent,
        "preflight",
        "Agent Skill 根目录",
    )
    .map_err(|error| error.for_transaction(transaction_id))?;
    if actual_parent != operation.original_parent {
        return Err(MigrationError::new(
            "source_parent_drift",
            "preflight",
            "迁移源的父目录已被替换或改道。",
            Some(operation.original_parent.clone()),
            Some(operation.original_parent.display().to_string()),
            Some(actual_parent.display().to_string()),
            "重新扫描并创建新的迁移计划。",
            false,
        )
        .for_transaction(transaction_id));
    }
    let metadata = fs::symlink_metadata(&operation.original_path).map_err(|error| {
        MigrationError::io(
            "source_drift",
            "preflight",
            "迁移源已不再匹配扫描快照。",
            &operation.original_path,
            error,
            "重新扫描并创建新的迁移计划。",
            false,
        )
        .for_transaction(transaction_id)
    })?;
    let actual_identity = identity(&metadata);
    if actual_identity != operation.expected_identity {
        return Err(MigrationError::new(
            "source_drift",
            "preflight",
            "迁移源的文件身份已变化。",
            Some(operation.original_path.clone()),
            Some(format!("{:?}", operation.expected_identity)),
            Some(format!("{actual_identity:?}")),
            "重新扫描并创建新的迁移计划。",
            false,
        )
        .for_transaction(transaction_id));
    }
    match operation.entry_kind {
        EntryKind::Symlink => {
            if !metadata.file_type().is_symlink() {
                return Err(MigrationError::new(
                    "source_drift",
                    "preflight",
                    "迁移源不再是符号链接。",
                    Some(operation.original_path.clone()),
                    Some("symlink".into()),
                    Some(format!("mode {:o}", metadata.mode())),
                    "重新扫描并创建新的迁移计划。",
                    false,
                )
                .for_transaction(transaction_id));
            }
            let actual = fs::read_link(&operation.original_path).map_err(|error| {
                MigrationError::io(
                    "source_drift",
                    "preflight",
                    "无法读取迁移源链接。",
                    &operation.original_path,
                    error,
                    "重新扫描并创建新的迁移计划。",
                    false,
                )
                .for_transaction(transaction_id)
            })?;
            if Some(&actual) != operation.expected_link_text.as_ref() {
                return Err(MigrationError::new(
                    "source_drift",
                    "preflight",
                    "迁移源链接文本已变化。",
                    Some(operation.original_path.clone()),
                    operation
                        .expected_link_text
                        .as_ref()
                        .map(|path| path.display().to_string()),
                    Some(actual.display().to_string()),
                    "重新扫描并创建新的迁移计划。",
                    false,
                )
                .for_transaction(transaction_id));
            }
        }
        EntryKind::Directory => {
            let (_, actual) = fingerprint_tree(&operation.original_path)
                .map_err(|error| error.for_transaction(transaction_id))?;
            if actual != operation.expected_fingerprint {
                return Err(MigrationError::new(
                    "source_drift",
                    "preflight",
                    "迁移源内容已变化。",
                    Some(operation.original_path.clone()),
                    Some(operation.expected_fingerprint.clone()),
                    Some(actual),
                    "重新扫描并创建新的迁移计划。",
                    false,
                )
                .for_transaction(transaction_id));
            }
        }
        _ => unreachable!("plans only contain movable entries"),
    }
    Ok(())
}

fn inspect_internal_chain(store: &Path, target: &Path) -> Result<(), MigrationError> {
    let relative = target.strip_prefix(store).map_err(|_| {
        MigrationError::new(
            "store_boundary",
            "preflight",
            "事务路径越过 Skill Store。",
            Some(target.to_path_buf()),
            Some(store.display().to_string()),
            Some(target.display().to_string()),
            "重新选择 Skill Store。",
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
                    "preflight",
                    "事务容器路径必须由真实目录组成。",
                    Some(current),
                    Some("real directory or absent".into()),
                    Some(format!("mode {:o}", metadata.mode())),
                    "移走冲突内容后重新预检。",
                    false,
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => break,
            Err(error) => {
                return Err(MigrationError::io(
                    "target_inspection_failed",
                    "preflight",
                    "无法检查事务容器。",
                    &current,
                    error,
                    "检查 Skill Store 权限后重试。",
                    true,
                ))
            }
        }
    }
    Ok(())
}

fn preflight_plan(plan: &MigrationPlan) -> Result<(), MigrationError> {
    let store = canonical_real_directory(&plan.store_root, "preflight", "Skill Store")?;
    let actual_store_identity = identity(&fs::symlink_metadata(&store).map_err(|error| {
        MigrationError::io(
            "store_drift",
            "preflight",
            "无法检查 Skill Store 身份。",
            &store,
            error,
            "重新选择 Skill Store 并创建新的迁移计划。",
            false,
        )
    })?);
    if store != plan.store_root || actual_store_identity != plan.store_identity {
        return Err(MigrationError::new(
            "store_drift",
            "preflight",
            "Skill Store 在确认前已被替换或改道。",
            Some(plan.store_root.clone()),
            Some(format!(
                "{} {:?}",
                plan.store_root.display(),
                plan.store_identity
            )),
            Some(format!("{} {actual_store_identity:?}", store.display())),
            "重新选择 Skill Store 并创建新的迁移计划。",
            false,
        )
        .for_transaction(&plan.transaction_id));
    }
    inspect_internal_chain(
        &plan.store_root,
        &plan.manifest_path.parent().unwrap_or(&plan.store_root),
    )?;
    inspect_absent(&plan.manifest_path, "preflight", "manifest_conflict")?;
    for import in &plan.imports {
        let canonical_source = fs::canonicalize(&import.source_path).map_err(|error| {
            MigrationError::io(
                "source_drift",
                "preflight",
                "无法规范化迁移源。",
                &import.source_path,
                error,
                "重新扫描并创建新的迁移计划。",
                false,
            )
            .for_transaction(&plan.transaction_id)
        })?;
        if canonical_source != import.source_path {
            return Err(MigrationError::new(
                "source_drift",
                "preflight",
                "迁移源规范路径已变化。",
                Some(import.source_path.clone()),
                Some(import.source_path.display().to_string()),
                Some(canonical_source.display().to_string()),
                "重新扫描并创建新的迁移计划。",
                false,
            )
            .for_transaction(&plan.transaction_id));
        }
        let (_, actual) = fingerprint_tree(&import.source_path)
            .map_err(|error| error.for_transaction(&plan.transaction_id))?;
        if actual != import.expected_fingerprint {
            return Err(MigrationError::new(
                "source_drift",
                "preflight",
                "迁移源内容已变化。",
                Some(import.source_path.clone()),
                Some(import.expected_fingerprint.clone()),
                Some(actual),
                "重新扫描并创建新的迁移计划。",
                false,
            )
            .for_transaction(&plan.transaction_id));
        }
        inspect_absent(&import.staging_path, "preflight", "staging_conflict")?;
        inspect_absent(&import.final_path, "preflight", "store_conflict")?;
        inspect_internal_chain(
            &plan.store_root,
            import.staging_path.parent().unwrap_or(&plan.store_root),
        )?;
    }
    for recovery in &plan.recoveries {
        verify_recovery_source(recovery, &plan.transaction_id)?;
        inspect_absent(&recovery.recovery_path, "preflight", "recovery_conflict")?;
        inspect_internal_chain(
            &plan.store_root,
            recovery.recovery_path.parent().unwrap_or(&plan.store_root),
        )?;
    }
    Ok(())
}

fn ensure_real_directory(path: &Path) -> Result<(), MigrationError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            Err(MigrationError::new(
                "unsafe_store_layout",
                "staging",
                "事务容器必须是真实目录。",
                Some(path.to_path_buf()),
                Some("real directory".into()),
                Some(format!("mode {:o}", metadata.mode())),
                "移走冲突内容后重新执行。",
                false,
            ))
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            let parent = path.parent().ok_or_else(|| {
                MigrationError::new(
                    "unsafe_store_layout",
                    "staging",
                    "事务容器没有安全父目录。",
                    Some(path.to_path_buf()),
                    None,
                    None,
                    "重新选择 Skill Store。",
                    false,
                )
            })?;
            ensure_real_directory(parent)?;
            fs::create_dir(path).map_err(|error| {
                MigrationError::io(
                    "create_container_failed",
                    "staging",
                    "无法创建事务容器。",
                    path,
                    error,
                    "检查 Skill Store 权限后重试。",
                    true,
                )
            })
        }
        Err(error) => Err(MigrationError::io(
            "target_inspection_failed",
            "staging",
            "无法检查事务容器。",
            path,
            error,
            "检查 Skill Store 权限后重试。",
            true,
        )),
    }
}

fn set_symlink_permissions(path: &Path, mode: u32) -> Result<(), MigrationError> {
    let path_bytes = CString::new(path.as_os_str().as_bytes())
        .expect("filesystem paths cannot contain NUL bytes");
    // SAFETY: `path_bytes` is a valid, NUL-terminated filesystem path and remains
    // alive for the duration of the call. AT_SYMLINK_NOFOLLOW prevents target mutation.
    let result = unsafe {
        libc::fchmodat(
            libc::AT_FDCWD,
            path_bytes.as_ptr(),
            (mode & 0o7777) as libc::mode_t,
            libc::AT_SYMLINK_NOFOLLOW,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(MigrationError::io(
            "staging_copy_failed",
            "staging",
            "无法保留 Skill 内部链接权限。",
            path,
            io::Error::last_os_error(),
            "从事务清单回滚后重试。",
            true,
        ))
    }
}

fn copy_tree(source: &Path, destination: &Path) -> Result<(), MigrationError> {
    inspect_absent(destination, "staging", "staging_conflict")?;
    let source_metadata = fs::symlink_metadata(source).map_err(|error| {
        MigrationError::io(
            "source_drift",
            "staging",
            "无法读取迁移源。",
            source,
            error,
            "从事务清单回滚或重新扫描。",
            false,
        )
    })?;
    fs::create_dir(destination).map_err(|error| {
        MigrationError::io(
            "staging_copy_failed",
            "staging",
            "无法创建 staging 目录。",
            destination,
            error,
            "从事务清单回滚后重试。",
            true,
        )
    })?;
    let mut entries = fs::read_dir(source)
        .map_err(|error| {
            MigrationError::io(
                "staging_copy_failed",
                "staging",
                "无法读取迁移源目录。",
                source,
                error,
                "从事务清单回滚后重试。",
                true,
            )
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            MigrationError::io(
                "staging_copy_failed",
                "staging",
                "无法读取迁移源条目。",
                source,
                error,
                "从事务清单回滚后重试。",
                true,
            )
        })?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let source_entry = entry.path();
        let destination_entry = destination.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source_entry).map_err(|error| {
            MigrationError::io(
                "staging_copy_failed",
                "staging",
                "无法检查迁移源条目。",
                &source_entry,
                error,
                "从事务清单回滚后重试。",
                true,
            )
        })?;
        if metadata.file_type().is_dir() {
            copy_tree(&source_entry, &destination_entry)?;
        } else if metadata.file_type().is_file() {
            fs::copy(&source_entry, &destination_entry).map_err(|error| {
                MigrationError::io(
                    "staging_copy_failed",
                    "staging",
                    "无法复制 Skill 文件。",
                    &source_entry,
                    error,
                    "从事务清单回滚后重试。",
                    true,
                )
            })?;
            fs::set_permissions(
                &destination_entry,
                fs::Permissions::from_mode(metadata.mode()),
            )
            .map_err(|error| {
                MigrationError::io(
                    "staging_copy_failed",
                    "staging",
                    "无法保留 Skill 文件权限。",
                    &destination_entry,
                    error,
                    "从事务清单回滚后重试。",
                    true,
                )
            })?;
        } else if metadata.file_type().is_symlink() {
            let target = fs::read_link(&source_entry).map_err(|error| {
                MigrationError::io(
                    "staging_copy_failed",
                    "staging",
                    "无法读取 Skill 内部链接。",
                    &source_entry,
                    error,
                    "从事务清单回滚后重试。",
                    true,
                )
            })?;
            symlink(target, &destination_entry).map_err(|error| {
                MigrationError::io(
                    "staging_copy_failed",
                    "staging",
                    "无法复制 Skill 内部链接。",
                    &destination_entry,
                    error,
                    "从事务清单回滚后重试。",
                    true,
                )
            })?;
            set_symlink_permissions(&destination_entry, metadata.mode())?;
        } else {
            return Err(MigrationError::new(
                "unsupported_entry_kind",
                "staging",
                "Skill 包含不支持的文件类型。",
                Some(source_entry),
                None,
                Some(format!("mode {:o}", metadata.mode())),
                "从事务清单回滚，移除特殊文件后重新扫描。",
                false,
            ));
        }
    }
    fs::set_permissions(
        destination,
        fs::Permissions::from_mode(source_metadata.mode()),
    )
    .map_err(|error| {
        MigrationError::io(
            "staging_copy_failed",
            "staging",
            "无法保留 Skill 目录权限。",
            destination,
            error,
            "从事务清单回滚后重试。",
            true,
        )
    })
}

fn write_manifest(path: &Path, manifest: &TransactionManifest) -> Result<(), MigrationError> {
    let parent = path.parent().ok_or_else(|| {
        MigrationError::new(
            "manifest_path_invalid",
            "verify",
            "事务清单路径无有效父目录。",
            Some(path.to_path_buf()),
            None,
            None,
            "重新选择 Skill Store。",
            false,
        )
    })?;
    ensure_real_directory(parent)?;
    let temporary = path.with_extension("json.tmp");
    inspect_absent(&temporary, "verify", "manifest_temp_conflict")?;
    let encoded = serde_json::to_vec_pretty(manifest).map_err(|error| {
        MigrationError::new(
            "manifest_encoding_failed",
            "verify",
            "无法编码事务清单。",
            Some(path.to_path_buf()),
            None,
            Some(error.to_string()),
            "保留当前文件状态并重试。",
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
                "无法创建事务清单临时文件。",
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
            "无法写入事务清单。",
            &temporary,
            error,
            "保留当前文件状态并重试。",
            true,
        )
    })?;
    file.sync_all().map_err(|error| {
        MigrationError::io(
            "manifest_write_failed",
            "verify",
            "无法同步事务清单。",
            &temporary,
            error,
            "保留当前文件状态并重试。",
            true,
        )
    })?;
    fs::rename(&temporary, path).map_err(|error| {
        MigrationError::io(
            "manifest_write_failed",
            "verify",
            "无法提交事务清单。",
            path,
            error,
            "保留当前文件状态并重试。",
            true,
        )
    })
}

fn persist_state(
    manifest_path: &Path,
    manifest: &mut TransactionManifest,
    state: TransactionState,
) -> Result<(), MigrationError> {
    manifest.state = state;
    manifest.updated_at = now_millis();
    write_manifest(manifest_path, manifest)
        .map_err(|error| error.for_transaction(&manifest.transaction_id))
}

pub fn execute_import(plan: &MigrationPlan) -> Result<TransactionManifest, MigrationError> {
    preflight_plan(plan)?;
    let timestamp = now_millis();
    let mut manifest = TransactionManifest {
        schema_version: 1,
        transaction_id: plan.transaction_id.clone(),
        snapshot_id: plan.snapshot_id.clone(),
        store_root: plan.store_root.clone(),
        store_identity: plan.store_identity.clone(),
        state: TransactionState::Confirmed,
        imports: plan.imports.clone(),
        recoveries: plan.recoveries.clone(),
        created_at: timestamp,
        updated_at: timestamp,
    };
    write_manifest(&plan.manifest_path, &manifest)
        .map_err(|error| error.for_transaction(&plan.transaction_id))?;

    let result = (|| {
        persist_state(
            &plan.manifest_path,
            &mut manifest,
            TransactionState::Staging,
        )?;
        for import in &mut manifest.imports {
            ensure_real_directory(import.staging_path.parent().expect("staging parent"))?;
            copy_tree(&import.source_path, &import.staging_path)?;
            let (_, fingerprint) = fingerprint_tree(&import.staging_path)?;
            if fingerprint != import.expected_fingerprint {
                return Err(MigrationError::new(
                    "staging_verification_failed",
                    "staging",
                    "staging 内容与扫描快照不一致。",
                    Some(import.staging_path.clone()),
                    Some(import.expected_fingerprint.clone()),
                    Some(fingerprint),
                    "从事务清单回滚，不要继续迁移。",
                    false,
                ));
            }
            import.result = OperationResult::Staged;
        }
        persist_state(
            &plan.manifest_path,
            &mut manifest,
            TransactionState::Staging,
        )?;

        for import in &mut manifest.imports {
            fs::rename(&import.staging_path, &import.final_path).map_err(|error| {
                MigrationError::io(
                    "store_import_failed",
                    "import",
                    "无法将 staging 内容提交到 Skill Store。",
                    &import.final_path,
                    error,
                    "从事务清单回滚，不要覆盖目标。",
                    false,
                )
            })?;
            let (_, fingerprint) = fingerprint_tree(&import.final_path)?;
            if fingerprint != import.expected_fingerprint {
                return Err(MigrationError::new(
                    "store_verification_failed",
                    "import",
                    "Skill Store 内容与扫描快照不一致。",
                    Some(import.final_path.clone()),
                    Some(import.expected_fingerprint.clone()),
                    Some(fingerprint),
                    "从事务清单回滚，不要移动用户入口。",
                    false,
                ));
            }
            import.result = OperationResult::Imported;
        }
        persist_state(
            &plan.manifest_path,
            &mut manifest,
            TransactionState::Imported,
        )?;

        for index in 0..manifest.recoveries.len() {
            let recovery = &manifest.recoveries[index];
            ensure_real_directory(recovery.recovery_path.parent().expect("recovery parent"))?;
            fs::rename(&recovery.original_path, &recovery.recovery_path).map_err(|error| {
                MigrationError::io(
                    "quarantine_failed",
                    "quarantine",
                    "无法将原用户入口移动到恢复区。",
                    &recovery.original_path,
                    error,
                    "从事务清单执行精确回滚。",
                    false,
                )
            })?;
            manifest.recoveries[index].result = OperationResult::Quarantined;
            persist_state(
                &plan.manifest_path,
                &mut manifest,
                TransactionState::Quarantined,
            )?;
        }

        persist_state(
            &plan.manifest_path,
            &mut manifest,
            TransactionState::Verifying,
        )?;
        for import in &manifest.imports {
            let (_, fingerprint) = fingerprint_tree(&import.final_path)?;
            if fingerprint != import.expected_fingerprint {
                return Err(MigrationError::new(
                    "final_verification_failed",
                    "verify",
                    "最终 Skill Store 指纹验证失败。",
                    Some(import.final_path.clone()),
                    Some(import.expected_fingerprint.clone()),
                    Some(fingerprint),
                    "停止操作并从事务清单回滚。",
                    false,
                ));
            }
        }
        persist_state(
            &plan.manifest_path,
            &mut manifest,
            TransactionState::Completed,
        )?;
        Ok(manifest.clone())
    })();

    match result {
        Ok(manifest) => Ok(manifest),
        Err(error) => {
            let _ = persist_state(
                &plan.manifest_path,
                &mut manifest,
                TransactionState::FailedPartial,
            );
            Err(error.for_transaction(&plan.transaction_id))
        }
    }
}

fn verify_recovery_entry(
    operation: &RecoveryOperation,
    transaction_id: &str,
) -> Result<(), MigrationError> {
    let metadata = fs::symlink_metadata(&operation.recovery_path).map_err(|error| {
        MigrationError::io(
            "rollback_drift",
            "rollback",
            "恢复区条目已缺失或不可读取。",
            &operation.recovery_path,
            error,
            "保留现场并人工检查事务清单。",
            false,
        )
        .for_transaction(transaction_id)
    })?;
    if identity(&metadata) != operation.expected_identity {
        return Err(MigrationError::new(
            "rollback_drift",
            "rollback",
            "恢复区条目的文件身份已变化。",
            Some(operation.recovery_path.clone()),
            Some(format!("{:?}", operation.expected_identity)),
            Some(format!("{:?}", identity(&metadata))),
            "保留现场并人工检查事务清单。",
            false,
        )
        .for_transaction(transaction_id));
    }
    match operation.entry_kind {
        EntryKind::Symlink => {
            let actual = fs::read_link(&operation.recovery_path).map_err(|error| {
                MigrationError::io(
                    "rollback_drift",
                    "rollback",
                    "无法读取恢复区符号链接。",
                    &operation.recovery_path,
                    error,
                    "保留现场并人工检查事务清单。",
                    false,
                )
                .for_transaction(transaction_id)
            })?;
            if Some(&actual) != operation.expected_link_text.as_ref() {
                return Err(MigrationError::new(
                    "rollback_drift",
                    "rollback",
                    "恢复区链接文本已变化。",
                    Some(operation.recovery_path.clone()),
                    operation
                        .expected_link_text
                        .as_ref()
                        .map(|path| path.display().to_string()),
                    Some(actual.display().to_string()),
                    "保留现场并人工检查事务清单。",
                    false,
                )
                .for_transaction(transaction_id));
            }
        }
        EntryKind::Directory => {
            let (_, actual) = fingerprint_tree(&operation.recovery_path)
                .map_err(|error| error.for_transaction(transaction_id))?;
            if actual != operation.expected_fingerprint {
                return Err(MigrationError::new(
                    "rollback_drift",
                    "rollback",
                    "恢复区 Skill 内容已变化。",
                    Some(operation.recovery_path.clone()),
                    Some(operation.expected_fingerprint.clone()),
                    Some(actual),
                    "保留现场并人工检查事务清单。",
                    false,
                )
                .for_transaction(transaction_id));
            }
        }
        _ => unreachable!("manifest only contains moved entries"),
    }
    Ok(())
}

fn remove_tree(path: &Path) -> Result<(), MigrationError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        MigrationError::io(
            "rollback_cleanup_failed",
            "rollback",
            "无法检查事务创建的 Store 内容。",
            path,
            error,
            "保留现场并人工检查事务清单。",
            false,
        )
    })?;
    if metadata.file_type().is_symlink() || metadata.is_file() {
        return fs::remove_file(path).map_err(|error| {
            MigrationError::io(
                "rollback_cleanup_failed",
                "rollback",
                "无法移除事务创建的条目。",
                path,
                error,
                "保留现场并人工检查事务清单。",
                false,
            )
        });
    }
    if !metadata.is_dir() {
        return Err(MigrationError::new(
            "rollback_drift",
            "rollback",
            "事务创建路径已变为不支持的文件类型。",
            Some(path.to_path_buf()),
            Some("directory".into()),
            Some(format!("mode {:o}", metadata.mode())),
            "保留现场并人工检查事务清单。",
            false,
        ));
    }
    let mut children = fs::read_dir(path)
        .map_err(|error| {
            MigrationError::io(
                "rollback_cleanup_failed",
                "rollback",
                "无法枚举事务创建的目录。",
                path,
                error,
                "保留现场并人工检查事务清单。",
                false,
            )
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            MigrationError::io(
                "rollback_cleanup_failed",
                "rollback",
                "无法读取事务创建的目录项。",
                path,
                error,
                "保留现场并人工检查事务清单。",
                false,
            )
        })?;
    children.sort_by_key(|entry| entry.file_name());
    for child in children {
        remove_tree(&child.path())?;
    }
    fs::remove_dir(path).map_err(|error| {
        MigrationError::io(
            "rollback_cleanup_failed",
            "rollback",
            "无法移除事务创建的目录。",
            path,
            error,
            "保留现场并人工检查事务清单。",
            false,
        )
    })
}

pub fn rollback_transaction(manifest_path: &Path) -> Result<TransactionManifest, MigrationError> {
    let contents = fs::read(manifest_path).map_err(|error| {
        MigrationError::io(
            "manifest_unreadable",
            "rollback",
            "无法读取事务清单。",
            manifest_path,
            error,
            "保留现场并选择有效事务清单。",
            false,
        )
    })?;
    let mut manifest: TransactionManifest = serde_json::from_slice(&contents).map_err(|error| {
        MigrationError::new(
            "manifest_invalid",
            "rollback",
            "事务清单格式无效。",
            Some(manifest_path.to_path_buf()),
            Some("TransactionManifest v1".into()),
            Some(error.to_string()),
            "保留现场并人工检查事务清单。",
            false,
        )
    })?;
    let transaction_id = manifest.transaction_id.clone();
    let store = canonical_real_directory(&manifest.store_root, "rollback", "Skill Store")?;
    let actual_store_identity = identity(&fs::symlink_metadata(&store).map_err(|error| {
        MigrationError::io(
            "store_drift",
            "rollback",
            "无法检查 Skill Store 身份。",
            &store,
            error,
            "保留现场并人工检查事务清单。",
            false,
        )
    })?);
    if store != manifest.store_root || actual_store_identity != manifest.store_identity {
        return Err(MigrationError::new(
            "store_drift",
            "rollback",
            "Skill Store 在事务后已被替换或改道。",
            Some(manifest.store_root.clone()),
            Some(format!(
                "{} {:?}",
                manifest.store_root.display(),
                manifest.store_identity
            )),
            Some(format!("{} {actual_store_identity:?}", store.display())),
            "保留现场并人工检查事务清单。",
            false,
        )
        .for_transaction(&transaction_id));
    }

    for recovery in manifest
        .recoveries
        .iter()
        .filter(|operation| operation.result == OperationResult::Quarantined)
    {
        inspect_absent(
            &recovery.original_path,
            "rollback",
            "rollback_destination_drift",
        )
        .map_err(|error| error.for_transaction(&transaction_id))?;
        verify_recovery_entry(recovery, &transaction_id)?;
    }
    for import in manifest
        .imports
        .iter()
        .filter(|operation| operation.result == OperationResult::Imported)
    {
        let canonical = fs::canonicalize(&import.final_path).map_err(|error| {
            MigrationError::io(
                "rollback_drift",
                "rollback",
                "事务创建的 Store 内容已缺失。",
                &import.final_path,
                error,
                "保留现场并人工检查事务清单。",
                false,
            )
            .for_transaction(&transaction_id)
        })?;
        if !canonical.starts_with(&manifest.store_root) || canonical == manifest.store_root {
            return Err(MigrationError::new(
                "store_boundary",
                "rollback",
                "待移除内容越过 Skill Store 边界。",
                Some(canonical),
                Some(manifest.store_root.display().to_string()),
                Some(import.final_path.display().to_string()),
                "保留现场并人工检查事务清单。",
                false,
            )
            .for_transaction(&transaction_id));
        }
        let (_, actual) = fingerprint_tree(&import.final_path)
            .map_err(|error| error.for_transaction(&transaction_id))?;
        if actual != import.expected_fingerprint {
            return Err(MigrationError::new(
                "rollback_drift",
                "rollback",
                "事务创建的 Store 内容已变化。",
                Some(import.final_path.clone()),
                Some(import.expected_fingerprint.clone()),
                Some(actual),
                "保留现场并人工检查事务清单。",
                false,
            )
            .for_transaction(&transaction_id));
        }
    }

    persist_state(manifest_path, &mut manifest, TransactionState::RollingBack)?;
    for index in 0..manifest.recoveries.len() {
        if manifest.recoveries[index].result != OperationResult::Quarantined {
            continue;
        }
        let recovery = &manifest.recoveries[index];
        fs::rename(&recovery.recovery_path, &recovery.original_path).map_err(|error| {
            MigrationError::io(
                "rollback_restore_failed",
                "rollback",
                "无法恢复原用户入口。",
                &recovery.original_path,
                error,
                "停止操作并人工检查事务清单。",
                false,
            )
            .for_transaction(&transaction_id)
        })?;
        manifest.recoveries[index].result = OperationResult::Restored;
        persist_state(manifest_path, &mut manifest, TransactionState::RollingBack)?;
    }
    for index in 0..manifest.imports.len() {
        if manifest.imports[index].result != OperationResult::Imported {
            continue;
        }
        let import = &manifest.imports[index];
        remove_tree(&import.final_path).map_err(|error| error.for_transaction(&transaction_id))?;
        manifest.imports[index].result = OperationResult::RolledBack;
        persist_state(manifest_path, &mut manifest, TransactionState::RollingBack)?;
    }
    persist_state(manifest_path, &mut manifest, TransactionState::RolledBack)?;
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn set_symlink_mode(path: &Path, mode: u32) {
        let path = CString::new(path.as_os_str().as_bytes()).unwrap();
        let result = unsafe {
            libc::fchmodat(
                libc::AT_FDCWD,
                path.as_ptr(),
                mode as libc::mode_t,
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        assert_eq!(result, 0, "{}", io::Error::last_os_error());
    }

    fn write_skill(path: &Path, name: &str, body: &str) {
        fs::create_dir_all(path).unwrap();
        fs::write(
            path.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: test skill\nversion: 1.0.0\n---\n\n{body}\n"),
        )
        .unwrap();
    }

    fn root(id: &str, path: &Path) -> InventoryRoot {
        InventoryRoot {
            root_id: id.into(),
            agent_id: id.into(),
            edition: None,
            path: path.to_path_buf(),
        }
    }

    #[test]
    fn store_must_be_disjoint_from_discovery_roots_and_not_a_symlink() {
        let fixture = TempDir::new().unwrap();
        let discovery = fixture.path().join("agent-skills");
        let nested_store = discovery.join("store");
        let safe_store = fixture.path().join("store");
        let project = fixture.path().join("workspace/project");
        fs::create_dir_all(&nested_store).unwrap();
        fs::create_dir(&safe_store).unwrap();
        fs::create_dir_all(&project).unwrap();

        let error = validate_store(&nested_store, std::slice::from_ref(&discovery)).unwrap_err();
        assert_eq!(error.code, "unsafe_store_relationship");

        let store_link = fixture.path().join("store-link");
        symlink(&safe_store, &store_link).unwrap();
        let error = validate_store(&store_link, std::slice::from_ref(&discovery)).unwrap_err();
        assert_eq!(error.code, "unsafe_directory");
        let error =
            validate_store(project.parent().unwrap(), std::slice::from_ref(&project)).unwrap_err();
        assert_eq!(error.code, "unsafe_store_relationship");
        assert_eq!(
            validate_store(&safe_store, &[discovery]).unwrap(),
            fs::canonicalize(safe_store).unwrap()
        );
    }

    #[test]
    fn inventory_dedupes_canonical_routes_but_keeps_copies_and_variants_distinct() {
        let fixture = TempDir::new().unwrap();
        let root_a = fixture.path().join("a");
        let root_b = fixture.path().join("b");
        let shared = fixture.path().join("shared/alpha");
        fs::create_dir_all(&root_a).unwrap();
        fs::create_dir_all(&root_b).unwrap();
        write_skill(&shared, "alpha", "same");
        write_skill(&root_b.join("alpha-copy"), "alpha", "same");
        write_skill(&root_b.join("alpha-variant"), "alpha", "different");
        symlink(&shared, root_a.join("alpha")).unwrap();
        symlink(&shared, root_b.join("alpha-linked")).unwrap();

        let snapshot = scan_inventory(&[root("a", &root_a), root("b", &root_b)]).unwrap();
        assert_eq!(snapshot.routes.len(), 4);
        assert_eq!(snapshot.artifacts.len(), 3);
        let linked_ids = snapshot
            .routes
            .iter()
            .filter(|route| {
                route.entry_path.ends_with("alpha") || route.entry_path.ends_with("alpha-linked")
            })
            .map(|route| route.artifact_id.clone().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(linked_ids[0], linked_ids[1]);
        assert_eq!(snapshot.duplicate_fingerprint_groups.len(), 1);
        assert_eq!(snapshot.variant_groups.len(), 1);
        assert_eq!(snapshot.variant_groups[0].len(), 3);
    }

    #[test]
    fn invalid_frontmatter_blocks_import_planning() {
        let fixture = TempDir::new().unwrap();
        let root_path = fixture.path().join("skills");
        let store = fixture.path().join("store");
        fs::create_dir_all(root_path.join("broken")).unwrap();
        fs::create_dir(&store).unwrap();
        fs::write(root_path.join("broken/SKILL.md"), "name: broken\n").unwrap();

        let roots = vec![root("codex", &root_path)];
        let snapshot = scan_inventory(&roots).unwrap();
        assert_eq!(snapshot.artifacts[0].parse_status, ParseStatus::Blocked);
        let error = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap_err();
        assert_eq!(error.code, "blocked_skill_declaration");
    }

    #[test]
    fn identical_copies_import_once_and_move_every_matching_route_to_recovery() {
        let fixture = TempDir::new().unwrap();
        let root_a = fixture.path().join("codex");
        let root_b = fixture.path().join("claude");
        let store = fixture.path().join("store");
        fs::create_dir_all(&root_a).unwrap();
        fs::create_dir_all(&root_b).unwrap();
        fs::create_dir(&store).unwrap();
        write_skill(&root_a.join("alpha"), "alpha", "same");
        write_skill(&root_b.join("alpha-copy"), "alpha", "same");
        let roots = vec![root("codex", &root_a), root("claude", &root_b)];
        let snapshot = scan_inventory(&roots).unwrap();
        assert_eq!(snapshot.artifacts.len(), 2);
        assert_eq!(snapshot.duplicate_fingerprint_groups.len(), 1);

        let plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();

        assert_eq!(plan.imports.len(), 1);
        assert_eq!(plan.recoveries.len(), 2);
        let canonical_root_a = fs::canonicalize(&root_a).unwrap();
        let canonical_root_b = fs::canonicalize(&root_b).unwrap();
        assert!(plan
            .recoveries
            .iter()
            .any(|operation| operation.original_path == canonical_root_a.join("alpha")));
        assert!(plan
            .recoveries
            .iter()
            .any(|operation| operation.original_path == canonical_root_b.join("alpha-copy")));
    }

    #[test]
    fn import_quarantines_user_entries_and_exact_rollback_restores_them() {
        let fixture = TempDir::new().unwrap();
        let root_a = fixture.path().join("codex");
        let root_b = fixture.path().join("pi");
        let store = fixture.path().join("store");
        let source = root_a.join("alpha");
        fs::create_dir_all(&root_b).unwrap();
        fs::create_dir(&store).unwrap();
        write_skill(&source, "alpha", "hello");
        symlink(&source, root_b.join("alpha")).unwrap();
        let roots = vec![root("codex", &root_a), root("pi", &root_b)];
        let snapshot = scan_inventory(&roots).unwrap();
        let plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();

        let manifest = execute_import(&plan).unwrap();
        assert_eq!(manifest.state, TransactionState::Completed);
        assert!(store.join("alpha/SKILL.md").is_file());
        assert!(fs::symlink_metadata(&source).is_err());
        assert!(fs::symlink_metadata(root_b.join("alpha")).is_err());
        assert!(manifest
            .recoveries
            .iter()
            .all(|operation| fs::symlink_metadata(&operation.recovery_path).is_ok()));

        let rolled_back = rollback_transaction(&plan.manifest_path).unwrap();
        assert_eq!(rolled_back.state, TransactionState::RolledBack);
        assert!(source.join("SKILL.md").is_file());
        assert!(fs::symlink_metadata(root_b.join("alpha"))
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::symlink_metadata(store.join("alpha")).is_err());
    }

    #[test]
    fn import_preserves_internal_symlink_mode_through_migration_and_rollback() {
        let fixture = TempDir::new().unwrap();
        let root_path = fixture.path().join("skills");
        let store = fixture.path().join("store");
        let source = root_path.join("alpha");
        let internal_target = source.join("scripts/venv/bin/python3.14");
        let internal_link = source.join("scripts/venv/bin/python");
        fs::create_dir(&store).unwrap();
        write_skill(&source, "alpha", "hello");
        fs::create_dir_all(internal_target.parent().unwrap()).unwrap();
        fs::write(&internal_target, "python fixture").unwrap();
        symlink("python3.14", &internal_link).unwrap();
        set_symlink_mode(&internal_link, 0o700);
        assert_eq!(
            fs::symlink_metadata(&internal_link).unwrap().mode() & 0o7777,
            0o700
        );

        let roots = vec![root("codex", &root_path)];
        let snapshot = scan_inventory(&roots).unwrap();
        let expected_fingerprint = snapshot.artifacts[0].content_fingerprint.clone();
        let plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();

        let manifest = execute_import(&plan).unwrap();
        assert_eq!(manifest.state, TransactionState::Completed);
        let store_link = store.join("alpha/scripts/venv/bin/python");
        assert_eq!(
            fs::symlink_metadata(&store_link).unwrap().mode() & 0o7777,
            0o700
        );
        assert_eq!(
            fingerprint_tree(&store.join("alpha")).unwrap().1,
            expected_fingerprint
        );
        assert!(fs::symlink_metadata(&source).is_err());
        assert!(manifest
            .recoveries
            .iter()
            .all(|operation| operation.result == OperationResult::Quarantined));

        let rolled_back = rollback_transaction(&plan.manifest_path).unwrap();
        assert_eq!(rolled_back.state, TransactionState::RolledBack);
        assert_eq!(
            fs::symlink_metadata(source.join("scripts/venv/bin/python"))
                .unwrap()
                .mode()
                & 0o7777,
            0o700
        );
        assert_eq!(fingerprint_tree(&source).unwrap().1, expected_fingerprint);
        assert!(fs::symlink_metadata(store.join("alpha")).is_err());
    }

    #[test]
    fn source_drift_blocks_execution_before_any_mutation() {
        let fixture = TempDir::new().unwrap();
        let root_path = fixture.path().join("skills");
        let store = fixture.path().join("store");
        let source = root_path.join("alpha");
        fs::create_dir(&store).unwrap();
        write_skill(&source, "alpha", "before");
        let roots = vec![root("codex", &root_path)];
        let snapshot = scan_inventory(&roots).unwrap();
        let plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();
        fs::write(source.join("extra.txt"), "drift").unwrap();

        let error = execute_import(&plan).unwrap_err();
        assert_eq!(error.code, "source_drift");
        assert!(source.is_dir());
        assert!(fs::symlink_metadata(store.join("alpha")).is_err());
        assert!(fs::symlink_metadata(&plan.manifest_path).is_err());
    }

    #[test]
    fn store_identity_drift_blocks_execution_before_any_mutation() {
        let fixture = TempDir::new().unwrap();
        let root_path = fixture.path().join("skills");
        let store = fixture.path().join("store");
        let original_store = fixture.path().join("store-before-plan");
        let source = root_path.join("alpha");
        fs::create_dir(&store).unwrap();
        write_skill(&source, "alpha", "before");
        let roots = vec![root("codex", &root_path)];
        let snapshot = scan_inventory(&roots).unwrap();
        let plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();
        fs::rename(&store, &original_store).unwrap();
        fs::create_dir(&store).unwrap();

        let error = execute_import(&plan).unwrap_err();
        assert_eq!(error.code, "store_drift");
        assert!(source.is_dir());
        assert!(fs::read_dir(&store).unwrap().next().is_none());
        assert!(fs::symlink_metadata(&plan.manifest_path).is_err());
    }

    #[test]
    fn rollback_drift_blocks_all_restoration_before_mutation() {
        let fixture = TempDir::new().unwrap();
        let root_path = fixture.path().join("skills");
        let store = fixture.path().join("store");
        let source = root_path.join("alpha");
        fs::create_dir(&store).unwrap();
        write_skill(&source, "alpha", "hello");
        let roots = vec![root("codex", &root_path)];
        let snapshot = scan_inventory(&roots).unwrap();
        let plan = build_import_plan(
            &snapshot,
            &store,
            &roots,
            &[],
            &[snapshot.artifacts[0].artifact_id.clone()],
        )
        .unwrap();
        let manifest = execute_import(&plan).unwrap();
        fs::write(&source, "unrelated replacement").unwrap();

        let error = rollback_transaction(&plan.manifest_path).unwrap_err();
        assert_eq!(error.code, "rollback_destination_drift");
        assert!(store.join("alpha/SKILL.md").is_file());
        assert!(manifest.recoveries[0].recovery_path.is_dir());
        assert!(source.is_file());
    }
}
