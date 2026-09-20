import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  type PublicQuestion,
  type Question,
  type QuestionResult,
  type ScoredAnswer,
} from './types.js';

/**
 * Strip `correctIndex` before a question is published to the live game node.
 * This is the one guard that stops a player reading the answer out of the
 * network traffic, so it is deliberately allow-list based.
 */
export function toPublicQuestion(question: Question): PublicQuestion {
  return {
    text: question.text,
    imageUrl: question.imageUrl ?? null,
    options: question.options.map((option) => ({ text: option.text })),
  };
}

export type QuestionProblem =
  | 'missing_text'
  | 'too_few_options'
  | 'too_many_options'
  | 'empty_option'
  | 'bad_correct_index';

/** Editor-side validation, also enforced in `createGame` before a game starts. */
export function validateQuestion(question: Partial<Question>): QuestionProblem[] {
  const problems: QuestionProblem[] = [];
  const options = question.options ?? [];

  if (!question.text?.trim()) problems.push('missing_text');
  if (options.length < MIN_OPTIONS) problems.push('too_few_options');
  if (options.length > MAX_OPTIONS) problems.push('too_many_options');
  if (options.some((option) => !option?.text?.trim())) problems.push('empty_option');

  const correctIndex = question.correctIndex;
  if (
    typeof correctIndex !== 'number' ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    problems.push('bad_correct_index');
  }

  return problems;
}

/** The per-question summary shown on the result screen. */
export function buildQuestionResult(
  correctIndex: number,
  counts: number[],
  scored: ScoredAnswer[],
): QuestionResult {
  return { correctIndex, counts, answeredCount: scored.length };
}
