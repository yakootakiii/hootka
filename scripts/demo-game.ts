/**
 * Drives a game from the command line against the emulators, so you can watch
 * the player screens on real devices without clicking through the host UI.
 *
 *   npm run demo:open              -> prints CODE and GAME
 *   npm run demo:next -- <gameId>  -> advances one phase
 *
 * Handy for testing on a phone: open the printed code on the phone, then step
 * the game forward from your laptop.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { FUNCTIONS_REGION } from '@hootka/core';

const CONFIG = { apiKey: 'demo-api-key', projectId: 'demo-hootka', databaseURL: 'https://demo-hootka.firebaseio.com' };
const EMAIL = 'demo-teacher@hootka.test';
const PASSWORD = 'password123';

async function main() {
  const [command, arg] = process.argv.slice(2);
  const app = initializeApp(CONFIG, `drive-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  connectFunctionsEmulator(getFunctions(app, FUNCTIONS_REGION), '127.0.0.1', 5001);

  const host = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    .catch(() => createUserWithEmailAndPassword(auth, EMAIL, PASSWORD));

  if (command === 'open') {
    const quizId = 'demo-quiz';
    await setDoc(doc(getFirestore(app), 'quizzes', quizId), {
      ownerUid: host.user.uid, title: 'Animal quiz', coverImageUrl: null,
      questionCount: 2, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await setDoc(doc(getFirestore(app), 'quizzes', quizId, 'questions', 'q0'), {
      order: 0, text: 'Which animal says hoot?', imageUrl: null, timeLimit: 10,
      options: [{ text: 'Owl' }, { text: 'Cow' }, { text: 'Frog' }, { text: 'Bee' }], correctIndex: 0,
    });
    await setDoc(doc(getFirestore(app), 'quizzes', quizId, 'questions', 'q1'), {
      order: 1, text: 'Is the sun a star?', imageUrl: null, timeLimit: 10,
      options: [{ text: 'Yes' }, { text: 'No' }], correctIndex: 0,
    });
    const { data } = await httpsCallable<any, any>(getFunctions(app, FUNCTIONS_REGION), 'createGame')({ quizId });
    console.log(`CODE=${data.code} GAME=${data.gameId}`);
  } else if (command === 'advance') {
    const { data } = await httpsCallable<any, any>(getFunctions(app, FUNCTIONS_REGION), 'advanceGame')({ gameId: arg });
    console.log('phase ->', data.phase);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
