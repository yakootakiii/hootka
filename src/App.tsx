import { Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Join } from '@/pages/player/Join';
import { PlayerGame } from '@/pages/player/PlayerGame';
import { Privacy } from '@/pages/Privacy';
import { useHostAuth } from '@/hooks/useHostAuth';
import { Screen } from '@/components/Layout';
import { Mascot } from '@/components/Mascot';

// The host half - the editor, Firestore and Storage - is a separate chunk, so a
// player joining on a phone downloads only the game itself.
const Login = lazy(() => import('@/pages/host/Login').then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import('@/pages/host/Dashboard').then((m) => ({ default: m.Dashboard })));
const QuizEditor = lazy(() => import('@/pages/host/QuizEditor').then((m) => ({ default: m.QuizEditor })));
const HostGame = lazy(() => import('@/pages/host/HostGame').then((m) => ({ default: m.HostGame })));

function Loading() {
  return (
    <Screen className="items-center justify-center">
      <Mascot mood="sleeping" />
      <p className="font-display text-2xl">One moment…</p>
    </Screen>
  );
}

/** Host pages wait for auth, then bounce to the login screen if nobody is signed in. */
function RequireHost({ children }: { children: React.ReactNode }) {
  const { host, loading } = useHostAuth();

  if (loading) return <Loading />;
  return host ? <>{children}</> : <Navigate to="/host/login" replace />;
}

export function App() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Join />} />
          <Route path="/play/:gameId" element={<PlayerGame />} />
          <Route path="/privacy" element={<Privacy />} />

          <Route path="/host/login" element={<Login />} />
          <Route path="/host" element={<RequireHost><Dashboard /></RequireHost>} />
          <Route path="/host/quiz/:quizId" element={<RequireHost><QuizEditor /></RequireHost>} />
          <Route path="/host/game/:gameId" element={<RequireHost><HostGame /></RequireHost>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <footer className="flex shrink-0 justify-center gap-4 p-3 text-sm text-ink-soft">
        <Link to="/privacy" className="underline">Privacy</Link>
        <Link to="/host/login" className="underline">Teacher sign in</Link>
      </footer>
    </div>
  );
}
