pub mod adapters;
pub mod migration;
pub mod skills;

use skills::{AppError, CommandResult, Preflight, ProjectScan, SkillInspection, StoreScan};

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
    skills::run_project_command(&project_path, "npx", &["skills", "list", "--project", "--json"])
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
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
