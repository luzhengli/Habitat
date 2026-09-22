import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const LIMITS = Object.freeze({ roots: 8, candidates: 500, skillBytes: 262144 });
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = stat => `${stat.dev}:${stat.ino}`;
const fault = (root, code, message) => ({ root, code, message });

/** Startup grants are the only authority in the bootstrap. No HTTP path grant exists. */
export async function authorizeRoots(paths) {
  if (!Array.isArray(paths) || paths.length > LIMITS.roots || paths.some(p => typeof p !== 'string')) {
    throw new Error(`HABITAT_ROOTS must be a JSON array of at most ${LIMITS.roots} absolute directory paths.`);
  }
  const grants = [];
  for (const requested of paths) {
    if (!path.isAbsolute(requested) || path.parse(requested).root === path.resolve(requested)) {
      throw new Error('A source grant must be an absolute non-filesystem-root directory.');
    }
    const stat = await fs.lstat(requested);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Source grants must be real directories, not symlinks.');
    const canonical = await fs.realpath(requested);
    const current = await fs.lstat(canonical);
    if (identity(stat) !== identity(current)) throw new Error('Source changed during authorization.');
    if (!grants.some(g => g.path === canonical)) grants.push({ id: hash(canonical).slice(0, 20), path: canonical, identity: identity(stat) });
  }
  return Object.freeze(grants.map(Object.freeze));
}

async function assertRoot(grant) {
  const stat = await fs.lstat(grant.path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || identity(stat) !== grant.identity || await fs.realpath(grant.path) !== grant.path) {
    throw new Error('Root identity changed; restart and explicitly authorize the new directory.');
  }
}

async function readCandidate(grant, relative) {
  await assertRoot(grant);
  const candidate = path.join(grant.path, relative);
  const before = await fs.lstat(candidate);
  if (!before.isDirectory() || before.isSymbolicLink()) throw new Error('Candidate is not a real directory.');
  if (await fs.realpath(candidate) !== candidate) throw new Error('Candidate escaped its grant.');
  const file = path.join(candidate, 'SKILL.md');
  const leaf = await fs.lstat(file);
  if (!leaf.isFile() || leaf.isSymbolicLink() || leaf.size > LIMITS.skillBytes) throw new Error('SKILL.md must be a bounded regular file.');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let text, stat;
  try {
    stat = await handle.stat();
    if (!stat.isFile() || identity(stat) !== identity(leaf) || stat.size > LIMITS.skillBytes) throw new Error('Skill changed before opening.');
    const bytes = Buffer.alloc(LIMITS.skillBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, length);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    const after = await handle.stat();
    if (length > LIMITS.skillBytes || identity(after) !== identity(stat) || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error('Skill changed during bounded read.');
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally { await handle.close(); }
  const finalParent = await fs.lstat(candidate);
  const finalLeaf = await fs.lstat(file);
  if (finalParent.isSymbolicLink() || identity(finalParent) !== identity(before) || finalLeaf.isSymbolicLink() || identity(finalLeaf) !== identity(stat)) throw new Error('Source path changed during read.');
  await assertRoot(grant);
  return { text, fingerprint: hash(text), modifiedAt: stat.mtime.toISOString() };
}

/** Intentionally limited read-only discovery, not a complete Agent scanner or YAML parser. */
export async function scanInventory(grants) {
  const skills = [], diagnostics = [];
  let inspected = 0;
  for (const grant of grants) {
    try {
      await assertRoot(grant);
      const directory = await fs.opendir(grant.path);
      const names = [];
      for await (const entry of directory) {
        if (names.length >= LIMITS.candidates) {
          diagnostics.push(fault(grant.path, 'SCAN_LIMIT', `Stopped after ${LIMITS.candidates} entries.`));
          break;
        }
        names.push(entry.name);
      }
      for (const name of names.sort()) {
        if (name.startsWith('.')) continue;
        const candidate = path.join(grant.path, name);
        try {
          const entry = await fs.lstat(candidate);
          if (entry.isSymbolicLink()) { diagnostics.push(fault(candidate, 'SYMLINK_NOT_FOLLOWED', '该入口是符号链接，未跟随或删除；其内容不在本次扫描范围。')); continue; }
          if (!entry.isDirectory()) continue;
          try { await fs.lstat(path.join(candidate, 'SKILL.md')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
          inspected++;
          const result = await readCandidate(grant, name);
          skills.push({
            id: hash(`${grant.id}\0${name}`).slice(0, 24), sourceId: grant.id,
            directoryName: name, declaredName: null, description: null, version: null,
            path: candidate, management: 'observed', discovery: 'not-checked',
            fingerprint: result.fingerprint, modifiedAt: result.modifiedAt,
            metadataStatus: 'not-parsed', sourceKind: 'authorized-local-directory'
          });
        } catch (error) { diagnostics.push(fault(candidate, 'UNREADABLE_OR_CHANGED', error.message)); }
      }
    } catch (error) { diagnostics.push(fault(grant.path, 'ROOT_UNAVAILABLE_OR_CHANGED', error.message)); }
  }
  return { snapshotId: hash(JSON.stringify({ skills, diagnostics })).slice(0, 24), capturedAt: new Date().toISOString(),
    coverage: { grantedRoots: grants.length, inspectedCandidates: inspected, completeWithinBootstrapScope: diagnostics.length === 0,
      scope: 'Direct non-hidden child directories only. No Agent discovery, recursive scan or symlink traversal.' }, skills, diagnostics };
}

export async function readSkill(grants, skill) {
  const grant = grants.find(g => g.id === skill.sourceId);
  if (!grant) throw new Error('Source grant is no longer available.');
  const result = await readCandidate(grant, skill.directoryName);
  if (result.fingerprint !== skill.fingerprint) throw new Error('Skill changed since inventory; refresh before reading.');
  return { id: skill.id, ...result };
}
