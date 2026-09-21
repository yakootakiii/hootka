import {
  ANSWER_WINDOW_MS,
  MAX_PLAYERS,
  applyQuestionResults,
  buildQuestionResult,
  canAcceptAnswer,
  generateGameCode,
  isValidGameCode,
  lobbyIsOpen,
  nextAdvance,
  normalizeGameCode,
  scoreQuestion,
  toPublicQuestion,
  validateNickname,
  validateQuestion,
  type AnswerSubmission,
  type GameMeta,
  type GameState,
  type Player,
  type PublicQuestion,
  type Question,
} from '../../src/core/index.js';
import { ServerValue } from 'firebase-admin/database';
import { codeRef, firestore, gameRef, rtdb } from './admin.js';
import { badRequest, conflict, forbidden, gone, notFound, tooMany, type Caller } from './http.js';

const CODE_ATTEMPTS = 12;

export async function loadQuizQuestions(quizId: string): Promise<Question[]> {
  const snapshot = await firestore()
    .collection('quizzes')
    .doc(quizId)
    .collection('questions')
    .orderBy('order')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Question);
}

async function assertHostOf(gameId: string, uid: string): Promise<GameMeta> {
  const meta = (await gameRef(gameId).child('meta').get()).val() as GameMeta | null;
  if (!meta) throw notFound('That game no longer exists.');
  if (meta.hostUid !== uid) throw forbidden('Only the host can control this game.');
  return meta;
}

/** Claim an unused 6-digit code atomically, so two hosts cannot share one. */
async function claimCode(gameId: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateGameCode();
    const result = await codeRef(code).transaction((existing) =>
      existing === null ? { gameId } : undefined,
    );
    if (result.committed) return code;
  }
  throw tooMany('Could not find a free game code. Try again.');
}

export async function createGame(caller: Caller, quizId: string, streakBonus: boolean) {
  const quizDoc = await firestore().collection('quizzes').doc(quizId).get();
  if (!quizDoc.exists) throw notFound('That quiz no longer exists.');
  if (quizDoc.data()?.ownerUid !== caller.uid) throw forbidden('That quiz belongs to someone else.');

  const questions = await loadQuizQuestions(quizId);
  if (questions.length === 0) throw badRequest('Add at least one question before playing.');
  const broken = questions.filter((question) => validateQuestion(question).length > 0);
  if (broken.length > 0) {
    throw badRequest(`Question ${(broken[0]?.order ?? 0) + 1} is incomplete.`);
  }

  const gameId = rtdb().ref('games').push().key;
  if (!gameId) throw new Error('Could not allocate a game id.');
  const code = await claimCode(gameId);

  const state: GameState = {
    phase: 'LOBBY',
    questionIndex: 0,
    questionStartedAt: null,
    totalQuestions: questions.length,
  };

  try {
    await gameRef(gameId).set({
      meta: {
        hostUid: caller.uid,
        quizId,
        code,
        status: 'open',
        createdAt: ServerValue.TIMESTAMP,
        endedAt: null,
        settings: { streakBonus },
      },
      state,
      playerCount: 0,
    });
  } catch (error) {
    await codeRef(code).remove();
    throw error;
  }

  return { gameId, code, totalQuestions: questions.length, maxPlayers: MAX_PLAYERS };
}

export async function joinGame(caller: Caller, rawCode: string, rawName: string) {
  const code = normalizeGameCode(rawCode);
  if (!isValidGameCode(code)) throw badRequest('That game code does not look right.');

  const gameId = (await codeRef(code).get()).val()?.gameId as string | undefined;
  if (!gameId) throw notFound('No game found with that code.');

  const game = gameRef(gameId);
  const [stateSnapshot, playersSnapshot] = await Promise.all([
    game.child('state').get(),
    game.child('players').get(),
  ]);

  const phase = (stateSnapshot.val() as GameState | null)?.phase;
  const players = (playersSnapshot.val() ?? {}) as Record<string, Player>;

  // A player who refreshes or drops off keeps their name and score.
  const existing = players[caller.uid];
  if (existing) {
    await game.child(`players/${caller.uid}/connected`).set(true);
    return { gameId, name: existing.name, rejoined: true };
  }

  if (!phase || !lobbyIsOpen(phase)) throw badRequest('That game has already started.');
  if (Object.keys(players).length >= MAX_PLAYERS) throw tooMany('This game is full.');

  const check = validateNickname(rawName, {
    taken: Object.values(players).map((player) => player.name),
  });
  if (!check.ok) throw badRequest(check.message, check.reason);

  // Re-check inside the write so a player cannot slip in as the host starts,
  // and so the cap holds under 50 simultaneous joins.
  const result = await game.child('players').transaction((current: Record<string, unknown> | null) => {
    const roster = current ?? {};
    if (Object.keys(roster).length >= MAX_PLAYERS) return undefined;
    if (Object.values(roster).some((row) => (row as Player)?.name === check.name)) return undefined;
    return {
      ...roster,
      [caller.uid]: {
        name: check.name,
        joinedAt: ServerValue.TIMESTAMP,
        score: 0,
        streak: 0,
        rank: 0,
        prevRank: 0,
        lastPoints: 0,
        correctCount: 0,
        totalResponseMs: 0,
        answeredCount: 0,
        connected: true,
      },
    };
  });

  if (!result.committed) throw conflict('That name was just taken, or the game filled up.');

  await game.child('playerCount').set(Object.keys(result.snapshot.val() ?? {}).length);
  return { gameId, name: check.name, rejoined: false };
}

