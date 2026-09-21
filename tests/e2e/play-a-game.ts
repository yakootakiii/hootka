/**
 * Plays a whole game against the Firebase emulators, driving the real Vercel
 * API route handlers in-process.
 *
 * The handlers are imported and called with mock request/response objects, so
 * this exercises bearer-token verification, the game logic, and the real
 * database writes - everything except Vercel's HTTP plumbing.
 *
 *   npm run emulators   # terminal 1
 *   npm run e2e         # terminal 2
 */
process.env.GCLOUD_PROJECT ??= 'demo-hootka';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';
process.env.FIREBASE_DATABASE_URL ??= 'https://demo-hootka.firebaseio.com';

import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInAnonymously,
} from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref } from 'firebase/database';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import type { GameState, Player } from '@hootka/core';

const PROJECT_ID = 'demo-hootka';
const CONFIG = {
  apiKey: 'demo-api-key',
  projectId: PROJECT_ID,
  databaseURL: `https://${PROJECT_ID}.firebaseio.com`,
};

let failures = 0;
function check(label: string, condition: boolean, detail = '') {
  console.log(`${condition ? '  ok  ' : ' FAIL '} ${label}${detail ? ` - ${detail}` : ''}`);
  if (!condition) failures += 1;
}

/** Minimal stand-ins for Vercel's request/response objects. */
function mockRes() {
  const state: { status: number; body: any; ended: boolean } = { status: 0, body: null, ended: false };
  const res: any = {
    status(code: number) { state.status = code; return res; },
    json(payload: any) { state.body = payload; state.ended = true; return res; },
    setHeader() { return res; },
    get writableEnded() { return state.ended; },
  };
  return { res, state };
}

/** Calls a route handler the way Vercel would, with a bearer token. */
async function callApi(handler: any, token: string | null, data: unknown) {
  const { res, state } = mockRes();
  await handler(
    { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: data },
    res,
  );
  return { status: state.status, body: state.body };
}

const QUESTIONS = [
  { text: 'Which animal says hoot?', options: ['Owl', 'Cow', 'Frog', 'Bee'], correctIndex: 0 },
  { text: 'How many legs does a spider have?', options: ['6', '8', '10'], correctIndex: 1 },
  { text: 'Is the sun a star?', options: ['Yes', 'No'], correctIndex: 0 },
];

function wire(name: string) {
  const app = initializeApp(CONFIG, name);
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(getDatabase(app), '127.0.0.1', 9000);
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  return app;
}

