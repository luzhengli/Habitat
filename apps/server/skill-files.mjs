import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {manifest,digest,directory} from './files.mjs';
import {requireValue} from './catalog.mjs';
export async function skillFiles(catalog,id,fileId) {
 await catalog.read(id);const skill=catalog.get('skill',id),source=catalog.grants().find(g=>g.id===skill.sourceId);await directory(source.path,source.identity);
 const m=await manifest(skill.path),items=m.entries.map(e=>({...e,id:digest(e.path).slice(0,24)}));
 if(!fileId)return {items};
 const entry=items.find(e=>e.id===fileId);requireValue(entry?.type==='file','FILE_UNKNOWN','文件不在当前受限清单中',404);requireValue(entry.size<=262144,'FILE_TOO_LARGE','文本预览最多 256 KiB',413);
 const h=await fs.open(path.join(skill.path,entry.path),constants.O_RDONLY|constants.O_NOFOLLOW);let bytes;
 try{const stat=await h.stat();requireValue(stat.isFile()&&stat.size===entry.size,'FILE_CHANGED','文件变化',409);bytes=Buffer.alloc(entry.size+1);const read=await h.read(bytes,0,bytes.length,0);bytes=bytes.subarray(0,read.bytesRead);}finally{await h.close();}
 requireValue(digest(bytes)===entry.hash,'FILE_CHANGED','文件在读取时变化',409);await catalog.read(id);await directory(source.path,source.identity);await directory(skill.path,m.rootIdentity);
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{requireValue(false,'UNSUPPORTED_BINARY','仅支持 UTF-8 文本',422);}requireValue(!text.includes('\0'),'UNSUPPORTED_BINARY','二进制文件不预览');return {text,path:entry.path};
}
