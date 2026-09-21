import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from '@/lib/firebase';
import { useHostAuth } from '@/hooks/useHostAuth';
import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { Screen, Wordmark } from '@/components/Layout';

/** Teachers sign in. Players never see this page. */
export function Login() {
  const { host, loading } = useHostAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (host) return <Navigate to="/host" replace />;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Sign-in failed.';
      setError(message.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/.*\)\.?$/, ''));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() =>
      mode === 'in'
        ? signInWithEmailAndPassword(auth, email, password)
        : createUserWithEmailAndPassword(auth, email, password),
    );
  };

  return (
    <Screen className="items-center justify-center text-center">
      <Wordmark className="text-grape-500" />
      <Mascot className="h-32 w-32" />
      <h1 className="font-display text-3xl">Teacher sign in</h1>

      <form onSubmit={submit} className="card flex w-full max-w-sm flex-col gap-4 text-left">
        <label className="font-bold" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-chunky border-2 border-grape-400 px-4 py-3 text-lg"
        />

        <label className="font-bold" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-chunky border-2 border-grape-400 px-4 py-3 text-lg"
        />

        <Button type="submit" disabled={busy || loading}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </Button>

        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => signInWithPopup(auth, googleProvider))}
        >
          Continue with Google
        </Button>

        <button
          type="button"
          className="text-sm font-bold text-grape-500 underline"
          onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
        >
          {mode === 'in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </form>

      {error && (
        <p role="alert" className="max-w-sm rounded-chunky bg-answer-red px-4 py-3 font-bold text-white">
          {error}
        </p>
      )}
    </Screen>
  );
}
