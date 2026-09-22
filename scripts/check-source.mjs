import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'||e.name==='dist'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
let checked=0;
for(const f of [...walk(path.join(root,'apps/server')),...walk(path.join(root,'scripts')),...walk(path.join(root,'apps/bootstrap'))]) {
 if(!f.endsWith('.mjs'))continue;
 const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(1);}checked++;
}
for(const f of walk(path.join(root,'apps/web/src'))) {
 if(!/\.(jsx?|tsx?|mjs)$/.test(f))continue;
 const s=fs.readFileSync(f,'utf8');
 if(/@tauri-apps|invoke\(|from\s+['"].*(?:model|reference\/air)/.test(s))throw Error('Production seed must not import native IPC or demo state: '+f);
}
console.log(`Source boundary and ${checked} JavaScript syntax checks passed. This is NOT a Vite build, JSX typecheck, or a security certification.`);
