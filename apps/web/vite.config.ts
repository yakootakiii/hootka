import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hootka/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173, host: true },
  build: {
    // Emitted to <repo root>/dist, not apps/web/dist. Vercel's Root Directory
    // has to be the repo root for the /api routes to deploy, and its default
    // output directory is "dist" relative to that - so this lands where both
    // vercel.json and an untouched dashboard setting expect it.
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
  },
});
