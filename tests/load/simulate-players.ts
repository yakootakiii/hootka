/**
 * Load test: 60 simulated players join a live game and all answer within one
 * second of each other (spec section 8.5 and the testing checklist).
 *
 * This one needs real infrastructure, so it is not part of `npm test`. Run the
 * emulators, create a game as a host, then:
 *
 *   npm run loadtest -- --code 123456 [--players 60] [--burst 1000]
 *
 * It reports join failures, answer failures, and the latency spread.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { FUNCTIONS_REGION } from '@hootka/core';

interface Options {
  code: string;
  players: number;
  burstMs: number;
  projectId: string;
}

function parseArgs(argv: string[]): Options {
  const get_ = (flag: string, fallback: string) => {
    const index = argv.indexOf(`--${flag}`);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };

  const code = get_('code', '');
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Pass a live 6-digit game code: npm run loadtest -- --code 123456');
  }

  return {
    code,
    players: Number(get_('players', '60')),
    burstMs: Number(get_('burst', '1000')),
    projectId: get_('project', process.env.GCLOUD_PROJECT ?? 'hootka-dev'),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Each bot gets its own app instance so it gets its own anonymous UID. */
async function makeBot(index: number, options: Options) {
  const app = initializeApp({ apiKey: 'emulator', projectId: options.projectId }, `bot-${index}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  const functions = getFunctions(app, FUNCTIONS_REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  await signInAnonymously(auth);

  return {
    index,
    name: `Bot ${index}`,
    join: httpsCallable(functions, 'joinGame'),
    answer: httpsCallable(functions, 'submitAnswer'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Spinning up ${options.players} bots for game ${options.code}…`);

  const bots = await Promise.all(
    Array.from({ length: options.players }, (_, index) => makeBot(index, options)),
  );

  // --- Join ---
  const joinStarted = Date.now();
  const joins = await Promise.allSettled(
    bots.map((bot) => bot.join({ code: options.code, name: bot.name })),
  );
  const joined = joins.filter((result) => result.status === 'fulfilled');
  console.log(
    `Joined ${joined.length}/${options.players} in ${Date.now() - joinStarted}ms`,
  );
  for (const failure of joins.filter((r): r is PromiseRejectedResult => r.status === 'rejected').slice(0, 5)) {
    console.log('  join failed:', failure.reason?.message ?? failure.reason);
  }

  const gameId = (joined[0] as PromiseFulfilledResult<{ data: { gameId: string } }> | undefined)
    ?.value.data.gameId;
  if (!gameId) throw new Error('No bot could join; is the lobby still open?');

  // --- Wait for the host to open a question ---
  // Namespace must match what the emulated Admin SDK uses: the project id.
  const admin = initializeApp(
    { projectId: options.projectId, databaseURL: `https://${options.projectId}.firebaseio.com` },
    'observer',
  );
  const rtdb = getDatabase(admin);
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);

  console.log('Waiting for the host to open a question…');
  let questionIndex = -1;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = (await get(ref(rtdb, `games/${gameId}/state`))).val();
    if (state?.phase === 'QUESTION_ACTIVE') {
      questionIndex = state.questionIndex;
      break;
    }
    await sleep(500);
  }
  if (questionIndex < 0) throw new Error('No question opened within 60s.');

  // --- Answer in a burst ---
  console.log(`Answering question ${questionIndex + 1} within ${options.burstMs}ms…`);
  const latencies: number[] = [];
  const answers = await Promise.allSettled(
    bots.map(async (bot) => {
      await sleep(Math.random() * options.burstMs);
      const startedAt = Date.now();
      const response = await bot.answer({ gameId, questionIndex, choice: bot.index % 4 });
      latencies.push(Date.now() - startedAt);
      return response;
    }),
  );

  const accepted = answers.filter((result) => result.status === 'fulfilled').length;
  const sorted = [...latencies].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

  console.log(`Answers accepted: ${accepted}/${options.players}`);
  console.log(`Latency  p50 ${percentile(0.5)}ms  p95 ${percentile(0.95)}ms  max ${sorted.at(-1) ?? 0}ms`);

  for (const failure of answers.filter((r): r is PromiseRejectedResult => r.status === 'rejected').slice(0, 5)) {
    console.log('  answer failed:', failure.reason?.message ?? failure.reason);
  }

  if (accepted < options.players) {
    console.error('FAIL: not every bot got an answer in.');
    process.exit(1);
  }
  console.log('PASS');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
