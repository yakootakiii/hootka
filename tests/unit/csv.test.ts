import { describe, expect, it } from 'vitest';
import { averageResponseSeconds, resultsToCsv, type Player } from '@hootka/core';

const player = (overrides: Partial<Player> & { uid: string }): Player => ({
  name: overrides.uid,
  joinedAt: 0,
  score: 0,
  streak: 0,
  rank: 1,
  prevRank: 0,
  lastPoints: 0,
  correctCount: 0,
  totalResponseMs: 0,
  answeredCount: 0,
  ...overrides,
});

describe('averageResponseSeconds', () => {
  it('averages to one decimal place', () => {
    expect(averageResponseSeconds({ totalResponseMs: 9_000, answeredCount: 4 })).toBe(2.3);
  });

  it('returns 0 when the player never answered', () => {
    expect(averageResponseSeconds({ totalResponseMs: 0, answeredCount: 0 })).toBe(0);
  });
});

describe('resultsToCsv', () => {
  it('writes a header and one row per player, ordered by rank', () => {
    const csv = resultsToCsv([
      player({ uid: 'b', name: 'Ben', score: 1800, rank: 2, correctCount: 2, totalResponseMs: 6_000, answeredCount: 3 }),
      player({ uid: 'a', name: 'Ana', score: 2600, rank: 1, correctCount: 3, totalResponseMs: 3_000, answeredCount: 3 }),
    ]);

    expect(csv.split('\n')).toEqual([
      'rank,nickname,score,correct,avg_response_seconds',
      '1,Ana,2600,3,1',
      '2,Ben,1800,2,2',
    ]);
  });

  it('quotes nicknames containing a comma or quote', () => {
    const csv = resultsToCsv([player({ uid: 'a', name: 'Ana, the "Owl"' })]);
    expect(csv).toContain('"Ana, the ""Owl"""');
  });

  it('handles an empty game', () => {
    expect(resultsToCsv([])).toBe('rank,nickname,score,correct,avg_response_seconds');
  });
});
