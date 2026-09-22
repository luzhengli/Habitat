/** Current read-only bootstrap. Future domain types are in domain.ts, not current API promises. */
export interface BootstrapSkill {
  id: string;
  sourceId: string;
  directoryName: string;
  declaredName: null;
  description: null;
  version: null;
  path: string;
  management: 'observed';
  discovery: 'not-checked';
  fingerprint: string;
  modifiedAt: string;
  metadataStatus: 'not-parsed';
  sourceKind: 'authorized-local-directory';
}
export interface BootstrapInventory {
  snapshotId: string;
  capturedAt: string;
  coverage: { grantedRoots: number; inspectedCandidates: number; completeWithinBootstrapScope: boolean; scope: string };
  skills: BootstrapSkill[];
  diagnostics: { root: string; code: string; message: string }[];
}
export interface BootstrapSession { csrfToken: string; expiresAt: number; }
export interface ApiError { error: { code: string; message: string; requestId: string; }; }
