import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const usingEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

/**
 * The Realtime Database namespace comes from the URL, not from
 * `connectDatabaseEmulator`. The Admin SDK inside the emulated Cloud Functions
 * defaults to a namespace equal to the project id, so the client has to use the
 * same one or the two read and write different databases - silently.
 */
const databaseURL = usingEmulators
  ? `https://${projectId}.firebaseio.com`
  : import.meta.env.VITE_FIREBASE_DATABASE_URL;

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * The services every visitor needs. Firestore and Storage are deliberately
 * absent: only the host pages use them, and they load from `firebase-host.ts`
 * so a player on slow 4G never downloads them.
 */
export const app = initializeApp(config);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

export { usingEmulators };

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
}

export const googleProvider = new GoogleAuthProvider();

/**
 * The server routes are Vercel serverless functions living beside the app at
 * /api, so calls are same-origin and there is no CORS to configure.
 *
 * Firebase callables attached the caller's ID token automatically; here we send
 * it ourselves as a bearer token and each route verifies it.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<Request, Response>(name: string, data: Request): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new ApiError('You are not signed in.', 401);

  const response = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(data ?? {}),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    reason?: string;
  };
  if (!response.ok) {
    throw new ApiError(payload.error ?? 'Something went wrong.', response.status, payload.reason);
  }
  return payload as Response;
}

export const api = {
  createGame: (data: { quizId: string; settings?: { streakBonus: boolean } }) =>
    call<typeof data, { gameId: string; code: string; totalQuestions: number }>('createGame', data),
  joinGame: (data: { code: string; name: string }) =>
    call<typeof data, { gameId: string; name: string; rejoined: boolean }>('joinGame', data),
  kickPlayer: (data: { gameId: string; playerUid: string }) =>
    call<typeof data, { ok: boolean }>('kickPlayer', data),
  advanceGame: (data: { gameId: string; skip?: boolean }) =>
    call<typeof data, { phase: string; questionIndex: number }>('advanceGame', data),
  endGame: (data: { gameId: string }) => call<typeof data, { ok: boolean }>('endGame', data),
  submitAnswer: (data: { gameId: string; questionIndex: number; choice: number }) =>
    call<typeof data, { ok: boolean }>('submitAnswer', data),
  closeQuestion: (data: { gameId: string; questionIndex: number }) =>
    call<typeof data, { alreadyClosed: boolean }>('closeQuestion', data),
};

export {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
};
