import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Catalog} from '../apps/server/catalog.mjs';
import {skillFiles} from '../apps/server/skill-files.mjs';
test('opaque file IDs read only bounded granted text and reject unknown/binary/revoked',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'habitat-files-')),c=new Catalog(path.join(dir,'data'));t.after(async()=>{c.close();await fs.rm(dir,{recursive:true,force:true});});
 await fs.mkdir(path.join(dir,'source/one'),{recursive:true});await fs.writeFile(path.join(dir,'source/one/SKILL.md'),'---\nname: one\ndescription: x\n---\ntext');await fs.writeFile(path.join(dir,'source/one/asset.bin'),Buffer.from([0,1,2]));
 const source=await c.authorize({absolutePath:path.join(dir,'source'),permission:'read-only',confirm:true});await c.scan();const skill=c.inventory().skills[0],files=await skillFiles(c,skill.id);assert.equal(files.items.length,2);const md=files.items.find(e=>e.path==='SKILL.md');assert.match((await skillFiles(c,skill.id,md.id)).text,/name: one/);await assert.rejects(skillFiles(c,skill.id,'../../etc/passwd'),/清单/);await assert.rejects(skillFiles(c,skill.id,files.items.find(e=>e.path==='asset.bin').id),/二进制/);c.revoke(source.id);await assert.rejects(skillFiles(c,skill.id,md.id),/撤销/);
});
