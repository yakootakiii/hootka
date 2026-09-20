import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hootka/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Only the component tests pay for a DOM.
    environmentMatchGlobs: [['tests/ui/**', 'jsdom']],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['packages/core/src/**', 'apps/web/src/lib/**', 'apps/web/src/components/**'],
      // The Firebase wiring is configuration, not logic: it is covered by the
      // emulator load test rather than by unit tests.
      exclude: ['**/*.d.ts', 'apps/web/src/lib/firebase.ts', 'apps/web/src/lib/firebase-host.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
