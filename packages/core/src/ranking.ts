import type { LeaderboardEntry, Player, RankChange, ScoredAnswer } from './types.js';

/** What the tie-break needs to know about a player's performance on the current question. */
export interface RankingInput {
  uid: string;
  name: string;
  score: number;
  joinedAt: number;
  streak: number;
  prevRank: number;
  /** Points scored on the question that just closed. */
  lastPoints: number;
  /** Server timestamp of this player's answer to the question that just closed. */
  lastAnsweredAt: number | null;
}

/**
 * Spec ordering: total score desc, then current-question score desc, then the
 * earlier answer on the current question, then the earlier join. `uid` is the
 * final tie-break purely so the sort is deterministic.
 */
export function compareForRank(a: RankingInput, b: RankingInput): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.lastPoints !== b.lastPoints) return b.lastPoints - a.lastPoints;

  const aAnswered = a.lastAnsweredAt ?? Number.POSITIVE_INFINITY;
  const bAnswered = b.lastAnsweredAt ?? Number.POSITIVE_INFINITY;
  if (aAnswered !== bAnswered) return aAnswered - bAnswered;

  if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
  return a.uid.localeCompare(b.uid);
}

/** True when two players are indistinguishable under every spec tie-break. */
function isTie(a: RankingInput, b: RankingInput): boolean {
  return (
    a.score === b.score &&
    a.lastPoints === b.lastPoints &&
    (a.lastAnsweredAt ?? null) === (b.lastAnsweredAt ?? null) &&
    a.joinedAt === b.joinedAt
  );
}

export function rankChangeFor(rank: number, prevRank: number): RankChange {
  if (!prevRank || prevRank <= 0) return 'new';
  if (rank < prevRank) return 'up';
  if (rank > prevRank) return 'down';
  return 'same';
}

/**
 * Order players and assign ranks. Players who tie on every criterion share a
 * rank (so two "1st" places are followed by a 3rd), which only happens when
 * neither answered.
 */
export function rankPlayers(players: RankingInput[]): LeaderboardEntry[] {
  const sorted = [...players].sort(compareForRank);

  let lastRank = 0;
  return sorted.map((player, index) => {
    const previous = sorted[index - 1];
    const rank = previous && isTie(player, previous) ? lastRank : index + 1;
    lastRank = rank;

    return {
      uid: player.uid,
      name: player.name,
      score: player.score,
      rank,
      prevRank: player.prevRank,
      change: rankChangeFor(rank, player.prevRank),
      lastPoints: player.lastPoints,
      streak: player.streak,
    };
  });
}

/** Points a player needs to catch the player directly above them. */
export function gapToNext(entries: LeaderboardEntry[], uid: string): number | null {
  const index = entries.findIndex((entry) => entry.uid === uid);
  if (index <= 0) return null;
  const above = entries[index - 1];
  const self = entries[index];
  if (!above || !self) return null;
  return Math.max(above.score - self.score, 0);
}

export interface ApplyQuestionInput {
  players: Player[];
  scored: ScoredAnswer[];
}

/**
 * Fold one question's scored answers into the player records: new totals,
 * streaks, ranks and `prevRank`. Returns fresh objects; the input is untouched.
 */
export function applyQuestionResults({ players, scored }: ApplyQuestionInput): Player[] {
  const byUid = new Map(scored.map((answer) => [answer.playerUid, answer]));

  const updated = players.map((player) => {
    const answer = byUid.get(player.uid);
    const correct = answer?.correct ?? false;

    return {
      ...player,
      score: player.score + (answer?.points ?? 0),
      streak: correct ? player.streak + 1 : 0,
      lastPoints: answer?.points ?? 0,
      correctCount: player.correctCount + (correct ? 1 : 0),
      answeredCount: player.answeredCount + (answer ? 1 : 0),
      totalResponseMs: player.totalResponseMs + (answer?.responseMs ?? 0),
      prevRank: player.rank,
    };
  });

  const ranked = rankPlayers(
    updated.map((player) => ({
      uid: player.uid,
      name: player.name,
      score: player.score,
      joinedAt: player.joinedAt,
      streak: player.streak,
      prevRank: player.prevRank,
      lastPoints: player.lastPoints,
      lastAnsweredAt: byUid.get(player.uid)?.answeredAt ?? null,
    })),
  );

  const rankByUid = new Map(ranked.map((entry) => [entry.uid, entry.rank]));
  return updated.map((player) => ({ ...player, rank: rankByUid.get(player.uid) ?? player.rank }));
}
