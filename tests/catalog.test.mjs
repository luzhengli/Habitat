import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Catalog, metadata } from '../apps/server/catalog.mjs';
async function fixture(t) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'habitat-catalog-'));
 await fs.mkdir(path.join(dir,'source/one'),{recursive:true});
 const file=path.join(dir,'source/one/SKILL.md');
 await fs.writeFile(file,'---\nname: one\ndescription: |\n  中文用途\n  第二行\nextra: preserved\n---\n# Safe <script>alert(1)</script>');
 let db=new Catalog(path.join(dir,'data'));
 t.after(async()=>{db.close();await fs.rm(dir,{recursive:true,force:true});});
 return {dir,file,get db(){return db;},restart(){db.close();db=new Catalog(path.join(dir,'data'));return db;},grant:()=>db.authorize({absolutePath:path.join(dir,'source'),permission:'read-only',confirm:true})};
}
test('explicit grant, durable identity and preferences survive restart; source unchanged',async t=>{
 const f=await fixture(t), before=await fs.readFile(f.file);
 assert.equal(f.db.inventory().skills.length,0); await assert.rejects(f.db.authorize({absolutePath:path.dirname(f.file)}),/确认/);
 await f.grant(); await f.db.scan(); const skill=f.db.inventory().skills[0];
 assert.equal(skill.description,'中文用途\n第二行\n');assert.equal(skill.metadata.extra,'preserved');
 f.db.preferences(skill.id,{favorite:true});f.restart();await f.db.scan();assert.equal(f.db.inventory().skills[0].id,skill.id);assert.equal(f.db.inventory().skills[0].favorite,true);
 assert.deepEqual(await fs.readFile(f.file),before);const source=f.db.grants()[0];f.db.revoke(source.id);assert.equal(f.db.inventory().skills.length,0);await assert.rejects(f.db.read(skill.id),/撤销/);assert.deepEqual(await fs.readFile(f.file),before);
});
test('variants, missing fields, source drift and symlink gaps remain explicit',async t=>{
 const f=await fixture(t);await f.grant();await fs.mkdir(path.join(f.dir,'source/two'));await fs.writeFile(path.join(f.dir,'source/two/SKILL.md'),'---\nname: one\n---\nvariant');await fs.symlink(path.dirname(f.file),path.join(f.dir,'source/link'));await f.db.scan();
 assert.ok(f.db.inventory().diagnostics.some(d=>d.code==='NAME_VARIANT'));assert.ok(f.db.inventory().diagnostics.some(d=>d.code==='SYMLINK_NOT_FOLLOWED'));
 const id=f.db.inventory().skills[0].id;await fs.writeFile(f.file,'changed');await assert.rejects(f.db.read(id),/changed/);
 await fs.rename(path.join(f.dir,'source'),path.join(f.dir,'moved'));await f.db.scan();assert.equal(f.db.inventory().skills.length,0);assert.ok(f.db.inventory().diagnostics.some(d=>d.code==='ROOT_UNAVAILABLE_OR_CHANGED'));
});
test('standard YAML parsing rejects invalid and binary data, preserves unknown fields',()=>{
 assert.throws(()=>metadata('---\nname: [\n---\n','a'));
 assert.throws(()=>metadata('\0binary','a'));
 assert.ok(metadata('no header','a').warnings.length);
 assert.ok(metadata('---\nname: different\ndescription: hello\n---\n','a').warnings.length);
 assert.throws(()=>metadata('---\nname: a\nname: b\n---\n','a'));
});
test('unsupported schema is rejected instead of silently rewritten',async t=>{
 const f=await fixture(t);f.db.db.exec('PRAGMA user_version=2');assert.throws(()=>new Catalog(path.join(f.dir,'data')),/数据库版本/);assert.equal(f.db.db.prepare('PRAGMA user_version').get().user_version,2);
});
test('unreadable authorized source reports partial rather than empty success',async t=>{
 const f=await fixture(t);await f.grant();await fs.chmod(path.join(f.dir,'source'),0);t.after(()=>fs.chmod(path.join(f.dir,'source'),0o700).catch(()=>{}));
 try{await f.db.scan();assert.ok(f.db.inventory().diagnostics.some(d=>d.code==='ROOT_UNAVAILABLE_OR_CHANGED'));assert.equal(f.db.inventory().coverage.completeWithinBootstrapScope,false);}finally{await fs.chmod(path.join(f.dir,'source'),0o700);}
});
test('database symlink is refused without modifying its target',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'habitat-db-link-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.mkdir(path.join(dir,'data'));await fs.writeFile(path.join(dir,'foreign'),'preserve');await fs.symlink(path.join(dir,'foreign'),path.join(dir,'data/catalog.sqlite'));assert.throws(()=>new Catalog(path.join(dir,'data')),/链接/);assert.equal(await fs.readFile(path.join(dir,'foreign'),'utf8'),'preserve');
});
