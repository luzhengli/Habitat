import { invoke } from "@tauri-apps/api/core";
import type {
  CommandResult,
  InventorySnapshot,
  MigrationPlan,
  Preflight,
  ProjectDraftSelection,
  ProjectExposurePlan,
  ProjectScan,
  ProjectTransactionManifest,
  ProjectWorkspaceInspection,
  StoreScan,
  TransactionManifest,
} from "./types";

export const api = {
  scanKnownInventory: () =>
    invoke<InventorySnapshot>("scan_known_inventory_command"),
  validateFirstRunStore: (storePath: string) =>
    invoke<string>("validate_first_run_store_command", { storePath }),
  planFirstRunMigration: (storePath: string, selectedArtifactIds: string[]) =>
    invoke<MigrationPlan>("plan_first_run_migration_command", { storePath, selectedArtifactIds }),
  executeFirstRunMigration: (transactionId: string) =>
    invoke<TransactionManifest>("execute_first_run_migration_command", { transactionId }),
  rollbackFirstRunMigration: (transactionId: string) =>
    invoke<TransactionManifest>("rollback_first_run_migration_command", { transactionId }),
  inspectProjectWorkspace: (storePath: string, projectPath: string) =>
    invoke<ProjectWorkspaceInspection>("inspect_project_workspace_command", { storePath, projectPath }),
  planProjectSettings: (storePath: string, projectPath: string, selections: ProjectDraftSelection[]) =>
    invoke<ProjectExposurePlan>("plan_project_settings_command", { storePath, projectPath, selections }),
  applyProjectSettings: (transactionId: string) =>
    invoke<ProjectTransactionManifest>("apply_project_settings_command", { transactionId }),
  rollbackProjectSettings: (transactionId: string) =>
    invoke<ProjectTransactionManifest>("rollback_project_settings_command", { transactionId }),
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
