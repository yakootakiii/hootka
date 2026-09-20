import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  // jsdom is only present for the tests/ui suite.
  if (typeof document !== 'undefined') cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
