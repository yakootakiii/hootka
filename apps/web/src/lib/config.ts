/**
 * Config check that runs before anything touches Firebase.
 *
 * Vite bakes `VITE_*` in at build time, so a deploy whose environment variables
 * were not set produces a bundle with `undefined` config. Firebase then throws
 * `auth/invalid-api-key` during module evaluation and the page renders blank,
 * with nothing to tell you why. Checking first turns that into a readable
 * message naming the variables that are missing.
 */
export const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** The two shapes a Realtime Database URL can take, by region. */
const DATABASE_URL_PATTERN =
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)?\.(firebaseio\.com|firebasedatabase\.app)\/?$/i;

/**
 * Names the config problems worth stopping for: a variable that was never set,
 * or a database URL that cannot be parsed. Both otherwise fail deep inside the
 * Firebase SDK with a blank page.
 */
export function missingFirebaseConfig(): string[] {
  const env = import.meta.env as unknown as Record<string, string | undefined>;

  const problems = REQUIRED_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== 'string' || value.trim() === '';
  }) as string[];

  const databaseUrl = env.VITE_FIREBASE_DATABASE_URL?.trim();
  const emulating = env.VITE_USE_EMULATORS === 'true';
  if (
    databaseUrl &&
    !emulating &&
    !problems.includes('VITE_FIREBASE_DATABASE_URL') &&
    !DATABASE_URL_PATTERN.test(databaseUrl)
  ) {
    problems.push(
      'VITE_FIREBASE_DATABASE_URL (set, but not a Realtime Database URL - ' +
        'it should end in .firebaseio.com or .firebasedatabase.app)',
    );
  }

  return problems;
}