export async function kickPlayer(caller: Caller, gameId: string, playerUid: string) {
  await assertHostOf(gameId, caller.uid);
  const game = gameRef(gameId);
  await game.child(`players/${playerUid}`).remove();
  const remaining = await game.child('players').get();
  await game.child('playerCount').set(Object.keys(remaining.val() ?? {}).length);
  return { ok: true };
}

/**
 * Score one question for everyone at once and publish the result. Idempotent:
 * the host's timer and `advanceGame` both call it, and the second must be a
 * no-op rather than paying everyone twice.
 */
export async function closeQuestionFor(gameId: string, questionIndex: number) {
  const game = gameRef(gameId);
  const [metaSnapshot, stateSnapshot, playersSnapshot, answersSnapshot, resultSnapshot] =
    await Promise.all([
      game.child('meta').get(),
      game.child('state').get(),
      game.child('players').get(),
      game.child(`answers/${questionIndex}`).get(),
      game.child(`results/${questionIndex}`).get(),
    ]);

  if (resultSnapshot.exists()) return { alreadyClosed: true as const };

  const meta = metaSnapshot.val() as GameMeta | null;
  const state = stateSnapshot.val() as GameState | null;
  if (!meta || !state) throw notFound('That game no longer exists.');
  if (typeof state.questionStartedAt !== 'number') throw badRequest('That question never opened.');

  const question = (await loadQuizQuestions(meta.quizId))[questionIndex];
  if (!question) throw notFound('That question no longer exists.');

  const submissions: AnswerSubmission[] = Object.entries(
    (answersSnapshot.val() ?? {}) as Record<string, { choice: number; answeredAt: number }>,
  ).map(([playerUid, answer]) => ({
    playerUid,
    choice: Number(answer.choice),
    answeredAt: Number(answer.answeredAt),
  }));

  const players: Player[] = Object.entries(
    (playersSnapshot.val() ?? {}) as Record<string, Omit<Player, 'uid'>>,
  ).map(([uid, player]) => ({ uid, ...player }));

  const { scored, counts } = scoreQuestion({
    submissions,
    correctIndex: question.correctIndex,
    questionStartedAt: state.questionStartedAt,
    timeLimitMs: (question.timeLimit ?? 10) * 1000,
    optionCount: question.options.length,
    streaks: Object.fromEntries(players.map((player) => [player.uid, player.streak])),
    streakBonusEnabled: meta.settings?.streakBonus === true,
  });

  const updates: Record<string, unknown> = {
    [`results/${questionIndex}`]: buildQuestionResult(question.correctIndex, counts, scored),
  };
  for (const answer of scored) {
    updates[`answers/${questionIndex}/${answer.playerUid}/points`] = answer.points;
    updates[`answers/${questionIndex}/${answer.playerUid}/correct`] = answer.correct;
    updates[`answers/${questionIndex}/${answer.playerUid}/order`] = answer.order;
  }
  for (const player of applyQuestionResults({ players, scored })) {
    const { uid, ...fields } = player;
    for (const [key, value] of Object.entries(fields)) updates[`players/${uid}/${key}`] = value;
  }

  await game.update(updates);
  return { alreadyClosed: false as const, answeredCount: scored.length };
}

export async function advanceGame(
  caller: Caller,
  gameId: string,
  skip: boolean,
  expectPhase?: string,
) {
  const meta = await assertHostOf(gameId, caller.uid);
  const game = gameRef(gameId);
  const state = (await game.child('state').get()).val() as GameState | null;
  if (!state) throw notFound('That game has no state.');

  // The host screen advances automatically when the timer runs out, and the
  // host can also click. Whoever loses the race must not push the game on a
  // second time, so a caller may say which phase it believed it was leaving.
  if (expectPhase && state.phase !== expectPhase) {
    return { phase: state.phase, questionIndex: state.questionIndex, skipped: true };
  }

  const action = nextAdvance({ state, skip });
  if (action.type === 'noop') throw badRequest(action.reason);

  // Leaving QUESTION_ACTIVE always scores first, whether the timer ran out or
  // the host pressed Skip, so the result screen has numbers to show.
  if (state.phase === 'QUESTION_ACTIVE') await closeQuestionFor(gameId, state.questionIndex);

  const updates: Record<string, unknown> = {
    'state/phase': action.phase,
    'state/questionIndex': action.questionIndex,
  };

  if (action.phase === 'QUESTION_INTRO') {
    const question = (await loadQuizQuestions(meta.quizId))[action.questionIndex];
    if (!question) throw badRequest('That question is missing.');
    // Only the redacted question reaches the public node.
    updates.publicQuestion = toPublicQuestion(question);
    updates['state/questionStartedAt'] = null;
    updates['meta/status'] = 'running';
    updates[`answerCounts/${action.questionIndex}`] = 0;
  }
  if (action.openWindow) updates['state/questionStartedAt'] = ServerValue.TIMESTAMP;
  if (action.phase === 'ENDED') {
    updates['meta/status'] = 'ended';
    updates['meta/endedAt'] = ServerValue.TIMESTAMP;
    updates.publicQuestion = null;
  }

  await game.update(updates);
  if (action.phase === 'ENDED' && meta.code) await codeRef(meta.code).remove();

  return { phase: action.phase, questionIndex: action.questionIndex };
}

