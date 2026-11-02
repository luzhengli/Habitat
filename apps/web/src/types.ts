export interface Skill {
  id: string; sourceId: string; directoryName: string; declaredName: string | null;
  description: string | null; path: string; fingerprint: string; favorite: boolean; note: string;
  metadata?: Record<string, unknown>; firstIndexedAt?: string | null;
  metadataStatus: string; warnings: string[];
}
export interface Inventory { skills: Skill[]; diagnostics: {root: string; code: string; message: string}[]; capturedAt: string | null; coverage: {grantedRoots:number} }
export interface Source { id:string; path:string; revokedAt:string | null; permission:string }
