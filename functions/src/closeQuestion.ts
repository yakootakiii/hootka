import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  applyQuestionResults,
  buildQuestionResult,
  scoreQuestion,
  type AnswerSubmission,
  type GameMeta,
  type GameState,
  type Player,
  type Question,
} from '@hootka/core';
import { gameRef } from './firebase.js';
import { requireHost, requireString } from './guards.js';
import { loadQuizQuestions } from './createGame.js';

/**
 * Score one question for every player at once and publish the result.
 *
 * Idempotent: the host client calls this at the timer end and `advanceGame`
 * calls it again when leaving QUESTION_ACTIVE, so a second call must be a
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

  if (resultSnapshot.exists()) {
    return { alreadyClosed: true as const };
  }

  const meta = metaSnapshot.val() as GameMeta | null;
  const state = stateSnapshot.val() as GameState | null;
  if (!meta || !state) throw new HttpsError('not-found', 'That game no longer exists.');
  if (typeof state.questionStartedAt !== 'number') {
    throw new HttpsError('failed-precondition', 'That question never opened.');
  }

  const questions = await loadQuizQuestions(meta.quizId);
  const question: Question | undefined = questions[questionIndex];
  if (!question) throw new HttpsError('not-found', 'That question no longer exists.');

  const rawAnswers = (answersSnapshot.val() ?? {}) as Record<
    string,
    { choice: number; answeredAt: number }
  >;
  const submissions: AnswerSubmission[] = Object.entries(rawAnswers).map(([playerUid, answer]) => ({
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

  const updated = applyQuestionResults({ players, scored });

  const updates: Record<string, unknown> = {
    [`results/${questionIndex}`]: buildQuestionResult(question.correctIndex, counts, scored),
  };

  for (const answer of scored) {
    updates[`answers/${questionIndex}/${answer.playerUid}/points`] = answer.points;
    updates[`answers/${questionIndex}/${answer.playerUid}/correct`] = answer.correct;
    updates[`answers/${questionIndex}/${answer.playerUid}/order`] = answer.order;
  }

  for (const player of updated) {
    const { uid, ...fields } = player;
    for (const [key, value] of Object.entries(fields)) {
      updates[`players/${uid}/${key}`] = value;
    }
  }

  await game.update(updates);
  return { alreadyClosed: false as const, answeredCount: scored.length };
}

export const closeQuestion = onCall(async (request) => {
  const uid = requireHost(request);
  const gameId = requireString(request.data?.gameId, 'gameId');
  const questionIndex = Number(request.data?.questionIndex);

  if (!Number.isInteger(questionIndex) || questionIndex < 0) {
    throw new HttpsError('invalid-argument', 'Bad question index.');
  }

  const hostUid = (await gameRef(gameId).child('meta/hostUid').get()).val();
  if (hostUid !== uid) {
    throw new HttpsError('permission-denied', 'Only the host can close a question.');
  }

  return closeQuestionFor(gameId, questionIndex);
});
