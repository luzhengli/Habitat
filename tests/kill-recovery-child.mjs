import { Catalog } from '../apps/server/catalog.mjs';
import { Operations } from '../apps/server/operations.mjs';
const c=new Catalog(process.argv[2]);
const ops=new Operations(c,{faultHook:async()=>{process.send('applied');await new Promise(()=>{});}});
const project=c.list('project')[0],skill=c.inventory().skills[0];
const plan=await ops.plan({projectId:project.id,revision:project.revision,changes:[{action:'add',skillId:skill.id}]});
await ops.execute({planId:plan.id,hash:plan.hash,confirm:true,idempotencyKey:'kill-recovery-key'});
