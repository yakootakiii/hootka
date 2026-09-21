import type { Player } from './types.js';

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Average response time in seconds, to one decimal. 0 when nothing was answered. */
export function averageResponseSeconds(player: Pick<Player, 'totalResponseMs' | 'answeredCount'>): number {
  if (player.answeredCount <= 0) return 0;
  return Math.round((player.totalResponseMs / player.answeredCount / 1000) * 10) / 10;
}

/** Host's end-of-game export: nickname, score, correct answers, average speed. */
export function resultsToCsv(players: Player[]): string {
  const header = ['rank', 'nickname', 'score', 'correct', 'avg_response_seconds'];
  const rows = [...players]
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map((player) =>
      [
        player.rank,
        player.name,
        player.score,
        player.correctCount,
        averageResponseSeconds(player),
      ]
        .map(escapeCell)
        .join(','),
    );
  return [header.join(','), ...rows].join('\n');
}
