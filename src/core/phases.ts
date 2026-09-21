import type { GamePhase, GameState } from './types.js';

/**
 * The advance the host's "Next" button asks for.
 *
 * LOBBY -> QUESTION_INTRO -> QUESTION_ACTIVE -> QUESTION_RESULT
 *       -> (next question | FINAL_PODIUM) -> ENDED
 *
 * QUESTION_RESULT carries the answer distribution and the ranking together, so
 * the host presses Next once per question rather than twice.
 */
export type AdvanceAction =
  | { type: 'noop'; reason: string }
  | { type: 'set-phase'; phase: GamePhase; questionIndex: number; openWindow: boolean };

export interface AdvanceInput {
  state: Pick<GameState, 'phase' | 'questionIndex' | 'totalQuestions'>;
  /** The host can skip a live question straight to its result. */
  skip?: boolean;
}

export function nextAdvance({ state, skip = false }: AdvanceInput): AdvanceAction {
  const { phase, questionIndex, totalQuestions } = state;
  const isLastQuestion = questionIndex >= totalQuestions - 1;

  const go = (next: GamePhase, index = questionIndex, openWindow = false): AdvanceAction => ({
    type: 'set-phase',
    phase: next,
    questionIndex: index,
    openWindow,
  });

  switch (phase) {
    case 'LOBBY':
      if (totalQuestions <= 0) return { type: 'noop', reason: 'quiz_has_no_questions' };
      return go('QUESTION_INTRO', 0);

    case 'QUESTION_INTRO':
      // Skipping before the window opens drops the question entirely: nothing
      // was asked, so there is no result or leaderboard to show for it.
      if (skip) {
        return isLastQuestion ? go('FINAL_PODIUM') : go('QUESTION_INTRO', questionIndex + 1);
      }
      // Opening the window is what stamps questionStartedAt on the server.
      return go('QUESTION_ACTIVE', questionIndex, true);

    case 'QUESTION_ACTIVE':
      // Reached either by the timer running out or by the host pressing Skip;
      // both score whatever was submitted before publishing the result.
      return go('QUESTION_RESULT');

    case 'QUESTION_RESULT':
      return isLastQuestion ? go('FINAL_PODIUM') : go('QUESTION_INTRO', questionIndex + 1);

    case 'FINAL_PODIUM':
      return go('ENDED');

    case 'ENDED':
      return { type: 'noop', reason: 'game_already_ended' };

    default:
      return { type: 'noop', reason: `unknown_phase:${String(phase satisfies never)}` };
  }
}

/** Players may only submit while the answer window is open. */
export function acceptsAnswers(phase: GamePhase): boolean {
  return phase === 'QUESTION_ACTIVE';
}

/** New players may only join before the first question. */
export function lobbyIsOpen(phase: GamePhase): boolean {
  return phase === 'LOBBY';
}

/** Whether the game has finished and its code can be released. */
export function isOver(phase: GamePhase): boolean {
  return phase === 'ENDED';
}
