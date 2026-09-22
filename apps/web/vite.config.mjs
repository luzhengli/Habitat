import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  server: { host: '127.0.0.1', port: 5173, strictPort: true, allowedHosts: ['127.0.0.1'], cors: false,
    proxy: { '/api': { target: 'http://127.0.0.1:4173', changeOrigin: true }, '/demo': { target: 'http://127.0.0.1:4173', changeOrigin: true } } },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false }
});
