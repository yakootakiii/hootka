import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Admin SDK setup for the Vercel serverless routes.
 *
 * On Firebase these functions ran with ambient credentials; on Vercel they need
 * an explicit service account, supplied as FIREBASE_SERVICE_ACCOUNT (the whole
 * JSON key, as one environment variable).
 */
function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not set. Add the service account JSON to the ' +
        'project environment variables (see docs/DEPLOY.md).',
    );
  }
  try {
    // Accept either raw JSON or base64, since dashboards mangle newlines.
    const json = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64-encoded JSON.');
  }
}

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  // The emulators accept any credential, so local runs skip the service account.
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    app = initializeApp({
      projectId: process.env.GCLOUD_PROJECT ?? 'demo-hootka',
      databaseURL: process.env.FIREBASE_DATABASE_URL ?? 'https://demo-hootka.firebaseio.com',
    });
    return app;
  }

  const service = credentials();
  app = initializeApp({
    credential: cert({
      projectId: service.project_id,
      clientEmail: service.client_email,
      // Vercel stores the key with literal \n sequences.
      privateKey: service.private_key.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  return app;
}

export const rtdb = () => getDatabase(adminApp());
export const firestore = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());

export const gameRef = (gameId: string) => rtdb().ref(`games/${gameId}`);
export const codeRef = (code: string) => rtdb().ref(`gameCodes/${code}`);
