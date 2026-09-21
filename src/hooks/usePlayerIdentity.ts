import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInAnonymously } from '@/lib/firebase';

const SESSION_KEY = 'hootka.session';

export interface PlayerSession {
  gameId: string;
  code: string;
  name: string;
}

/**
 * Players never sign up. Anonymous auth gives each one a stable UID so the
 * security rules can protect their record, and so a refresh reconnects them to
 * the same player rather than creating a second entry.
 */
export interface AnonymousIdentity {
  uid: string | null;
  loading: boolean;
  /** Set when sign-in failed, so the screen can say why instead of going dead. */
  error: string | null;
}

export function useAnonymousUid(): AnonymousIdentity {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loading, setLoading] = useState(!auth.currentUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUid(user.uid);
        setError(null);
        setLoading(false);
        return;
      }
      signInAnonymously(auth).catch((cause: { code?: string }) => {
        // Anonymous sign-in being switched off in the Firebase console is the
        // usual cause, and it used to leave the join button permanently
        // disabled with nothing on screen to explain it.
        const disabled =
          cause?.code === 'auth/admin-restricted-operation' ||
          cause?.code === 'auth/operation-not-allowed';
        setError(
          disabled
            ? "This game can't let players in yet. Ask your teacher to turn on anonymous sign-in for Hootka."
            : "We couldn't get you in. Check your connection and try again.",
        );
        setLoading(false);
      });
    });
    return stop;
  }, []);

  return { uid, loading, error };
}

/**
 * Remember which game this device is in, so closing the tab by accident does
 * not cost a player their place. Cleared when the game ends.
 */
export function loadSession(): PlayerSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: PlayerSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can refuse storage; the game still works for this tab.
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to do.
  }
}
