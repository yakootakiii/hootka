import { useEffect, useRef } from 'react';
import { msRemaining, progress, secondsRemaining } from '@hootka/core';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';

interface TimerProps {
  questionStartedAt: number | null;
  serverNow: number;
  timeLimitMs?: number;
  /** Called once when the countdown reaches zero. */
  onExpire?: () => void;
  /** Called on each of the last three seconds, for the tick sound. */
  onTick?: (secondsLeft: number) => void;
  variant?: 'ring' | 'bar';
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The countdown, drawn from the server-corrected clock rather than a local
 * interval, so every device shows the same number.
 */
export function Timer({
  questionStartedAt,
  serverNow,
  timeLimitMs = 10_000,
  onExpire,
  onTick,
  variant = 'ring',
}: TimerProps) {
  const reduced = usePrefersReducedMotion();
  const seconds = secondsRemaining(questionStartedAt, serverNow, timeLimitMs);
  const done = msRemaining(questionStartedAt, serverNow, timeLimitMs) <= 0;
  const fraction = progress(questionStartedAt, serverNow, timeLimitMs);

  const expiredRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (questionStartedAt == null) {
      expiredRef.current = false;
      lastTickRef.current = null;
    }
  }, [questionStartedAt]);

  useEffect(() => {
    if (done && !expiredRef.current && questionStartedAt != null) {
      expiredRef.current = true;
      onExpire?.();
    }
  }, [done, onExpire, questionStartedAt]);

  useEffect(() => {
    if (seconds <= 3 && seconds > 0 && lastTickRef.current !== seconds) {
      lastTickRef.current = seconds;
      onTick?.(seconds);
    }
  }, [seconds, onTick]);

  const urgent = seconds <= 3 && !done;

  if (variant === 'bar') {
    // The bar lives on the player's purple screen, so the *remaining* time is
    // painted white on a dark track. Filling it with a purple would leave the
    // remaining time invisible and make the countdown read backwards.
    return (
      <div
        className="h-5 w-full overflow-hidden rounded-full bg-black/25"
        role="timer"
        aria-live="off"
        aria-label={`${seconds} seconds left`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            urgent ? 'bg-answer-red' : 'bg-white'
          }`}
          style={{ width: `${Math.max(0, 100 - fraction * 100)}%` }}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative grid h-32 w-32 place-items-center ${urgent && !reduced ? 'animate-pulse' : ''}`}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#E6DEFF" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={urgent ? '#FF5A5F' : '#6D45F5'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * fraction}
          style={{ transition: 'stroke-dashoffset 100ms linear' }}
        />
      </svg>
      <span className="absolute font-display text-timer tabular-nums text-ink">{seconds}</span>
    </div>
  );
}
