import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { parseDocument } from 'yaml';
import { authorizeRoots, scanInventory, readSkill } from './inventory.mjs';

export class DomainError extends Error {
  constructor(code, message, status = 422) { super(message); this.code = code; this.status = status; }
}
export const requireValue = (condition, code, message, status) => { if (!condition) throw new DomainError(code, message, status); };
export class Catalog {
  constructor(directory) {
    if (directory) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      requireValue(!fs.lstatSync(directory).isSymbolicLink(), 'UNSAFE_DATA', '应用数据目录不能是链接');
    }
    directory = directory ? fs.realpathSync(directory) : directory;
    requireValue(!directory || !/(?:^|[\\/])\.(?:claude|agents|codex)[\\/]skills(?:[\\/]|$)/.test(directory), 'UNSAFE_STORE', '应用数据不能放在 Agent 技能发现目录内');
    this.directory = directory;
    this.db = new DatabaseSync(directory ? path.join(directory, 'catalog.sqlite') : ':memory:');
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    requireValue(version <= 1, 'SCHEMA_UNSUPPORTED', '数据库版本高于服务支持版本；请使用原版本或备份恢复');
    this.db.exec('CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(kind,id)); PRAGMA user_version=1;');
  }
  list(kind) { return this.db.prepare('SELECT json FROM entities WHERE kind=? ORDER BY rowid').all(kind).map(row => JSON.parse(row.json)); }
  get(kind, id) { if (typeof id !== 'string') return null; const row = this.db.prepare('SELECT json FROM entities WHERE kind=? AND id=?').get(kind, id); return row ? JSON.parse(row.json) : null; }
  put(kind, value) { this.db.prepare('INSERT INTO entities(kind,id,json) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json').run(kind, value.id, JSON.stringify(value)); return value; }
  close() { this.db.close(); }
  grants() { return this.list('source').filter(s => !s.revokedAt); }
  async authorize(input) {
    requireValue(input.permission === 'read-only' && input.confirm === true, 'GRANT_REQUIRED', '请明确确认只读授权');
    requireValue(this.grants().length < 8, 'SOURCE_LIMIT', '最多授权 8 个来源');
    let grant; try { [grant] = await authorizeRoots([input.absolutePath]); } catch { throw new DomainError('INVALID_SOURCE', '路径必须是可访问的绝对真实目录，不能为根目录或符号链接'); }
    const prior = this.list('source').find(s => s.path === grant.path);
    requireValue(!prior || prior.revokedAt || prior.identity === grant.identity, 'SOURCE_CHANGED', '来源身份变化，先撤销旧授权', 409);
    return this.put('source', { ...grant, id: prior?.id ?? randomUUID(), grantId: randomUUID(), permission: 'read-only', grantedAt: new Date().toISOString(), revokedAt: null });
  }
  revoke(id) {
    const source = this.get('source', id); requireValue(source, 'NOT_FOUND', '来源不存在', 404);
    return this.put('source', { ...source, revokedAt: new Date().toISOString() });
  }
  async scan() {
    requireValue(!this.scanning, 'SCAN_BUSY', '扫描正在进行', 409); this.scanning = true;
    const job = this.put('job', { id: randomUUID(), status: 'running', startedAt: new Date().toISOString() });
    try {
      const grants = this.grants(), snapshot = await scanInventory(grants);
      const skills = [];
      for (const observed of snapshot.skills) {
        const previous = this.list('skill').find(s => s.sourceId === observed.sourceId && s.directoryName === observed.directoryName);
        try {
          const content = await readSkill(grants, observed);
          const parsed = metadata(content.text, observed.directoryName);
          const skill = { ...observed, ...parsed, id: previous?.id ?? randomUUID(), favorite: previous?.favorite ?? false, note: previous?.note ?? '', management: 'indexed' };
          this.put('skill', skill); skills.push(skill);
          for (const message of parsed.warnings) snapshot.diagnostics.push({ root: skill.path, code: 'METADATA_WARNING', message });
        } catch (error) { snapshot.diagnostics.push({ root: observed.path, code: 'METADATA_INVALID', message: error.message }); }
      }
      for (const skill of skills) {
        const variants = skills.filter(s => s.id !== skill.id && s.declaredName && s.declaredName === skill.declaredName);
        if (variants.length) snapshot.diagnostics.push({ root: skill.path, code: variants.some(s => s.fingerprint !== skill.fingerprint) ? 'NAME_VARIANT' : 'DUPLICATE_CONTENT', message: '同名入口存在；未推断优先级，不自动合并。' });
      }
      snapshot.skills = skills;
      snapshot.coverage.completeWithinBootstrapScope = !snapshot.diagnostics.length;
      this.put('snapshot', { id: 'current', ...snapshot });
      return this.put('job', { ...job, status: snapshot.diagnostics.length ? 'partial' : 'succeeded', snapshotId: snapshot.snapshotId, finishedAt: new Date().toISOString() });
    } catch (error) { this.put('job', { ...job, status: 'failed', message: error.message }); throw error; }
    finally { this.scanning = false; }
  }
  inventory() {
    const snapshot = this.get('snapshot', 'current') ?? { skills: [], diagnostics: [], capturedAt: null, coverage: {grantedRoots: this.grants().length, inspectedCandidates: 0, completeWithinBootstrapScope: true, scope: '尚未扫描'} };
    const active = new Set(this.grants().map(g => g.id));
    return { ...snapshot, skills: snapshot.skills.filter(s => active.has(s.sourceId)).map(s => this.get('skill', s.id)), coverage: { ...snapshot.coverage, grantedRoots: active.size } };
  }
  async read(id) {
    const skill = this.get('skill', id); requireValue(skill, 'NOT_FOUND', '技能不存在', 404);
    requireValue(this.grants().some(g => g.id === skill.sourceId), 'GRANT_REVOKED', '来源授权已撤销', 403);
    try { return await readSkill(this.grants(), skill); } catch (e) { throw new DomainError('SOURCE_CHANGED', e.message, 409); }
  }
  preferences(id, input) {
    const skill = this.get('skill', id); requireValue(skill, 'NOT_FOUND', '技能不存在', 404);
    requireValue(typeof input.favorite === 'boolean' && (input.note === undefined || typeof input.note === 'string' && input.note.length <= 2000), 'INVALID_INPUT', '收藏或注释格式无效');
    return this.put('skill', { ...skill, favorite: input.favorite, note: input.note ?? skill.note });
  }
}

