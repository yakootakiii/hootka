import { describe, expect, it } from 'vitest';
import { acceptsAnswers, isOver, lobbyIsOpen, nextAdvance, type GamePhase } from '@hootka/core';

const state = (phase: GamePhase, questionIndex = 0, totalQuestions = 3) => ({
  phase,
  questionIndex,
  totalQuestions,
});

describe('nextAdvance', () => {
  it('starts the first question from the lobby', () => {
    expect(nextAdvance({ state: state('LOBBY') })).toEqual({
      type: 'set-phase',
      phase: 'QUESTION_INTRO',
      questionIndex: 0,
      openWindow: false,
    });
  });

  it('refuses to start a quiz with no questions', () => {
    expect(nextAdvance({ state: state('LOBBY', 0, 0) })).toEqual({
      type: 'noop',
      reason: 'quiz_has_no_questions',
    });
  });

  it('opens the answer window only when leaving the intro', () => {
    const fromIntro = nextAdvance({ state: state('QUESTION_INTRO') });
    expect(fromIntro).toMatchObject({ phase: 'QUESTION_ACTIVE', openWindow: true });

    const fromActive = nextAdvance({ state: state('QUESTION_ACTIVE') });
    expect(fromActive).toMatchObject({ phase: 'QUESTION_RESULT', openWindow: false });
  });

  it('shows the result then the leaderboard', () => {
    expect(nextAdvance({ state: state('QUESTION_RESULT') })).toMatchObject({ phase: 'LEADERBOARD' });
  });

  it('moves to the next question from the leaderboard', () => {
    expect(nextAdvance({ state: state('LEADERBOARD', 0, 3) })).toMatchObject({
      phase: 'QUESTION_INTRO',
      questionIndex: 1,
    });
  });

  it('goes to the podium after the last question', () => {
    expect(nextAdvance({ state: state('LEADERBOARD', 2, 3) })).toMatchObject({
      phase: 'FINAL_PODIUM',
      questionIndex: 2,
    });
  });

  it('ends after the podium and then refuses to advance', () => {
    expect(nextAdvance({ state: state('FINAL_PODIUM', 2, 3) })).toMatchObject({ phase: 'ENDED' });
    expect(nextAdvance({ state: state('ENDED', 2, 3) })).toEqual({
      type: 'noop',
      reason: 'game_already_ended',
    });
  });

  it('treats Skip on a live question the same as the timer running out', () => {
    expect(nextAdvance({ state: state('QUESTION_ACTIVE'), skip: true })).toMatchObject({
      phase: 'QUESTION_RESULT',
    });
  });

  it('drops a question entirely when Skip is pressed during the intro', () => {
    // Nothing was asked, so there is no result or leaderboard for it.
    expect(nextAdvance({ state: state('QUESTION_INTRO', 0, 3), skip: true })).toMatchObject({
      phase: 'QUESTION_INTRO',
      questionIndex: 1,
      openWindow: false,
    });
  });

  it('goes to the podium when the last question is skipped in the intro', () => {
    expect(nextAdvance({ state: state('QUESTION_INTRO', 2, 3), skip: true })).toMatchObject({
      phase: 'FINAL_PODIUM',
    });
  });

  it('handles a single-question quiz', () => {
    expect(nextAdvance({ state: state('LEADERBOARD', 0, 1) })).toMatchObject({
      phase: 'FINAL_PODIUM',
    });
  });
});

describe('phase predicates', () => {
  it('accepts answers only while a question is active', () => {
    const phases: GamePhase[] = [
      'LOBBY', 'QUESTION_INTRO', 'QUESTION_ACTIVE', 'QUESTION_RESULT',
      'LEADERBOARD', 'FINAL_PODIUM', 'ENDED',
    ];
    expect(phases.filter(acceptsAnswers)).toEqual(['QUESTION_ACTIVE']);
  });

  it('opens the lobby only before the first question', () => {
    expect(lobbyIsOpen('LOBBY')).toBe(true);
    expect(lobbyIsOpen('QUESTION_INTRO')).toBe(false);
  });

  it('reports the end of the game', () => {
    expect(isOver('ENDED')).toBe(true);
    expect(isOver('FINAL_PODIUM')).toBe(false);
  });
});
