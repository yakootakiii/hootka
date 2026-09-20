import { motion } from 'framer-motion';
import { answerStyle } from '@/lib/answerStyles';
import { AnswerShapeIcon } from './AnswerShapeIcon';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';

/** How many players picked each option, revealed once the question closes. */
export function AnswerDistribution({
  counts,
  correctIndex,
  options,
}: {
  counts: number[];
  correctIndex: number;
  options: { text: string }[];
}) {
  const reduced = usePrefersReducedMotion();
  const max = Math.max(1, ...counts);

  return (
    <div className="flex h-56 w-full items-end justify-center gap-6">
      {options.map((option, index) => {
        const style = answerStyle(index);
        const count = counts[index] ?? 0;
        const isCorrect = index === correctIndex;

        return (
          <div key={index} className="flex h-full w-20 flex-col items-center justify-end gap-2 sm:w-28">
            <span className="font-display text-2xl tabular-nums">{count}</span>
            <motion.div
              initial={reduced ? false : { height: 0 }}
              animate={{ height: `${Math.max((count / max) * 100, 4)}%` }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              className={`w-full rounded-t-2xl ${style.bg} ${isCorrect ? 'ring-4 ring-ink' : 'opacity-70'}`}
            />
            <div className="flex items-center gap-1 text-ink-soft">
              <AnswerShapeIcon shape={style.shape} className="h-5 w-5" />
              {isCorrect && <span aria-label="correct answer">✓</span>}
            </div>
            <span className="line-clamp-2 text-center text-sm font-semibold">{option.text}</span>
          </div>
        );
      })}
    </div>
  );
}
