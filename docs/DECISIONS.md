# Decisions

## The spec's open questions (section 13)

These were answered with defaults so the build could proceed. Each is cheap to
change - say the word and it changes.

**1. Is the host screen required, or is phone-only hosting supported?**
Both. The host screen is designed landscape-first for a projector, but every
host screen is responsive and works on a phone. The lobby, question, result,
leaderboard and podium all reflow to a single column. A teacher with no
projector can run a game from their phone and read the code aloud.

**2. Are quiz images needed in v1?**
Yes, they are in. Optional per question, 2 MB limit, images only, enforced in
both the editor and `storage.rules`. A quiz with no images costs nothing.

**3. Mascot and theme?**
An owl, named Hootka - which is where the site's name comes from. She has five
moods (happy, thinking, cheering, sad-but-encouraging, sleeping) and is drawn as
inline SVG, so she is weightless and recolourable. The palette is the one the
spec fixes, on a soft purple ground.

**4. Private quizzes, or a shared library?**
Private. `firestore.rules` allows a teacher to read and write only their own
quizzes. Duplicate-and-edit already works within an account, so a shared library
later is an additive change, not a rewrite.

## Judgment calls made while building

**A shared `packages/core`.** Scoring, ranking, the phase machine, the nickname
filter and the answer guard are pure functions in one package, imported by both
the Cloud Functions and the React app. The client and the server cannot drift
apart about the rules, and every rule is testable without Firebase. Functions
are bundled with esbuild at deploy time, so the workspace dependency does not
have to survive `npm install` inside `functions/`.

**The streak bonus starts on the second consecutive correct answer.** The spec
says "+50 per consecutive correct answer, capped at +200" without fixing where
the run begins. Bonus is computed from the streak a player carried *into* the
question: first correct answer 0, second 50, third 100, capped at 200. Off by
default, as specified.

**Skip means two different things, deliberately.** Pressed during a live
question, it behaves exactly like the timer expiring: whatever was submitted is
scored and the result is shown. Pressed during the 3-second intro - before
anyone could answer - it drops the question entirely and moves to the next one,
because there is no result worth showing for a question nobody was asked.

**`closeQuestion` is idempotent.** The host client calls it when the timer hits
zero, and `advanceGame` calls it again when leaving `QUESTION_ACTIVE`. The
second call is a no-op: the presence of `results/{index}` is the guard. Without
this, a race between the timer and an eager host would pay everyone twice.

**Rejoining is keyed on the anonymous UID.** A player who refreshes, drops off
Wi-Fi, or locks their phone comes back to the same record with the same score,
even mid-game, because Firebase anonymous auth persists the UID. Rejoining
bypasses the "lobby is closed" check for exactly that reason; a genuinely new
player still cannot join after the start.

**The nickname filter matches on folded text, with two tiers.** Names are
lowercased, de-accented, un-leeted ("sh1t", "a$$hole") and run-collapsed
("fuuuuck"). Terms with no innocent host are matched anywhere in the name;
short terms that live inside real words (`ass`, `cunt`, `sex`, `tit`) are only
matched as whole words, so "Cassie" and "Scunthorpe" can play. Runs of two or
more digits are exempt from leet-mapping - without that rule, "Player 45" folds
to "...as" and a whole class gets blocked one nickname at a time.

**The host bundle is loaded lazily.** Firestore and Storage live in
`lib/firebase-host.ts` and the host routes are `React.lazy`, so a player joining
on a phone downloads 179 kB gzipped instead of 280 kB. The spec asks the game to
work on slow 4G; this is most of that requirement.

**Sounds are synthesised, not shipped.** Five short tones from the Web Audio
API instead of audio files: nothing to download, nothing to cache, and they stay
gentle by construction. Muted until someone turns them on, as specified.

## Not built yet

- Drag-to-reorder in the quiz editor. Reordering works today with up/down
  buttons, which are also keyboard- and screen-reader-operable; drag is a
  refinement on top.
- The scheduled fallback that closes a question if the host's browser dies
  mid-question. `cleanupGames` is scheduled and working; the per-question
  fallback is not, so today a host who closes the tab mid-question leaves the
  game parked until they return (their scores are intact).
- Host-disconnect pause/resume (checklist item). A host who returns can carry
  on, but the players' screens do not currently say "paused".
