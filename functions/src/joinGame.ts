import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { ServerValue } from 'firebase-admin/database';
import {
  MAX_PLAYERS,
  isValidGameCode,
  lobbyIsOpen,
  normalizeGameCode,
  validateNickname,
  type GamePhase,
  type Player,
} from '@hootka/core';
import { codeRef, gameRef } from './firebase.js';
import { requireAuth, requireString } from './guards.js';

export const joinGame = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = normalizeGameCode(requireString(request.data?.code, 'code', 20));
  const rawName = requireString(request.data?.name, 'name', 64);

  if (!isValidGameCode(code)) {
    throw new HttpsError('invalid-argument', 'That game code does not look right.');
  }

  const codeSnapshot = await codeRef(code).get();
  const gameId = codeSnapshot.val()?.gameId as string | undefined;
  if (!gameId) {
    throw new HttpsError('not-found', 'No game found with that code.');
  }

  const game = gameRef(gameId);
  const [stateSnapshot, playersSnapshot] = await Promise.all([
    game.child('state').get(),
    game.child('players').get(),
  ]);

  const phase = stateSnapshot.val()?.phase as GamePhase | undefined;
  const players = (playersSnapshot.val() ?? {}) as Record<string, Player>;

  // A player who refreshes or drops off mid-game keeps their name and score.
  const existing = players[uid];
  if (existing) {
    await game.child(`players/${uid}/connected`).set(true);
    return { gameId, name: existing.name, rejoined: true };
  }

  if (!phase || !lobbyIsOpen(phase)) {
    throw new HttpsError('failed-precondition', 'That game has already started.');
  }
  if (Object.keys(players).length >= MAX_PLAYERS) {
    throw new HttpsError('resource-exhausted', 'This game is full.');
  }

  const taken = Object.values(players).map((player) => player.name);
  const check = validateNickname(rawName, { taken });
  if (!check.ok) {
    throw new HttpsError('invalid-argument', check.message, { reason: check.reason });
  }

  const player: Omit<Player, 'uid' | 'joinedAt'> & { joinedAt: object } = {
    name: check.name,
    joinedAt: ServerValue.TIMESTAMP as unknown as object,
    score: 0,
    streak: 0,
    rank: 0,
    prevRank: 0,
    lastPoints: 0,
    correctCount: 0,
    totalResponseMs: 0,
    answeredCount: 0,
    connected: true,
  };

  // Re-check the lobby inside the write so a player cannot slip in as the
  // host presses Start, and so the cap holds under 50 simultaneous joins.
  const result = await game.child('players').transaction((current: Record<string, unknown> | null) => {
    const roster = current ?? {};
    if (Object.keys(roster).length >= MAX_PLAYERS) return undefined;
    if (Object.values(roster).some((row) => (row as Player)?.name === check.name)) return undefined;
    return { ...roster, [uid]: player };
  });

  if (!result.committed) {
    throw new HttpsError('aborted', 'That name was just taken, or the game filled up.');
  }

  await game.child('playerCount').set(Object.keys(result.snapshot.val() ?? {}).length);
  return { gameId, name: check.name, rejoined: false };
});

export const kickPlayer = onCall(async (request) => {
  const uid = requireAuth(request);
  const gameId = requireString(request.data?.gameId, 'gameId');
  const playerUid = requireString(request.data?.playerUid, 'playerUid');

  const game = gameRef(gameId);
  const hostUid = (await game.child('meta/hostUid').get()).val();
  if (hostUid !== uid) {
    throw new HttpsError('permission-denied', 'Only the host can remove a player.');
  }

  await game.child(`players/${playerUid}`).remove();
  const remaining = await game.child('players').get();
  await game.child('playerCount').set(Object.keys(remaining.val() ?? {}).length);
  return { ok: true };
});
