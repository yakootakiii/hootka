import { beforeEach, describe, expect, it } from 'vitest';
import { GameSim, makeQuestions } from '../helpers/game-sim.js';

describe('a full game', () => {
  let game: GameSim;

  beforeEach(() => {
    game = new GameSim(makeQuestions(3));
    game.join('u1', 'Ana');
    game.join('u2', 'Ben');
    game.join('u3', 'Cal');
  });

  it('walks the phases in the order the spec defines', () => {
    const phases: string[] = [game.state.phase];
    for (let i = 0; i < 12; i += 1) {
      const action = game.advance();
      if (action.type === 'noop') break;
      phases.push(action.phase);
    }

    expect(phases).toEqual([
      'LOBBY',
      'QUESTION_INTRO', 'QUESTION_ACTIVE', 'QUESTION_RESULT', 'LEADERBOARD',
      'QUESTION_INTRO', 'QUESTION_ACTIVE', 'QUESTION_RESULT', 'LEADERBOARD',
      'QUESTION_INTRO', 'QUESTION_ACTIVE', 'QUESTION_RESULT', 'LEADERBOARD',
    ].slice(0, phases.length));
  });

  it('ends on the podium after the last question', () => {
    for (let i = 0; i < 40; i += 1) {
      if (game.advance().type === 'noop') break;
    }
    expect(game.state.phase).toBe('ENDED');
    expect(game.publicQuestion).toBeNull();
  });

  it('plays three questions and produces a consistent leaderboard', () => {
    // Q1 (correct = 0): Ana instantly right, Ben right but slow, Cal wrong.
    game.openNextQuestion();
    expect(game.submit('u1', 0)).toEqual({ ok: true });
    game.tick(8_000);
    expect(game.submit('u2', 0)).toEqual({ ok: true });
    expect(game.submit('u3', 2)).toEqual({ ok: true });
    game.advance();

    expect(game.player('u1').score).toBe(1000);
    expect(game.player('u2').score).toBe(600);
    expect(game.player('u3').score).toBe(0);
    expect(game.leaderboard().map((player) => player.name)).toEqual(['Ana', 'Ben', 'Cal']);

    // Q2 (correct = 1): Cal fastest, Ana wrong.
    game.advance();
    game.openNextQuestion();
    expect(game.submit('u3', 1)).toEqual({ ok: true });
    game.tick(2_000);
    expect(game.submit('u1', 3)).toEqual({ ok: true });
    game.advance();

    expect(game.player('u3').score).toBe(1000);
    expect(game.player('u1').streak).toBe(0);
    expect(game.player('u3').streak).toBe(1);

    // Rank movement is recorded for the arrows.
    const cal = game.player('u3');
    expect(cal.prevRank).toBe(3);
    expect(cal.rank).toBeLessThan(cal.prevRank);
  });

  it('publishes a question without ever exposing the correct answer', () => {
    game.openNextQuestion();
    expect(game.publicQuestion).not.toBeNull();
    expect(JSON.stringify(game.publicQuestion)).not.toContain('correctIndex');

    // Only once the question closes does the answer become public.
    expect(game.results.get(0)).toBeUndefined();
    game.advance();
    expect(game.results.get(0)?.correctIndex).toBe(0);
  });

  it('records the answer distribution for the result chart', () => {
    game.openNextQuestion();
    game.submit('u1', 0);
    game.submit('u2', 0);
    game.submit('u3', 3);
    game.advance();

    expect(game.results.get(0)).toMatchObject({ correctIndex: 0, counts: [2, 0, 0, 1], answeredCount: 3 });
  });
});

