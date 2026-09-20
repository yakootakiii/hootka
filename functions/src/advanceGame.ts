import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { ServerValue } from 'firebase-admin/database';
import { nextAdvance, toPublicQuestion, type GameState } from '@hootka/core';
import { codeRef, gameRef } from './firebase.js';
import { requireHost, requireString } from './guards.js';
import { loadQuizQuestions } from './createGame.js';
import { closeQuestionFor } from './closeQuestion.js';

export async function assertHostOf(gameId: string, uid: string) {
  const metaSnapshot = await gameRef(gameId).child('meta').get();
  const meta = metaSnapshot.val();
  if (!meta) throw new HttpsError('not-found', 'That game no longer exists.');
  if (meta.hostUid !== uid) {
    throw new HttpsError('permission-denied', 'Only the host can control this game.');
  }
  return meta;
}

export const advanceGame = onCall(async (request) => {
  const uid = requireHost(request);
  const gameId = requireString(request.data?.gameId, 'gameId');
  const skip = request.data?.skip === true;

  const meta = await assertHostOf(gameId, uid);
  const game = gameRef(gameId);
  const state = (await game.child('state').get()).val() as GameState | null;
  if (!state) throw new HttpsError('not-found', 'That game has no state.');

  const action = nextAdvance({ state, skip });
  if (action.type === 'noop') {
    throw new HttpsError('failed-precondition', action.reason);
  }

  // Leaving QUESTION_ACTIVE always scores first, whether the timer ran out or
  // the host pressed Skip, so the result screen has numbers to show.
  if (state.phase === 'QUESTION_ACTIVE') {
    await closeQuestionFor(gameId, state.questionIndex);
  }

  const updates: Record<string, unknown> = {
    'state/phase': action.phase,
    'state/questionIndex': action.questionIndex,
  };

  if (action.phase === 'QUESTION_INTRO') {
    const questions = await loadQuizQuestions(meta.quizId);
    const question = questions[action.questionIndex];
    if (!question) throw new HttpsError('failed-precondition', 'That question is missing.');

    // Only the redacted question reaches the public node; correctIndex stays
    // in Firestore until closeQuestion publishes the result.
    updates.publicQuestion = toPublicQuestion(question);
    updates['state/questionStartedAt'] = null;
    updates['meta/status'] = 'running';
  }

  if (action.openWindow) {
    updates['state/questionStartedAt'] = ServerValue.TIMESTAMP;
  }

  if (action.phase === 'ENDED') {
    updates['meta/status'] = 'ended';
    updates['meta/endedAt'] = ServerValue.TIMESTAMP;
    updates.publicQuestion = null;
  }

  await game.update(updates);

  // The code is released as soon as the game ends so it can be reused.
  if (action.phase === 'ENDED' && meta.code) {
    await codeRef(meta.code).remove();
  }

  return { phase: action.phase, questionIndex: action.questionIndex };
});

export const endGame = onCall(async (request) => {
  const uid = requireHost(request);
  const gameId = requireString(request.data?.gameId, 'gameId');
  const meta = await assertHostOf(gameId, uid);

  await gameRef(gameId).update({
    'state/phase': 'FINAL_PODIUM',
    'meta/status': 'ended',
    'meta/endedAt': ServerValue.TIMESTAMP,
    publicQuestion: null,
  });
  if (meta.code) await codeRef(meta.code).remove();
  return { ok: true };
});