export async function endGame(caller: Caller, gameId: string) {
  const meta = await assertHostOf(gameId, caller.uid);
  await gameRef(gameId).update({
    'state/phase': 'FINAL_PODIUM',
    'meta/status': 'ended',
    'meta/endedAt': ServerValue.TIMESTAMP,
    publicQuestion: null,
  });
  if (meta.code) await codeRef(meta.code).remove();
  return { ok: true };
}

export async function closeQuestion(caller: Caller, gameId: string, questionIndex: number) {
  await assertHostOf(gameId, caller.uid);
  return closeQuestionFor(gameId, questionIndex);
}

/**
 * Record a choice with a server timestamp. Deliberately does no scoring:
 * closeQuestion scores everyone at once against the same clock.
 */
export async function submitAnswer(
  caller: Caller,
  gameId: string,
  questionIndex: number,
  choice: number,
) {
  const game = gameRef(gameId);
  const [stateSnapshot, questionSnapshot, playerSnapshot, answerSnapshot] = await Promise.all([
    game.child('state').get(),
    game.child('publicQuestion').get(),
    game.child(`players/${caller.uid}`).get(),
    game.child(`answers/${questionIndex}/${caller.uid}`).get(),
  ]);

  const state = stateSnapshot.val() as GameState | null;
  const question = questionSnapshot.val() as PublicQuestion | null;

  const decision = canAcceptAnswer({
    phase: state?.phase ?? 'ENDED',
    currentQuestionIndex: state?.questionIndex ?? -1,
    questionStartedAt: state?.questionStartedAt ?? null,
    questionIndex,
    choice,
    optionCount: question?.options?.length ?? 0,
    now: Date.now(),
    isPlayer: playerSnapshot.exists(),
    hasAnswered: answerSnapshot.exists(),
    timeLimitMs: ANSWER_WINDOW_MS,
  });

  if (!decision.ok) {
    const messages: Record<string, () => never> = {
      not_in_game: () => { throw forbidden('You are not in this game.', 'not_in_game'); },
      wrong_phase: () => { throw badRequest('No question is open right now.', 'wrong_phase'); },
      wrong_question: () => { throw badRequest('That question is not open.', 'wrong_question'); },
      not_started: () => { throw badRequest('The question has not started yet.', 'not_started'); },
      too_late: () => { throw gone("Time's up for that question!", 'too_late'); },
      already_answered: () => { throw conflict('You already answered this question.', 'already_answered'); },
      invalid_choice: () => { throw badRequest('That answer does not exist.', 'invalid_choice'); },
    };
    messages[decision.reason]?.();
  }

  // First submission wins; the transaction closes the race between two taps.
  const result = await game
    .child(`answers/${questionIndex}/${caller.uid}`)
    .transaction((existing) =>
      existing === null ? { choice, answeredAt: ServerValue.TIMESTAMP } : undefined,
    );

  if (!result.committed) {
    throw conflict('You already answered this question.', 'already_answered');
  }

  // A plain count the host screen can watch live. The answers themselves stay
  // unreadable to everyone but their own author, so the host cannot see who
  // picked what until the question closes.
  await game
    .child(`answerCounts/${questionIndex}`)
    .set(ServerValue.increment(1) as unknown as number)
    .catch(() => {
      // The tally is only a progress indicator; never fail an answer over it.
    });

  return { ok: true, choice };
}

const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Player records are temporary: anything finished over 24 hours ago is deleted. */
export async function purgeOldGames(now: number = Date.now()) {
  const snapshot = await rtdb().ref('games').get();
  const games = (snapshot.val() ?? {}) as Record<string, { meta?: GameMeta }>;

  let removed = 0;
  for (const [gameId, game] of Object.entries(games)) {
    const meta = game.meta;
    if (!meta) continue;
    // Abandoned lobbies are swept on the same clock as finished games.
    const finishedAt = meta.endedAt ?? meta.createdAt;
    if (typeof finishedAt !== 'number' || now - finishedAt < RETENTION_MS) continue;

    await rtdb().ref(`games/${gameId}`).remove();
    if (meta.code) await codeRef(meta.code).remove();
    removed += 1;
  }
  return { removed };
}
