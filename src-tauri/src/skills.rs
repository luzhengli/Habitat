use pathdiff::diff_paths;
use serde::Serialize;
use std::ffi::OsStr;
use std::fmt;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const SKILLS_RELATIVE_PATH: &str = ".agents/skills";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub stderr: String,
    pub recovery: String,
}

impl AppError {
    fn new(code: &str, message: impl Into<String>, recovery: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            stderr: String::new(),
            recovery: recovery.into(),
        }
    }

    fn io(code: &str, context: &str, error: io::Error, recovery: &str) -> Self {
        Self {
            code: code.into(),
            message: context.into(),
            stderr: error.to_string(),
            recovery: recovery.into(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub version: String,
    pub source_path: String,
    pub source_kind: String,
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreScan {
    pub root: String,
    pub name: String,
    pub skills: Vec<Skill>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LinkState {
    Valid,
    Broken,
    Conflict,
    OutsideStore,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSkill {
    pub name: String,
    pub target_path: String,
    pub relative_target: Option<String>,
    pub state: LinkState,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScan {
    pub root: String,
    pub name: String,
    pub skills_directory: String,
    pub links: Vec<ProjectSkill>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CheckStatus {
    Pass,
    Warning,
    Fail,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckItem {
    pub id: String,
    pub label: String,
    pub status: CheckStatus,
    pub detail: String,
    pub recovery: Option<String>,
}

impl CheckItem {
    fn pass(id: &str, label: &str, detail: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            status: CheckStatus::Pass,
            detail: detail.into(),
            recovery: None,
        }
    }

    fn warning(id: &str, label: &str, detail: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            status: CheckStatus::Warning,
            detail: detail.into(),
            recovery: None,
        }
    }

    fn fail(id: &str, label: &str, detail: impl Into<String>, recovery: &str) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            status: CheckStatus::Fail,
            detail: detail.into(),
            recovery: Some(recovery.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preflight {
    pub source_path: String,
    pub target_path: String,
    pub relative_link: String,
    pub can_link: bool,
    pub already_linked: bool,
    pub checks: Vec<CheckItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInspection {
    pub skill: Skill,
    pub preflight: Preflight,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub status: Option<i32>,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

fn canonical_directory(path: &str, label: &str) -> Result<PathBuf, AppError> {
    let requested = Path::new(path);
    let canonical = fs::canonicalize(requested).map_err(|error| {
        AppError::io(
            "path_unavailable",
            &format!("无法读取{label}：{}", requested.display()),
            error,
            "确认目录仍然存在且 Habitat 有读取权限，然后重新选择。",
        )
    })?;
    if !canonical.is_dir() {
        return Err(AppError::new(
            "not_directory",
            format!("{label}不是目录：{}", canonical.display()),
            "请选择一个真实目录。",
        ));
    }
    Ok(canonical)
}

fn safe_name(name: &str) -> Result<(), AppError> {
    let path = Path::new(name);
    if name.is_empty()
        || name == "."
        || name == ".."
        || path.components().count() != 1
        || path.file_name() != Some(OsStr::new(name))
    {
        return Err(AppError::new(
            "invalid_skill_name",
            format!("技能名称不是安全的单一路径段：{name}"),
            "使用不含斜杠、点路径或空值的技能目录名。",
        ));
    }
    Ok(())
}

fn path_name(path: &Path) -> String {
    path.file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("未命名")
        .to_string()
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn modified_millis(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn frontmatter_value(contents: &str, key: &str) -> Option<String> {
    let mut lines = contents.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    for line in lines {
        if line.trim() == "---" {
            break;
        }
        let Some((candidate, value)) = line.split_once(':') else {
            continue;
        };
        if candidate.trim() == key {
            return Some(value.trim().trim_matches(['\'', '"']).to_string());
        }
    }
    None
}

fn read_skill(path: &Path, source_kind: &str) -> Result<Skill, AppError> {
    let skill_file = path.join("SKILL.md");
    let contents = fs::read_to_string(&skill_file).map_err(|error| {
        AppError::io(
            "invalid_skill",
            &format!("无法读取技能声明：{}", skill_file.display()),
            error,
            "确认 SKILL.md 是可读取的 UTF-8 文本。",
        )
    })?;
    let fallback_name = path_name(path);
    let name = frontmatter_value(&contents, "name").unwrap_or(fallback_name);
    safe_name(&name)?;
    Ok(Skill {
        name,
        description: frontmatter_value(&contents, "description")
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "未声明描述".into()),
        version: frontmatter_value(&contents, "version")
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "未声明".into()),
        source_path: display(path),
        source_kind: source_kind.into(),
        modified_at: modified_millis(&skill_file),
    })
}

fn scan_skill_parent(store: &Path, parent: &Path, source_kind: &str) -> Result<Vec<Skill>, AppError> {
    if !parent.exists() {
        return Ok(Vec::new());
    }
    let metadata = fs::symlink_metadata(parent).map_err(|error| {
        AppError::io(
            "store_scan_failed",
            &format!("无法检查技能目录：{}", parent.display()),
            error,
            "检查技能库权限后重试。",
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(AppError::new(
            "unsafe_store_layout",
            format!("技能容器必须是真实目录：{}", parent.display()),
            "将技能容器恢复为技能库内的真实目录。",
        ));
    }

    let mut skills = Vec::new();
    for entry in fs::read_dir(parent).map_err(|error| {
        AppError::io(
            "store_scan_failed",
            &format!("无法扫描技能目录：{}", parent.display()),
            error,
            "检查技能库权限后重试。",
        )
    })? {
        let entry = entry.map_err(|error| {
            AppError::io(
                "store_scan_failed",
                "读取技能目录项失败。",
                error,
                "检查技能库目录权限后重试。",
            )
        })?;
        let candidate = entry.path();
        let entry_metadata = fs::symlink_metadata(&candidate).map_err(|error| {
            AppError::io(
                "store_scan_failed",
                &format!("无法检查目录项：{}", candidate.display()),
                error,
                "检查该目录项的权限。",
            )
        })?;
        if entry_metadata.file_type().is_symlink() || !entry_metadata.is_dir() {
            continue;
        }
        if !candidate.join("SKILL.md").is_file() {
            continue;
        }
        let canonical = fs::canonicalize(&candidate).map_err(|error| {
            AppError::io(
                "store_scan_failed",
                &format!("无法规范化技能路径：{}", candidate.display()),
                error,
                "确认技能目录可读取。",
            )
        })?;
        if !canonical.starts_with(store) {
            return Err(AppError::new(
                "store_boundary",
                format!("技能路径越过技能库边界：{}", canonical.display()),
                "把技能移动回已选择的技能库内。",
            ));
        }
        skills.push(read_skill(&canonical, source_kind)?);
    }
    Ok(skills)
}

pub fn scan_store(store_path: &str) -> Result<StoreScan, AppError> {
    let root = canonical_directory(store_path, "技能库")?;
    let mut skills = scan_skill_parent(&root, &root, "技能库根目录")?;
    skills.extend(scan_skill_parent(
        &root,
        &root.join(SKILLS_RELATIVE_PATH),
        ".agents/skills",
    )?);
    skills.sort_by(|left, right| left.name.cmp(&right.name));
    for pair in skills.windows(2) {
        if pair[0].name == pair[1].name {
            return Err(AppError::new(
                "duplicate_skill",
                format!("技能库中存在重名技能：{}", pair[0].name),
                "保留一个权威技能目录，或修改其中一个 SKILL.md 的 name。",
            ));
        }
    }
    Ok(StoreScan {
        root: display(&root),
        name: path_name(&root),
        skills,
    })
}

fn resolve_skill(store_path: &str, skill_name: &str) -> Result<(PathBuf, Skill), AppError> {
    safe_name(skill_name)?;
    let store = scan_store(store_path)?;
    let skill = store
        .skills
        .into_iter()
        .find(|skill| skill.name == skill_name)
        .ok_or_else(|| {
            AppError::new(
                "skill_not_found",
                format!("技能库中没有找到 {skill_name}"),
                "重新扫描技能库，或确认 SKILL.md 中的 name 与目录选择一致。",
            )
        })?;
    let source = fs::canonicalize(&skill.source_path).map_err(|error| {
        AppError::io(
            "skill_not_found",
            &format!("技能源目录已不可读取：{}", skill.source_path),
            error,
            "重新扫描技能库。",
        )
    })?;
    let store_root = PathBuf::from(&store.root);
    if !source.starts_with(&store_root) {
        return Err(AppError::new(
            "store_boundary",
            format!("技能源目录越过技能库边界：{}", source.display()),
            "只选择技能库根目录或其 .agents/skills 下的技能。",
        ));
    }
    Ok((source, skill))
}

fn lexical_normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

fn project_paths(project_path: &str) -> Result<(PathBuf, PathBuf, PathBuf), AppError> {
    let project = canonical_directory(project_path, "项目")?;
    let agents = project.join(".agents");
    let skills = agents.join("skills");
    if !skills.starts_with(&project) {
        return Err(AppError::new(
            "project_boundary",
            "项目技能目录越过项目边界。",
            "重新选择项目目录。",
        ));
    }
    for (label, path) in [(".agents", &agents), (".agents/skills", &skills)] {
        match fs::symlink_metadata(path) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(AppError::new(
                    "unsafe_project_layout",
                    format!("{label} 不能是符号链接：{}", path.display()),
                    "将该容器恢复为项目内的真实目录。",
                ));
            }
            Ok(metadata) if !metadata.is_dir() => {
                return Err(AppError::new(
                    "unsafe_project_layout",
                    format!("{label} 必须是目录：{}", path.display()),
                    "移走冲突文件，再重试。",
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(AppError::io(
                    "project_scan_failed",
                    &format!("无法检查项目路径：{}", path.display()),
                    error,
                    "检查项目目录权限后重试。",
                ));
            }
        }
    }
    Ok((project, agents, skills))
}

fn link_target_absolute(link_path: &Path, raw_target: &Path) -> PathBuf {
    if raw_target.is_absolute() {
        lexical_normalize(raw_target)
    } else {
        lexical_normalize(&link_path.parent().unwrap_or(Path::new("/")).join(raw_target))
    }
}

fn inspect_existing_target(target: &Path, source: &Path) -> Result<(bool, CheckItem), AppError> {
    match fs::symlink_metadata(target) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok((
            false,
            CheckItem::pass("target", "目标位置可用", "目标尚不存在，不会覆盖任何内容。"),
        )),
        Err(error) => Err(AppError::io(
            "target_inspection_failed",
            &format!("无法检查目标位置：{}", target.display()),
            error,
            "检查项目目录权限后重试。",
        )),
        Ok(metadata) if !metadata.file_type().is_symlink() => {
            let kind = if metadata.is_dir() { "真实目录" } else { "普通文件" };
            Ok((
                false,
                CheckItem::fail(
                    "target",
                    "目标位置存在冲突",
                    format!("目标已存在{kind}，Habitat 不会覆盖。"),
                    "移走或重命名冲突内容后重新预检。",
                ),
            ))
        }
        Ok(_) => {
            let raw_target = fs::read_link(target).map_err(|error| {
                AppError::io(
                    "target_inspection_failed",
                    &format!("无法读取符号链接：{}", target.display()),
                    error,
                    "检查链接权限后重试。",
                )
            })?;
            let absolute = link_target_absolute(target, &raw_target);
            match fs::canonicalize(&absolute) {
                Ok(existing) if existing == source => Ok((
                    true,
                    CheckItem::pass("target", "目标已安全链接", "现有链接已指向同一技能源，重复添加不会改写它。"),
                )),
                Ok(existing) => Ok((
                    false,
                    CheckItem::fail(
                        "target",
                        "目标位置是未知链接",
                        format!("现有链接指向 {}", existing.display()),
                        "请在 Finder 或终端中人工确认并处理该链接；Habitat 不会覆盖。",
                    ),
                )),
                Err(_) => Ok((
                    false,
                    CheckItem::fail(
                        "target",
                        "目标位置是失效链接",
                        format!("现有链接指向不存在的位置：{}", absolute.display()),
                        "人工确认失效链接后移走它，再重新预检。",
                    ),
                )),
            }
        }
    }
}

pub fn preflight_link(
    store_path: &str,
    project_path: &str,
    skill_name: &str,
) -> Result<Preflight, AppError> {
    let (source, _) = resolve_skill(store_path, skill_name)?;
    let (project, _, skills) = project_paths(project_path)?;
    let target = skills.join(skill_name);
    let relative = diff_paths(&source, &skills).ok_or_else(|| {
        AppError::new(
            "relative_path_failed",
            "无法计算相对符号链接路径。",
            "确认技能库与项目位于同一 macOS 文件系统可寻址范围。",
        )
    })?;
    let mut checks = vec![
        CheckItem::pass("source", "源技能目录存在", display(&source)),
        CheckItem::pass("project", "目标项目目录存在", display(&project)),
        CheckItem::pass("source_boundary", "源路径位于技能库内", "已 canonicalize 并验证边界。"),
        CheckItem::pass("project_boundary", "目标路径位于项目内", display(&target)),
        CheckItem::pass("name", "无同名路径注入", skill_name),
        CheckItem::pass("relative", "相对链接路径有效", display(&relative)),
    ];
    let (already_linked, target_check) = inspect_existing_target(&target, &source)?;
    checks.insert(2, target_check);

    if project.join(".git").exists() {
        let git = run_command(&project, "git", &["status", "--short"]);
        match git {
            Ok(result) if result.success && result.stdout.trim().is_empty() => checks.push(
                CheckItem::pass("git", "Git 工作区干净", "未发现未提交变更。"),
            ),
            Ok(result) if result.success => checks.push(CheckItem::warning(
                "git",
                "Git 工作区有未提交变更",
                "Habitat 只展示状态；只有点击主操作才会创建或解除目标链接。",
            )),
            Ok(result) => checks.push(CheckItem::warning(
                "git",
                "Git 状态不可用",
                result.stderr,
            )),
            Err(error) => checks.push(CheckItem::warning("git", "Git 状态不可用", error.stderr)),
        }
    } else {
        checks.push(CheckItem::warning(
            "git",
            "项目尚未初始化 Git",
            "链接操作仍可显式执行，但没有 Git 变更保护视图。",
        ));
    }

    let can_link = !checks.iter().any(|check| check.status == CheckStatus::Fail);
    Ok(Preflight {
        source_path: display(&source),
        target_path: display(&target),
        relative_link: display(&relative),
        can_link,
        already_linked,
        checks,
    })
}

#[cfg(unix)]
fn create_symlink(source: &Path, target: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(source, target)
}

#[cfg(not(unix))]
compile_error!("Habitat prototype supports macOS/Unix symlinks only.");

pub fn link_skill(
    store_path: &str,
    project_path: &str,
    skill_name: &str,
) -> Result<Preflight, AppError> {
    let preflight = preflight_link(store_path, project_path, skill_name)?;
    if !preflight.can_link {
        return Err(AppError::new(
            "preflight_failed",
            "预检未通过，未创建符号链接。",
            "按失败项的恢复说明处理后重新预检。",
        ));
    }
    if preflight.already_linked {
        return Ok(preflight);
    }
    let (_, agents, skills) = project_paths(project_path)?;
    if !agents.exists() {
        fs::create_dir(&agents).map_err(|error| {
            AppError::io(
                "create_container_failed",
                &format!("无法创建项目目录：{}", agents.display()),
                error,
                "检查项目写入权限后重试。",
            )
        })?;
    }
    if !skills.exists() {
        fs::create_dir(&skills).map_err(|error| {
            AppError::io(
                "create_container_failed",
                &format!("无法创建项目目录：{}", skills.display()),
                error,
                "检查项目写入权限后重试。",
            )
        })?;
    }
    let target = PathBuf::from(&preflight.target_path);
    create_symlink(Path::new(&preflight.relative_link), &target).map_err(|error| {
        AppError::io(
            "link_failed",
            &format!("无法创建符号链接：{}", target.display()),
            error,
            "确认目标仍不存在且项目目录可写，然后重新预检。",
        )
    })?;
    preflight_link(store_path, project_path, skill_name)
}

pub fn unlink_skill(
    store_path: &str,
    project_path: &str,
    skill_name: &str,
) -> Result<(), AppError> {
    let (source, _) = resolve_skill(store_path, skill_name)?;
    let (_, _, skills) = project_paths(project_path)?;
    let target = skills.join(skill_name);
    let metadata = fs::symlink_metadata(&target).map_err(|error| {
        AppError::io(
            "link_missing",
            &format!("项目链接不存在：{}", target.display()),
            error,
            "重新扫描项目后再试。",
        )
    })?;
    if !metadata.file_type().is_symlink() {
        return Err(AppError::new(
            "not_a_symlink",
            format!("目标不是符号链接，Habitat 不会删除：{}", target.display()),
            "在 Finder 或终端中人工检查冲突内容。",
        ));
    }
    let raw = fs::read_link(&target).map_err(|error| {
        AppError::io(
            "link_read_failed",
            &format!("无法读取链接：{}", target.display()),
            error,
            "检查链接权限后重试。",
        )
    })?;
    let absolute = link_target_absolute(&target, &raw);
    let linked_source = fs::canonicalize(&absolute).map_err(|error| {
        AppError::io(
            "broken_link",
            &format!("链接目标已失效：{}", absolute.display()),
            error,
            "人工确认该失效链接后处理；Habitat 不会猜测并删除未知链接。",
        )
    })?;
    if linked_source != source {
        return Err(AppError::new(
            "unknown_link",
            format!("链接指向其他位置：{}", linked_source.display()),
            "人工确认链接归属；Habitat 不会解除未知链接。",
        ));
    }
    fs::remove_file(&target).map_err(|error| {
        AppError::io(
            "unlink_failed",
            &format!("无法解除链接：{}", target.display()),
            error,
            "检查项目写入权限后重试。",
        )
    })?;
    if !source.join("SKILL.md").is_file() {
        return Err(AppError::new(
            "source_changed",
            "链接已解除，但源技能验证失败。",
            "检查技能库源目录；Habitat 没有删除源文件。",
        ));
    }
    Ok(())
}

pub fn scan_project(project_path: &str, store_path: &str) -> Result<ProjectScan, AppError> {
    let store = canonical_directory(store_path, "技能库")?;
    let (project, _, skills) = project_paths(project_path)?;
    let mut links = Vec::new();
    if skills.exists() {
        for entry in fs::read_dir(&skills).map_err(|error| {
            AppError::io(
                "project_scan_failed",
                &format!("无法扫描项目技能目录：{}", skills.display()),
                error,
                "检查项目目录权限后重试。",
            )
        })? {
            let entry = entry.map_err(|error| {
                AppError::io(
                    "project_scan_failed",
                    "读取项目技能目录项失败。",
                    error,
                    "检查项目目录权限后重试。",
                )
            })?;
            let target = entry.path();
            let name = path_name(&target);
            let metadata = fs::symlink_metadata(&target).map_err(|error| {
                AppError::io(
                    "project_scan_failed",
                    &format!("无法检查项目技能：{}", target.display()),
                    error,
                    "检查该目录项权限。",
                )
            })?;
            if !metadata.file_type().is_symlink() {
                links.push(ProjectSkill {
                    name,
                    target_path: display(&target),
                    relative_target: None,
                    state: LinkState::Conflict,
                    detail: "目标是普通文件或真实目录，不会覆盖。".into(),
                });
                continue;
            }
            let raw = fs::read_link(&target).map_err(|error| {
                AppError::io(
                    "project_scan_failed",
                    &format!("无法读取链接：{}", target.display()),
                    error,
                    "检查链接权限。",
                )
            })?;
            let absolute = link_target_absolute(&target, &raw);
            let relative_target = Some(display(&raw));
            match fs::canonicalize(&absolute) {
                Err(_) => links.push(ProjectSkill {
                    name,
                    target_path: display(&target),
                    relative_target,
                    state: LinkState::Broken,
                    detail: format!("链接目标不存在：{}", absolute.display()),
                }),
                Ok(source) if !source.starts_with(&store) => links.push(ProjectSkill {
                    name,
                    target_path: display(&target),
                    relative_target,
                    state: LinkState::OutsideStore,
                    detail: format!("链接目标位于当前技能库之外：{}", source.display()),
                }),
                Ok(source) if !source.join("SKILL.md").is_file() => links.push(ProjectSkill {
                    name,
                    target_path: display(&target),
                    relative_target,
                    state: LinkState::Broken,
                    detail: "链接目标缺少 SKILL.md。".into(),
                }),
                Ok(source) => links.push(ProjectSkill {
                    name,
                    target_path: display(&target),
                    relative_target,
                    state: LinkState::Valid,
                    detail: format!("已验证指向技能库：{}", source.display()),
                }),
            }
        }
    }
    links.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(ProjectScan {
        root: display(&project),
        name: path_name(&project),
        skills_directory: display(&skills),
        links,
    })
}

pub fn inspect_skill(
    store_path: &str,
    project_path: &str,
    skill_name: &str,
) -> Result<SkillInspection, AppError> {
    let (_, skill) = resolve_skill(store_path, skill_name)?;
    let preflight = preflight_link(store_path, project_path, skill_name)?;
    Ok(SkillInspection { skill, preflight })
}

fn run_command(cwd: &Path, program: &str, args: &[&str]) -> Result<CommandResult, AppError> {
    let output = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|error| {
            AppError::io(
                "command_failed",
                &format!("无法启动受限命令：{program}"),
                error,
                "确认程序已安装并可从 Habitat 的 PATH 访问。",
            )
        })?;
    Ok(CommandResult {
        program: program.into(),
        args: args.iter().map(|value| (*value).to_string()).collect(),
        cwd: display(cwd),
        status: output.status.code(),
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

fn project_command_is_allowed(program: &str, args: &[&str]) -> bool {
    matches!(
        (program, args),
        ("git", ["status", "--short"])
            | ("git", ["diff"])
            | ("npx", ["skills", "list", "--project", "--json"])
    )
}

pub fn run_project_command(
    project_path: &str,
    program: &str,
    args: &[&str],
) -> Result<CommandResult, AppError> {
    let project = canonical_directory(project_path, "项目")?;
    if !project_command_is_allowed(program, args) {
        return Err(AppError::new(
            "command_not_allowed",
            "请求的程序或参数不在 Habitat 允许列表中。",
            "只能使用界面提供的 Git 与 npx skills 检查操作。",
        ));
    }
    run_command(&project, program, args)
}

pub fn inspect_git_status_for_capture(project_path: &str) -> Result<CommandResult, AppError> {
    run_project_command(project_path, "git", &["status", "--short"])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;
    use tempfile::TempDir;

    struct Fixture {
        _temp: TempDir,
        store: PathBuf,
        project: PathBuf,
        source: PathBuf,
        target: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let temp = tempfile::tempdir().unwrap();
            let store = temp.path().join("store");
            let project = temp.path().join("project");
            let source = store.join("example");
            let target = project.join(".agents/skills/example");
            fs::create_dir_all(&source).unwrap();
            fs::create_dir_all(target.parent().unwrap()).unwrap();
            fs::write(
                source.join("SKILL.md"),
                "---\nname: example\ndescription: Test skill\nversion: 1.0.0\n---\n",
            )
            .unwrap();
            Self {
                _temp: temp,
                store,
                project,
                source,
                target,
            }
        }

        fn paths(&self) -> (&str, &str) {
            (self.store.to_str().unwrap(), self.project.to_str().unwrap())
        }
    }

    #[test]
    fn creates_valid_relative_symlink() {
        let fixture = Fixture::new();
        let (store, project) = fixture.paths();
        let result = link_skill(store, project, "example").unwrap();
        let raw = fs::read_link(&fixture.target).unwrap();
        assert!(!raw.is_absolute());
        assert_eq!(
            fs::canonicalize(fixture.target).unwrap(),
            fs::canonicalize(fixture.source).unwrap()
        );
        assert!(result.already_linked);
    }

    #[test]
    fn reports_broken_symlink() {
        let fixture = Fixture::new();
        symlink("../../../store/missing", &fixture.target).unwrap();
        let scan = scan_project(fixture.project.to_str().unwrap(), fixture.store.to_str().unwrap()).unwrap();
        assert_eq!(scan.links[0].state, LinkState::Broken);
        assert!(!preflight_link(fixture.store.to_str().unwrap(), fixture.project.to_str().unwrap(), "example").unwrap().can_link);
    }

    #[test]
    fn rejects_unknown_symlink_name_conflict() {
        let fixture = Fixture::new();
        let other = fixture.store.join("other");
        fs::create_dir_all(&other).unwrap();
        fs::write(other.join("SKILL.md"), "---\nname: other\n---\n").unwrap();
        symlink(&other, &fixture.target).unwrap();
        let preflight = preflight_link(fixture.store.to_str().unwrap(), fixture.project.to_str().unwrap(), "example").unwrap();
        assert!(!preflight.can_link);
    }

    #[test]
    fn rejects_existing_regular_file() {
        let fixture = Fixture::new();
        fs::write(&fixture.target, "conflict").unwrap();
        let preflight = preflight_link(fixture.store.to_str().unwrap(), fixture.project.to_str().unwrap(), "example").unwrap();
        assert!(!preflight.can_link);
    }

    #[test]
    fn rejects_existing_real_directory() {
        let fixture = Fixture::new();
        fs::create_dir(&fixture.target).unwrap();
        let preflight = preflight_link(fixture.store.to_str().unwrap(), fixture.project.to_str().unwrap(), "example").unwrap();
        assert!(!preflight.can_link);
    }

    #[test]
    fn rejects_store_escape_through_symlink_container() {
        let fixture = Fixture::new();
        let outside = fixture._temp.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("SKILL.md"), "---\nname: outside\n---\n").unwrap();
        symlink(&outside, fixture.store.join("outside")).unwrap();
        let scan = scan_store(fixture.store.to_str().unwrap()).unwrap();
        assert!(scan.skills.iter().all(|skill| skill.name != "outside"));
    }

    #[test]
    fn rejects_project_escape_through_agents_symlink() {
        let fixture = Fixture::new();
        fs::remove_dir_all(fixture.project.join(".agents")).unwrap();
        let outside = fixture._temp.path().join("outside-agents");
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, fixture.project.join(".agents")).unwrap();
        let error = preflight_link(fixture.store.to_str().unwrap(), fixture.project.to_str().unwrap(), "example").unwrap_err();
        assert_eq!(error.code, "unsafe_project_layout");
    }

    #[test]
    fn repeated_add_is_idempotent() {
        let fixture = Fixture::new();
        let (store, project) = fixture.paths();
        link_skill(store, project, "example").unwrap();
        let first = fs::read_link(&fixture.target).unwrap();
        let second = link_skill(store, project, "example").unwrap();
        assert!(second.already_linked);
        assert_eq!(first, fs::read_link(&fixture.target).unwrap());
    }

    #[test]
    fn unlink_keeps_source_files() {
        let fixture = Fixture::new();
        let (store, project) = fixture.paths();
        link_skill(store, project, "example").unwrap();
        unlink_skill(store, project, "example").unwrap();
        assert!(fixture.source.join("SKILL.md").is_file());
        assert!(fs::symlink_metadata(&fixture.target).is_err());
    }

    #[test]
    fn project_command_allowlist_accepts_only_exact_signatures() {
        let allowed: &[(&str, &[&str])] = &[
            ("git", &["status", "--short"]),
            ("git", &["diff"]),
            ("npx", &["skills", "list", "--project", "--json"]),
        ];
        let rejected: &[(&str, &[&str])] = &[
            ("git", &["status"]),
            ("git", &["status", "--short", "--branch"]),
            ("git", &["diff", "--cached"]),
            ("npx", &["skills", "list", "--project"]),
            ("npx", &["--yes", "skills", "list", "--project", "--json"]),
            ("sh", &["-c", "true"]),
        ];

        for (program, args) in allowed {
            assert!(project_command_is_allowed(program, args));
        }
        for (program, args) in rejected {
            assert!(!project_command_is_allowed(program, args));
        }
    }

    #[test]
    fn rejected_project_command_is_not_executed() {
        let fixture = Fixture::new();
        let marker = fixture.project.join("unexpected-command-output");
        let shell_command = format!("touch {}", marker.display());
        let error = run_project_command(
            fixture.project.to_str().unwrap(),
            "sh",
            &["-c", shell_command.as_str()],
        )
        .unwrap_err();

        assert_eq!(error.code, "command_not_allowed");
        assert!(!marker.exists());
    }
}
