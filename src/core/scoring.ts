import {
  ANSWER_WINDOW_MS,
  LATE_GRACE_MS,
  MAX_POINTS,
  type AnswerSubmission,
  type ScoredAnswer,
} from './types.js';

export const STREAK_BONUS_STEP = 50;
export const STREAK_BONUS_CAP = 200;

/**
 * Time a player took to answer, clamped into [0, timeLimitMs].
 *
 * Clock skew or the 1s network grace can produce values slightly outside the
 * window; clamping keeps points inside [MAX_POINTS/2, MAX_POINTS].
 */
export function responseMs(
  answeredAt: number,
  questionStartedAt: number,
  timeLimitMs: number = ANSWER_WINDOW_MS,
): number {
  const elapsed = answeredAt - questionStartedAt;
  if (!Number.isFinite(elapsed)) return timeLimitMs;
  return Math.min(Math.max(elapsed, 0), timeLimitMs);
}

/**
 * Kahoot-style speed points: `round(1000 * (1 - (responseTime / limit) / 2))`.
 * Instant answer ~1000, answer at the buzzer ~500. Only correct answers call this.
 */
export function pointsFor(response: number, timeLimitMs: number = ANSWER_WINDOW_MS): number {
  if (timeLimitMs <= 0) return MAX_POINTS;
  const fraction = Math.min(Math.max(response, 0), timeLimitMs) / timeLimitMs;
  return Math.round(MAX_POINTS * (1 - fraction / 2));
}

/** Bonus for the run of correct answers a player had *before* this one. */
export function streakBonusFor(priorStreak: number): number {
  if (priorStreak <= 0) return 0;
  return Math.min(priorStreak * STREAK_BONUS_STEP, STREAK_BONUS_CAP);
}

/** An answer counts only if it arrives inside the window plus the network grace. */
export function isWithinAnswerWindow(
  answeredAt: number,
  questionStartedAt: number,
  timeLimitMs: number = ANSWER_WINDOW_MS,
  graceMs: number = LATE_GRACE_MS,
): boolean {
  if (!Number.isFinite(answeredAt) || !Number.isFinite(questionStartedAt)) return false;
  const elapsed = answeredAt - questionStartedAt;
  return elapsed >= 0 && elapsed <= timeLimitMs + graceMs;
}

export interface ScoreQuestionInput {
  submissions: AnswerSubmission[];
  correctIndex: number;
  questionStartedAt: number;
  timeLimitMs?: number;
  optionCount: number;
  /** Streak each player carried into this question, keyed by uid. */
  streaks?: Record<string, number>;
  streakBonusEnabled?: boolean;
}

export interface ScoreQuestionOutput {
  scored: ScoredAnswer[];
  /** How many players picked each option, indexed by option. */
  counts: number[];
  answeredCount: number;
}

/**
 * Score every submission for one question in a single pass, so all players are
 * ranked consistently against the same server timestamps.
 *
 * Submissions outside the answer window are dropped entirely (they neither score
 * nor appear in the distribution chart).
 */
export function scoreQuestion(input: ScoreQuestionInput): ScoreQuestionOutput {
  const {
    submissions,
    correctIndex,
    questionStartedAt,
    timeLimitMs = ANSWER_WINDOW_MS,
    optionCount,
    streaks = {},
    streakBonusEnabled = false,
  } = input;

  const counts = new Array<number>(Math.max(optionCount, 0)).fill(0);

  const valid = submissions
    .filter(
      (s) =>
        isWithinAnswerWindow(s.answeredAt, questionStartedAt, timeLimitMs) &&
        Number.isInteger(s.choice) &&
        s.choice >= 0 &&
        s.choice < optionCount,
    )
    // Fastest first; uid keeps the order deterministic when timestamps tie.
    .sort((a, b) => a.answeredAt - b.answeredAt || a.playerUid.localeCompare(b.playerUid));

  const scored: ScoredAnswer[] = valid.map((submission, index) => {
    counts[submission.choice] = (counts[submission.choice] ?? 0) + 1;
    const correct = submission.choice === correctIndex;
    const response = responseMs(submission.answeredAt, questionStartedAt, timeLimitMs);
    const base = correct ? pointsFor(response, timeLimitMs) : 0;
    const bonus =
      correct && streakBonusEnabled ? streakBonusFor(streaks[submission.playerUid] ?? 0) : 0;

    return {
      ...submission,
      correct,
      points: base + bonus,
      order: index + 1,
      responseMs: response,
    };
  });

  return { scored, counts, answeredCount: scored.length };
}
