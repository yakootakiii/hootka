/**
 * Each answer carries a colour *and* a shape, so a colour-blind player can
 * still tell the four options apart (section 6 of the spec).
 */
export type AnswerShape = 'triangle' | 'diamond' | 'circle' | 'square';

export interface AnswerStyle {
  shape: AnswerShape;
  /** Tailwind background class. */
  bg: string;
  /** Slightly darker shade for the chunky shadow and the result bars. */
  hex: string;
  /** Screen-reader and keyboard label, e.g. "Red triangle". */
  label: string;
  /** Keyboard shortcut on the host screen and on laptops. */
  key: string;
}

export const ANSWER_STYLES: AnswerStyle[] = [
  { shape: 'triangle', bg: 'bg-answer-red', hex: '#FF5A5F', label: 'Red triangle', key: '1' },
  { shape: 'diamond', bg: 'bg-answer-blue', hex: '#3D8BFF', label: 'Blue diamond', key: '2' },
  { shape: 'circle', bg: 'bg-answer-yellow', hex: '#FFC93C', label: 'Yellow circle', key: '3' },
  { shape: 'square', bg: 'bg-answer-green', hex: '#3DDC84', label: 'Green square', key: '4' },
];

export function answerStyle(index: number): AnswerStyle {
  return ANSWER_STYLES[index % ANSWER_STYLES.length] as AnswerStyle;
}

/** Yellow needs dark text to clear WCAG AA; the others take white. */
export function answerTextClass(index: number): string {
  return answerStyle(index).shape === 'circle' ? 'text-ink' : 'text-white';
}
