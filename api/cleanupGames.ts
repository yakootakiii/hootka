import type { VercelRequest, VercelResponse } from '@vercel/node';
import { purgeOldGames } from './_lib/game.js';

/**
 * Replaces the scheduled Cloud Function. Vercel Cron calls this once a day and
 * sends CRON_SECRET as a bearer token; nothing else may trigger a bulk delete.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    response.status(500).json({ error: 'CRON_SECRET is not configured.' });
    return;
  }
  if (request.headers.authorization !== `Bearer ${secret}`) {
    response.status(401).json({ error: 'Not authorised.' });
    return;
  }
  try {
    const { removed } = await purgeOldGames();
    console.log(`cleanupGames removed ${removed} game(s)`);
    response.status(200).json({ removed });
  } catch (error) {
    console.error('cleanupGames failed:', error);
    response.status(500).json({ error: 'Cleanup failed.' });
  }
}
