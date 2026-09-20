import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { LeaderboardEntry } from '@hootka/core';
import { formatPoints } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';
import { Mascot } from './Mascot';

/** Bars rise in the order 3rd, 2nd, 1st, so the winner lands last. */
const ORDER = [2, 0, 1];
const HEIGHTS = ['h-56', 'h-40', 'h-32'];
const MEDALS = ['🥇', '🥈', '🥉'];

export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const reduced = usePrefersReducedMotion();
  const top = entries.slice(0, 3);

  useEffect(() => {
    if (reduced || top.length === 0) return;
    const timer = window.setTimeout(() => {
      void confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [reduced, top.length]);

  if (top.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Mascot mood="sleeping" />
        <p className="font-display text-2xl">Nobody played this one!</p>
      </div>
    );
  }

  return (
    <div className="flex w-full items-end justify-center gap-4 sm:gap-8">
      {ORDER.map((position, step) => {
        const entry = top[position];
        if (!entry) return null;

        return (
          <div key={entry.uid} className="flex w-28 flex-col items-center gap-2 sm:w-40">
            <span className="text-4xl" aria-hidden="true">{MEDALS[position]}</span>
            <span className="truncate text-center font-display text-xl">{entry.name}</span>
            <span className="font-bold tabular-nums text-ink-soft">{formatPoints(entry.score)}</span>
            <motion.div
              initial={reduced ? false : { height: 0 }}
              animate={{ height: 'auto' }}
              transition={{ delay: reduced ? 0 : 0.35 * step, type: 'spring', stiffness: 160, damping: 20 }}
              className={`${HEIGHTS[position]} w-full rounded-t-chunky bg-grape-500 shadow-chunky`}
            >
              <span className="sr-only">
                Position {position + 1}: {entry.name}, {entry.score} points
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
