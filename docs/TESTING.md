# Testing

```bash
npm test              # 162 tests
npm run test:coverage # thresholds at 70%; core sits at 99%
```

| Suite | What it covers |
|---|---|
| `tests/unit` | The rules in `packages/core`, one module at a time. |
| `tests/integration` | Whole games played through `GameSim`, an in-memory stand-in for the database and the functions that runs the real core modules. |
| `tests/ui` | Components in jsdom, with the accessibility requirements asserted. |
| `tests/e2e` | A whole game against the running emulators: real Cloud Functions, real server timestamps, real security rules. `npm run e2e`. |
| `tests/load` | 60 bots against the emulator suite. Needs infrastructure, so it is not in `npm test`. |

## The spec's checklist (section 11)

| Item | Covered by |
|---|---|
| Instant answer ≈1000, at 10s ≈500, wrong 0, no answer 0 | `unit/scoring.test.ts`, `integration/game-flow.test.ts` |
| Tie-break: equal totals ordered by earlier answer | `unit/ranking.test.ts` |
| Late answer rejected; double-submit ignored | `unit/answerGuard.test.ts`, `integration/game-flow.test.ts` |
| Players cannot see `correctIndex` before the reveal | `unit/question.test.ts`, `integration/game-flow.test.ts` |
| Timer within ~0.3s across devices, including a wrong clock | `unit/timing.test.ts` |
| 60 players join and answer without errors | `integration/concurrency.test.ts`, `load/simulate-players.ts` |
| Refresh or disconnect rejoins with the same nickname and score | `integration/game-flow.test.ts` |
| Host disconnect pauses and resumes | **not covered** - see `docs/DECISIONS.md` |
| Chrome, iOS Safari, Android Chrome, slow 4G | **manual** - the bundle split is the automated half |
| `prefers-reduced-motion` disables heavy animation | Implemented in `useReducedMotion` and the CSS; **not asserted in a test** |

The three gaps are real and listed as gaps, not glossed over. The two marked
manual need devices; the host-disconnect one needs the feature built first.

## How the integration tests work

`tests/helpers/game-sim.ts` replaces Firebase reads and writes with plain
objects, while calling the same `canAcceptAnswer`, `scoreQuestion`,
`applyQuestionResults`, `nextAdvance` and `toPublicQuestion` that the deployed
functions call. A test can therefore play a three-question game, move the clock
by hand, and assert on the resulting leaderboard in about a millisecond.

What it cannot check - that the security rules actually deny a write, that the
real server timestamp behaves, that 60 concurrent HTTPS calls all land - is
exactly what `tests/load/simulate-players.ts` is for.

## Running the end-to-end game

```bash
npm run emulators   # terminal 1
npm run e2e         # terminal 2
```

It signs a teacher up, writes a three-question quiz, runs the game with four
players (one fast and correct, one slower and correct, one always wrong, one who
never answers), and checks 32 assertions through to the podium - including that
`correctIndex` is absent from the published question, that a result does not
exist while a question is live, that a double submit is refused, and that the
game code is released at the end.

This is what proves the security rules and the Admin-SDK write path, which the
in-memory integration tests cannot reach.

## Running the load test

```bash
npm run emulators                       # terminal 1
npm run dev                             # terminal 2, then start a game as a host
npm run loadtest -- --code 123456       # terminal 3, once the lobby is open
```

It joins 60 bots, waits for the host to open a question, has every bot answer
inside a 1-second burst, and reports p50/p95/max latency plus any failures.
