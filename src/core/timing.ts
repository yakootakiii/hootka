import { ANSWER_WINDOW_MS, INTRO_MS } from './types.js';

/**
 * Server-corrected wall clock. `offset` comes from Firebase's
 * `.info/serverTimeOffset`, so a device with a wrong clock still agrees with
 * everyone else about when the question started.
 */
export function serverNow(offsetMs: number, now: number = Date.now()): number {
  return now + (Number.isFinite(offsetMs) ? offsetMs : 0);
}

/** Milliseconds left in the answer window, clamped to [0, timeLimitMs]. */
export function msRemaining(
  questionStartedAt: number | null,
  serverTime: number,
  timeLimitMs: number = ANSWER_WINDOW_MS,
): number {
  if (questionStartedAt == null || !Number.isFinite(questionStartedAt)) return timeLimitMs;
  const remaining = questionStartedAt + timeLimitMs - serverTime;
  return Math.min(Math.max(remaining, 0), timeLimitMs);
}

/** Whole seconds shown on the countdown; 10 at the start, 0 when time is up. */
export function secondsRemaining(
  questionStartedAt: number | null,
  serverTime: number,
  timeLimitMs: number = ANSWER_WINDOW_MS,
): number {
  return Math.ceil(msRemaining(questionStartedAt, serverTime, timeLimitMs) / 1000);
}

/** 0 at the start of the window, 1 when it closes. Drives the timer ring. */
export function progress(
  questionStartedAt: number | null,
  serverTime: number,
  timeLimitMs: number = ANSWER_WINDOW_MS,
): number {
  if (timeLimitMs <= 0) return 1;
  return 1 - msRemaining(questionStartedAt, serverTime, timeLimitMs) / timeLimitMs;
}

/** When the "Get ready!" countdown ends and the answer window should open. */
export function introEndsAt(introStartedAt: number, introMs: number = INTRO_MS): number {
  return introStartedAt + introMs;
}
