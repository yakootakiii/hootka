import { AnimatePresence, motion } from 'framer-motion';
import type { LeaderboardEntry } from '@hootka/core';
import { formatPoints } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';
import { CountUp } from './CountUp';

const ARROWS = {
  up: { glyph: '▲', className: 'text-answer-green', label: 'moved up' },
  down: { glyph: '▼', className: 'text-answer-red', label: 'moved down' },
  same: { glyph: '–', className: 'text-ink-soft', label: 'unchanged' },
  new: { glyph: '★', className: 'text-grape-500', label: 'new' },
} as const;

export function RankArrow({ change }: { change: LeaderboardEntry['change'] }) {
  const arrow = ARROWS[change];
  return (
    <span className={`font-bold ${arrow.className}`} aria-label={arrow.label} role="img">
      {arrow.glyph}
    </span>
  );
}

/**
 * The animated ranking. `layout` lets Framer Motion slide rows past each other
 * when positions swap, which is the moment the class actually reacts to.
 */
export function Leaderboard({ entries, limit = 5 }: { entries: LeaderboardEntry[]; limit?: number }) {
  const reduced = usePrefersReducedMotion();
  const shown = entries.slice(0, limit);

  return (
    <ol className="flex w-full flex-col gap-3" aria-label="Leaderboard">
      <AnimatePresence initial={false}>
        {shown.map((entry) => (
          <motion.li
            key={entry.uid}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="flex items-center gap-4 rounded-chunky bg-white px-5 py-4 shadow-lift"
          >
            <span className="w-10 shrink-0 font-display text-3xl text-grape-500">{entry.rank}</span>
            <RankArrow change={entry.change} />
            <span className="flex-1 truncate font-display text-2xl">{entry.name}</span>
            {entry.lastPoints > 0 && (
              <span className="shrink-0 rounded-full bg-answer-green/20 px-3 py-1 text-sm font-bold text-ink">
                +{formatPoints(entry.lastPoints)}
              </span>
            )}
            <span className="w-28 shrink-0 text-right font-display text-2xl tabular-nums">
              <CountUp value={entry.score} />
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
