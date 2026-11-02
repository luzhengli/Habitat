import { build } from '../../../apps/web/node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
await build({ configFile: path.join(root, 'vite.config.mjs') });

const htmlPath = path.join(root, 'dist/index.html');
let html = await fs.readFile(htmlPath, 'utf8');
const cssHref = html.match(/<link rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
const jsSrc = html.match(/<script type="module"[^>]+src="([^"]+)"/)?.[1];
if (!cssHref || !jsSrc) throw new Error('Vite output did not contain the expected CSS and JS assets.');
const assetPath = value => path.join(root, 'dist', value.replace(/^\.\//, '').replace(/^\//, ''));
const css = await fs.readFile(assetPath(cssHref), 'utf8');
const js = (await fs.readFile(assetPath(jsSrc), 'utf8')).replaceAll('</script', '<\\/script');
html = html
  .replace(/<link rel="stylesheet"[^>]+>/, () => `<style>${css}</style>`)
  .replace(/<script type="module"[^>]+><\/script>/, () => `<script type="module">${js}</script>`);
await fs.writeFile(path.join(root, 'dist/Habitat-A1-web-real.html'), html);
