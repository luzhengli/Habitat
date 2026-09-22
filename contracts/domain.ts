/** Target contracts for M1+, NOT an assertion that endpoints are already implemented.
 * Runtime payload validation must be added; TypeScript types alone do not validate HTTP.
 */
export type ID = string;
export type ISOTime = string;
export type Scope = 'project' | 'user' | 'ancestor' | 'runtime-owned';
export type Management = 'observed' | 'indexed' | 'managed' | 'unavailable';
export type Configuration = 'not-configured' | 'configured' | 'drifted' | 'unknown';
export type Discovery = 'not-checked' | 'expected' | 'confirmed' | 'conditional' | 'conflict' | 'shadowed' | 'unknown';
export interface Source {
  id: ID; kind: 'local-reference' | 'managed-copy' | 'git';
  canonicalRoot: string; grantId: ID; identity: string; availability: 'ready' | 'missing' | 'denied' | 'changed';
  origin?: { repositoryUrl: string; commit: string; subpath: string };
}
export interface Grant {
  id: ID; root: string; identity: string; permission: 'read' | 'project-entry-write' | 'store-write';
  grantedAt: ISOTime; revokedAt?: ISOTime;
}
export interface Skill {
  id: ID; sourceId: ID; contentRoot: string; declaredName: string | null; displayName: string;
  description: string | null; metadataStatus: 'valid' | 'warning' | 'blocked'; management: Management;
  versionId: ID | null; diagnostics: Diagnostic[];
}
export interface SkillVersion {
  id: ID; skillId: ID; manifestVersion: 1; contentFingerprint: string; declaredVersion: string | null;
  snapshotPath: string; sourceCommit?: string; createdAt: ISOTime;
}
export interface Project {
  id: ID; name: string; root: string; identity: string; grantId: ID; defaultAgentIds: ID[]; revision: number;
}
export interface Binding {
  id: ID; projectId: ID; skillVersionId: ID; targetPath: string; targetIdentity: string;
  ownerOperationId: ID; configuration: Configuration;
}
export interface Exposure {
  agentId: ID; projectId: ID; skillId: ID; scope: Scope; route: string;
  configuration: Configuration; discovery: Discovery; evidenceId?: ID; scannedAt: ISOTime;
}
export interface Evidence {
  id: ID; type: 'filesystem' | 'adapter-rule' | 'runtime-observation'; sourceRef: string;
  capturedAt: ISOTime; contentFingerprint: string; projectId?: ID; cwd?: string; agentVersion?: string;
}
export interface Diagnostic {
  code: string; message: string; severity: 'info' | 'warning' | 'blocked';
  observedPath?: string; recovery: string; evidenceIds: ID[];
}
export type Intent =
  | { type: 'import-copy'; sourceId: ID; skillIds: ID[] }
  | { type: 'configure-project'; projectId: ID; revision: number; desiredVersionIds: ID[]; selectedAgentIds: ID[] }
  | { type: 'undo-operation'; operationId: ID };
export interface ChangeStep {
  id: ID; kind: 'copy-to-staging' | 'publish-snapshot' | 'create-link' | 'remove-owned-link' | 'restore-owned-entry';
  sourceRef?: ID; targetPath: string; beforeFingerprint: string | null; expectedIdentity: string | null;
  impact: string; status: 'planned' | 'running' | 'verified' | 'failed' | 'compensated' | 'unknown';
}
export interface ChangePlan {
  id: ID; intent: Intent; hash: string; revision: number; snapshotId: ID; expiresAt: ISOTime;
  steps: ChangeStep[]; diagnostics: Diagnostic[]; affectedProjectIds: ID[];
  coverage: 'complete-within-known-scope' | 'partial' | 'unknown'; canApply: boolean;
}
export interface ExecuteRequest { planId: ID; planHash: string; idempotencyKey: string; }
export type OperationState = 'confirmed' | 'running' | 'verifying' | 'succeeded' | 'failed' | 'partial' | 'recovery-required' | 'compensating' | 'rolled-back' | 'rollback-partial';
export interface Operation {
  id: ID; planId: ID; state: OperationState; steps: ChangeStep[];
  startedAt: ISOTime; completedAt?: ISOTime; safeToCancel: boolean;
  evidenceIds: ID[]; recovery: string | null;
}
