import { describe, expect, it } from 'vitest';
import { canAcceptAnswer, type AnswerGuardInput } from '@hootka/core';

const T0 = 1_700_000_000_000;

const input = (overrides: Partial<AnswerGuardInput> = {}): AnswerGuardInput => ({
  phase: 'QUESTION_ACTIVE',
  currentQuestionIndex: 0,
  questionStartedAt: T0,
  questionIndex: 0,
  choice: 1,
  optionCount: 4,
  now: T0 + 1_000,
  isPlayer: true,
  hasAnswered: false,
  ...overrides,
});

describe('canAcceptAnswer', () => {
  it('accepts a normal in-window answer', () => {
    expect(canAcceptAnswer(input())).toEqual({ ok: true });
  });

  it('rejects someone who is not in the game', () => {
    expect(canAcceptAnswer(input({ isPlayer: false }))).toEqual({ ok: false, reason: 'not_in_game' });
  });

  it('rejects an answer sent outside the active phase', () => {
    expect(canAcceptAnswer(input({ phase: 'QUESTION_RESULT' }))).toEqual({
      ok: false,
      reason: 'wrong_phase',
    });
  });

  it('rejects an answer aimed at a different question', () => {
    expect(canAcceptAnswer(input({ questionIndex: 1, currentQuestionIndex: 0 }))).toEqual({
      ok: false,
      reason: 'wrong_question',
    });
  });

  it('rejects an answer before the server stamped the start', () => {
    expect(canAcceptAnswer(input({ questionStartedAt: null }))).toEqual({
      ok: false,
      reason: 'not_started',
    });
  });

  it('rejects a choice outside the options', () => {
    expect(canAcceptAnswer(input({ choice: 4 }))).toEqual({ ok: false, reason: 'invalid_choice' });
    expect(canAcceptAnswer(input({ choice: -1 }))).toEqual({ ok: false, reason: 'invalid_choice' });
    expect(canAcceptAnswer(input({ choice: 1.5 }))).toEqual({ ok: false, reason: 'invalid_choice' });
  });

  it('rejects a second answer from the same player', () => {
    expect(canAcceptAnswer(input({ hasAnswered: true }))).toEqual({
      ok: false,
      reason: 'already_answered',
    });
  });

  it('reports a double submit as such even when it arrives late', () => {
    expect(canAcceptAnswer(input({ hasAnswered: true, now: T0 + 30_000 }))).toEqual({
      ok: false,
      reason: 'already_answered',
    });
  });

  it('accepts the last moment of the grace period and rejects just after', () => {
    expect(canAcceptAnswer(input({ now: T0 + 11_000 }))).toEqual({ ok: true });
    expect(canAcceptAnswer(input({ now: T0 + 11_001 }))).toEqual({ ok: false, reason: 'too_late' });
  });

  it('honours a custom time limit', () => {
    expect(canAcceptAnswer(input({ now: T0 + 6_500, timeLimitMs: 5_000 }))).toEqual({
      ok: false,
      reason: 'too_late',
    });
  });
});

describe('answers stop counting once the result is up', () => {
  // The result screen now also carries the ranking, so it is the only phase a
  // late tap can land in after the window closes.
  it('rejects an answer sent while the result is showing', () => {
    expect(canAcceptAnswer(input({ phase: 'QUESTION_RESULT', now: T0 + 500 }))).toEqual({
      ok: false,
      reason: 'wrong_phase',
    });
  });
});
