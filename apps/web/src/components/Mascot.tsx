import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';

export type MascotMood = 'happy' | 'thinking' | 'cheering' | 'sad' | 'sleeping';

const EYES: Record<MascotMood, { left: string; right: string }> = {
  happy: { left: 'M -4 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 -8 0', right: 'M -4 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 -8 0' },
  thinking: { left: 'M -4 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 -8 0', right: 'M -4 1 h 8' },
  cheering: { left: 'M -4 2 a 4 4 0 0 1 8 0', right: 'M -4 2 a 4 4 0 0 1 8 0' },
  sad: { left: 'M -4 -1 a 4 4 0 0 0 8 0', right: 'M -4 -1 a 4 4 0 0 0 8 0' },
  sleeping: { left: 'M -4 0 h 8', right: 'M -4 0 h 8' },
};

const CAPTIONS: Record<MascotMood, string> = {
  happy: 'Hootka the owl, smiling',
  thinking: 'Hootka the owl, thinking',
  cheering: 'Hootka the owl, cheering',
  sad: 'Hootka the owl, being encouraging',
  sleeping: 'Hootka the owl, dozing',
};

/**
 * Hootka herself: a friendly owl who reacts to what just happened. Purely
 * decorative, but she carries a label so the mood is not lost to a screen
 * reader reading the feedback screen.
 */
export function Mascot({
  mood = 'happy',
  className = 'h-32 w-32',
}: {
  mood?: MascotMood;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const eyes = EYES[mood];
  const animation = reduced ? '' : mood === 'cheering' ? 'animate-wiggle' : 'animate-bobbing';

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${className} ${animation}`}
      role="img"
      aria-label={CAPTIONS[mood]}
    >
      {/* Body */}
      <ellipse cx="60" cy="72" rx="38" ry="40" fill="#6D45F5" />
      <ellipse cx="60" cy="80" rx="26" ry="30" fill="#F7F3FF" />
      {/* Ear tufts */}
      <path d="M26 42 L34 16 L50 34 Z" fill="#5730D6" />
      <path d="M94 42 L86 16 L70 34 Z" fill="#5730D6" />
      {/* Eye discs */}
      <circle cx="46" cy="58" r="16" fill="#FFFFFF" />
      <circle cx="74" cy="58" r="16" fill="#FFFFFF" />
      <g stroke="#241B3A" strokeWidth="4" strokeLinecap="round" fill="#241B3A">
        <path d={eyes.left} transform="translate(46 58)" />
        <path d={eyes.right} transform="translate(74 58)" />
      </g>
      {/* Beak */}
      <path d="M60 66 L68 78 L52 78 Z" fill="#FFC93C" />
      {/* Feet */}
      <path d="M48 110 l-6 8 M48 110 l0 9 M48 110 l6 8" stroke="#FFC93C" strokeWidth="4" strokeLinecap="round" />
      <path d="M72 110 l-6 8 M72 110 l0 9 M72 110 l6 8" stroke="#FFC93C" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
