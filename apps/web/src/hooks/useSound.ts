import { useCallback, useEffect, useRef, useState } from 'react';

export type SoundName = 'join' | 'tick' | 'correct' | 'wrong' | 'victory';

const MUTE_KEY = 'hootka.muted';

/**
 * Short tones synthesised with the Web Audio API rather than shipping audio
 * files: it keeps the bundle small and lets the sounds stay gentle.
 *
 * Sound is off until someone turns it on, as the spec requires.
 */
const TONES: Record<SoundName, { freq: number[]; duration: number; type: OscillatorType }> = {
  join: { freq: [660, 880], duration: 0.12, type: 'sine' },
  tick: { freq: [440], duration: 0.06, type: 'square' },
  correct: { freq: [660, 880, 1320], duration: 0.14, type: 'sine' },
  wrong: { freq: [330, 262], duration: 0.18, type: 'sine' },
  victory: { freq: [523, 659, 784, 1047], duration: 0.18, type: 'triangle' },
};

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function useSound() {
  const [muted, setMuted] = useState(readMuted);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(MUTE_KEY, String(muted));
    } catch {
      // Storage is optional.
    }
  }, [muted]);

  const play = useCallback(
    (name: SoundName) => {
      if (muted) return;
      try {
        const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const context = (contextRef.current ??= new Ctor());
        if (context.state === 'suspended') void context.resume();

        const tone = TONES[name];
        tone.freq.forEach((frequency, step) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const startAt = context.currentTime + step * tone.duration;

          oscillator.type = tone.type;
          oscillator.frequency.value = frequency;
          // A short fade keeps the tone soft instead of clicking.
          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);

          oscillator.connect(gain).connect(context.destination);
          oscillator.start(startAt);
          oscillator.stop(startAt + tone.duration + 0.02);
        });
      } catch {
        // Audio is a nicety; never let it break the game.
      }
    },
    [muted],
  );

  return { play, muted, setMuted, toggleMuted: () => setMuted((value) => !value) };
}
