import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { authorizeRoots } from './inventory.mjs';
import { requireValue } from './catalog.mjs';
import { directory, exists, identity, manifest, copySnapshot, digest } from './files.mjs';
export const ADAPTER = { id:'claude-code', name:'Claude Code', container:'.claude/skills', evidenceUrl:'https://code.claude.com/docs/en/skills', checkedAt:'2026-09-22', runtimeVersion:null, discovery:'unknown', note:'项目入口预计可发现；个人/企业范围可能优先，未授权范围未扫描。多个工具若读取该目录会共享入口，并非权限隔离。' };
const nested = (a,b) => {const r=path.relative(a,b);return r===''||!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);};
export class Operations {
 constructor(catalog,{faultHook}={}) {this.c=catalog;this.lock=false;this.faultHook=faultHook;}
 async project(input) {
  requireValue(input.confirm === true && input.writeScope === ADAPTER.container,'GRANT_REQUIRED','请明确授权项目 .claude/skills 写入范围');
  let grant;try{[grant]=await authorizeRoots([input.directory]);}catch{requireValue(false,'INVALID_PROJECT','项目路径必须是可访问的绝对真实目录');}
  const store=path.resolve(this.c.directory,'store');
  requireValue(!nested(grant.path,store)&&!nested(store,grant.path),'STORE_OVERLAP','项目与 Store 不能互为祖先/后代');
  requireValue(!this.c.list('project').some(p=>p.path===grant.path),'PROJECT_EXISTS','项目已登记',409);
  return this.c.put('project',{...grant,id:randomUUID(),name:path.basename(grant.path),defaultAgentIds:['claude-code'],writeScope:ADAPTER.container,revision:0,grantedAt:new Date().toISOString(),revokedAt:null});
 }
 async parents(project, create=false, operation=null) {
  requireValue(!project.revokedAt,'GRANT_REVOKED','项目写授权已撤销',403);await directory(project.path,project.identity);
  const values=[];let current=project.path;
  for(const part of ['.claude','skills']) {
   current=path.join(current,part);const stat=await exists(current);
   if(!stat) {
    if(create){await fs.mkdir(current,{mode:0o755});if(operation){operation.createdDirectories.push({path:current,identity:await directory(current)});this.c.put('operation',operation);}}
    values.push({path:current,identity:create?await directory(current):null});
   } else {values.push({path:current,identity:await directory(current)});}
  }
  return values;
 }
 async targetState(target) { const s=await exists(target);return !s?null:{identity:identity(s),type:s.isSymbolicLink()?'link':s.isDirectory()?'directory':'file',link:s.isSymbolicLink()?await fs.readlink(target):null}; }
 async preflight(plan) {
  const project=this.c.get('project',plan.projectId);requireValue(project&&project.revision===plan.revision,'REVISION_CHANGED','项目已变化，请重新预览',409);
  const parents=await this.parents(project);
  for(const expected of plan.parents) {const current=parents.find(p=>p.path===expected.path);requireValue(expected.identity===current.identity,'PATH_CHANGED','项目父目录在预览后改变',409);}
  for(const step of plan.steps) {
   requireValue(JSON.stringify(await this.targetState(step.target))===JSON.stringify(step.before),'TARGET_CHANGED','目标已存在或身份改变，未施工',409);
   if(step.action==='add'||step.action==='replace') {
    if(step.action==='replace') requireValue((await manifest(step.previous.snapshot)).hash===step.previous.manifest.hash,'PERSONAL_MODIFICATION','旧快照存在个人修改，拒绝更新',409);
    if(step.sourceId) {const source=this.c.grants().find(s=>s.id===step.sourceId);requireValue(source,'GRANT_REVOKED','来源授权已撤销',403);await directory(source.path,source.identity);const m=await manifest(step.source);requireValue(m.hash===step.manifest.hash&&m.rootIdentity===step.manifest.rootIdentity,'SOURCE_CHANGED','完整源包已变化',409);}
    else {requireValue((await manifest(step.snapshot)).hash===step.manifest.hash,'SNAPSHOT_CHANGED','受管快照改变',409);}
   } else {
    requireValue(step.before?.type==='link'&&step.before.link===step.snapshot&&JSON.stringify(step.before)===JSON.stringify(step.after),'NOT_OWNED','目标不是可证明的受管入口',409);
    requireValue((await manifest(step.snapshot)).hash===step.manifest.hash,'SNAPSHOT_CHANGED','受管快照已被修改，拒绝移除',409);
   }
  }
  return project;
 }
 async plan(input) {
  let project=this.c.get('project',input.projectId), changes=input.changes;
  let undo=null;
  if(input.kind==='undo-operation') {
   undo=this.c.get('operation',input.operationId);requireValue(undo?.status==='succeeded','UNDO_UNAVAILABLE','该操作不能撤销',409);
   project=this.c.get('project',undo.projectId);requireValue(project.revision===undo.resultRevision,'LATER_CHANGE','项目已有后续变更，拒绝旧撤销',409);
   changes=undo.steps.map(s=>({action:s.action==='replace'?'restore-version':s.action==='add'?'remove':'restore',bindingId:s.bindingId,step:s}));
  }
  requireValue(project,'PROJECT_UNKNOWN','项目不存在',404);
  requireValue(input.kind==='undo-operation'||input.revision===project.revision,'REVISION_CHANGED','项目版本已变化',409);
  requireValue(Array.isArray(changes)&&changes.length>0&&changes.length<=50,'INVALID_INTENT','选择 1–50 项变更');
  const parents=await this.parents(project),steps=[];
  for(const change of changes) {
   if(change.action==='add'||change.action==='update') {
    const skill=this.c.get('skill',change.skillId);requireValue(skill,'SKILL_UNKNOWN','技能不存在',404);await this.c.read(skill.id);
    const name=skill.declaredName;requireValue(typeof name==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)&&name.length<=64&&name!=='synced','INVALID_NAME','技能名称不适合项目入口');
    const target=path.join(project.path,ADAPTER.container,name),before=await this.targetState(target);
    const previous=change.action==='update'?this.c.get('binding',change.bindingId):null;
    if(previous){requireValue(previous.active&&previous.projectId===project.id&&previous.target===target&&JSON.stringify(before)===JSON.stringify(previous.after),'TARGET_CHANGED','更新目标不是未漂移的受管入口',409);requireValue((await manifest(previous.snapshot)).hash===previous.manifest.hash,'PERSONAL_MODIFICATION','旧快照存在个人修改，拒绝覆盖',409);}else requireValue(!before,'TARGET_CONFLICT','目标已有内容，不能覆盖',409);
    const store=path.join(this.c.directory,'store');requireValue(!nested(skill.path,store)&&!nested(store,skill.path),'STORE_OVERLAP','来源与 Store 不能互为祖先/后代');
    const m=await manifest(skill.path);steps.push({action:previous?'replace':'add',previous,skillId:skill.id,sourceId:skill.sourceId,source:skill.path,name,target,before,manifest:m,snapshot:path.join(this.c.directory,'store',m.hash),bindingId:randomUUID()});
   }else if(change.action==='remove') {
    const binding=this.c.get('binding',change.bindingId);requireValue(binding?.active&&binding.projectId===project.id,'BINDING_UNKNOWN','配置不属于该项目',409);
    steps.push({...binding,action:'remove',before:await this.targetState(binding.target),bindingId:binding.id});
   }else if(change.action==='restore-version'&&undo){const current=this.c.get('binding',change.bindingId);requireValue(current?.active,'BINDING_UNKNOWN','更新配置已变化',409);steps.push({...change.step.previous,action:'replace',previous:current,sourceId:null,before:await this.targetState(current.target),bindingId:randomUUID()});
   }else if(change.action==='restore'&&undo) {steps.push({...change.step,action:'add',sourceId:null,before:null,bindingId:randomUUID()});}
   else requireValue(false,'INVALID_INTENT','不支持的变更动作');
  }
  requireValue(new Set(steps.map(s=>s.target)).size===steps.length,'DUPLICATE_TARGET','一个计划不能重复修改同一入口');
  const plan={id:randomUUID(),projectId:project.id,revision:project.revision,parents,steps,draftChanges:changes,expiresAt:Date.now()+600000,kind:input.kind??'configure',undoOf:undo?.id??null,impact:ADAPTER.note,status:'ready'};
  await this.preflight(plan);plan.hash=digest(plan);return this.c.put('plan',plan);
 }
 async execute(input, onStart) {
  requireValue(input.confirm===true&&typeof input.idempotencyKey==='string'&&input.idempotencyKey.length>=8&&input.idempotencyKey.length<=128,'CONFIRM_REQUIRED','需要明确确认及幂等键');
  const payload=digest({planId:input.planId,hash:input.hash});
  const prior=this.c.list('operation').find(o=>o.key===input.idempotencyKey);
  if(prior){requireValue(prior.payload===payload,'IDEMPOTENCY_CONFLICT','幂等键用于不同计划',409);return prior;}
  requireValue(!this.lock&&!this.c.list('operation').some(o=>['running','recovery-required'].includes(o.status)),'OPERATION_LOCKED','有执行中或待恢复操作',409);
  this.lock=true;let operation;
  try {
   const plan=this.c.get('plan',input.planId);requireValue(plan&&plan.hash===input.hash&&plan.expiresAt>Date.now(),'PLAN_EXPIRED','预览已失效或 hash 不匹配',409);
   const project=await this.preflight(plan);
   operation=this.c.put('operation',{id:randomUUID(),key:input.idempotencyKey,payload,planId:plan.id,projectId:project.id,revision:project.revision,parents:plan.parents,status:'running',steps:plan.steps.map(s=>({...s,status:'pending'})),createdDirectories:[],startedAt:new Date().toISOString()});
   if(onStart)onStart({...operation});
   await this.parents(project,true,operation);
   const parentIdentity=await directory(path.join(project.path,ADAPTER.container));
   await fs.mkdir(path.join(this.c.directory,'store'),{recursive:true,mode:0o700});await directory(path.join(this.c.directory,'store'));
   for(const step of operation.steps) {
    requireValue(!this.c.get('cancellation',operation.id),'CANCELLED','用户请求在安全边界取消');
    requireValue(!this.c.get('project',project.id)?.revokedAt,'GRANT_REVOKED','项目授权在执行中撤销',403);
    if(step.sourceId)requireValue(this.c.grants().some(s=>s.id===step.sourceId),'GRANT_REVOKED','来源授权在执行中撤销',403);
    await directory(project.path,project.identity);await directory(path.join(project.path,ADAPTER.container),parentIdentity);
    requireValue(JSON.stringify(await this.targetState(step.target))===JSON.stringify(step.before),'TARGET_CHANGED','执行前目标变化',409);
    step.status='intent';this.c.put('operation',operation);
    if(step.action==='add'||step.action==='replace') {
     if(await exists(step.snapshot)) requireValue((await manifest(step.snapshot)).hash===step.manifest.hash,'SNAPSHOT_CHANGED','已有快照发生漂移',409);
     else {requireValue(step.sourceId&&this.c.grants().some(s=>s.id===step.sourceId),'GRANT_REVOKED','来源授权已撤销',403);const staging=path.join(this.c.directory,'store',`.staging-${operation.id}-${step.bindingId}`);await copySnapshot(step.source,staging,step.manifest);await fs.rename(staging,step.snapshot);}
     if(step.action==='replace'){const temporary=step.target+`.habitat-${operation.id}`;await fs.symlink(step.snapshot,temporary,'dir');requireValue(JSON.stringify(await this.targetState(step.target))===JSON.stringify(step.before),'TARGET_CHANGED','切换前目标变化',409);await fs.rename(temporary,step.target);}else await fs.symlink(step.snapshot,step.target,'dir');
    }else await fs.unlink(step.target);
    step.after=await this.targetState(step.target);step.status='applied';this.c.put('operation',operation);
    if(this.faultHook)await this.faultHook(operation,step);
    requireValue(step.action!=='remove'?step.after?.link===step.snapshot:step.after===null,'READBACK_FAILED','入口回读失败',409);
    step.status='verified';this.c.put('operation',operation);
   }
   this.c.db.exec('BEGIN IMMEDIATE');
   try {
    for(const step of operation.steps) {if(step.action!=='remove'){if(step.previous)this.c.put('binding',{...step.previous,active:false});this.c.put('binding',{...step,id:step.bindingId,projectId:project.id,active:true,configuredAt:new Date().toISOString(),discovery:'unknown'});}else this.c.put('binding',{...this.c.get('binding',step.bindingId),active:false});}
    project.revision++;this.c.put('project',project);const draft=this.c.get('draft',project.id);if(draft&&JSON.stringify(draft.changes)===JSON.stringify(plan.draftChanges))this.c.put('draft',{...draft,changes:[],revision:project.revision,generation:(draft.generation??0)+1});operation.resultRevision=project.revision;operation.status='succeeded';operation.finishedAt=new Date().toISOString();this.c.put('operation',operation);this.c.db.exec('COMMIT');
   }catch(e){this.c.db.exec('ROLLBACK');throw e;}
   return operation;
  }catch(error){if(operation){operation.error=error.message;await this.compensate(operation);return operation;}throw error;}
  finally {this.lock=false;}
 }
 async compensate(operation) {
  let blocked=false;
  const project=this.c.get('project',operation.projectId);
  for(const step of [...operation.steps].reverse()) {
   if(!['applied','verified','intent'].includes(step.status))continue;
   try {
    const actualParents=await this.parents(project);
    for(const actual of actualParents){const expected=operation.createdDirectories.find(p=>p.path===actual.path)??operation.parents?.find(p=>p.path===actual.path);requireValue(expected?.identity===actual.identity,'PATH_CHANGED','恢复时父目录身份改变',409);}
    const current=await this.targetState(step.target);
    if(step.action==='add'||step.action==='replace') {
     if(current===null){step.status='rolled-back';continue;}
     requireValue(step.after&&JSON.stringify(current)===JSON.stringify(step.after),'RECOVERY_UNKNOWN','缺少回读身份或入口已改变',409);
     await fs.unlink(step.target);
     if(step.action==='replace'){await fs.symlink(step.previous.snapshot,step.target,'dir');this.c.put('binding',{...step.previous,after:await this.targetState(step.target)});}
    }else {
     if(JSON.stringify(current)===JSON.stringify(step.before)){step.status='rolled-back';continue;}
     requireValue(step.after===null&&current===null,'RECOVERY_UNKNOWN','目标改变或缺少执行证据',409);
     await fs.symlink(step.snapshot,step.target,'dir');
     const binding=this.c.get('binding',step.bindingId);if(binding)this.c.put('binding',{...binding,after:await this.targetState(step.target)});
    }
    step.status='rolled-back';this.c.put('operation',operation);
   }catch(e){blocked=true;step.recovery=e.message;}
  }
  operation.status=blocked?'recovery-required':'rolled-back';operation.finishedAt=new Date().toISOString();return this.c.put('operation',operation);
 }
 async recover() { for(const operation of this.c.list('operation').filter(o=>o.status==='running')) {operation.error='服务中断；依据持久步骤补偿，未知对象保留';await this.compensate(operation);} }
 async exposures(id) {
  const project=this.c.get('project',id);requireValue(project,'NOT_FOUND','项目不存在',404);
  const items=[];
  for(const binding of this.c.list('binding').filter(b=>b.projectId===id&&b.active)) {
   let configured=false,message=null;try{await this.parents(project);const state=await this.targetState(binding.target);configured=JSON.stringify(state)===JSON.stringify(binding.after)&&(await manifest(binding.snapshot)).hash===binding.manifest.hash;}catch(e){message=e.message;}
   items.push({...binding,configured,discovery:'unknown',message:message??(configured?'入口已回读；Agent 未运行实测':'入口或快照缺失/漂移')});
  }
  return {items,adapter:ADAPTER,otherScopes:{status:'unknown',message:'个人、企业和父目录未获得读取授权；移除项目入口不代表全局禁用。'}};
 }
}
