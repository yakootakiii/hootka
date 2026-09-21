import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { rankChangeFor, type GamePhase } from '@hootka/core';
import { api } from '@/lib/firebase';
import {
  useGameState,
  useMyAnswer,
  useMyPlayer,
  usePublicQuestion,
  useQuestionResult,
} from '@/hooks/useGameState';
import { useServerClock } from '@/hooks/useServerTime';
import { useAnonymousUid, clearSession } from '@/hooks/usePlayerIdentity';
import { useSound } from '@/hooks/useSound';
import { AnswerButton } from '@/components/AnswerButton';
import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { RankArrow } from '@/components/Leaderboard';
import { Screen, Wordmark } from '@/components/Layout';
import { SoundToggle } from '@/components/SoundToggle';
import { Timer } from '@/components/Timer';
import { feedbackHeadline, feedbackSubline, formatPoints, ordinal } from '@/lib/format';

/**
 * The player's phone. It shows exactly one thing at a time, driven entirely by
 * the shared `state.phase`, so the whole class moves together.
 */
export function PlayerGame() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const { uid } = useAnonymousUid();
  const { play, muted, toggleMuted } = useSound();

  const state = useGameState(gameId);
  const question = usePublicQuestion(gameId);
  const me = useMyPlayer(gameId, uid);
  const serverNow = useServerClock();

  const phase: GamePhase = state?.phase ?? 'LOBBY';
  const questionIndex = state?.questionIndex ?? 0;
  const myAnswer = useMyAnswer(gameId, questionIndex, uid);
  const result = useQuestionResult(gameId, phase === 'QUESTION_ACTIVE' ? null : questionIndex);

  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A new question clears whatever the last one left on screen.
  useEffect(() => {
    setPending(null);
    setError(null);
  }, [questionIndex]);

  const locked = myAnswer != null || pending != null;

  const answer = useCallback(
    async (choice: number) => {
      if (locked || phase !== 'QUESTION_ACTIVE') return;
      setPending(choice);
      try {
        await api.submitAnswer({ gameId, questionIndex, choice });
      } catch (cause) {
        setPending(null);
        const message = cause instanceof Error ? cause.message : 'That did not send.';
        setError(message.replace(/^.*?:\s*/, ''));
      }
    },
    [gameId, locked, phase, questionIndex],
  );

  // Laptop players can use the number keys.
  useEffect(() => {
    if (phase !== 'QUESTION_ACTIVE' || locked) return;
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < (question?.options.length ?? 0)) void answer(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, locked, phase, question?.options.length]);

  const correct = myAnswer?.correct ?? false;
  const points = myAnswer?.points ?? 0;

  useEffect(() => {
    if (phase === 'QUESTION_RESULT' && myAnswer?.points !== undefined) {
      play(correct ? 'correct' : 'wrong');
    }
  }, [phase, myAnswer?.points, correct, play]);

  const body = useMemo(() => {
    switch (phase) {
      case 'LOBBY':
        return (
          <Centered>
            <Mascot mood="happy" className="h-44 w-44" />
            <h1 className="font-display text-4xl">You're in!</h1>
            <p className="text-xl opacity-90">Look at the big screen.</p>
            {me && <p className="font-display text-2xl">{me.name}</p>}
          </Centered>
        );

      case 'QUESTION_INTRO':
        return (
          <Centered>
            <Mascot mood="thinking" className="h-44 w-44" />
            <h1 className="font-display text-4xl">Get ready!</h1>
            <p className="text-xl opacity-90">
              Question {questionIndex + 1} of {state?.totalQuestions ?? '?'}
            </p>
          </Centered>
        );

      case 'QUESTION_ACTIVE':
        if (locked) {
          return (
            <Centered>
              <Mascot mood="thinking" className="h-40 w-40" />
              <h1 className="font-display text-4xl">Answer sent!</h1>
              <p className="text-xl opacity-90">Hold tight while everyone finishes.</p>
            </Centered>
          );
        }
        return (
          <div className="flex flex-1 flex-col gap-4">
            <Timer
              questionStartedAt={state?.questionStartedAt ?? null}
              serverNow={serverNow}
              variant="bar"
              onTick={() => play('tick')}
            />
            <p className="text-center font-display text-xl">Tap your answer</p>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              {question?.options.map((option, index) => (
                <AnswerButton
                  key={index}
                  index={index}
                  text={option.text}
                  onClick={() => void answer(index)}
                />
              ))}
            </div>
          </div>
        );

      case 'QUESTION_RESULT':
        return (
          <Centered>
            <Mascot mood={correct ? 'cheering' : 'sad'} className="h-40 w-40" />
            <h1 className="font-display text-5xl">{feedbackHeadline(correct, points)}</h1>
            {correct && <p className="font-display text-4xl">+{formatPoints(points)}</p>}
            <p className="text-xl opacity-90">{feedbackSubline(correct, me?.streak ?? 0)}</p>
            {myAnswer?.order && (
              <p className="rounded-full bg-white/20 px-4 py-2 font-bold">
                You were {ordinal(myAnswer.order)} fastest!
              </p>
            )}
            {!myAnswer && result && <p className="text-xl opacity-90">Time's up - no answer this round.</p>}
          </Centered>
        );

      case 'LEADERBOARD':
        return (
          <Centered>
            <p className="text-xl opacity-90">You are</p>
            <div className="flex items-center gap-3">
              <span className="font-display text-7xl">{ordinal(me?.rank ?? 0)}</span>
              {me && <RankArrow change={rankChangeFor(me.rank, me.prevRank)} />}
            </div>
            <p className="font-display text-3xl">{formatPoints(me?.score ?? 0)} points</p>
            {me && me.rank > 1 && (
              <p className="text-lg opacity-90">Keep going - you are closing in!</p>
            )}
            {me?.rank === 1 && <p className="text-lg opacity-90">You are in the lead!</p>}
          </Centered>
        );

      case 'FINAL_PODIUM':
      case 'ENDED':
        return (
          <Centered>
            <Mascot mood={(me?.rank ?? 99) <= 3 ? 'cheering' : 'happy'} className="h-44 w-44" />
            <h1 className="font-display text-4xl">
              You finished {ordinal(me?.rank ?? 0)}!
            </h1>
            <p className="font-display text-3xl">{formatPoints(me?.score ?? 0)} points</p>
            <p className="text-xl opacity-90">
              {me?.correctCount ?? 0} correct out of {state?.totalQuestions ?? 0}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                clearSession();
                navigate('/');
              }}
            >
              Join another game
            </Button>
          </Centered>
        );

      default:
        return null;
    }
  }, [
    answer, correct, locked, me, myAnswer, navigate, phase, play, points,
    question, questionIndex, result, serverNow, state,
  ]);

  return (
    <Screen tone="play" className="justify-between">
      <header className="flex items-center justify-between">
        <Wordmark className="text-white/90" />
        <div className="flex items-center gap-3">
          {me && (
            <span className="rounded-full bg-white/20 px-4 py-2 font-bold tabular-nums">
              {formatPoints(me.score)}
            </span>
          )}
          <SoundToggle muted={muted} onToggle={toggleMuted} />
        </div>
      </header>

      {body}

      {error && (
        <p role="alert" className="rounded-chunky bg-white px-4 py-3 text-center font-bold text-answer-red">
          {error}
        </p>
      )}
    </Screen>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
    >
      {children}
    </motion.section>
  );
}
