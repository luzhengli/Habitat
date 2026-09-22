import path from 'node:path';
import os from 'node:os';
import { lockInstance } from './instance.mjs';
import { GitSources } from './git-source.mjs';
import { Operations } from './operations.mjs';
import { Catalog } from './catalog.mjs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { authorizeRoots } from './inventory.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
try {
  if (process.env.HABITAT_HOST && process.env.HABITAT_HOST !== '127.0.0.1') throw new Error('Only HABITAT_HOST=127.0.0.1 is supported; do not expose this local service publicly.');
  const port = Number(process.env.HABITAT_PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('HABITAT_PORT must be 1024–65535.');
  const roots = process.argv.includes('--fixture') ? [path.join(root, 'fixtures/skills')] : JSON.parse(process.env.HABITAT_ROOTS ?? '[]');
  const grants = await authorizeRoots(roots);
  const dataDirectory = process.env.HABITAT_DATA_DIR ?? path.join(os.homedir(), '.habitat-web');
  const catalog = new Catalog(dataDirectory);
  const release = lockInstance(catalog.directory);
  for (const grant of grants) if (!catalog.grants().some(s => s.path === grant.path)) await catalog.authorize({absolutePath:grant.path,permission:'read-only',confirm:true});
  if (grants.length) await catalog.scan();
  const operations = new Operations(catalog); await operations.recover();
  const gitSources = new GitSources(catalog);
  const server = createApp({ root, grants, catalog, operations, gitSources, dev: process.argv.includes('--dev') });
  server.on('error', error => { console.error(`Habitat failed to listen: ${error.code ?? error.message}. No fallback port or public host was chosen.`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Habitat Web: http://127.0.0.1:${port}/\nAir reference: http://127.0.0.1:${port}/demo\nAuthorized read-only roots: ${catalog.grants().length}. Project writes: explicit grant + confirmed plan only.`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(async () => { while(operations.lock || gitSources.busy) await new Promise(resolve=>setTimeout(resolve,50)); catalog.close(); release(); }); server.closeAllConnections(); });
} catch (error) { console.error(error.message); process.exitCode = 1; }