export function metadata(text, directoryName) {
  requireValue(!text.includes('\0'), 'BINARY_CONTENT', '内容包含二进制空字节');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  const warnings = [];
  let fields = {};
  if (!match) warnings.push('未提供 YAML frontmatter');
  else {
    const document = parseDocument(match[1], { uniqueKeys: true, schema: 'core' });
    requireValue(!document.errors.length, 'INVALID_YAML', document.errors[0]?.message ?? 'YAML 无效');
    fields = document.toJS({ maxAliasCount: 20 });
    requireValue(fields && typeof fields === 'object' && !Array.isArray(fields), 'INVALID_YAML', '元数据必须是映射');
  }
  for (const key of ['name', 'description']) if (typeof fields[key] !== 'string' || !fields[key].trim()) warnings.push(`未提供有效 ${key}`);
  if (typeof fields.name === 'string' && (fields.name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.name))) warnings.push('name 不符合长度或命名规范');
  if (typeof fields.description === 'string' && fields.description.length > 1024) warnings.push('description 超过 1024 字符');
  if (typeof fields.name === 'string' && fields.name !== directoryName) warnings.push('声明名与目录名不同，保留真实来源');
  return { declaredName: typeof fields.name === 'string' ? fields.name : null, description: typeof fields.description === 'string' ? fields.description : null, metadata: fields, metadataStatus: warnings.length ? 'partial' : 'parsed', warnings };
}
