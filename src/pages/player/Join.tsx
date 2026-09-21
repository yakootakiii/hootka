import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MAX_NICKNAME_LENGTH, isValidGameCode, normalizeGameCode, validateNickname } from '@hootka/core';
import { api } from '@/lib/firebase';
import { useAnonymousUid, saveSession } from '@/hooks/usePlayerIdentity';
import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { Screen, Wordmark } from '@/components/Layout';

/**
 * Two steps and nothing else: a game code, then a nickname. No account, no
 * email, no personal data.
 */
export function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { uid, loading } = useAnonymousUid();

  const [step, setStep] = useState<'code' | 'name'>('code');
  const [code, setCode] = useState(() => normalizeGameCode(params.get('code') ?? ''));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A QR code link carries ?code=123456, so skip straight to the nickname.
  useEffect(() => {
    if (isValidGameCode(code) && params.get('code')) setStep('name');
  }, [code, params]);

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidGameCode(code)) {
      setError('A game code is 6 digits. Check the big screen!');
      return;
    }
    setError(null);
    setStep('name');
  };

  const submitName = async (event: FormEvent) => {
    event.preventDefault();
    const check = validateNickname(name);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.joinGame({ code, name: check.name });
      saveSession({ gameId: result.gameId, code, name: result.name });
      navigate(`/play/${result.gameId}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Something went wrong.';
      setError(message.replace(/^.*?:\s*/, ''));
      setBusy(false);
    }
  };

  return (
    <Screen className="items-center justify-center text-center">
      <Wordmark className="text-grape-500" />
      <Mascot mood={step === 'name' ? 'happy' : 'thinking'} className="h-40 w-40" />

      {step === 'code' ? (
        <form onSubmit={submitCode} className="card flex w-full max-w-sm flex-col gap-4">
          <label htmlFor="code" className="font-display text-2xl">
            Game code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(event) => setCode(normalizeGameCode(event.target.value))}
            placeholder="123456"
            aria-describedby={error ? 'join-error' : undefined}
            className="rounded-chunky border-4 border-grape-400 px-4 py-5 text-center font-display text-4xl tracking-[0.3em] tabular-nums"
          />
          <Button type="submit" disabled={loading}>
            Next
          </Button>
        </form>
      ) : (
        <form onSubmit={submitName} className="card flex w-full max-w-sm flex-col gap-4">
          <label htmlFor="nickname" className="font-display text-2xl">
            Pick a nickname
          </label>
          <input
            id="nickname"
            autoComplete="off"
            autoFocus
            maxLength={MAX_NICKNAME_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sunny Owl"
            aria-describedby={error ? 'join-error' : 'nickname-hint'}
            className="rounded-chunky border-4 border-grape-400 px-4 py-5 text-center font-display text-3xl"
          />
          <p id="nickname-hint" className="text-sm text-ink-soft">
            Up to {MAX_NICKNAME_LENGTH} characters. Keep it kind!
          </p>
          <Button type="submit" disabled={busy || loading || !uid}>
            {busy ? 'Joining…' : "Let's go!"}
          </Button>
          <button
            type="button"
            onClick={() => { setStep('code'); setError(null); }}
            className="text-sm font-bold text-ink-soft underline"
          >
            Change game code
          </button>
        </form>
      )}

      {error && (
        <p id="join-error" role="alert" className="max-w-sm rounded-chunky bg-answer-red px-4 py-3 font-bold text-white">
          {error}
        </p>
      )}
    </Screen>
  );
}
