import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  MAX_PLAYERS, rankChangeFor, resultsToCsv, type GamePhase, type LeaderboardEntry,
} from '@hootka/core';
import { api } from '@/lib/firebase';
import {
  useAnsweredCount, useGameMeta, useGameState, usePlayers, usePublicQuestion, useQuestionResult,
} from '@/hooks/useGameState';
import { useServerClock } from '@/hooks/useServerTime';
import { useSound } from '@/hooks/useSound';
import { AnswerButton } from '@/components/AnswerButton';
import { AnswerDistribution } from '@/components/AnswerDistribution';
import { Button } from '@/components/Button';
import { Leaderboard } from '@/components/Leaderboard';
import { Mascot } from '@/components/Mascot';
import { PlayerChips } from '@/components/PlayerChips';
import { Podium } from '@/components/Podium';
import { Screen, Wordmark } from '@/components/Layout';
import { SoundToggle } from '@/components/SoundToggle';
import { Timer } from '@/components/Timer';
import { formatGameCode } from '@/lib/format';

/**
 * The projector screen. It owns the controls (Next, Skip, End) and closes each
 * question when the timer runs out - the server re-checks everything anyway.
 */
export function HostGame() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const { play, muted, toggleMuted } = useSound();

  const meta = useGameMeta(gameId);
  const state = useGameState(gameId);
  const question = usePublicQuestion(gameId);
  const players = usePlayers(gameId);
  const serverNow = useServerClock();

  const phase: GamePhase = state?.phase ?? 'LOBBY';
  const questionIndex = state?.questionIndex ?? 0;
  const result = useQuestionResult(gameId, phase === 'QUESTION_ACTIVE' ? null : questionIndex);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinUrl = useMemo(
    () => `${window.location.origin}/?code=${meta?.code ?? ''}`,
    [meta?.code],
  );

  const entries: LeaderboardEntry[] = useMemo(
    () =>
      players.map((player) => ({
        uid: player.uid,
        name: player.name,
        score: player.score,
        rank: player.rank,
        prevRank: player.prevRank,
        change: rankChangeFor(player.rank, player.prevRank),
        lastPoints: player.lastPoints,
        streak: player.streak,
      })),
    [players],
  );

  const advance = useCallback(
    async (options: { skip?: boolean; expectPhase?: GamePhase } = {}) => {
      setBusy(true);
      setError(null);
      try {
        await api.advanceGame({ gameId, ...options });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'That did not work.';
        setError(message.replace(/^.*?:\s*/, ''));
      } finally {
        setBusy(false);
      }
    },
    [gameId],
  );

  // The intro is a fixed 3 seconds, then the window opens by itself.
  useEffect(() => {
    if (phase !== 'QUESTION_INTRO') return;
    const timer = window.setTimeout(() => void advance(), 3_000);
    return () => window.clearTimeout(timer);
  }, [phase, questionIndex, advance]);

  // When the timer runs out the game moves itself to the result screen. The
  // expectPhase guard means a click landing at the same moment cannot advance
  // it twice.
  const closeAtTimeUp = useCallback(() => {
    void advance({ expectPhase: 'QUESTION_ACTIVE' });
  }, [advance]);

  const answeredCount = useAnsweredCount(gameId, questionIndex);

  const downloadCsv = () => {
    const blob = new Blob([resultsToCsv(players)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hootka-results-${meta?.code ?? gameId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <Wordmark className="text-grape-500" />
        <div className="flex items-center gap-3">
          {phase !== 'LOBBY' && (
            <span className="font-display text-xl text-ink-soft">
              {questionIndex + 1} / {state?.totalQuestions ?? 0}
            </span>
          )}
          <SoundToggle muted={muted} onToggle={toggleMuted} />
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-chunky bg-answer-red px-4 py-3 font-bold text-white">{error}</p>
      )}

      {phase === 'LOBBY' && (
        <section className="flex flex-1 flex-col items-center gap-6 text-center">
          <h1 className="font-display text-3xl">Join at {window.location.host}</h1>
          <p className="font-display text-7xl tracking-widest tabular-nums text-grape-500 sm:text-8xl">
            {formatGameCode(meta?.code ?? '······')}
          </p>
          <div className="rounded-chunky bg-white p-4 shadow-lift">
            <QRCodeSVG value={joinUrl} size={180} aria-label="QR code to join this game" />
          </div>
          <p className="font-display text-2xl">
            {players.length} / {MAX_PLAYERS} players
          </p>
          <PlayerChips
            players={players}
            onKick={(uid) => void api.kickPlayer({ gameId, playerUid: uid })}
          />
          <Button
            onClick={() => { play('join'); void advance(); }}
            disabled={busy || players.length === 0}
            className="mt-auto"
          >
            Start game
          </Button>
        </section>
      )}

      {phase === 'QUESTION_INTRO' && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Mascot mood="thinking" className="h-40 w-40" />
          <p className="font-display text-3xl text-ink-soft">Question {questionIndex + 1}</p>
          <h1 className="font-display text-5xl">{question?.text}</h1>
          <p className="text-2xl">Get ready!</p>
        </section>
      )}

      {phase === 'QUESTION_ACTIVE' && (
        <section className="flex flex-1 flex-col gap-6">
          <h1 className="text-center font-display text-4xl sm:text-5xl">{question?.text}</h1>
          {question?.imageUrl && (
            <img src={question.imageUrl} alt="" className="mx-auto max-h-64 rounded-chunky object-contain" />
          )}
          <div className="flex items-center justify-between gap-6">
            <Timer
              questionStartedAt={state?.questionStartedAt ?? null}
              serverNow={serverNow}
              onExpire={closeAtTimeUp}
              onTick={() => play('tick')}
            />
            <p className="font-display text-3xl">
              {answeredCount} of {players.length} answered
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {question?.options.map((option, index) => (
              <AnswerButton key={index} index={index} text={option.text} asStatic />
            ))}
          </div>
          <Button variant="secondary" onClick={() => void advance({ skip: true })} disabled={busy}>
            Skip
          </Button>
        </section>
      )}

      {phase === 'QUESTION_RESULT' && (
        <section className="flex flex-1 flex-col gap-6">
          <h1 className="text-center font-display text-4xl">{question?.text}</h1>
          {result && question && (
            <AnswerDistribution
              counts={result.counts}
              correctIndex={result.correctIndex}
              options={question.options}
            />
          )}
          <h2 className="text-center font-display text-3xl">Top 5</h2>
          <Leaderboard entries={entries} limit={5} />
          <Button onClick={() => void advance()} disabled={busy} className="mt-auto">
            {questionIndex + 1 >= (state?.totalQuestions ?? 0) ? 'Show podium' : 'Next question'}
          </Button>
        </section>
      )}

      {(phase === 'FINAL_PODIUM' || phase === 'ENDED') && (
        <section className="flex flex-1 flex-col items-center gap-8">
          <h1 className="font-display text-5xl">
            {entries[0] ? `${entries[0].name} wins!` : 'That is a wrap!'}
          </h1>
          <Podium entries={entries} />
          <Leaderboard entries={entries} limit={entries.length} />
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={downloadCsv}>Download results (CSV)</Button>
            <Button onClick={() => navigate('/host')}>Back to my quizzes</Button>
          </div>
        </section>
      )}

      {phase !== 'ENDED' && phase !== 'LOBBY' && (
        <Button
          variant="ghost"
          className="self-center text-ink-soft"
          onClick={() => {
            if (window.confirm('End the game for everyone?')) void api.endGame({ gameId });
          }}
        >
          End game
        </Button>
      )}
    </Screen>
  );
}
