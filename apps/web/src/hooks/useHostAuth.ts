import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/** The signed-in teacher, or null. Anonymous players are not hosts. */
export function useHostAuth(): { host: User | null; loading: boolean } {
  const [host, setHost] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setHost(user && !user.isAnonymous ? user : null);
      setLoading(false);
    });
  }, []);

  return { host, loading };
}
