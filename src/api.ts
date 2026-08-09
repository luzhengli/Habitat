import { invoke } from "@tauri-apps/api/core";
import type { CommandResult, Preflight, ProjectScan, StoreScan } from "./types";

export const api = {
  scanStore: (storePath: string) => invoke<StoreScan>("scan_store", { storePath }),
  scanProject: (projectPath: string, storePath: string) =>
    invoke<ProjectScan>("scan_project", { projectPath, storePath }),
  preflightLink: (storePath: string, projectPath: string, skillName: string) =>
    invoke<Preflight>("preflight_link", { storePath, projectPath, skillName }),
  linkSkill: (storePath: string, projectPath: string, skillName: string) =>
    invoke<Preflight>("link_skill", { storePath, projectPath, skillName }),
  unlinkSkill: (storePath: string, projectPath: string, skillName: string) =>
    invoke<void>("unlink_skill", { storePath, projectPath, skillName }),
  validateLinks: (storePath: string, projectPath: string) =>
    invoke<ProjectScan>("validate_links", { storePath, projectPath }),
  listProjectSkills: (projectPath: string) =>
    invoke<CommandResult>("list_project_skills", { projectPath }),
  inspectGitStatus: (projectPath: string) =>
    invoke<CommandResult>("inspect_git_status", { projectPath }),
  previewGitDiff: (projectPath: string) =>
    invoke<CommandResult>("preview_git_diff", { projectPath }),
};
