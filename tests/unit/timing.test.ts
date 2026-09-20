import { describe, expect, it } from 'vitest';
import {
  ANSWER_WINDOW_MS,
  INTRO_MS,
  introEndsAt,
  msRemaining,
  progress,
  secondsRemaining,
  serverNow,
} from '@hootka/core';

const T0 = 1_700_000_000_000;

describe('serverNow', () => {
  // Checklist: the timer must survive a device with a wrong clock.
  it('corrects a device clock using the server offset', () => {
    const deviceClock = T0 - 45_000; // device is 45s slow
    const offset = 45_000; // .info/serverTimeOffset
    expect(serverNow(offset, deviceClock)).toBe(T0);
  });

  it('ignores a missing or non-finite offset', () => {
    expect(serverNow(Number.NaN, T0)).toBe(T0);
  });
});

describe('msRemaining', () => {
  it('counts down across the window', () => {
    expect(msRemaining(T0, T0)).toBe(ANSWER_WINDOW_MS);
    expect(msRemaining(T0, T0 + 4_000)).toBe(6_000);
    expect(msRemaining(T0, T0 + ANSWER_WINDOW_MS)).toBe(0);
  });

  it('clamps rather than going negative once the window closes', () => {
    expect(msRemaining(T0, T0 + 30_000)).toBe(0);
  });

  it('shows a full window before the question has opened', () => {
    expect(msRemaining(null, T0)).toBe(ANSWER_WINDOW_MS);
  });

  // Checklist: devices stay within ~0.3s of each other.
  it('keeps two skewed devices within 300ms once corrected', () => {
    const fastDevice = { clock: T0 + 8_000, offset: -8_000 };
    const slowDevice = { clock: T0 - 120_000, offset: 120_000 };
    const jitterMs = 120; // realistic offset-estimate error

    const fastRemaining = msRemaining(T0, serverNow(fastDevice.offset, fastDevice.clock + 2_000));
    const slowRemaining = msRemaining(
      T0,
      serverNow(slowDevice.offset - jitterMs, slowDevice.clock + 2_000),
    );

    expect(Math.abs(fastRemaining - slowRemaining)).toBeLessThanOrEqual(300);
  });
});

describe('secondsRemaining', () => {
  it('shows the full count at the start and zero at the end', () => {
    expect(secondsRemaining(T0, T0)).toBe(10);
    expect(secondsRemaining(T0, T0 + 500)).toBe(10);
    expect(secondsRemaining(T0, T0 + 9_500)).toBe(1);
    expect(secondsRemaining(T0, T0 + ANSWER_WINDOW_MS)).toBe(0);
  });
});

describe('progress', () => {
  it('runs from 0 to 1 over the window', () => {
    expect(progress(T0, T0)).toBe(0);
    expect(progress(T0, T0 + 5_000)).toBe(0.5);
    expect(progress(T0, T0 + ANSWER_WINDOW_MS)).toBe(1);
    expect(progress(T0, T0 + 60_000)).toBe(1);
  });
});

describe('introEndsAt', () => {
  it('opens the answer window 3 seconds after the intro starts', () => {
    expect(introEndsAt(T0)).toBe(T0 + INTRO_MS);
  });
});
