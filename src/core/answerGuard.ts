import { acceptsAnswers } from './phases.js';
import { isWithinAnswerWindow } from './scoring.js';
import { ANSWER_WINDOW_MS, type GamePhase } from './types.js';

export type AnswerRejection =
  | 'not_in_game'
  | 'wrong_phase'
  | 'wrong_question'
  | 'not_started'
  | 'too_late'
  | 'already_answered'
  | 'invalid_choice';

export type AnswerDecision = { ok: true } | { ok: false; reason: AnswerRejection };

export interface AnswerGuardInput {
  phase: GamePhase;
  /** The question the game currently has open. */
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  /** The question the player believes they are answering. */
  questionIndex: number;
  choice: number;
  optionCount: number;
  /** Server time at which the submission arrived. */
  now: number;
  isPlayer: boolean;
  /** True when this player already has an answer stored for this question. */
  hasAnswered: boolean;
  timeLimitMs?: number;
}

/**
 * The full set of rules `submitAnswer` applies before storing a choice. Kept
 * pure so the late-answer and double-submit cases can be tested directly.
 */
export function canAcceptAnswer(input: AnswerGuardInput): AnswerDecision {
  const {
    phase,
    currentQuestionIndex,
    questionStartedAt,
    questionIndex,
    choice,
    optionCount,
    now,
    isPlayer,
    hasAnswered,
    timeLimitMs = ANSWER_WINDOW_MS,
  } = input;

  if (!isPlayer) return { ok: false, reason: 'not_in_game' };
  if (!acceptsAnswers(phase)) return { ok: false, reason: 'wrong_phase' };
  if (questionIndex !== currentQuestionIndex) return { ok: false, reason: 'wrong_question' };
  if (typeof questionStartedAt !== 'number') return { ok: false, reason: 'not_started' };
  if (!Number.isInteger(choice) || choice < 0 || choice >= optionCount) {
    return { ok: false, reason: 'invalid_choice' };
  }
  // Checked before the window so a double submit is reported as such even late.
  if (hasAnswered) return { ok: false, reason: 'already_answered' };
  if (!isWithinAnswerWindow(now, questionStartedAt, timeLimitMs)) {
    return { ok: false, reason: 'too_late' };
  }

  return { ok: true };
}
