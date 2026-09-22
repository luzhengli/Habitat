import fs from 'node:fs';
import path from 'node:path';
export function lockInstance(directory) {
 const file=path.join(directory,'service.lock');
 const claim=()=>{const fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,String(process.pid));fs.fsyncSync(fd);fs.closeSync(fd);};
 try{claim();}catch(e){
  if(e.code!=='EEXIST')throw e;
  const pid=Number(fs.readFileSync(file,'utf8'));if(!Number.isInteger(pid)||pid<1)throw Error('Unknown service lock; inspect it before restarting.');
  let alive=true;try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
  if(alive)throw Error('Another Habitat service owns this data directory.');
  fs.unlinkSync(file);claim();
 }
 const release=()=>{try{if(fs.readFileSync(file,'utf8')===String(process.pid))fs.unlinkSync(file);}catch{}};
 process.once('exit',release);return release;
}
