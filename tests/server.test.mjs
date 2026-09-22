import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { authorizeRoots, scanInventory, readSkill, LIMITS } from '../apps/server/inventory.mjs';
import { createApp } from '../apps/server/app.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'habitat-web-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, 'source/one'), { recursive: true });
  await fs.writeFile(path.join(dir, 'source/one/SKILL.md'), '---\nname: one\n---\n# One\n');
  return { dir, source: path.join(dir, 'source'), file: path.join(dir, 'source/one/SKILL.md') };
}
async function service(t, grants = [], dev = false) {
  const server = createApp({ root, grants, dev });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(base + '/api/v1/session', { headers: { 'X-Habitat-Client': 'habitat-web' } });
  const value = await session.json(); assert.equal(session.status, 200);
  const headers = { 'X-Habitat-Client': 'habitat-web', 'X-Habitat-CSRF': value.csrfToken, Cookie: session.headers.get('set-cookie').split(';')[0] };
  return { base, headers, get: route => fetch(base + route, { headers }) };
}
test('no grants means no implicit home scan', async () => { const result = await scanInventory([]); assert.equal(result.skills.length, 0); assert.equal(result.coverage.grantedRoots, 0); });
test('authorized real scan and read preserve source bytes', async t => { const f = await fixture(t), before = await fs.readFile(f.file); const grants = await authorizeRoots([f.source]); const result = await scanInventory(grants); assert.equal(result.skills.length, 1); assert.equal(result.skills[0].declaredName, null); assert.equal(result.skills[0].discovery, 'not-checked'); assert.equal((await readSkill(grants, result.skills[0])).text, before.toString()); assert.deepEqual(await fs.readFile(f.file), before); });
test('source directory symlink grant is rejected', async t => { const f = await fixture(t); await fs.symlink(f.source, path.join(f.dir,'alias')); await assert.rejects(authorizeRoots([path.join(f.dir,'alias')]), /real directories/); });
test('relative, root and malformed grants are rejected', async () => { await assert.rejects(authorizeRoots(['relative'])); await assert.rejects(authorizeRoots(['/'])); await assert.rejects(authorizeRoots('path')); await assert.rejects(authorizeRoots([42])); });
test('candidate and SKILL symlinks are not followed', async t => { const f = await fixture(t); await fs.symlink(path.join(f.source,'one'), path.join(f.source,'alias')); await fs.mkdir(path.join(f.source,'two')); await fs.symlink(f.file,path.join(f.source,'two/SKILL.md')); const r = await scanInventory(await authorizeRoots([f.source])); assert.equal(r.skills.length,1); assert.equal(r.diagnostics.length,2); assert.equal(r.coverage.completeWithinBootstrapScope,false); });
test('content drift invalidates ID-based read', async t => { const f = await fixture(t), grants = await authorizeRoots([f.source]); const r = await scanInventory(grants); await fs.writeFile(f.file,'changed'); await assert.rejects(readSkill(grants,r.skills[0]), /changed since/); });
test('root drift is partial, never empty success', async t => { const f = await fixture(t), grants = await authorizeRoots([f.source]); await fs.rename(f.source, path.join(f.dir,'moved')); const r=await scanInventory(grants); assert.equal(r.coverage.completeWithinBootstrapScope,false); assert.equal(r.diagnostics[0].code,'ROOT_UNAVAILABLE_OR_CHANGED'); });
test('oversized and invalid UTF-8 content is reported', async t => { const f=await fixture(t); await fs.writeFile(f.file, Buffer.alloc(LIMITS.skillBytes+1)); let r=await scanInventory(await authorizeRoots([f.source])); assert.equal(r.skills.length,0); assert.equal(r.diagnostics.length,1); await fs.writeFile(f.file, Buffer.from([0xff,0xff])); r=await scanInventory(await authorizeRoots([f.source])); assert.equal(r.skills.length,0); assert.equal(r.diagnostics.length,1); });
test('API requires header, session and CSRF', async t => { const s=await service(t); assert.equal((await fetch(s.base+'/api/v1/inventory')).status,403); assert.equal((await fetch(s.base+'/api/v1/inventory',{headers:{'X-Habitat-Client':'habitat-web'}})).status,401); assert.equal((await fetch(s.base+'/api/v1/inventory',{headers:{...s.headers,'X-Habitat-CSRF':'wrong'}})).status,403); assert.equal((await s.get('/api/v1/inventory')).status,200); });
test('foreign and null origins, fetch sites and Host are denied', async t => { const s=await service(t); for(const origin of ['https://example.com','null','http://127.0.0.1:9999']) assert.equal((await fetch(s.base+'/api/v1/session',{headers:{'X-Habitat-Client':'habitat-web',Origin:origin}})).status,403); assert.equal((await fetch(s.base+'/api/v1/session',{headers:{'X-Habitat-Client':'habitat-web','Sec-Fetch-Site':'cross-site'}})).status,403); const status = await new Promise((resolve,reject) => { const req=http.get(s.base+'/',{headers:{Host:'attacker.example'}},r=>{r.resume();resolve(r.statusCode);}); req.on('error',reject); }); assert.equal(status,403); });
test('dev exact origin enabled only in explicit dev mode', async t => { const s=await service(t,[],true); assert.equal((await fetch(s.base+'/api/v1/session',{headers:{'X-Habitat-Client':'habitat-web',Origin:'http://127.0.0.1:5173','Sec-Fetch-Site':'same-site'}})).status,200); });
test('mutation API is closed with explicit 501 and no file writes', async t => { const f=await fixture(t), before=await fs.readFile(f.file), s=await service(t,await authorizeRoots([f.source])); const r=await fetch(s.base+'/api/v1/plans',{method:'POST',headers:{...s.headers,'Content-Type':'application/json'},body:'{}'}); assert.equal(r.status,501); assert.equal((await r.json()).error.code,'NOT_IMPLEMENTED'); assert.deepEqual(await fs.readFile(f.file),before); });
test('real inventory IDs only, no arbitrary file route', async t => { const f=await fixture(t), s=await service(t,await authorizeRoots([f.source])); const snapshot=await (await s.get('/api/v1/inventory')).json(); assert.equal(snapshot.skills.length,1); const content=await (await s.get('/api/v1/skills/'+snapshot.skills[0].id)).json(); assert.match(content.text,/# One/); assert.equal((await s.get('/api/v1/skills/000000000000000000000000')).status,404); assert.equal((await s.get('/api/v1/read?path=/etc/passwd')).status,404); });
test('static exposure is allowlisted and demo has nonce CSP', async t => { const s=await service(t); for(const route of ['/package.json','/.env','/reference/air/src/App.jsx','/api-nope']) assert.equal((await fetch(s.base+route)).status,404); const r=await fetch(s.base+'/demo'); assert.equal(r.status,200); assert.match(r.headers.get('content-security-policy'),/nonce-/); assert.equal(r.headers.get('access-control-allow-origin'),null); assert.match(await r.text(),/演示原型/); });
