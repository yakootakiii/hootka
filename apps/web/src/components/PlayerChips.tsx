import { AnimatePresence, motion } from 'framer-motion';
import type { Player } from '@hootka/core';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';

/** Players popping into the lobby, with a kick button for the host. */
export function PlayerChips({
  players,
  onKick,
}: {
  players: Player[];
  onKick?: (uid: string) => void;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <ul className="flex flex-wrap justify-center gap-3" aria-label="Players who have joined">
      <AnimatePresence initial={false}>
        {players.map((player) => (
          <motion.li
            key={player.uid}
            layout={!reduced}
            initial={reduced ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-display text-lg shadow-chunky-sm"
          >
            <span className="max-w-[12ch] truncate">{player.name}</span>
            {onKick && (
              <button
                type="button"
                onClick={() => onKick(player.uid)}
                aria-label={`Remove ${player.name} from the game`}
                className="grid h-7 w-7 place-items-center rounded-full bg-cloud text-ink-soft hover:bg-answer-red hover:text-white"
              >
                ×
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
