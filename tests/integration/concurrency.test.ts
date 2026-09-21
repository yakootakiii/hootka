import { describe, expect, it } from 'vitest';
import { resultsToCsv, MAX_PLAYERS } from '@hootka/core';
import { GameSim, makeQuestions } from '../helpers/game-sim.js';

/** Deterministic pseudo-random so a failure can be reproduced. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return value / 4_294_967_296;
  };
}

describe('a full class of players', () => {
  // Checklist: 60 simultaneous players join and answer without errors.
  it('scores 60 players who all answer within one second of each other', () => {
    const game = new GameSim(makeQuestions(1));
    for (let i = 0; i < MAX_PLAYERS; i += 1) {
      expect(game.join(`u${i}`, `Player ${i}`)).toMatchObject({ ok: true });
    }

    game.openNextQuestion();
    const random = seeded(42);

    // Everyone taps inside a 1000ms burst, in a shuffled arrival order.
    const arrivals = Array.from({ length: MAX_PLAYERS }, (_, i) => ({
      uid: `u${i}`,
      delay: Math.floor(random() * 1000),
      choice: i % 4,
    })).sort((a, b) => a.delay - b.delay);

    let clock = 0;
    for (const arrival of arrivals) {
      game.tick(arrival.delay - clock);
      clock = arrival.delay;
      expect(game.submit(arrival.uid, arrival.choice), arrival.uid).toEqual({ ok: true });
    }

    game.advance();

    const result = game.results.get(0);
    expect(result?.answeredCount).toBe(MAX_PLAYERS);
    expect(result?.counts.reduce((sum, count) => sum + count, 0)).toBe(MAX_PLAYERS);

    // Exactly the 15 players who picked option 0 scored.
    const scorers = game.leaderboard().filter((player) => player.score > 0);
    expect(scorers).toHaveLength(MAX_PLAYERS / 4);
    for (const player of scorers) {
      expect(player.score).toBeGreaterThanOrEqual(950);
      expect(player.score).toBeLessThanOrEqual(1000);
    }
  });

  it('gives every player a distinct rank when the burst is tight', () => {
    const game = new GameSim(makeQuestions(1));
    for (let i = 0; i < 50; i += 1) game.join(`u${i}`, `Player ${i}`);

    game.openNextQuestion();
    for (let i = 0; i < 50; i += 1) {
      game.tick(10); // 10ms apart: everyone correct, different speeds
      game.submit(`u${i}`, 0);
    }
    game.advance();

    const ranks = game.leaderboard().map((player) => player.rank);
    expect(ranks).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    // The earliest answer leads, as the tie-break requires.
    expect(game.leaderboard()[0]?.uid).toBe('u0');
  });

  it('exports a CSV covering the whole class after three questions', () => {
    const game = new GameSim(makeQuestions(3));
    for (let i = 0; i < 50; i += 1) game.join(`u${i}`, `Player ${i}`);

    for (let q = 0; q < 3; q += 1) {
      game.openNextQuestion();
      const correct = game.questions[q]!.correctIndex;
      for (let i = 0; i < 50; i += 1) {
        game.tick(20);
        game.submit(`u${i}`, i % 3 === 0 ? correct : (correct + 1) % 4);
      }
      game.advance(); // -> RESULT (scores and ranks)
    }

    const csv = resultsToCsv(game.leaderboard());
    const lines = csv.split('\n');
    expect(lines[0]).toBe('rank,nickname,score,correct,avg_response_seconds');
    expect(lines).toHaveLength(51);
    expect(game.leaderboard()[0]?.correctCount).toBe(3);
  });
});
