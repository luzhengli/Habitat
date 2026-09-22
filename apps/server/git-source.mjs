import https from 'node:https';
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { requireValue } from './catalog.mjs';
import { manifest, directory } from './files.mjs';
export function publicIPv4(ip) {
 const n=ip.split('.').map(Number);if(n.length!==4||n.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 return !(n[0]===0||n[0]===10||n[0]===127||n[0]>=224||n[0]===169&&n[1]===254||n[0]===172&&n[1]>=16&&n[1]<=31||n[0]===192&&n[1]===168||n[0]===100&&n[1]>=64&&n[1]<=127||n[0]===198&&[18,19].includes(n[1])||n[0]===192&&n[1]===0||n[0]===192&&n[1]===88&&n[2]===99||n[0]===198&&n[1]===51&&n[2]===100||n[0]===203&&n[1]===0&&n[2]===113);
}
export async function githubJSON(route,{timeoutMs=15000}={}) {
 requireValue(/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\//.test(route),'NETWORK_TARGET','仅允许公开 GitHub 仓库 API');
 const addresses=await dns.resolve4('api.github.com');requireValue(addresses.length&&addresses.every(publicIPv4),'SSRF_BLOCKED','GitHub 解析结果不是公开地址');
 return await new Promise((resolve,reject)=>{
  const req=https.get({hostname:'api.github.com',path:route,port:443,headers:{'User-Agent':'Habitat-Web','Accept':'application/vnd.github+json','Accept-Encoding':'identity'},lookup:(_host,options,cb)=>options?.all?cb(null,[{address:addresses[0],family:4}]):cb(null,addresses[0],4)},res=>{
   if(res.statusCode!==200){res.resume();reject(Error(`GitHub HTTP ${res.statusCode}; 不跟随重定向，不读取凭据`));return;}
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){req.destroy(Error('GitHub 响应超过 8 MiB'));return;}chunks.push(chunk);});res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){reject(e);}});res.on('error',reject);
  });
  const timeout=setTimeout(()=>req.destroy(Error('GitHub 请求超时')),timeoutMs);req.on('close',()=>clearTimeout(timeout));req.on('error',reject);
 });
}
export function validateGit(input) {
 requireValue(typeof input.repository==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(input.repository),'INVALID_REPOSITORY','使用 owner/repository，不能输入任意 URL');
 requireValue(typeof input.ref==='string'&&/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(input.ref)&&!input.ref.includes('..'),'INVALID_REF','Git ref 格式无效');
 const subdir=input.subdir??'';requireValue(typeof subdir==='string'&&(!subdir||subdir.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0')))&&subdir.length<=250,'INVALID_SUBDIR','子目录必须是安全相对路径');
 return {repository:input.repository,ref:input.ref,subdir};
}
export class GitSources {
 constructor(catalog,{fetchJSON=githubJSON}={}){this.c=catalog;this.fetchJSON=fetchJSON;this.busy=false;}
 async download(input) {
  requireValue(input.confirmNetwork===true,'NETWORK_CONSENT','需明确确认下载公开 GitHub 内容');const config=validateGit(input);
  requireValue(!this.busy,'DOWNLOAD_BUSY','已有下载任务',409);this.busy=true;
  try {
   const deadline=Date.now()+90000;const fetchBounded=route=>{requireValue(Date.now()<deadline,'DOWNLOAD_TIMEOUT','整体下载超过 90 秒');return this.fetchJSON(route,{timeoutMs:Math.max(1,Math.min(15000,deadline-Date.now()))});};
   const base=`/repos/${config.repository}`,commit=await fetchBounded(`${base}/commits/${encodeURIComponent(config.ref)}`);
   requireValue(/^[a-f0-9]{40}$/.test(commit.sha)&&/^[a-f0-9]{40}$/.test(commit.commit?.tree?.sha),'INVALID_GIT_RESPONSE','无效 commit/tree');
   const tree=await fetchBounded(`${base}/git/trees/${commit.commit.tree.sha}?recursive=1`);
   requireValue(!tree.truncated&&Array.isArray(tree.tree)&&tree.tree.length<=2000,'GIT_LIMIT','仓库树不完整或超过 2000 项');
   const prefix=config.subdir?config.subdir+'/':'';
   const entries=tree.tree.filter(e=>e.path.startsWith(prefix)&&e.path!==config.subdir);
   requireValue(entries.length>0&&entries.length<=1000,'GIT_LIMIT','选择的目录为空或超过 1000 项');
   let total=0;
   for(const entry of entries){const relative=entry.path.slice(prefix.length);requireValue(relative.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0'))&&!path.isAbsolute(relative),'UNSAFE_GIT_PATH','不安全的仓库路径');requireValue(/^[a-f0-9]{40}$/.test(entry.sha),'INVALID_GIT_SHA','无效对象 SHA');requireValue(entry.type==='tree'||entry.type==='blob'&&['100644','100755'].includes(entry.mode),'UNSAFE_GIT_ENTRY','不支持 Git 链接、子模块或特殊类型');if(entry.type==='blob'){requireValue(Number.isInteger(entry.size)&&entry.size>=0&&entry.size<=4*1024*1024,'GIT_LIMIT','文件超过 4 MiB');total+=entry.size;}}
   requireValue(total<=20*1024*1024,'GIT_LIMIT','选择的技能包超过 20 MiB');
   const candidateId=randomUUID(),root=path.join(this.c.directory,'downloads',candidateId);await fs.mkdir(root,{recursive:true,mode:0o700});await directory(root);
   for(const entry of entries){requireValue(Date.now()<deadline,'DOWNLOAD_TIMEOUT','整体下载超过 90 秒');const rel=entry.path.slice(prefix.length),file=path.join(root,rel);if(entry.type==='tree'){await fs.mkdir(file,{recursive:true,mode:0o755});continue;}
    const blob=await fetchBounded(`${base}/git/blobs/${entry.sha}`);requireValue(blob.encoding==='base64'&&typeof blob.content==='string','INVALID_BLOB','不支持的 Git blob');const bytes=Buffer.from(blob.content,'base64');const sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');requireValue(bytes.length===entry.size&&sha===entry.sha,'BLOB_MISMATCH','Git blob 内容不匹配');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes,{flag:'wx',mode:entry.mode==='100755'?0o755:0o644});
   }
   const m=await manifest(root);const previous=input.sourceId?this.c.get('source',input.sourceId):null;
   let diff=null;if(previous){const before=previous.git.manifest.entries;const now=m.entries;diff={added:now.filter(e=>!before.some(b=>b.path===e.path)).map(e=>e.path),removed:before.filter(e=>!now.some(b=>b.path===e.path)).map(e=>e.path),changed:now.filter(e=>before.some(b=>b.path===e.path&&JSON.stringify(b)!==JSON.stringify(e))).map(e=>e.path)};}
   return this.c.put('git-candidate',{id:candidateId,...config,commit:commit.sha,path:root,manifest:m,sourceId:previous?.id??null,diff,createdAt:new Date().toISOString()});
  }finally{this.busy=false;}
 }
 async accept(input) {
  requireValue(input.confirm===true,'CONFIRM_REQUIRED','确认收录下载候选');const candidate=this.c.get('git-candidate',input.candidateId);requireValue(candidate,'NOT_FOUND','候选不存在',404);requireValue((await manifest(candidate.path)).hash===candidate.manifest.hash,'CANDIDATE_CHANGED','下载候选改变',409);
  // A single root skill is represented by a collection parent; nested skill collections stay unchanged.
  let collection=candidate.path;
  try{await fs.lstat(path.join(collection,'SKILL.md'));collection=path.join(this.c.directory,'git-collections',candidate.id);await fs.mkdir(collection,{recursive:true});const content=await fs.readFile(path.join(candidate.path,'SKILL.md'),'utf8');const name=(await import('./catalog.mjs')).metadata(content,'').declaredName;requireValue(typeof name==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name),'INVALID_NAME','根技能名称无效');const target=path.join(collection,name);await fs.cp(candidate.path,target,{recursive:true,errorOnExist:true,force:false});}catch(e){if(e.code!=='ENOENT')throw e;}
  const source=await this.c.authorize({absolutePath:collection,permission:'read-only',confirm:true});source.kind='public-github';source.git={repository:candidate.repository,ref:candidate.ref,subdir:candidate.subdir,commit:candidate.commit,manifest:candidate.manifest};source.previousSourceId=candidate.sourceId;this.c.put('source',source);await this.c.scan();return source;
 }
 async check(input){const source=this.c.get('source',input.sourceId);requireValue(source?.git,'NO_GIT_SOURCE','来源不是可追溯 Git 仓库');return this.download({...source.git,sourceId:source.id,confirmNetwork:input.confirmNetwork});}
}
