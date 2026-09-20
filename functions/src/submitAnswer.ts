import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { ServerValue } from 'firebase-admin/database';
import {
  canAcceptAnswer,
  type AnswerRejection,
  type GameState,
  type PublicQuestion,
} from '@hootka/core';
import { gameRef } from './firebase.js';
import { requireAuth, requireString } from './guards.js';

const REJECTION_ERRORS: Record<AnswerRejection, { code: 'permission-denied' | 'failed-precondition' | 'invalid-argument' | 'deadline-exceeded' | 'already-exists'; message: string }> = {
  not_in_game: { code: 'permission-denied', message: 'You are not in this game.' },
  wrong_phase: { code: 'failed-precondition', message: 'No question is open right now.' },
  wrong_question: { code: 'failed-precondition', message: 'That question is not open.' },
  not_started: { code: 'failed-precondition', message: 'The question has not started yet.' },
  too_late: { code: 'deadline-exceeded', message: "Time's up for that question!" },
  already_answered: { code: 'already-exists', message: 'You already answered this question.' },
  invalid_choice: { code: 'invalid-argument', message: 'That answer does not exist.' },
};

/**
 * Record a player's choice with a server timestamp. This function deliberately
 * does no scoring: `closeQuestion` scores everyone at once so all 50 players
 * are judged against the same clock.
 */
export const submitAnswer = onCall(async (request) => {
  const uid = requireAuth(request);
  const gameId = requireString(request.data?.gameId, 'gameId');
  const questionIndex = Number(request.data?.questionIndex);
  const choice = Number(request.data?.choice);

  if (!Number.isInteger(questionIndex) || questionIndex < 0) {
    throw new HttpsError('invalid-argument', 'Bad question index.');
  }

  const game = gameRef(gameId);
  const [stateSnapshot, questionSnapshot, playerSnapshot, answerSnapshot] = await Promise.all([
    game.child('state').get(),
    game.child('publicQuestion').get(),
    game.child(`players/${uid}`).get(),
    game.child(`answers/${questionIndex}/${uid}`).get(),
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
  });

  if (!decision.ok) {
    const error = REJECTION_ERRORS[decision.reason];
    throw new HttpsError(error.code, error.message, { reason: decision.reason });
  }

  // First submission wins: the transaction aborts if anything is already there,
  // which also closes the race between two taps sent at the same instant.
  const result = await game
    .child(`answers/${questionIndex}/${uid}`)
    .transaction((existing) => (existing === null ? { choice, answeredAt: ServerValue.TIMESTAMP } : undefined));

  if (!result.committed) {
    throw new HttpsError('already-exists', 'You already answered this question.', {
      reason: 'already_answered',
    });
  }

  return { ok: true, choice };
});
