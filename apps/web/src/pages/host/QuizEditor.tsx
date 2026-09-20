import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { MAX_OPTIONS, MIN_OPTIONS, validateQuestion, type Question } from '@hootka/core';
import { firestore, storage } from '@/lib/firebase-host';
import { useHostAuth } from '@/hooks/useHostAuth';
import { AnswerButton } from '@/components/AnswerButton';
import { Button } from '@/components/Button';
import { Screen, Wordmark } from '@/components/Layout';
import { answerStyle } from '@/lib/answerStyles';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const blankQuestion = (order: number): Omit<Question, 'id'> => ({
  order,
  text: '',
  imageUrl: null,
  timeLimit: 10,
  options: [{ text: '' }, { text: '' }],
  correctIndex: 0,
});

export function QuizEditor() {
  const { quizId = '' } = useParams();
  const { host } = useHostAuth();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    void getDoc(doc(firestore, 'quizzes', quizId)).then((snapshot) => {
      setTitle((snapshot.data()?.title as string) ?? '');
    });
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;
    const questionQuery = query(
      collection(firestore, 'quizzes', quizId, 'questions'),
      orderBy('order'),
    );
    return onSnapshot(questionQuery, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Question);
      setQuestions(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    });
  }, [quizId]);

  const selected = questions.find((question) => question.id === selectedId) ?? null;

  const saveTitle = async (value: string) => {
    setTitle(value);
    await updateDoc(doc(firestore, 'quizzes', quizId), { title: value, updatedAt: serverTimestamp() });
  };

  const addQuestion = async () => {
    const id = doc(collection(firestore, 'quizzes', quizId, 'questions')).id;
    await setDoc(doc(firestore, 'quizzes', quizId, 'questions', id), blankQuestion(questions.length));
    await updateDoc(doc(firestore, 'quizzes', quizId), {
      questionCount: questions.length + 1,
      updatedAt: serverTimestamp(),
    });
    setSelectedId(id);
  };

  const patchQuestion = async (id: string, patch: Partial<Question>) => {
    await updateDoc(doc(firestore, 'quizzes', quizId, 'questions', id), patch);
    await updateDoc(doc(firestore, 'quizzes', quizId), { updatedAt: serverTimestamp() });
  };

  const removeQuestion = async (id: string) => {
    await deleteDoc(doc(firestore, 'quizzes', quizId, 'questions', id));
    // Close the gap the deletion left so `order` stays 0..n-1.
    const batch = writeBatch(firestore);
    questions
      .filter((question) => question.id !== id)
      .forEach((question, index) => {
        batch.update(doc(firestore, 'quizzes', quizId, 'questions', question.id), { order: index });
      });
    batch.update(doc(firestore, 'quizzes', quizId), {
      questionCount: questions.length - 1,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    if (selectedId === id) setSelectedId(null);
  };

  const move = async (id: string, direction: -1 | 1) => {
    const index = questions.findIndex((question) => question.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= questions.length) return;

    const batch = writeBatch(firestore);
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    if (moved) reordered.splice(target, 0, moved);
    reordered.forEach((question, order) => {
      batch.update(doc(firestore, 'quizzes', quizId, 'questions', question.id), { order });
    });
    await batch.commit();
  };

  const uploadImage = async (question: Question, file: File) => {
    if (!host) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Images must be 2 MB or smaller.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    setError(null);
    const path = `quizzes/${host.uid}/${quizId}/${question.id}`;
    await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
    await patchQuestion(question.id, { imageUrl: await getDownloadURL(storageRef(storage, path)) });
  };

  const problems = selected ? validateQuestion(selected) : [];

  return (
    <Screen>
      <header className="flex items-center justify-between gap-4">
        <Link to="/host"><Wordmark className="text-grape-500" /></Link>
        <input
          aria-label="Quiz title"
          value={title}
          onChange={(event) => void saveTitle(event.target.value)}
          className="min-w-0 flex-1 rounded-chunky border-2 border-grape-400 px-4 py-3 font-display text-2xl"
        />
        <Link to="/host" className="btn-chunky bg-white text-ink">Done</Link>
      </header>

      {error && (
        <p role="alert" className="rounded-chunky bg-answer-red px-4 py-3 font-bold text-white">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {questions.map((question, index) => (
              <li key={question.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(question.id)}
                  aria-current={question.id === selectedId}
                  className={`flex-1 truncate rounded-chunky px-4 py-3 text-left font-bold ${
                    question.id === selectedId ? 'bg-grape-500 text-white' : 'bg-white text-ink'
                  }`}
                >
                  {index + 1}. {question.text || 'New question'}
                  {validateQuestion(question).length > 0 && (
                    <span className="ml-2 text-answer-red" aria-label="incomplete">•</span>
                  )}
                </button>
                <button type="button" onClick={() => void move(question.id, -1)} aria-label={`Move question ${index + 1} up`} className="px-2 text-xl">↑</button>
                <button type="button" onClick={() => void move(question.id, 1)} aria-label={`Move question ${index + 1} down`} className="px-2 text-xl">↓</button>
              </li>
            ))}
          </ol>
          <Button onClick={() => void addQuestion()}>Add question</Button>
        </aside>

        {selected ? (
          <section className="card flex flex-col gap-4">
            <label className="font-bold" htmlFor="question-text">Question</label>
            <input
              id="question-text"
              value={selected.text}
              onChange={(event) => void patchQuestion(selected.id, { text: event.target.value })}
              placeholder="Which animal says hoot?"
              className="rounded-chunky border-2 border-grape-400 px-4 py-3 text-xl"
            />

            <label className="font-bold" htmlFor="question-image">Image (optional, max 2 MB)</label>
            <input
              id="question-image"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(selected, file);
              }}
            />
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="" className="max-h-48 w-fit rounded-chunky object-contain" />
            )}

            <fieldset className="flex flex-col gap-3">
              <legend className="font-bold">Answers (pick the correct one)</legend>
              {selected.options.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${selected.id}`}
                    checked={selected.correctIndex === index}
                    onChange={() => void patchQuestion(selected.id, { correctIndex: index })}
                    aria-label={`Mark ${answerStyle(index).label} as correct`}
                    className="h-6 w-6"
                  />
                  <input
                    value={option.text}
                    onChange={(event) => {
                      const options = selected.options.map((existing, i) =>
                        i === index ? { text: event.target.value } : existing,
                      );
                      void patchQuestion(selected.id, { options });
                    }}
                    aria-label={`${answerStyle(index).label} answer text`}
                    className="flex-1 rounded-chunky border-2 px-4 py-3 text-lg"
                    style={{ borderColor: answerStyle(index).hex }}
                  />
                  {selected.options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      aria-label={`Remove ${answerStyle(index).label} answer`}
                      onClick={() => {
                        const options = selected.options.filter((_, i) => i !== index);
                        void patchQuestion(selected.id, {
                          options,
                          correctIndex: Math.min(selected.correctIndex, options.length - 1),
                        });
                      }}
                      className="px-2 text-xl"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {selected.options.length < MAX_OPTIONS && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void patchQuestion(selected.id, { options: [...selected.options, { text: '' }] })
                  }
                >
                  Add answer
                </Button>
              )}
            </fieldset>

            {problems.length > 0 && (
              <p className="rounded-chunky bg-answer-yellow/40 px-4 py-3 font-bold">
                Finish this question before playing: {problems.join(', ').replace(/_/g, ' ')}.
              </p>
            )}

            <div>
              <h3 className="mb-2 font-display text-xl">Player preview</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.options.map((option, index) => (
                  <AnswerButton key={index} index={index} text={option.text || '…'} asStatic />
                ))}
              </div>
            </div>

            <Button variant="danger" onClick={() => void removeQuestion(selected.id)}>
              Delete question
            </Button>
          </section>
        ) : (
          <section className="card grid place-items-center text-center text-ink-soft">
            Add a question to get started.
          </section>
        )}
      </div>
    </Screen>
  );
}
