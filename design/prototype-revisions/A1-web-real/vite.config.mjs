import { defineConfig } from '../../../apps/web/node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const webModules = path.resolve(root, '../../../apps/web/node_modules');

export default defineConfig({
  root,
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: path.join(webModules, 'react/jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.join(webModules, 'react/jsx-dev-runtime.js') },
      { find: /^react$/, replacement: path.join(webModules, 'react/index.js') },
      { find: /^react-dom\/client$/, replacement: path.join(webModules, 'react-dom/client.js') }
    ]
  },
  server: { host: '127.0.0.1', port: 5191, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, modulePreload: { polyfill: false } }
});
