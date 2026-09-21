import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import type { GameState, Player, PublicQuestion, QuestionResult } from '@hootka/core';
import { rtdb } from '@/lib/firebase';

function useNode<T>(path: string | null): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    if (!path) {
      setValue(null);
      return;
    }
    return onValue(ref(rtdb, path), (snapshot) => setValue(snapshot.val() as T | null));
  }, [path]);

  return value;
}

/** The live phase/question/timer node. Every screen listens to this. */
export function useGameState(gameId: string | null): GameState | null {
  return useNode<GameState>(gameId ? `games/${gameId}/state` : null);
}

/** The redacted question. It never contains the correct answer. */
export function usePublicQuestion(gameId: string | null): PublicQuestion | null {
  return useNode<PublicQuestion>(gameId ? `games/${gameId}/publicQuestion` : null);
}

/** The result of one question, written only once that question has closed. */
export function useQuestionResult(
  gameId: string | null,
  questionIndex: number | null,
): QuestionResult | null {
  return useNode<QuestionResult>(
    gameId && questionIndex !== null ? `games/${gameId}/results/${questionIndex}` : null,
  );
}

/**
 * The full roster. Only the host subscribes to this; players read just their
 * own record, which keeps 50 phones off the busiest node.
 */
export function usePlayers(gameId: string | null): Player[] {
  const raw = useNode<Record<string, Omit<Player, 'uid'>>>(gameId ? `games/${gameId}/players` : null);

  return useMemo(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([uid, player]) => ({ uid, ...player }))
      .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity) || a.joinedAt - b.joinedAt);
  }, [raw]);
}

/** One player's own record: score, rank and the points they just earned. */
export function useMyPlayer(gameId: string | null, uid: string | null): Player | null {
  const raw = useNode<Omit<Player, 'uid'>>(
    gameId && uid ? `games/${gameId}/players/${uid}` : null,
  );
  return raw && uid ? { uid, ...raw } : null;
}

/**
 * How many players have answered the question currently open. Maintained by
 * `submitAnswer` as a plain number, because the answers themselves are only
 * readable by their own author.
 */
export function useAnsweredCount(gameId: string | null, questionIndex: number | null): number {
  const value = useNode<number>(
    gameId && questionIndex !== null ? `games/${gameId}/answerCounts/${questionIndex}` : null,
  );
  return typeof value === 'number' ? value : 0;
}

export function useGameMeta(gameId: string | null) {
  return useNode<{ code: string; status: string; hostUid: string; quizId: string }>(
    gameId ? `games/${gameId}/meta` : null,
  );
}

/** My own answer for a question, so the player screen can show what they picked. */
export function useMyAnswer(gameId: string | null, questionIndex: number | null, uid: string | null) {
  return useNode<{ choice: number; points?: number; correct?: boolean; order?: number }>(
    gameId && uid && questionIndex !== null
      ? `games/${gameId}/answers/${questionIndex}/${uid}`
      : null,
  );
}
