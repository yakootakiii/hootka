import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { codeRef, rtdb } from './firebase.js';
import type { GameMeta } from '@hootka/core';

const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Player records are temporary by design (section 7 of the spec): every game
 * that ended more than 24 hours ago is deleted, along with its code.
 */
export async function purgeOldGames(now: number = Date.now()) {
  const snapshot = await rtdb.ref('games').get();
  const games = (snapshot.val() ?? {}) as Record<string, { meta?: GameMeta }>;

  let removed = 0;
  for (const [gameId, game] of Object.entries(games)) {
    const meta = game.meta;
    if (!meta) continue;

    // Abandoned lobbies are swept on the same clock as finished games.
    const finishedAt = meta.endedAt ?? meta.createdAt;
    if (typeof finishedAt !== 'number' || now - finishedAt < RETENTION_MS) continue;

    await rtdb.ref(`games/${gameId}`).remove();
    if (meta.code) await codeRef(meta.code).remove();
    removed += 1;
  }

  return { removed };
}

export const cleanupGames = onSchedule('every 60 minutes', async () => {
  const { removed } = await purgeOldGames();
  logger.info(`cleanupGames removed ${removed} game(s)`);
});
