import { describe, expect, it } from 'vitest';
import {
  applyQuestionResults,
  compareForRank,
  gapToNext,
  rankChangeFor,
  rankPlayers,
  scoreQuestion,
  type Player,
  type RankingInput,
} from '@hootka/core';

const T0 = 1_700_000_000_000;

const entry = (overrides: Partial<RankingInput> & { uid: string }): RankingInput => ({
  name: overrides.uid,
  score: 0,
  joinedAt: T0,
  streak: 0,
  prevRank: 0,
  lastPoints: 0,
  lastAnsweredAt: null,
  ...overrides,
});

const player = (overrides: Partial<Player> & { uid: string }): Player => ({
  name: overrides.uid,
  joinedAt: T0,
  score: 0,
  streak: 0,
  rank: 0,
  prevRank: 0,
  lastPoints: 0,
  correctCount: 0,
  totalResponseMs: 0,
  answeredCount: 0,
  ...overrides,
});

describe('compareForRank', () => {
  it('orders by total score first', () => {
    expect(compareForRank(entry({ uid: 'a', score: 900 }), entry({ uid: 'b', score: 1000 }))).toBeGreaterThan(0);
  });

  it('falls back to the current question score', () => {
    const a = entry({ uid: 'a', score: 1000, lastPoints: 400 });
    const b = entry({ uid: 'b', score: 1000, lastPoints: 900 });
    expect(compareForRank(a, b)).toBeGreaterThan(0);
  });

  // Checklist: equal totals are ordered by the earlier answer time.
  it('falls back to the earlier answer on the current question', () => {
    const early = entry({ uid: 'early', score: 1000, lastPoints: 800, lastAnsweredAt: T0 + 1_000 });
    const late = entry({ uid: 'late', score: 1000, lastPoints: 800, lastAnsweredAt: T0 + 4_000 });
    expect(compareForRank(early, late)).toBeLessThan(0);
    expect(rankPlayers([late, early]).map((row) => row.uid)).toEqual(['early', 'late']);
  });

  it('ranks a player who answered above one who did not', () => {
    const answered = entry({ uid: 'answered', lastAnsweredAt: T0 + 9_000 });
    const silent = entry({ uid: 'silent', lastAnsweredAt: null });
    expect(compareForRank(answered, silent)).toBeLessThan(0);
  });

  it('falls back to the earlier join time', () => {
    const veteran = entry({ uid: 'veteran', joinedAt: T0 });
    const latecomer = entry({ uid: 'latecomer', joinedAt: T0 + 60_000 });
    expect(compareForRank(veteran, latecomer)).toBeLessThan(0);
  });
});

describe('rankPlayers', () => {
  it('assigns 1..n in order', () => {
    const ranked = rankPlayers([
      entry({ uid: 'c', score: 100 }),
      entry({ uid: 'a', score: 3000 }),
      entry({ uid: 'b', score: 2000 }),
    ]);
    expect(ranked.map((row) => [row.uid, row.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('shares a rank only when every tie-break is identical', () => {
    const ranked = rankPlayers([
      entry({ uid: 'x', score: 500, joinedAt: T0 }),
      entry({ uid: 'y', score: 500, joinedAt: T0 }),
      entry({ uid: 'z', score: 100, joinedAt: T0 }),
    ]);
    expect(ranked.map((row) => row.rank)).toEqual([1, 1, 3]);
  });

  it('reports rank movement against the previous question', () => {
    const ranked = rankPlayers([
      entry({ uid: 'climber', score: 2000, prevRank: 5 }),
      entry({ uid: 'faller', score: 1000, prevRank: 1 }),
      entry({ uid: 'steady', score: 500, prevRank: 3 }),
      entry({ uid: 'rookie', score: 0, prevRank: 0 }),
    ]);
    expect(ranked.map((row) => row.change)).toEqual(['up', 'down', 'same', 'new']);
  });

  it('does not mutate the input array', () => {
    const input = [entry({ uid: 'a', score: 1 }), entry({ uid: 'b', score: 2 })];
    const snapshot = [...input];
    rankPlayers(input);
    expect(input).toEqual(snapshot);
  });
});

describe('rankChangeFor', () => {
  it('maps rank movement to an arrow', () => {
    expect(rankChangeFor(1, 4)).toBe('up');
    expect(rankChangeFor(4, 1)).toBe('down');
    expect(rankChangeFor(2, 2)).toBe('same');
    expect(rankChangeFor(2, 0)).toBe('new');
  });
});

describe('gapToNext', () => {
  const board = rankPlayers([
    entry({ uid: 'first', score: 2400 }),
    entry({ uid: 'second', score: 1950 }),
    entry({ uid: 'third', score: 1950, joinedAt: T0 + 5 }),
  ]);

  it('returns the points needed to catch the player above', () => {
    expect(gapToNext(board, 'second')).toBe(450);
    expect(gapToNext(board, 'third')).toBe(0);
  });

  it('returns null for the leader and for an unknown player', () => {
    expect(gapToNext(board, 'first')).toBeNull();
    expect(gapToNext(board, 'ghost')).toBeNull();
  });
});

describe('applyQuestionResults', () => {
  it('folds a question into totals, streaks, counts and ranks', () => {
    const players = [
      player({ uid: 'ana', score: 1000, streak: 1, rank: 1 }),
      player({ uid: 'ben', score: 900, streak: 0, rank: 2 }),
      player({ uid: 'cal', score: 0, streak: 0, rank: 3 }),
    ];

    const { scored } = scoreQuestion({
      submissions: [
        { playerUid: 'ana', choice: 0, answeredAt: T0 + 2_000 },
        { playerUid: 'ben', choice: 1, answeredAt: T0 + 1_000 },
      ],
      correctIndex: 1,
      questionStartedAt: T0,
      optionCount: 4,
    });

    const updated = applyQuestionResults({ players, scored });
    const byUid = Object.fromEntries(updated.map((entryPlayer) => [entryPlayer.uid, entryPlayer]));

    expect(byUid.ben?.score).toBe(900 + 950);
    expect(byUid.ben?.streak).toBe(1);
    expect(byUid.ben?.correctCount).toBe(1);
    expect(byUid.ben?.rank).toBe(1);

    // A wrong answer keeps the score but resets the streak.
    expect(byUid.ana?.score).toBe(1000);
    expect(byUid.ana?.streak).toBe(0);
    expect(byUid.ana?.lastPoints).toBe(0);
    expect(byUid.ana?.answeredCount).toBe(1);

    // No answer at all: nothing changes except the remembered rank.
    expect(byUid.cal?.score).toBe(0);
    expect(byUid.cal?.answeredCount).toBe(0);
    expect(byUid.cal?.prevRank).toBe(3);
  });

  it('remembers the previous rank so arrows can be drawn', () => {
    const players = [player({ uid: 'a', score: 0, rank: 2 }), player({ uid: 'b', score: 0, rank: 1 })];
    const updated = applyQuestionResults({ players, scored: [] });
    expect(updated.map((entryPlayer) => entryPlayer.prevRank)).toEqual([2, 1]);
  });

  it('does not mutate the players passed in', () => {
    const players = [player({ uid: 'a', score: 100 })];
    applyQuestionResults({
      players,
      scored: [
        {
          playerUid: 'a',
          choice: 0,
          answeredAt: T0,
          correct: true,
          points: 1000,
          order: 1,
          responseMs: 0,
        },
      ],
    });
    expect(players[0]?.score).toBe(100);
  });
});
