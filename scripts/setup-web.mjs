import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = path.join(root, 'apps/web');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
  console.error('A lockfile already exists. Use npm --prefix apps/web ci; this script will not silently re-resolve versions.'); process.exit(1);
}
console.log('Installing official React/Vite/TypeScript packages and saving exact resolved versions. Requires registry access.');
for (const args of [ ['install', '--save-exact', 'react', 'react-dom'], ['install', '--save-dev', '--save-exact', 'vite', 'typescript', '@types/react', '@types/react-dom'] ]) {
  const result = spawnSync(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status) { console.error('Setup incomplete. Do not report frontend ready; inspect package.json and package-lock.json before retrying.'); process.exit(result.status); }
}
console.log('Dependencies installed. Run npm run build, npm --prefix apps/web run typecheck, npm run check; commit package.json and lockfile after review.');