describe('answer submission rules', () => {
  let game: GameSim;

  beforeEach(() => {
    game = new GameSim(makeQuestions(2));
    game.join('u1', 'Ana');
    game.openNextQuestion();
  });

  // Checklist: double-submit is ignored, first answer is locked.
  it('locks the first answer and ignores a second', () => {
    expect(game.submit('u1', 0)).toEqual({ ok: true });
    game.tick(1_000);
    expect(game.submit('u1', 1)).toEqual({ ok: false, reason: 'already_answered' });

    game.advance();
    expect(game.player('u1').score).toBe(1000);
    expect(game.results.get(0)?.counts).toEqual([1, 0, 0, 0]);
  });

  // Checklist: an answer arriving after the window is rejected.
  it('rejects an answer that arrives after the window and grace', () => {
    game.tick(11_001);
    expect(game.submit('u1', 0)).toEqual({ ok: false, reason: 'too_late' });
    game.advance();
    expect(game.player('u1').score).toBe(0);
    expect(game.player('u1').answeredCount).toBe(0);
  });

  it('accepts an answer inside the 1s network grace and scores it at the floor', () => {
    game.tick(10_500);
    expect(game.submit('u1', 0)).toEqual({ ok: true });
    game.advance();
    expect(game.player('u1').score).toBe(500);
  });

  it('rejects answers outside the active phase', () => {
    game.advance(); // -> QUESTION_RESULT
    expect(game.submit('u1', 0)).toEqual({ ok: false, reason: 'wrong_phase' });
  });

  it('rejects an option that does not exist', () => {
    expect(game.submit('u1', 9)).toEqual({ ok: false, reason: 'invalid_choice' });
  });

  it('rejects someone who never joined', () => {
    expect(game.submit('stranger', 0)).toEqual({ ok: false, reason: 'not_in_game' });
  });
});

describe('closing a question', () => {
  it('is idempotent, so the timer and the host cannot double-score', () => {
    const game = new GameSim(makeQuestions(1));
    game.join('u1', 'Ana');
    game.openNextQuestion();
    game.submit('u1', 0);

    game.closeQuestion();
    expect(game.player('u1').score).toBe(1000);

    // Host presses Next straight after the timer already closed the question.
    expect(game.closeQuestion()).toEqual({ alreadyClosed: true });
    game.advance();
    expect(game.player('u1').score).toBe(1000);
  });

  it('scores a skipped question with whatever had been submitted', () => {
    const game = new GameSim(makeQuestions(2));
    game.join('u1', 'Ana');
    game.join('u2', 'Ben');
    game.openNextQuestion();
    game.submit('u1', 0);

    game.advance({ skip: true });
    expect(game.state.phase).toBe('QUESTION_RESULT');
    expect(game.player('u1').score).toBe(1000);
    expect(game.player('u2').score).toBe(0);
  });
});

describe('the lobby', () => {
  it('rejects a duplicate nickname but allows it again after a kick', () => {
    const game = new GameSim(makeQuestions(1));
    expect(game.join('u1', 'Ana')).toMatchObject({ ok: true });
    expect(game.join('u2', 'ana')).toEqual({ ok: false, reason: 'duplicate' });

    game.kick('u1');
    expect(game.join('u2', 'Ana')).toMatchObject({ ok: true, name: 'Ana' });
  });

  it('rejects a profane nickname', () => {
    const game = new GameSim(makeQuestions(1));
    expect(game.join('u1', 'fuckface')).toEqual({ ok: false, reason: 'profanity' });
  });

  it('locks once the game starts', () => {
    const game = new GameSim(makeQuestions(1));
    game.join('u1', 'Ana');
    game.openNextQuestion();
    expect(game.join('u2', 'Ben')).toEqual({ ok: false, reason: 'game_started' });
  });

  it('caps the roster at 60 players', () => {
    const game = new GameSim(makeQuestions(1));
    for (let i = 0; i < 60; i += 1) {
      expect(game.join(`u${i}`, `Player${i}`), `player ${i}`).toMatchObject({ ok: true });
    }
    expect(game.join('u60', 'OneTooMany')).toEqual({ ok: false, reason: 'full' });
    expect(game.players.size).toBe(60);
  });

  // Checklist: a player who refreshes keeps their nickname and score.
  it('lets a disconnected player rejoin mid-game with their score intact', () => {
    const game = new GameSim(makeQuestions(2));
    game.join('u1', 'Ana');
    game.openNextQuestion();
    game.submit('u1', 0);
    game.advance();
    expect(game.player('u1').score).toBe(1000);

    // Same anonymous UID comes back after a refresh, mid-game.
    const rejoin = game.join('u1', 'Ana');
    expect(rejoin).toEqual({ ok: true, name: 'Ana', rejoined: true });
    expect(game.player('u1').score).toBe(1000);
  });
});