async function main() {
  console.log('\n=== Hootka end-to-end: Vercel API routes on the emulators ===\n');

  const [createGame, joinGame, advanceGame, submitAnswer, endGame] = await Promise.all([
    import('../../api/createGame.js').then((m) => m.default),
    import('../../api/joinGame.js').then((m) => m.default),
    import('../../api/advanceGame.js').then((m) => m.default),
    import('../../api/submitAnswer.js').then((m) => m.default),
    import('../../api/endGame.js').then((m) => m.default),
  ]);

  // --- Host signs up and writes a quiz -----------------------------------
  const hostApp = wire('host');
  const hostAuth = getAuth(hostApp);
  const host = await createUserWithEmailAndPassword(hostAuth, `t-${Date.now()}@hootka.test`, 'password123');
  const hostToken = await host.user.getIdToken();
  check('host signs up', Boolean(host.user.uid));

  const quizId = `quiz-${Date.now()}`;
  const hostDb = getFirestore(hostApp);
  await setDoc(doc(hostDb, 'quizzes', quizId), {
    ownerUid: host.user.uid, title: 'Animals and space', coverImageUrl: null,
    questionCount: QUESTIONS.length, createdAt: Date.now(), updatedAt: Date.now(),
  });
  await Promise.all(QUESTIONS.map((q, order) =>
    setDoc(doc(hostDb, 'quizzes', quizId, 'questions', `q${order}`), {
      order, text: q.text, imageUrl: null, timeLimit: 10,
      options: q.options.map((text) => ({ text })), correctIndex: q.correctIndex,
    })));
  check('host writes a 3-question quiz', true);

  // --- Auth is actually enforced -----------------------------------------
  const noToken = await callApi(createGame, null, { quizId });
  check('createGame without a token is rejected', noToken.status === 401, `got ${noToken.status}`);

  // --- Start the game ----------------------------------------------------
  const created = await callApi(createGame, hostToken, { quizId });
  check('createGame returns a 6-digit code', /^\d{6}$/.test(created.body?.code ?? ''), created.body?.code ?? JSON.stringify(created.body));
  const gameId: string = created.body.gameId;

  const rtdb = getDatabase(hostApp);
  const readState = async () => (await get(ref(rtdb, `games/${gameId}/state`))).val() as GameState;
  const readPlayers = async () =>
    Object.entries(((await get(ref(rtdb, `games/${gameId}/players`))).val() ?? {}) as Record<string, Omit<Player, 'uid'>>)
      .map(([uid, p]) => ({ uid, ...p }));

  // --- Players join -------------------------------------------------------
  const NAMES = ['Ana', 'Ben', 'Cal', 'Dia'];
  const players = await Promise.all(NAMES.map(async (name, i) => {
    const app = wire(`player-${i}`);
    const cred = await signInAnonymously(getAuth(app));
    const token = await cred.user.getIdToken();
    const res = await callApi(joinGame, token, { code: created.body.code, name });
    return { name, uid: cred.user.uid, token, joined: res.status === 200 };
  }));
  check('four players join', players.every((p) => p.joined) && (await readPlayers()).length === 4);

  // A player must not be able to reach a host-only route.
  const playerAdvance = await callApi(advanceGame, players[0]!.token, { gameId });
  check('a player cannot advance the game', playerAdvance.status === 403, `got ${playerAdvance.status}`);

  const dupeApp = wire('dupe');
  const dupeToken = await signInAnonymously(getAuth(dupeApp)).then((c) => c.user.getIdToken());
  const dupe = await callApi(joinGame, dupeToken, { code: created.body.code, name: 'ana' });
  check('a duplicate nickname is refused', dupe.status === 400, `got ${dupe.status}`);

  const rudeApp = wire('rude');
  const rudeToken = await signInAnonymously(getAuth(rudeApp)).then((c) => c.user.getIdToken());
  const rude = await callApi(joinGame, rudeToken, { code: created.body.code, name: 'fuckface' });
  check('a profane nickname is refused', rude.status === 400, `got ${rude.status}`);

  // --- Play every question ------------------------------------------------
  for (let index = 0; index < QUESTIONS.length; index += 1) {
    await callApi(advanceGame, hostToken, { gameId });   // -> INTRO
    await callApi(advanceGame, hostToken, { gameId });   // -> ACTIVE

    const state = await readState();
    check(`Q${index + 1} opens with a server timestamp`,
      state.phase === 'QUESTION_ACTIVE' && typeof state.questionStartedAt === 'number');

    const published = (await get(ref(rtdb, `games/${gameId}/publicQuestion`))).val();
    check(`Q${index + 1} is published without correctIndex`,
      !JSON.stringify(published).includes('correctIndex'));
    check(`Q${index + 1} has no result while it is live`,
      (await get(ref(rtdb, `games/${gameId}/results/${index}`))).val() === null);

    const correct = QUESTIONS[index]!.correctIndex;
    await callApi(submitAnswer, players[0]!.token, { gameId, questionIndex: index, choice: correct });
    await new Promise((r) => setTimeout(r, 400));
    await callApi(submitAnswer, players[1]!.token, { gameId, questionIndex: index, choice: correct });
    await callApi(submitAnswer, players[2]!.token, {
      gameId, questionIndex: index, choice: (correct + 1) % QUESTIONS[index]!.options.length,
    });

    if (index === 0) {
      const again = await callApi(submitAnswer, players[0]!.token, { gameId, questionIndex: index, choice: 1 });
      check('a second answer from the same player is refused', again.status === 409, `got ${again.status}`);
    }

    await callApi(advanceGame, hostToken, { gameId });   // -> RESULT (scores)
    const result = (await get(ref(rtdb, `games/${gameId}/results/${index}`))).val();
    check(`Q${index + 1} result reveals the answer`, result?.correctIndex === correct, JSON.stringify(result?.counts));

    await callApi(advanceGame, hostToken, { gameId });   // -> LEADERBOARD
  }

  await callApi(advanceGame, hostToken, { gameId });     // -> PODIUM
  check('the game reaches the podium', (await readState()).phase === 'FINAL_PODIUM');

  const finalPlayers = (await readPlayers()).sort((a, b) => a.rank - b.rank);
  console.log('\n  Final standings');
  for (const p of finalPlayers) {
    console.log(`    ${p.rank}. ${p.name.padEnd(5)} ${String(p.score).padStart(5)} pts   ${p.correctCount}/${QUESTIONS.length} correct`);
  }

  check('the fastest correct player wins', finalPlayers[0]?.name === 'Ana', `${finalPlayers[0]?.name}`);
  check('scoring rewards speed', (finalPlayers[0]?.score ?? 0) > (finalPlayers[1]?.score ?? 0));
  check('a player who never answered scores zero', finalPlayers.find((p) => p.name === 'Dia')?.score === 0);

  await callApi(endGame, hostToken, { gameId });
  check('the code is released for reuse',
    (await get(ref(rtdb, `gameCodes/${created.body.code}`))).val() === null);

  console.log(failures === 0
    ? '\n=== PASS: a full game played end to end ===\n'
    : `\n=== ${failures} CHECK(S) FAILED ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => { console.error('\nE2E run crashed:', error); process.exit(1); });
