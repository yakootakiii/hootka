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
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

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
export const functions = getFunctions(app);

export { usingEmulators };

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export const googleProvider = new GoogleAuthProvider();

/** Typed wrapper so pages call functions by name without repeating generics. */
export function callable<Request, Response>(name: string) {
  const fn = httpsCallable<Request, Response>(functions, name);
  return async (data: Request): Promise<Response> => (await fn(data)).data;
}

export const api = {
  createGame: callable<
    { quizId: string; settings?: { streakBonus: boolean } },
    { gameId: string; code: string; totalQuestions: number }
  >('createGame'),
  joinGame: callable<{ code: string; name: string }, { gameId: string; name: string; rejoined: boolean }>(
    'joinGame',
  ),
  kickPlayer: callable<{ gameId: string; playerUid: string }, { ok: boolean }>('kickPlayer'),
  advanceGame: callable<{ gameId: string; skip?: boolean }, { phase: string; questionIndex: number }>(
    'advanceGame',
  ),
  endGame: callable<{ gameId: string }, { ok: boolean }>('endGame'),
  submitAnswer: callable<{ gameId: string; questionIndex: number; choice: number }, { ok: boolean }>(
    'submitAnswer',
  ),
  closeQuestion: callable<{ gameId: string; questionIndex: number }, { alreadyClosed: boolean }>(
    'closeQuestion',
  ),
};

export {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
};
