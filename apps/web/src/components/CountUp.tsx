import { useEffect, useRef, useState } from 'react';
import { formatPoints } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';

/** Points that roll up to their new total instead of snapping. */
export function CountUp({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    const startedAt = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min((now - startedAt) / durationMs, 1);
      // Ease-out so the number decelerates into its final value.
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else fromRef.current = value;
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, reduced]);

  return <>{formatPoints(shown)}</>;
}
