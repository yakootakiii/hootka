import { useEffect, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { serverNow } from '@hootka/core';
import { rtdb } from '@/lib/firebase';

/**
 * Firebase publishes the difference between this device's clock and the server
 * at `.info/serverTimeOffset`. Every countdown is drawn from that corrected
 * clock, so a tablet whose clock is ten minutes out still agrees with the host.
 */
export function useServerTimeOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    return onValue(ref(rtdb, '.info/serverTimeOffset'), (snapshot) => {
      const value = snapshot.val();
      if (typeof value === 'number' && Number.isFinite(value)) setOffset(value);
    });
  }, []);

  return offset;
}

/**
 * A corrected clock that ticks about 10 times a second - fast enough for a
 * smooth timer ring, cheap enough for a low-end phone.
 */
export function useServerClock(intervalMs = 100): number {
  const offset = useServerTimeOffset();
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const [now, setNow] = useState(() => serverNow(offset));

  useEffect(() => {
    let frame = 0;
    const tick = () => setNow(serverNow(offsetRef.current));
    tick();
    frame = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(frame);
  }, [intervalMs]);

  return now;
}
