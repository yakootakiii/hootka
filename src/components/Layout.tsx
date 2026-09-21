import type { ReactNode } from 'react';

/** The playful gradient every screen sits on. */
export function Screen({
  children,
  className = '',
  tone = 'calm',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'calm' | 'play';
}) {
  const background =
    tone === 'play'
      ? 'bg-gradient-to-b from-grape-500 to-grape-600 text-white'
      : 'bg-gradient-to-b from-cloud to-[#EDE6FF]';

  // `flex-1`, not `min-h-[100dvh]`: App owns the viewport height so the footer
  // sits inside it rather than pushing a white strip below the fold.
  return (
    <main className={`flex w-full flex-1 flex-col ${background}`}>
      <div className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8 ${className}`}>
        {children}
      </div>
    </main>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-3xl font-extrabold tracking-tight ${className}`}>
      Hootka
    </span>
  );
}
