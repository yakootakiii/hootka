import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import type { Quiz } from '@hootka/core';
import { api, auth, signOut } from '@/lib/firebase';
import { firestore } from '@/lib/firebase-host';
import { useHostAuth } from '@/hooks/useHostAuth';
import { Button } from '@/components/Button';
import { Screen, Wordmark } from '@/components/Layout';

/** A teacher's quizzes: create, edit, duplicate, delete, play. */
export function Dashboard() {
  const { host } = useHostAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host) return;
    const quizQuery = query(
      collection(firestore, 'quizzes'),
      where('ownerUid', '==', host.uid),
      orderBy('updatedAt', 'desc'),
    );
    return onSnapshot(quizQuery, (snapshot) => {
      setQuizzes(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Quiz));
    });
  }, [host]);

  const createQuiz = async () => {
    if (!host) return;
    const created = await addDoc(collection(firestore, 'quizzes'), {
      ownerUid: host.uid,
      title: 'Untitled quiz',
      coverImageUrl: null,
      questionCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigate(`/host/quiz/${created.id}`);
  };

  const duplicateQuiz = async (quiz: Quiz) => {
    if (!host) return;
    setBusy(quiz.id);
    try {
      const copy = await addDoc(collection(firestore, 'quizzes'), {
        ownerUid: host.uid,
        title: `${quiz.title} (copy)`,
        coverImageUrl: quiz.coverImageUrl ?? null,
        questionCount: quiz.questionCount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const questions = await getDocs(collection(firestore, 'quizzes', quiz.id, 'questions'));
      await Promise.all(
        questions.docs.map((questionDoc) =>
          setDoc(doc(firestore, 'quizzes', copy.id, 'questions', questionDoc.id), questionDoc.data()),
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const deleteQuiz = async (quiz: Quiz) => {
    if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`)) return;
    setBusy(quiz.id);
    try {
      const questions = await getDocs(collection(firestore, 'quizzes', quiz.id, 'questions'));
      await Promise.all(questions.docs.map((questionDoc) => deleteDoc(questionDoc.ref)));
      await deleteDoc(doc(firestore, 'quizzes', quiz.id));
    } finally {
      setBusy(null);
    }
  };

  const play = async (quiz: Quiz) => {
    setBusy(quiz.id);
    setError(null);
    try {
      const game = await api.createGame({ quizId: quiz.id });
      navigate(`/host/game/${game.gameId}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not start the game.';
      setError(message.replace(/^.*?:\s*/, ''));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <Wordmark className="text-grape-500" />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-soft sm:inline">{host?.email}</span>
          <Button variant="ghost" onClick={() => void signOut(auth)}>Sign out</Button>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl">My quizzes</h1>
        <Button onClick={() => void createQuiz()}>New quiz</Button>
      </div>

      {error && (
        <p role="alert" className="rounded-chunky bg-answer-red px-4 py-3 font-bold text-white">{error}</p>
      )}

      {quizzes.length === 0 ? (
        <p className="card text-center text-lg text-ink-soft">
          No quizzes yet. Make your first one!
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="card flex flex-col gap-3">
              <h2 className="font-display text-2xl">{quiz.title}</h2>
              <p className="text-ink-soft">
                {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button onClick={() => void play(quiz)} disabled={busy === quiz.id || quiz.questionCount === 0}>
                  Play
                </Button>
                <Link to={`/host/quiz/${quiz.id}`} className="btn-chunky bg-white text-ink">Edit</Link>
                <Button variant="secondary" onClick={() => void duplicateQuiz(quiz)} disabled={busy === quiz.id}>
                  Duplicate
                </Button>
                <Button variant="danger" onClick={() => void deleteQuiz(quiz)} disabled={busy === quiz.id}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
