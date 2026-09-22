import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'MANIFEST.json'), 'utf8'));
const errors = [];
for (const item of manifest.files) {
  const full = path.resolve(root, item.path);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid manifest path');
  try {
    const stat = await fs.lstat(full);
    if (!stat.isFile() || stat.isSymbolicLink()) { errors.push(item.path + ': not a regular file'); continue; }
    const data = await fs.readFile(full);
    const digest = createHash('sha256').update(data).digest('hex');
    if (digest !== item.sha256 || data.length !== item.bytes) errors.push(item.path + ': changed');
  } catch { errors.push(item.path + ': unavailable'); }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Verified ${manifest.files.length} delivered files. Intentional code changes after handoff are not errors in development.`);
