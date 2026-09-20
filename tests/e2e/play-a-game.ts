/**
 * Plays a whole game against the Firebase emulator suite: a host signs up,
 * writes a quiz, runs it, and four players answer, right through to the podium.
 *
 * Unlike tests/integration (which stubs the database), this exercises the real
 * Cloud Functions, the real server timestamps and the real security rules.
 *
 *   npm run emulators            # terminal 1
 *   npm run e2e                  # terminal 2
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInAnonymously,
} from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref } from 'firebase/database';
import {
  connectFirestoreEmulator, doc, getFirestore, setDoc,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { GameState, Player } from '@hootka/core';

const PROJECT_ID = 'demo-hootka';
const CONFIG = {
  apiKey: 'demo-api-key',
  projectId: PROJECT_ID,
  // Namespace must match what the emulated Admin SDK uses: the project id.
  databaseURL: `https://${PROJECT_ID}.firebaseio.com`,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
function check(label: string, condition: boolean, detail = '') {
  const mark = condition ? '  ok  ' : ' FAIL ';
  console.log(`${mark} ${label}${detail ? ` - ${detail}` : ''}`);
  if (!condition) failures += 1;
}

function wire(name: string): FirebaseApp {
  const app = initializeApp(CONFIG, name);
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(getDatabase(app), '127.0.0.1', 9000);
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  connectFunctionsEmulator(getFunctions(app), '127.0.0.1', 5001);
  return app;
}

const QUESTIONS = [
  { text: 'Which animal says hoot?', options: ['Owl', 'Cow', 'Frog', 'Bee'], correctIndex: 0 },
  { text: 'How many legs does a spider have?', options: ['6', '8', '10'], correctIndex: 1 },
  { text: 'Is the sun a star?', options: ['Yes', 'No'], correctIndex: 0 },
];

async function main() {
  console.log('\n=== Hootka end-to-end: a real game on the emulators ===\n');

  // --- The host signs up and writes a quiz -------------------------------
  const hostApp = wire('host');
  const hostAuth = getAuth(hostApp);
  const hostDb = getFirestore(hostApp);
  const hostFns = getFunctions(hostApp);

  const email = `teacher-${Date.now()}@hootka.test`;
  const host = await createUserWithEmailAndPassword(hostAuth, email, 'password123');
  check('host signs up', Boolean(host.user.uid));

  const quizId = `quiz-${Date.now()}`;
  await setDoc(doc(hostDb, 'quizzes', quizId), {
    ownerUid: host.user.uid,
    title: 'Animals and space',
    coverImageUrl: null,
    questionCount: QUESTIONS.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await Promise.all(
    QUESTIONS.map((question, order) =>
      setDoc(doc(hostDb, 'quizzes', quizId, 'questions', `q${order}`), {
        order,
        text: question.text,
        imageUrl: null,
        timeLimit: 10,
        options: question.options.map((text) => ({ text })),
        correctIndex: question.correctIndex,
      }),
    ),
  );
  check('host writes a 3-question quiz', true);

  // --- Start the game ----------------------------------------------------
  const createGame = httpsCallable<{ quizId: string }, { gameId: string; code: string }>(hostFns, 'createGame');
  const { data: game } = await createGame({ quizId });
  check('createGame returns a 6-digit code', /^\d{6}$/.test(game.code), game.code);

  const advance = httpsCallable<{ gameId: string; skip?: boolean }, { phase: string }>(hostFns, 'advanceGame');
  const rtdb = getDatabase(hostApp);
  const readState = async () => (await get(ref(rtdb, `games/${game.gameId}/state`))).val() as GameState;
  const readPlayers = async () =>
    Object.entries(((await get(ref(rtdb, `games/${game.gameId}/players`))).val() ?? {}) as Record<string, Omit<Player, 'uid'>>)
      .map(([uid, player]) => ({ uid, ...player }));

  // --- Four players join -------------------------------------------------
  const NAMES = ['Ana', 'Ben', 'Cal', 'Dia'];
  const players = await Promise.all(
    NAMES.map(async (name, index) => {
      const app = wire(`player-${index}`);
      await signInAnonymously(getAuth(app));
      const fns = getFunctions(app);
      const join = httpsCallable<{ code: string; name: string }, { gameId: string; name: string }>(fns, 'joinGame');
      const { data } = await join({ code: game.code, name });
      return { name, uid: getAuth(app).currentUser!.uid, submit: httpsCallable<unknown, unknown>(fns, 'submitAnswer') };
    }),
  );
  check('four players join with a code and a nickname', (await readPlayers()).length === 4);

  // A duplicate nickname is refused.
  const dupeApp = wire('player-dupe');
  await signInAnonymously(getAuth(dupeApp));
  const dupeJoin = httpsCallable(getFunctions(dupeApp), 'joinGame');
  const dupeRejected = await dupeJoin({ code: game.code, name: 'ana' }).then(() => false).catch(() => true);
  check('a duplicate nickname is refused', dupeRejected);

  // A profane nickname is refused.
  const rudeApp = wire('player-rude');
  await signInAnonymously(getAuth(rudeApp));
  const rudeJoin = httpsCallable(getFunctions(rudeApp), 'joinGame');
  const rudeRejected = await rudeJoin({ code: game.code, name: 'fuckface' }).then(() => false).catch(() => true);
  check('a profane nickname is refused', rudeRejected);

  // --- Play every question ----------------------------------------------
  for (let index = 0; index < QUESTIONS.length; index += 1) {
    await advance({ gameId: game.gameId });               // -> QUESTION_INTRO
    await advance({ gameId: game.gameId });               // -> QUESTION_ACTIVE

    const state = await readState();
    check(
      `Q${index + 1} opens with a server timestamp`,
      state.phase === 'QUESTION_ACTIVE' && typeof state.questionStartedAt === 'number',
    );

    // The published question must not carry the answer.
    const published = (await get(ref(rtdb, `games/${game.gameId}/publicQuestion`))).val();
    check(
      `Q${index + 1} is published without correctIndex`,
      !JSON.stringify(published).includes('correctIndex'),
    );
    // Nor may the result exist before the question closes.
    const earlyResult = (await get(ref(rtdb, `games/${game.gameId}/results/${index}`))).val();
    check(`Q${index + 1} has no result while it is live`, earlyResult === null);

    const correct = QUESTIONS[index]!.correctIndex;
    // Ana answers first and correctly every time; Ben is correct but slower;
    // Cal is always wrong; Dia never answers at all.
    await players[0]!.submit({ gameId: game.gameId, questionIndex: index, choice: correct });
    await sleep(400);
    await players[1]!.submit({ gameId: game.gameId, questionIndex: index, choice: correct });
    await players[2]!.submit({
      gameId: game.gameId,
      questionIndex: index,
      choice: (correct + 1) % QUESTIONS[index]!.options.length,
    });

    // A second answer from the same player is refused.
    if (index === 0) {
      const doubled = await players[0]!
        .submit({ gameId: game.gameId, questionIndex: index, choice: 1 })
        .then(() => false)
        .catch(() => true);
      check('a second answer from the same player is refused', doubled);
    }

    await advance({ gameId: game.gameId });               // -> QUESTION_RESULT (scores)
    const result = (await get(ref(rtdb, `games/${game.gameId}/results/${index}`))).val();
    check(`Q${index + 1} result reveals the answer and the counts`, result?.correctIndex === correct, JSON.stringify(result?.counts));

    await advance({ gameId: game.gameId });               // -> LEADERBOARD
  }

  // --- The podium --------------------------------------------------------
  await advance({ gameId: game.gameId });                 // -> FINAL_PODIUM
  const finalState = await readState();
  check('the game reaches the podium', finalState.phase === 'FINAL_PODIUM');

  const finalPlayers = (await readPlayers()).sort((a, b) => a.rank - b.rank);
  console.log('\n  Final standings');
  for (const player of finalPlayers) {
    console.log(
      `    ${player.rank}. ${player.name.padEnd(5)} ${String(player.score).padStart(5)} pts   ` +
      `${player.correctCount}/${QUESTIONS.length} correct`,
    );
  }

  const [first, second, third, fourth] = finalPlayers;
  check('the fastest correct player wins', first?.name === 'Ana', `${first?.name} with ${first?.score}`);
  check('a slower correct player comes second', second?.name === 'Ben', `${second?.score} pts`);
  check('scoring rewards speed', (first?.score ?? 0) > (second?.score ?? 0));
  check('every answer correct scores near the maximum', (first?.score ?? 0) > 2700, `${first?.score}`);
  check('a player who was always wrong scores zero', third?.score === 0 || fourth?.score === 0);
  check('a player who never answered scores zero', finalPlayers.find((p) => p.name === 'Dia')?.score === 0);

  await advance({ gameId: game.gameId });                 // -> ENDED
  const ended = await readState();
  check('the game ends', ended.phase === 'ENDED');

  const releasedCode = (await get(ref(rtdb, `gameCodes/${game.code}`))).val();
  check('the game code is released for reuse', releasedCode === null);

  console.log(
    failures === 0
      ? '\n=== PASS: a full game played end to end ===\n'
      : `\n=== ${failures} CHECK(S) FAILED ===\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nE2E run crashed:', error);
  process.exit(1);
});
