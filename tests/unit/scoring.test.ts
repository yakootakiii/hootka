import { describe, expect, it } from 'vitest';
import {
  ANSWER_WINDOW_MS,
  isWithinAnswerWindow,
  pointsFor,
  responseMs,
  scoreQuestion,
  streakBonusFor,
  type AnswerSubmission,
} from '@hootka/core';

const T0 = 1_700_000_000_000;

const at = (msAfterStart: number, uid: string, choice: number): AnswerSubmission => ({
  playerUid: uid,
  choice,
  answeredAt: T0 + msAfterStart,
});

describe('pointsFor', () => {
  // Checklist: instant answer ~1000, answer at 10s ~500.
  it('awards ~1000 for an instant answer', () => {
    expect(pointsFor(0)).toBe(1000);
  });

  it('awards ~500 at the buzzer', () => {
    expect(pointsFor(ANSWER_WINDOW_MS)).toBe(500);
  });

  it('awards ~750 at the halfway point', () => {
    expect(pointsFor(5_000)).toBe(750);
  });

  it('never drops below half the maximum, even past the window', () => {
    expect(pointsFor(99_000)).toBe(500);
  });

  it('never exceeds the maximum for a negative response time', () => {
    expect(pointsFor(-5_000)).toBe(1000);
  });

  it('decreases monotonically across the window', () => {
    const series = [0, 1000, 2500, 5000, 7500, 9999, 10000].map((ms) => pointsFor(ms));
    const sortedDesc = [...series].sort((a, b) => b - a);
    expect(series).toEqual(sortedDesc);
  });
});

describe('responseMs', () => {
  it('clamps into the answer window', () => {
    expect(responseMs(T0 + 3_000, T0)).toBe(3_000);
    expect(responseMs(T0 - 500, T0)).toBe(0);
    expect(responseMs(T0 + 10_600, T0)).toBe(ANSWER_WINDOW_MS);
  });

  it('treats a non-finite timestamp as a full-window response', () => {
    expect(responseMs(Number.NaN, T0)).toBe(ANSWER_WINDOW_MS);
  });
});

describe('isWithinAnswerWindow', () => {
  it('accepts an answer inside the window', () => {
    expect(isWithinAnswerWindow(T0 + 9_999, T0)).toBe(true);
  });

  // Checklist: a late answer after the window closes is rejected.
  it('accepts the 1s network grace but rejects anything later', () => {
    expect(isWithinAnswerWindow(T0 + 10_999, T0)).toBe(true);
    expect(isWithinAnswerWindow(T0 + 11_001, T0)).toBe(false);
  });

  it('rejects an answer that predates the question opening', () => {
    expect(isWithinAnswerWindow(T0 - 1, T0)).toBe(false);
  });
});

describe('streakBonusFor', () => {
  it('pays nothing for the first correct answer', () => {
    expect(streakBonusFor(0)).toBe(0);
  });

  it('pays 50 per consecutive correct answer, capped at 200', () => {
    expect(streakBonusFor(1)).toBe(50);
    expect(streakBonusFor(4)).toBe(200);
    expect(streakBonusFor(9)).toBe(200);
  });
});

describe('scoreQuestion', () => {
  const base = { correctIndex: 1, questionStartedAt: T0, optionCount: 4 };

  it('scores correct answers by speed and wrong answers at zero', () => {
    const { scored } = scoreQuestion({
      ...base,
      submissions: [at(0, 'fast', 1), at(10_000, 'slow', 1), at(1_000, 'wrong', 3)],
    });

    const byUid = Object.fromEntries(scored.map((answer) => [answer.playerUid, answer]));
    expect(byUid.fast?.points).toBe(1000);
    expect(byUid.slow?.points).toBe(500);
    // Checklist: a wrong answer scores 0 however fast it was.
    expect(byUid.wrong?.points).toBe(0);
    expect(byUid.wrong?.correct).toBe(false);
  });

  // Checklist: no answer = 0 points (the player simply has no scored record).
  it('produces no record for a player who did not answer', () => {
    const { scored, answeredCount } = scoreQuestion({ ...base, submissions: [at(500, 'a', 1)] });
    expect(scored.map((answer) => answer.playerUid)).toEqual(['a']);
    expect(answeredCount).toBe(1);
  });

  // Checklist: late answers are rejected.
  it('drops answers that arrive after the window plus grace', () => {
    const { scored, counts } = scoreQuestion({
      ...base,
      submissions: [at(1_000, 'ontime', 1), at(11_500, 'late', 1)],
    });
    expect(scored.map((answer) => answer.playerUid)).toEqual(['ontime']);
    expect(counts[1]).toBe(1);
  });

  it('drops answers pointing at an option that does not exist', () => {
    const { scored } = scoreQuestion({
      ...base,
      optionCount: 2,
      submissions: [at(100, 'ok', 1), at(100, 'bogus', 7), at(100, 'negative', -1)],
    });
    expect(scored.map((answer) => answer.playerUid)).toEqual(['ok']);
  });

  it('numbers answers by arrival so the speed badge is meaningful', () => {
    const { scored } = scoreQuestion({
      ...base,
      submissions: [at(900, 'third', 0), at(100, 'first', 1), at(400, 'second', 1)],
    });
    expect(scored.map((answer) => [answer.playerUid, answer.order])).toEqual([
      ['first', 1],
      ['second', 2],
      ['third', 3],
    ]);
  });

  it('breaks identical timestamps deterministically', () => {
    const run = () =>
      scoreQuestion({ ...base, submissions: [at(500, 'zoe', 1), at(500, 'amy', 1)] }).scored.map(
        (answer) => answer.playerUid,
      );
    expect(run()).toEqual(['amy', 'zoe']);
    expect(run()).toEqual(run());
  });

  it('counts the distribution for the result chart', () => {
    const { counts, answeredCount } = scoreQuestion({
      ...base,
      submissions: [at(100, 'a', 0), at(200, 'b', 1), at(300, 'c', 1), at(400, 'd', 3)],
    });
    expect(counts).toEqual([1, 2, 0, 1]);
    expect(answeredCount).toBe(4);
  });

  it('adds the streak bonus only when the setting is on', () => {
    const args = {
      ...base,
      submissions: [at(0, 'streaker', 1)],
      streaks: { streaker: 3 },
    };
    expect(scoreQuestion(args).scored[0]?.points).toBe(1000);
    expect(scoreQuestion({ ...args, streakBonusEnabled: true }).scored[0]?.points).toBe(1150);
  });

  it('never pays a streak bonus on a wrong answer', () => {
    const { scored } = scoreQuestion({
      ...base,
      submissions: [at(0, 'streaker', 2)],
      streaks: { streaker: 4 },
      streakBonusEnabled: true,
    });
    expect(scored[0]?.points).toBe(0);
  });

  it('handles a question nobody answered', () => {
    const { scored, counts, answeredCount } = scoreQuestion({ ...base, submissions: [] });
    expect(scored).toEqual([]);
    expect(counts).toEqual([0, 0, 0, 0]);
    expect(answeredCount).toBe(0);
  });
});
