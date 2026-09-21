import { Link } from 'react-router-dom';
import { Screen, Wordmark } from '@/components/Layout';

/** Section 7 asks for a plain-language privacy page linked from every screen. */
export function Privacy() {
  return (
    <Screen>
      <Link to="/"><Wordmark className="text-grape-500" /></Link>
      <article className="card flex flex-col gap-4">
        <h1 className="font-display text-4xl">Privacy</h1>

        <h2 className="font-display text-2xl">Players</h2>
        <p>
          Players do not make an account. We ask for a nickname and nothing else - no
          email, no photo, no age, no location. Nicknames are checked so they stay kind,
          and the teacher can remove any nickname from the game.
        </p>
        <p>
          While a game runs we store the nickname, the answers given, and the score. All
          of it is deleted automatically 24 hours after the game ends.
        </p>

        <h2 className="font-display text-2xl">Teachers</h2>
        <p>
          A teacher account stores an email address and the quizzes they write. Quizzes
          are private to the teacher who made them. Deleting a quiz deletes its questions.
        </p>

        <h2 className="font-display text-2xl">What Hootka never does</h2>
        <ul className="list-inside list-disc">
          <li>No chat between players.</li>
          <li>No adverts and no third-party tracking.</li>
          <li>No links out of the game.</li>
          <li>No selling or sharing of any data.</li>
        </ul>
      </article>
    </Screen>
  );
}
