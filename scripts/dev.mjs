import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(path.join(root, 'apps/web/node_modules/vite/bin/vite.js'))) { console.error('First run npm run setup:web. For an offline reference only, run npm start.'); process.exit(1); }
if (process.env.HABITAT_PORT && process.env.HABITAT_PORT !== '4173') { console.error('Dev proxy uses 4173; unset HABITAT_PORT or change the explicit Vite proxy and service port together.'); process.exit(1); }
const children = [
  spawn(process.execPath, ['--watch', 'apps/server/index.mjs', '--dev', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: path.join(root, 'apps/web'), stdio: 'inherit' })
];
let stopping = false;
const stop = code => { if (stopping) return; stopping = true; children.forEach(c => c.kill('SIGTERM')); process.exitCode = code; };
children.forEach(c => { c.on('error', e => { console.error(e.message); stop(1); }); c.on('exit', code => stop(code ?? 0)); });
process.on('SIGINT', () => stop(0)); process.on('SIGTERM', () => stop(0));
console.log('React dev UI: http://127.0.0.1:5173 ; API is proxied to 127.0.0.1:4173.');
