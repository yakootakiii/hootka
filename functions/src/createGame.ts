import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { ServerValue } from 'firebase-admin/database';
import {
  MAX_PLAYERS,
  generateGameCode,
  validateQuestion,
  type GameMeta,
  type GameState,
  type Question,
} from '@hootka/core';
import { codeRef, firestore, gameRef, rtdb } from './firebase.js';
import { requireHost, requireString } from './guards.js';

const CODE_ATTEMPTS = 12;

/** Claim an unused 6-digit code atomically, so two hosts cannot share one. */
async function claimCode(gameId: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateGameCode();
    const result = await codeRef(code).transaction((existing) =>
      existing === null ? { gameId } : undefined,
    );
    if (result.committed) return code;
  }
  throw new HttpsError('resource-exhausted', 'Could not find a free game code. Try again.');
}

export async function loadQuizQuestions(quizId: string): Promise<Question[]> {
  const snapshot = await firestore
    .collection('quizzes')
    .doc(quizId)
    .collection('questions')
    .orderBy('order')
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Question);
}

export const createGame = onCall(async (request) => {
  const hostUid = requireHost(request);
  const quizId = requireString(request.data?.quizId, 'quizId');
  const streakBonus = request.data?.settings?.streakBonus === true;

  const quizDoc = await firestore.collection('quizzes').doc(quizId).get();
  if (!quizDoc.exists) {
    throw new HttpsError('not-found', 'That quiz no longer exists.');
  }
  if (quizDoc.data()?.ownerUid !== hostUid) {
    throw new HttpsError('permission-denied', 'That quiz belongs to someone else.');
  }

  const questions = await loadQuizQuestions(quizId);
  if (questions.length === 0) {
    throw new HttpsError('failed-precondition', 'Add at least one question before playing.');
  }
  const broken = questions.filter((question) => validateQuestion(question).length > 0);
  if (broken.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Question ${(broken[0]?.order ?? 0) + 1} is incomplete.`,
    );
  }

  const gameId = rtdb.ref('games').push().key;
  if (!gameId) {
    throw new HttpsError('internal', 'Could not create the game.');
  }
  const code = await claimCode(gameId);

  const meta: GameMeta = {
    hostUid,
    quizId,
    code,
    status: 'open',
    createdAt: Date.now(),
    endedAt: null,
    settings: { streakBonus },
  };
  const state: GameState = {
    phase: 'LOBBY',
    questionIndex: 0,
    questionStartedAt: null,
    totalQuestions: questions.length,
  };

  try {
    await gameRef(gameId).set({
      meta: { ...meta, createdAt: ServerValue.TIMESTAMP },
      state,
      playerCount: 0,
    });
  } catch (error) {
    // Do not leave an orphan code pointing at a game that was never written.
    await codeRef(code).remove();
    throw error;
  }

  return { gameId, code, totalQuestions: questions.length, maxPlayers: MAX_PLAYERS };
});
