import { answerStyle, answerTextClass } from '@/lib/answerStyles';
import { AnswerShapeIcon } from './AnswerShapeIcon';

interface AnswerButtonProps {
  index: number;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Dim the options that were not chosen once an answer is locked in. */
  dimmed?: boolean;
  /** Ring the correct answer on the result screen. */
  highlight?: 'correct' | 'chosen' | null;
  /** Host screens show the options without making them clickable. */
  asStatic?: boolean;
}

/**
 * A chunky answer button: colour plus shape, a big touch target, and a
 * press-down effect. The accessible name spells out both the colour/shape and
 * the answer text.
 */
export function AnswerButton({
  index,
  text,
  onClick,
  disabled = false,
  dimmed = false,
  highlight = null,
  asStatic = false,
}: AnswerButtonProps) {
  const style = answerStyle(index);
  const Tag = asStatic ? 'div' : 'button';

  return (
    <Tag
      {...(asStatic ? {} : { type: 'button' as const, onClick, disabled })}
      aria-label={asStatic ? undefined : `${style.label}: ${text}`}
      className={[
        'btn-chunky flex w-full items-center gap-4 text-left',
        style.bg,
        answerTextClass(index),
        dimmed ? 'opacity-40 saturate-50' : '',
        highlight === 'correct' ? 'ring-8 ring-white ring-offset-4 ring-offset-grape-500' : '',
        highlight === 'chosen' ? 'ring-4 ring-ink' : '',
        asStatic ? 'cursor-default active:translate-y-0 active:shadow-chunky' : '',
      ].join(' ')}
    >
      <AnswerShapeIcon shape={style.shape} className="h-8 w-8 shrink-0" />
      <span className="text-answer">{text}</span>
      {highlight === 'correct' && (
        <span className="ml-auto shrink-0 text-2xl" aria-hidden="true">
          ✓
        </span>
      )}
    </Tag>
  );
}
