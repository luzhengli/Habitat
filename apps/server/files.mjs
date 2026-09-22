import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { requireValue } from './catalog.mjs';
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const identity = s => `${s.dev}:${s.ino}`;
export const exists = async p => { try {return await fs.lstat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;} };
export async function directory(p, expected) {
 const s=await fs.lstat(p);requireValue(s.isDirectory()&&!s.isSymbolicLink()&&await fs.realpath(p)===p&&(!expected||identity(s)===expected),'PATH_CHANGED','目录身份改变或包含链接',409);return identity(s);
}
export async function manifest(root) {
 const rootIdentity=await directory(root), entries=[];let bytes=0;
 async function walk(relative='') {
  const folder=path.join(root,relative), before=await directory(folder);
  for(const name of (await fs.readdir(folder)).sort()) {
   requireValue(entries.length<1000,'PACKAGE_LIMIT','技能包超过 1000 项');
   const rel=path.join(relative,name), p=path.join(root,rel), s=await fs.lstat(p);
   requireValue(!s.isSymbolicLink()&&(s.isFile()||s.isDirectory()),'UNSUPPORTED_ENTRY','托管不允许符号链接或特殊文件');
   if(s.isDirectory()){entries.push({path:rel,type:'directory',mode:s.mode&0o777});await walk(rel);}
   else {
    bytes+=s.size;requireValue(s.size<=4*1024*1024&&bytes<=20*1024*1024,'PACKAGE_LIMIT','技能包文件或总大小超限');
    const handle=await fs.open(p,constants.O_RDONLY|constants.O_NOFOLLOW);
    let content;
    try {const opened=await handle.stat();requireValue(identity(opened)===identity(s)&&opened.isFile(),'PATH_CHANGED','读取时文件改变',409);content=Buffer.alloc(s.size+1);const {bytesRead}=await handle.read(content,0,content.length,0);content=content.subarray(0,bytesRead);const after=await handle.stat();requireValue(bytesRead===s.size&&after.mtimeMs===s.mtimeMs&&identity(await fs.lstat(p))===identity(s),'PATH_CHANGED','读取时文件改变',409);}finally{await handle.close();}
    entries.push({path:rel,type:'file',mode:s.mode&0o777,size:s.size,hash:digest(content)});
   }
  }
  await directory(folder,before);
 }
 await walk();await directory(root,rootIdentity);
 return {entries,bytes,hash:digest(entries),rootIdentity};
}
export async function copySnapshot(source, target, expected) {
 const current=await manifest(source);requireValue(current.hash===expected.hash&&current.rootIdentity===expected.rootIdentity,'SOURCE_CHANGED','完整技能包在预览后改变',409);
 await fs.mkdir(target,{mode:0o700});
 for(const entry of expected.entries){const dest=path.join(target,entry.path);if(entry.type==='directory')await fs.mkdir(dest,{mode:0o700});else {await fs.copyFile(path.join(source,entry.path),dest,constants.COPYFILE_EXCL);await fs.chmod(dest,entry.mode);const h=await fs.open(dest,'r');await h.sync();await h.close();}}
 for(const entry of [...expected.entries].reverse())if(entry.type==='directory')await fs.chmod(path.join(target,entry.path),entry.mode);
 const after=await manifest(target), original=await manifest(source);requireValue(after.hash===expected.hash&&original.hash===expected.hash,'COPY_MISMATCH','副本或来源指纹改变',409);return after;
}
