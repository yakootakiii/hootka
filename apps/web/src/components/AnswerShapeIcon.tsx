import type { AnswerShape } from '@/lib/answerStyles';

const PATHS: Record<AnswerShape, string> = {
  triangle: 'M12 3 L22 20 L2 20 Z',
  diamond: 'M12 2 L22 12 L12 22 L2 12 Z',
  circle: 'M12 12 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0',
  square: 'M3 3 H21 V21 H3 Z',
};

/**
 * The shape that pairs with each answer colour. Decorative: the button itself
 * carries the accessible name, so this is hidden from screen readers.
 */
export function AnswerShapeIcon({ shape, className = 'h-7 w-7' }: { shape: AnswerShape; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={PATHS[shape]} />
    </svg>
  );
}
