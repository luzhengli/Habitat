export type Skill = {
  name: string;
  description: string;
  version: string;
  sourcePath: string;
  sourceKind: string;
  modifiedAt: number;
};

export type StoreScan = { root: string; name: string; skills: Skill[] };

export type LinkState = "available" | "valid" | "broken" | "conflict" | "outside_store";

export type ProjectSkill = {
  name: string;
  targetPath: string;
  relativeTarget: string | null;
  state: LinkState;
  detail: string;
};

export type ProjectScan = {
  root: string;
  name: string;
  skillsDirectory: string;
  links: ProjectSkill[];
};

export type CheckItem = {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  recovery: string | null;
};

export type Preflight = {
  sourcePath: string;
  targetPath: string;
  relativeLink: string;
  canLink: boolean;
  alreadyLinked: boolean;
  checks: CheckItem[];
};

export type CommandResult = {
  program: string;
  args: string[];
  cwd: string;
  status: number | null;
  success: boolean;
  stdout: string;
  stderr: string;
};

export type AppError = {
  code?: string;
  message?: string;
  stderr?: string;
  recovery?: string;
};

export type ParseStatus = "valid" | "warning" | "blocked";
export type EntryKind = "directory" | "symlink" | "broken_symlink" | "file" | "unreadable";

export type MigrationDiagnostic = {
  code: string;
  message: string;
  blocking: boolean;
};

export type CanonicalArtifact = {
  artifactId: string;
  canonicalPath: string;
  declaredName: string | null;
  directoryName: string;
  description: string | null;
  version: string | null;
  manifest: Array<{
    relativePath: string;
    kind: "directory" | "file" | "symlink";
    mode: number;
    size: number;
    linkText: string | null;
    contentHash: string | null;
  }>;
  contentFingerprint: string;
  parseStatus: ParseStatus;
  diagnostics: MigrationDiagnostic[];
};

export type ExposureRoute = {
  routeId: string;
  rootId: string;
  agentId: AgentId;
  edition: string | null;
  entryPath: string;
  entryKind: EntryKind;
  canonicalTarget: string | null;
  artifactId: string | null;
  identity: { device: number; inode: number; mode: number } | null;
  linkText: string | null;
  diagnostic: MigrationDiagnostic | null;
};

export type AgentId = "codex" | "claude_code" | "pi" | "cursor" | "trae";

export type InventorySnapshot = {
  snapshotId: string;
  capturedAt: number;
  artifacts: CanonicalArtifact[];
  routes: ExposureRoute[];
  duplicateFingerprintGroups: string[][];
  variantGroups: string[][];
  diagnostics: MigrationDiagnostic[];
};

export type MigrationPlan = {
  transactionId: string;
  snapshotId: string;
  storeRoot: string;
  manifestPath: string;
  imports: Array<{
    artifactId: string;
    sourcePath: string;
    expectedFingerprint: string;
    stagingPath: string;
    finalPath: string;
    result: string;
  }>;
  recoveries: Array<{
    routeId: string;
    originalPath: string;
    recoveryPath: string;
    result: string;
  }>;
};

export type TransactionManifest = MigrationPlan & {
  schemaVersion: number;
  state:
    | "confirmed"
    | "staging"
    | "imported"
    | "quarantined"
    | "verifying"
    | "completed"
    | "failed_partial"
    | "rolling_back"
    | "rolled_back";
  createdAt: number;
  updatedAt: number;
};

export type TargetGroupId = "agents_shared" | "claude" | "trae";
export type ProjectAction = "create" | "remove";
export type ProjectOperationResult = "pending" | "created" | "removed" | "rolled_back" | "drifted";
export type ObservedRouteState = "absent" | "matching" | "conflicting" | "broken" | "unsafe";
export type EffectiveExposureState = "unavailable" | "available" | "duplicate" | "shadowed" | "conflict" | "unknown";
export type SupportTier = "runtime_verified" | "path_compatible";

export type RouteObservation = {
  scope: "user" | "project";
  relativeRoot: string;
  entryPath: string;
  condition: "active" | "setting_controlled";
  state: ObservedRouteState;
  canonicalTarget: string | null;
  detail: string;
};

export type AgentExposureInspection = {
  agentId: AgentId;
  targeted: boolean;
  expectedTarget: string;
  expectedSatisfied: boolean;
  effectiveState: EffectiveExposureState;
  supportTier: SupportTier;
  runtimeVerified: boolean;
  routes: RouteObservation[];
};

export type ProjectExposureInspection = {
  registryVersion: string;
  projectRoot: string;
  skillName: string;
  sourcePath: string;
  agents: AgentExposureInspection[];
};

export type ProjectWorkspaceInspection = {
  registryVersion: string;
  projectRoot: string;
  skills: ProjectExposureInspection[];
};

export type ProjectDraftSelection = {
  name: string;
  selectedAgents: AgentId[];
};

export type ProjectOperation = {
  skillName: string;
  targetGroup: TargetGroupId;
  action: ProjectAction;
  sourcePath: string;
  targetPath: string;
  relativeLink: string;
  result: ProjectOperationResult;
};

export type ProjectExposurePlan = {
  transactionId: string;
  registryVersion: string;
  storeRoot: string;
  projectRoot: string;
  manifestPath: string;
  operations: ProjectOperation[];
};

export type ProjectTransactionManifest = ProjectExposurePlan & {
  schemaVersion: number;
  state: "confirmed" | "applying" | "completed" | "rolling_back" | "rolled_back" | "rollback_partial";
  createdContainers: string[];
  createdAt: number;
  updatedAt: number;
};
