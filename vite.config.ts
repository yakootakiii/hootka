import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { apiDevServer } from './tools/api-dev-server';

export default defineConfig({
  plugins: [react(), apiDevServer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hootka/core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173, host: true },
  build: { outDir: 'dist', sourcemap: true },
});
