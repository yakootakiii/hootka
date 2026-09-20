import { afterEach, describe, expect, it, vi } from 'vitest';
import { REQUIRED_KEYS, missingFirebaseConfig } from '@/lib/config';

const VALID = {
  VITE_FIREBASE_API_KEY: 'AIzaSyFake',
  VITE_FIREBASE_AUTH_DOMAIN: 'hootka.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://hootka-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'hootka',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
};

function setEnv(values: Record<string, string | undefined>) {
  for (const key of [...REQUIRED_KEYS, 'VITE_USE_EMULATORS']) {
    vi.stubEnv(key, values[key] ?? '');
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('missingFirebaseConfig', () => {
  it('passes a complete config', () => {
    setEnv(VALID);
    expect(missingFirebaseConfig()).toEqual([]);
  });

  // A deploy with no environment variables otherwise renders a blank page.
  it('names every variable that was never set', () => {
    setEnv({});
    expect(missingFirebaseConfig()).toEqual([...REQUIRED_KEYS]);
  });

  it('names just the one that is missing', () => {
    setEnv({ ...VALID, VITE_FIREBASE_API_KEY: undefined });
    expect(missingFirebaseConfig()).toEqual(['VITE_FIREBASE_API_KEY']);
  });

  it('treats whitespace as missing', () => {
    setEnv({ ...VALID, VITE_FIREBASE_PROJECT_ID: '   ' });
    expect(missingFirebaseConfig()).toEqual(['VITE_FIREBASE_PROJECT_ID']);
  });

  it('accepts a regional database URL', () => {
    setEnv({ ...VALID, VITE_FIREBASE_DATABASE_URL: 'https://hootka.asia-southeast1.firebasedatabase.app' });
    expect(missingFirebaseConfig()).toEqual([]);
  });

  it('accepts a database URL with a trailing slash', () => {
    setEnv({ ...VALID, VITE_FIREBASE_DATABASE_URL: 'https://hootka.firebaseio.com/' });
    expect(missingFirebaseConfig()).toEqual([]);
  });

  // A malformed URL fails deep inside the SDK with "Cannot parse Firebase url".
  it('flags a database URL that is set but unparseable', () => {
    setEnv({ ...VALID, VITE_FIREBASE_DATABASE_URL: 'not-a-url' });
    const problems = missingFirebaseConfig();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('VITE_FIREBASE_DATABASE_URL');
    expect(problems[0]).toContain('firebaseio.com');
  });

  it('rejects an http database URL', () => {
    setEnv({ ...VALID, VITE_FIREBASE_DATABASE_URL: 'http://hootka.firebaseio.com' });
    expect(missingFirebaseConfig()).toHaveLength(1);
  });

  it('does not complain about the URL when emulating, where it is derived', () => {
    setEnv({ ...VALID, VITE_FIREBASE_DATABASE_URL: 'anything', VITE_USE_EMULATORS: 'true' });
    expect(missingFirebaseConfig()).toEqual([]);
  });

  it('reports a missing URL once, not twice', () => {
    setEnv({ ...VALID, VITE_FIREBASE_DATABASE_URL: undefined });
    expect(missingFirebaseConfig()).toEqual(['VITE_FIREBASE_DATABASE_URL']);
  });
});
