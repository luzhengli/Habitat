import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Catalog } from '../apps/server/catalog.mjs';
import { Operations } from '../apps/server/operations.mjs';
import { manifest } from '../apps/server/files.mjs';
async function setup(t,options={}) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'habitat-ops-'));let c=new Catalog(path.join(dir,'data'));
 t.after(async()=>{c.close();await fs.rm(dir,{recursive:true,force:true});});
 await fs.mkdir(path.join(dir,'source/one/scripts'),{recursive:true});await fs.writeFile(path.join(dir,'source/one/SKILL.md'),'---\nname: one\ndescription: synthetic test\n---\nhello');await fs.writeFile(path.join(dir,'source/one/scripts/test.txt'),'never execute');await fs.mkdir(path.join(dir,'project'));
 await c.authorize({absolutePath:path.join(dir,'source'),permission:'read-only',confirm:true});await c.scan();
 let ops=new Operations(c,options);const project=await ops.project({directory:path.join(dir,'project'),writeScope:'.claude/skills',confirm:true});
 return {dir,get c(){return c;},get ops(){return ops;},project,skill:c.inventory().skills[0],async plan(){return ops.plan({projectId:project.id,revision:c.get('project',project.id).revision,changes:[{action:'add',skillId:c.inventory().skills[0].id}]});},async apply(plan,key='test-key-0001'){return ops.execute({planId:plan.id,hash:plan.hash,idempotencyKey:key,confirm:true});},restart(){c.close();c=new Catalog(path.join(dir,'data'));ops=new Operations(c);}};
}
test('full copy fingerprint, explicit plan, readback, idempotency and undo preserve source',async t=>{
 const f=await setup(t),before=await manifest(f.skill.path),p=await f.plan();assert.equal(await fs.readdir(path.join(f.dir,'project')).then(x=>x.length),0);
 const op=await f.apply(p);assert.equal(op.status,'succeeded');assert.equal((await manifest(op.steps[0].snapshot)).hash,before.hash);assert.equal((await manifest(f.skill.path)).hash,before.hash);assert.equal((await f.apply(p)).id,op.id);assert.equal((await f.ops.exposures(f.project.id)).items[0].configured,true);
 f.restart();assert.equal((await f.ops.exposures(f.project.id)).items[0].discovery,'unknown');const undo=await f.ops.plan({kind:'undo-operation',operationId:op.id});const result=await f.apply(undo,'undo-key-0001');assert.equal(result.status,'succeeded');assert.equal((await f.ops.exposures(f.project.id)).items.length,0);assert.equal((await manifest(f.skill.path)).hash,before.hash);
});
test('conflict, source drift, parent symlink and revoked grant block before construction',async t=>{
 const f=await setup(t),p=await f.plan();await fs.writeFile(path.join(f.skill.path,'scripts/test.txt'),'changed');await assert.rejects(f.apply(p),/完整源包/);assert.deepEqual(await fs.readdir(f.project.path),[]);
 const p2=await f.plan();f.c.revoke(f.skill.sourceId);await assert.rejects(f.apply(p2),/撤销/);assert.deepEqual(await fs.readdir(f.project.path),[]);
 await fs.mkdir(path.join(f.dir,'outside'));await fs.symlink(path.join(f.dir,'outside'),path.join(f.project.path,'.claude'));await assert.rejects(f.ops.parents(f.project),/身份/);
});
test('later revision, wrong hash and idempotency payload are rejected',async t=>{
 const f=await setup(t),p=await f.plan();await assert.rejects(f.ops.execute({planId:p.id,hash:'wrong',confirm:true,idempotencyKey:'wrong-key'}),/hash/);await f.apply(p);
 await assert.rejects(f.ops.plan({projectId:f.project.id,revision:0,changes:[{action:'add',skillId:f.skill.id}]}),/版本/);
 await assert.rejects(f.ops.execute({planId:'another',hash:p.hash,confirm:true,idempotencyKey:'test-key-0001'}),/不同计划/);
});
test('failure compensation removes only proven created entry',async t=>{
 const f=await setup(t,{faultHook:()=>{throw Error('injected disk failure');}}),p=await f.plan(),result=await f.apply(p);assert.equal(result.status,'rolled-back');await assert.rejects(fs.lstat(p.steps[0].target),{code:'ENOENT'});assert.equal((await manifest(f.skill.path)).hash,p.steps[0].manifest.hash);
});
test('foreign replacement remains intact and requires recovery',async t=>{
 const f=await setup(t,{faultHook:async(op,step)=>{await fs.unlink(step.target);await fs.writeFile(step.target,'foreign');throw Error('replacement');}}),p=await f.plan(),result=await f.apply(p);assert.equal(result.status,'recovery-required');assert.equal(await fs.readFile(p.steps[0].target,'utf8'),'foreign');
});
test('restarting a journaled interrupted operation compensates exact entry',async t=>{
 const f=await setup(t),p=await f.plan(),op=await f.apply(p);f.c.put('operation',{...op,status:'running'});f.restart();await f.ops.recover();assert.equal(f.c.get('operation',op.id).status,'rolled-back');await assert.rejects(fs.lstat(p.steps[0].target),{code:'ENOENT'});
});
test('existing foreign target and changed owned snapshot cannot be removed',async t=>{
 const f=await setup(t),p=await f.plan(),op=await f.apply(p);await fs.writeFile(path.join(op.steps[0].snapshot,'scripts/test.txt'),'personal change');await assert.rejects(f.ops.plan({kind:'undo-operation',operationId:op.id}),/修改/);assert.equal(await fs.readlink(p.steps[0].target),op.steps[0].snapshot);
});
test('SIGKILL after filesystem apply recovers from durable journal without touching source',async t=>{
 const {fork}=await import('node:child_process');const {once}=await import('node:events');
 const f=await setup(t);const child=fork(new URL('./kill-recovery-child.mjs',import.meta.url),[f.c.directory],{stdio:['ignore','ignore','ignore','ipc']});t.after(()=>{if(!child.killed)child.kill('SIGKILL');});
 await once(child,'message');child.kill('SIGKILL');await once(child,'exit');
 const op=f.c.list('operation')[0];assert.equal(op.status,'running');await f.ops.recover();assert.equal(f.c.get('operation',op.id).status,'rolled-back');await assert.rejects(fs.lstat(op.steps[0].target),{code:'ENOENT'});assert.equal((await manifest(f.skill.path)).hash,op.steps[0].manifest.hash);
});
test('fixed version update and undo keep old snapshot; personal modifications block',async t=>{
 const f=await setup(t),installed=await f.apply(await f.plan());const old=installed.steps[0].snapshot;
 await fs.writeFile(path.join(f.skill.path,'scripts/test.txt'),'new upstream');await f.c.scan();
 const preview=await f.ops.plan({projectId:f.project.id,revision:1,changes:[{action:'update',skillId:f.skill.id,bindingId:installed.steps[0].bindingId}]});
 const updated=await f.apply(preview,'update-key-001');assert.equal(updated.status,'succeeded');assert.notEqual(updated.steps[0].snapshot,old);assert.equal(await fs.readFile(path.join(old,'scripts/test.txt'),'utf8'),'never execute');
 const undo=await f.ops.plan({kind:'undo-operation',operationId:updated.id});const restored=await f.apply(undo,'restore-key-001');assert.equal(restored.status,'succeeded');assert.equal(await fs.readlink(installed.steps[0].target),old);
 await fs.writeFile(path.join(old,'scripts/test.txt'),'personal');await assert.rejects(f.ops.plan({projectId:f.project.id,revision:3,changes:[{action:'update',skillId:f.skill.id,bindingId:restored.steps[0].bindingId}]}),/个人修改/);
});
test('concurrent requests cannot both execute a stale plan',async t=>{
 const f=await setup(t),p=await f.plan();const results=await Promise.allSettled([f.apply(p,'concurrent-one'),f.apply(p,'concurrent-two')]);assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.status==='succeeded').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('whole-package symlink and oversize files are rejected without project writes',async t=>{
 const f=await setup(t);await fs.symlink('/etc/passwd',path.join(f.skill.path,'escape'));await assert.rejects(f.plan(),/链接/);assert.deepEqual(await fs.readdir(f.project.path),[]);
 await fs.unlink(path.join(f.skill.path,'escape'));await fs.writeFile(path.join(f.skill.path,'large'),Buffer.alloc(4*1024*1024+1));await assert.rejects(f.plan(),/超限/);assert.deepEqual(await fs.readdir(f.project.path),[]);
});
test('cancellation at durable safe boundary writes no project entry',async t=>{
 const f=await setup(t),p=await f.plan();const result=await f.ops.execute({planId:p.id,hash:p.hash,confirm:true,idempotencyKey:'cancel-test-key'},op=>f.c.put('cancellation',{id:op.id}));assert.equal(result.status,'rolled-back');await assert.rejects(fs.lstat(p.steps[0].target),{code:'ENOENT'});
});
test('copy preserves nested directory modes after writing children',async t=>{
 const f=await setup(t);await fs.chmod(path.join(f.skill.path,'scripts'),0o555);const p=await f.plan(),op=await f.apply(p);assert.equal(op.status,'succeeded');assert.equal((await fs.stat(path.join(op.steps[0].snapshot,'scripts'))).mode&0o777,0o555);
 await fs.chmod(path.join(f.skill.path,'scripts'),0o755);await fs.chmod(path.join(op.steps[0].snapshot,'scripts'),0o755);
});
test('permission preflight failure creates no project container',async t=>{
 const f=await setup(t);await fs.chmod(f.c.directory,0o500);try{await assert.rejects(f.plan(),/权限/);assert.deepEqual(await fs.readdir(f.project.path),[]);}finally{await fs.chmod(f.c.directory,0o700);}
});
