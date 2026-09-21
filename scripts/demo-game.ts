/**
 * Drives a game from the command line against the emulators, so you can watch
 * the player screens on real devices without clicking through the host UI.
 *
 *   npm run demo:open              -> prints CODE and GAME
 *   npm run demo:next -- <gameId>  -> advances one phase
 */
process.env.GCLOUD_PROJECT ??= 'demo-hootka';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';
process.env.FIREBASE_DATABASE_URL ??= 'https://demo-hootka.firebaseio.com';

import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';

const CONFIG = { apiKey: 'demo-api-key', projectId: 'demo-hootka', databaseURL: 'https://demo-hootka.firebaseio.com' };
const EMAIL = 'demo-teacher@hootka.test';
const PASSWORD = 'password123';

function mockRes() {
  const state: { status: number; body: any; ended: boolean } = { status: 0, body: null, ended: false };
  const res: any = {
    status(c: number) { state.status = c; return res; },
    json(b: any) { state.body = b; state.ended = true; return res; },
    setHeader() { return res; },
    get writableEnded() { return state.ended; },
  };
  return { res, state };
}

async function callApi(handler: any, token: string, data: unknown) {
  const { res, state } = mockRes();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: data }, res);
  if (state.status >= 400) throw new Error(`${state.status}: ${state.body?.error}`);
  return state.body;
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  const app = initializeApp(CONFIG, `drive-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);

  const host = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    .catch(() => createUserWithEmailAndPassword(auth, EMAIL, PASSWORD));
  const token = await host.user.getIdToken();

  if (command === 'open') {
    const quizId = 'demo-quiz';
    const db = getFirestore(app);
    await setDoc(doc(db, 'quizzes', quizId), {
      ownerUid: host.user.uid, title: 'Animal quiz', coverImageUrl: null,
      questionCount: 2, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'quizzes', quizId, 'questions', 'q0'), {
      order: 0, text: 'Which animal says hoot?', imageUrl: null, timeLimit: 10,
      options: [{ text: 'Owl' }, { text: 'Cow' }, { text: 'Frog' }, { text: 'Bee' }], correctIndex: 0,
    });
    await setDoc(doc(db, 'quizzes', quizId, 'questions', 'q1'), {
      order: 1, text: 'Is the sun a star?', imageUrl: null, timeLimit: 10,
      options: [{ text: 'Yes' }, { text: 'No' }], correctIndex: 0,
    });
    const createGame = (await import('../api/createGame.js')).default;
    const data = await callApi(createGame, token, { quizId });
    console.log(`CODE=${data.code} GAME=${data.gameId}`);
  } else if (command === 'advance') {
    const advanceGame = (await import('../api/advanceGame.js')).default;
    const data = await callApi(advanceGame, token, { gameId: arg });
    console.log('phase ->', data.phase);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
