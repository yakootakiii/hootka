# Hootka

A kid-friendly live quiz game. Teachers write quizzes and run them on a big
screen; a class of 40-50 students joins with a 6-digit code and a nickname, no
accounts and no personal data.

Built from `quiz-game-spec.md`. Hootka is the owl who hosts the game.

## Where things are

```
src/core          Pure game logic: scoring, ranking, phases, the nickname
                  filter, the answer guard. No Firebase, no React - which is
                  why it can be tested exhaustively and why the server and the
                  client can never disagree about the rules.
src               React 18 + Vite + Tailwind + Framer Motion.
api               Vercel serverless routes (TypeScript). Everything a player
                  must not be able to forge: joining, answering, scoring,
                  advancing. Same-origin with the app, so no CORS.
tests             Vitest: unit, integration and component tests, plus the
                  emulator end-to-end game and the load test.
*.rules / *.json  Firebase security rules and project config.
```

## Running it

`.env.production.local` ships pointing at a `demo-hootka` project, which is a
Firebase convention: the emulators accept it with no login and it can never
reach a real project. So this works straight after a clone:

```bash
npm install
npm run emulators        # Firebase emulator suite (needs firebase-tools + Java)
npm run dev              # the web app on http://localhost:5173
npm run e2e              # plays a whole game against the emulators
```

To point at a real project, put its values in `.env.production.local`, set the
project id in `.firebaserc`, and drop `VITE_USE_EMULATORS`. Cloud Functions need
the Blaze plan to deploy; the emulators need nothing.

Two things worth knowing:

- The hosting emulator is on port **5050**, not Firebase's default 5000, which
  macOS occupies with AirPlay Receiver.
- Against the emulators the app derives the Realtime Database URL from the
  project id. The Admin SDK inside the emulated functions uses the project id as
  the database namespace, and if the client uses the usual
  `<project>-default-rtdb` URL the two read and write *different databases* with
  no error at all.

## Tests

```bash
npm test                 # 162 tests, ~2s
npm run test:watch
npm run test:coverage    # thresholds enforced at 70%
npm run typecheck        # core, web and functions
```

The load test needs the emulators and a live game code, so it is deliberately
separate from `npm test`:

```bash
npm run loadtest -- --code 123456 --players 60
```

## How a game works

```
LOBBY -> QUESTION_INTRO (3s) -> QUESTION_ACTIVE (10s) -> QUESTION_RESULT
      -> LEADERBOARD -> (next question | FINAL_PODIUM) -> ENDED
```

Three rules hold the whole thing together:

1. **The server clock is the only clock.** `questionStartedAt` is a server
   timestamp; clients correct their own clock with `.info/serverTimeOffset`
   before drawing a countdown. A tablet whose clock is an hour out still plays
   fairly.
2. **`correctIndex` never leaves Firestore** until the question closes.
   `toPublicQuestion` builds the published question from an allow-list, so a
   player inspecting network traffic sees the options and nothing else.
3. **Scoring happens once, server-side, for everyone at the same moment.**
   `submitAnswer` only records a choice and an arrival time; `closeQuestion`
   scores all 50 players together, so the ranking is consistent.

Points: `round(1000 * (1 - (responseTime / 10) / 2))` - about 1000 for an
instant correct answer, about 500 at the buzzer, 0 for wrong or no answer.

## Deploying

The backend always runs on Firebase; the frontend is static and can go on
Vercel (`vercel.json` is set up) or Firebase Hosting. Full steps, including the
authorized-domain step that breaks Google sign-in if you skip it, are in
`docs/DEPLOY.md`.

## Documentation

- `docs/DEPLOY.md` - shipping it to a real Firebase project.
- `docs/DECISIONS.md` - the spec's open questions, answered, plus the judgment
  calls made while building.
- `docs/TESTING.md` - every item in the spec's testing checklist mapped to the
  test that covers it, and what is still manual.
