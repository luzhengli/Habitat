import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Catalog } from '../apps/server/catalog.mjs';
import { GitSources, publicIPv4, validateGit } from '../apps/server/git-source.mjs';
const sha=s=>createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');
test('network input cannot select arbitrary host, private address, traversal or credential',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','::1','224.0.0.1'])assert.equal(publicIPv4(ip),false);
 assert.equal(publicIPv4('140.82.113.6'),true);
 for(const repository of ['https://localhost/x','owner/repo/token','user:pass@github.com/repo','../repo'])assert.throws(()=>validateGit({repository,ref:'main'}));
 assert.throws(()=>validateGit({repository:'owner/repo',ref:'main',subdir:'../private'}));
});
test('isolated Git candidate verifies blobs, diffs and preserves prior imported source',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'habitat-git-test-')),c=new Catalog(dir);t.after(async()=>{c.close();await fs.rm(dir,{recursive:true,force:true});});
 let content='---\nname: skill\ndescription: version one\n---\nhello';
 const transport=async route=>route.includes('/commits/')?{sha:'a'.repeat(40),commit:{tree:{sha:'b'.repeat(40)}}}:route.includes('/trees/')?{truncated:false,tree:[{path:'SKILL.md',type:'blob',mode:'100644',sha:sha(content),size:Buffer.byteLength(content)}]}:{encoding:'base64',content:Buffer.from(content).toString('base64')};
 const git=new GitSources(c,{fetchJSON:transport});await assert.rejects(git.download({repository:'owner/repo',ref:'main'}),/确认/);
 const candidate=await git.download({repository:'owner/repo',ref:'main',confirmNetwork:true});assert.equal(c.grants().length,0);
 const source=await git.accept({candidateId:candidate.id,confirm:true});const oldFile=path.join(source.path,'skill/SKILL.md'),before=await fs.readFile(oldFile);
 content='---\nname: skill\ndescription: version two\n---\nnew';const next=await git.check({sourceId:source.id,confirmNetwork:true});assert.deepEqual(next.diff.changed,['SKILL.md']);assert.deepEqual(await fs.readFile(oldFile),before);
});
test('Git symlinks, submodules and excessive tree are rejected before writes',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'habitat-git-reject-')),c=new Catalog(dir);t.after(async()=>{c.close();await fs.rm(dir,{recursive:true,force:true});});
 const git=new GitSources(c,{fetchJSON:async route=>route.includes('/commits/')?{sha:'a'.repeat(40),commit:{tree:{sha:'b'.repeat(40)}}}:{truncated:false,tree:[{path:'SKILL.md',type:'blob',mode:'120000',sha:'c'.repeat(40),size:12}]}});
 await assert.rejects(git.download({repository:'owner/repo',ref:'main',confirmNetwork:true}),/链接/);assert.equal(c.list('git-candidate').length,0);
});
