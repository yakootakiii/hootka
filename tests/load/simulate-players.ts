/**
 * Load test: 60 simulated players join a live game and all answer within one
 * second of each other (spec section 8.5 and the testing checklist).
 *
 * Unlike the e2e test, this goes over real HTTP against a running deployment,
 * so it measures the serverless routes end to end.
 *
 *   npm run loadtest -- --code 123456 [--base https://your-app.vercel.app]
 *                                     [--players 60] [--burst 1000]
 *
 * With no --base it targets http://localhost:3000, i.e. `vercel dev`.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref } from 'firebase/database';

interface Options {
  code: string; players: number; burstMs: number; base: string; projectId: string; apiKey: string;
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
  };
  const code = flag('code', '');
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Pass a live 6-digit game code: npm run loadtest -- --code 123456');
  }
  return {
    code,
    players: Number(flag('players', '60')),
    burstMs: Number(flag('burst', '1000')),
    base: flag('base', 'http://localhost:3000').replace(/\/$/, ''),
    projectId: flag('project', process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-hootka'),
    apiKey: flag('key', process.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key'),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const local = (base: string) => base.includes('localhost') || base.includes('127.0.0.1');

async function post(base: string, name: string, token: string, data: unknown) {
  const response = await fetch(`${base}/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${(payload as any).error ?? 'failed'}`);
  return payload as any;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Spinning up ${options.players} bots against ${options.base} for game ${options.code}…`);

  const bots = await Promise.all(
    Array.from({ length: options.players }, async (_, index) => {
      const app = initializeApp(
        { apiKey: options.apiKey, projectId: options.projectId,
          databaseURL: `https://${options.projectId}.firebaseio.com` },
        `bot-${index}`,
      );
      const auth = getAuth(app);
      if (local(options.base)) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      const cred = await signInAnonymously(auth);
      return { index, app, name: `Bot ${index}`, token: await cred.user.getIdToken() };
    }),
  );

  const joinStarted = Date.now();
  const joins = await Promise.allSettled(
    bots.map((bot) => post(options.base, 'joinGame', bot.token, { code: options.code, name: bot.name })),
  );
  const ok = joins.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
  console.log(`Joined ${ok.length}/${options.players} in ${Date.now() - joinStarted}ms`);
  for (const f of joins.filter((r): r is PromiseRejectedResult => r.status === 'rejected').slice(0, 5)) {
    console.log('  join failed:', f.reason?.message ?? f.reason);
  }
  const gameId = ok[0]?.value?.gameId;
  if (!gameId) throw new Error('No bot could join; is the lobby still open?');

  // Watch for the host to open a question.
  const observer = initializeApp(
    { projectId: options.projectId, databaseURL: `https://${options.projectId}.firebaseio.com` },
    'observer',
  );
  const rtdb = getDatabase(observer);
  if (local(options.base)) connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);

  console.log('Waiting for the host to open a question…');
  let questionIndex = -1;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = (await get(ref(rtdb, `games/${gameId}/state`))).val();
    if (state?.phase === 'QUESTION_ACTIVE') { questionIndex = state.questionIndex; break; }
    await sleep(500);
  }
  if (questionIndex < 0) throw new Error('No question opened within 60s.');

  console.log(`Answering question ${questionIndex + 1} within ${options.burstMs}ms…`);
  const latencies: number[] = [];
  const answers = await Promise.allSettled(
    bots.map(async (bot) => {
      await sleep(Math.random() * options.burstMs);
      const startedAt = Date.now();
      const res = await post(options.base, 'submitAnswer', bot.token, {
        gameId, questionIndex, choice: bot.index % 4,
      });
      latencies.push(Date.now() - startedAt);
      return res;
    }),
  );

  const accepted = answers.filter((r) => r.status === 'fulfilled').length;
  const sorted = [...latencies].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  console.log(`Answers accepted: ${accepted}/${options.players}`);
  console.log(`Latency  p50 ${pct(0.5)}ms  p95 ${pct(0.95)}ms  max ${sorted.at(-1) ?? 0}ms`);
  for (const f of answers.filter((r): r is PromiseRejectedResult => r.status === 'rejected').slice(0, 5)) {
    console.log('  answer failed:', f.reason?.message ?? f.reason);
  }

  if (accepted < options.players) { console.error('FAIL: not every bot got an answer in.'); process.exit(1); }
  console.log('PASS');
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
