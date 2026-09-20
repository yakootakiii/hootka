# Kid-Friendly Live Quiz Game: Development Spec

A Kahoot-style real-time quiz website. Hosts create quizzes and run live games. 40-50 students join with a game code and a nickname (no account), answer timed questions, and see animated rankings after every question.

---

## 1. Decisions Confirmed

| Topic | Decision |
|---|---|
| Stack | React + Firebase |
| Host accounts | Simple host login (email/password + Google). **Players never need an account.** |
| Quiz creation | Built-in quiz editor |
| Scoring | Kahoot-style speed points with earliest-answer tie-break |
| Answer time | 10 seconds per question |
| Players per game | 40-50 (design target: up to 60 for headroom) |
| Audience | Children (playful, colorful, simple, safe) |

## 2. Assumptions (change if you disagree)

- Question type: **multiple choice, 2-4 options, exactly one correct answer** (True/False is just 2 options).
- Optional **image per question** (uploaded to Firebase Storage, size-limited).
- Hosted on **Firebase Hosting** (frontend) + **Cloud Functions** (trusted logic).
- The host runs the game on a big screen or projector ("Host screen"); players use phones, tablets, or laptops ("Player screen").
- Language: English only for v1.
- Free tier of Firebase is enough for classroom use, but Cloud Functions require the Blaze (pay-as-you-go) plan; usage for a class is typically pennies.

---

## 3. User Roles and Flows

### 3.1 Host (logged in)
1. Sign up / log in.
2. Dashboard: list of my quizzes, "Create quiz" button.
3. Quiz editor: title, optional cover image, add/reorder/delete questions.
4. Press **Start Game** on a quiz, which generates a **6-digit game code** and opens the lobby.
5. Lobby: shows the code and QR/join link in large text, and a live list of joined players (with pop-in animation). Host can kick a player.
6. Host presses **Start** to run questions. Host controls: **Next**, **Skip**, **End game**.
7. After the last question, the podium and final results are shown.

### 3.2 Player (no account)
1. Open the site, type the **game code**, then type a **nickname**.
2. Wait in the lobby ("You're in! Look at the big screen").
3. For each question: see 2-4 big colored answer buttons, tap one within 10 seconds.
4. See instant feedback (Correct! +points / Wrong / Time's up), rank, and points behind the next player.
5. At the end: see final rank and podium celebration.

---

## 4. Game Rules

### 4.1 Game state machine
```
LOBBY -> QUESTION_INTRO (3s) -> QUESTION_ACTIVE (10s) -> QUESTION_RESULT -> LEADERBOARD -> (next question | FINAL_PODIUM) -> ENDED
```
- `QUESTION_INTRO`: 3-second "Get ready!" countdown showing the question number (question text may show here for reading; see 4.2).
- `QUESTION_ACTIVE`: the answer buttons unlock and the 10-second timer starts.
- `QUESTION_RESULT`: correct answer revealed and a bar chart of how many picked each option.
- `LEADERBOARD`: animated ranking (top 5 on the host screen, own rank on each player screen).

### 4.2 Timer
- The **server timestamp** is the source of truth. The host writes `questionStartedAt = serverTimestamp()` when a question opens.
- Clients display the countdown from the server start time (corrected with Firebase's `.info/serverTimeOffset`) so devices stay in sync.
- The answer window is exactly 10 seconds. Answers arriving after `questionStartedAt + 10s + 1s grace` are rejected.
- Each player can answer **once per question**; the first submission is locked.

### 4.3 Scoring
Only **correct** answers earn points. Wrong or no answer = 0.

```
responseTime  = answerServerTime - questionStartedAt        (seconds, 0..10)
points        = round( 1000 * (1 - (responseTime / 10) / 2) )
```
- Instant correct answer: about **1000** points.
- Correct at the last second: about **500** points.
- Points are calculated **server-side** (Cloud Function), never trusted from the client.

**Who answered first (tie-break):** ordering is by total score (descending), then by:
1. Higher score on the current question,
2. Earlier answer timestamp on the current question,
3. Earlier join time.

Also store an `answerOrder` (1st, 2nd, 3rd...) per question so the result screen can show a small badge like "You were 3rd fastest!"

**Optional streak bonus (off by default):** +50 per consecutive correct answer, capped at +200. Toggle in game settings.

### 4.4 Rankings
- After each question, compute the ranking across all players.
- Show **rank change** arrows (up, down, same) compared to the previous question.
- Show the **top 5** on the host screen with animation; each player sees **their own rank + points gap** to the player above.

### 4.5 End of game
- Podium with 1st, 2nd, 3rd (animated: bars rise, confetti burst for 1st place).
- Full results list below the podium.
- Host can **download results as CSV** (nickname, final score, correct count, average response time).

---

## 5. Screens

### Host side
| Screen | Contents |
|---|---|
| Login / Sign up | Email + Google buttons |
| Dashboard | Quiz cards, "New quiz", "Play", "Edit", "Delete", "Duplicate" |
| Quiz editor | Title, question list (drag to reorder), per-question editor (text, image, 2-4 answers, correct answer selector) with live preview |
| Lobby | Giant game code + join URL/QR, player chips popping in, player count (x/50), Kick, **Start** |
| Question (host) | Question text, image, timer ring, live "X of Y answered" counter |
| Result (host) | Correct answer highlight, answer distribution bars |
| Leaderboard (host) | Animated top 5 |
| Podium (host) | Winner announcement, confetti, download CSV, "Play again" |

### Player side
| Screen | Contents |
|---|---|
| Join | Game code input, then nickname input |
| Waiting | "You're in!" with a bouncing mascot |
| Answer | 2-4 huge colored buttons (with shapes), timer bar |
| Locked | "Answer sent!" waiting animation |
| Feedback | Correct or Wrong, points earned, streak, speed rank |
| My rank | Rank and gap to next player, rank-change arrow |
| Final | Final rank, celebration, "Join another game" |

---

## 6. Kid-Friendly Design Guidelines

- **Colors:** bright, high-contrast palette. Four answer colors, each also with a **shape** (triangle, diamond, circle, square) so color-blind kids can play.
  - Red `#FF5A5F` triangle, Blue `#3D8BFF` diamond, Yellow `#FFC93C` circle, Green `#3DDC84` square.
- **Typography:** rounded, friendly fonts (e.g., *Baloo 2* or *Fredoka* for headings, *Nunito* for body). Big sizes: answer text at least 24px, timer at least 64px.
- **Buttons:** huge, rounded, chunky with a "press down" effect and a soft shadow. Minimum touch target 64px.
- **Mascot:** a friendly character (owl, star, or robot) that reacts: cheering, thinking, sad-but-encouraging.
- **Animations** (Framer Motion or CSS):
  - Player chips bounce in on join.
  - Countdown ring shrinks and pulses in the last 3 seconds.
  - Leaderboard rows **slide and swap** to new positions (layout animation) with points **counting up**.
  - Correct answer: confetti/stars. Wrong: gentle shake, no harsh red screens.
  - Podium bars rise in sequence (3rd, 2nd, 1st).
- **Sound (with mute button):** join pop, tick-tock in last seconds, correct chime, gentle wrong sound, victory fanfare. Sounds are off until the host or player enables them.
- **Tone:** encouraging copy ("Nice try!", "So close!"), never shaming a low rank.
- **Accessibility:** WCAG AA contrast, keyboard operable, `prefers-reduced-motion` respected, screen-reader labels on answer buttons.
- **Responsive:** phone-first for players (portrait), landscape/projector-first for the host screen.

---

## 7. Safety and Child Protection

- Players enter **only a nickname**; no email, no photos, no personal data collected.
- **Profanity filter** on nicknames (block and ask for another). Max 15 characters; duplicates in the same game get rejected.
- Host can **kick** any player and **lock the lobby** after the game starts.
- Game data is **temporary**: player records are deleted automatically 24 hours after a game ends (scheduled Cloud Function).
- No chat between players. No external links or ads.
- Host accounts hold only email and quiz content; privacy policy page linking to data handling.

---

## 8. Technical Architecture

### 8.1 Stack
- **Frontend:** React 18 + Vite + TypeScript, React Router, Tailwind CSS, Framer Motion, `canvas-confetti`, `howler` (sound), `qrcode.react`.
- **Backend:** Firebase Authentication (hosts only), **Realtime Database** for live game state (low latency, cheap for many small writes), **Firestore** for saved quizzes, Cloud Functions (TypeScript) for trusted logic, Cloud Storage for question images, Firebase Hosting for deployment.
- **Player identity:** Firebase **Anonymous Auth** silently under the hood (gives each player a secure UID for security rules) while the player never sees any sign-up.

### 8.2 Why two databases
- **Firestore** = durable content (quizzes, questions, host profile).
- **Realtime Database** = ephemeral live games (players, answers, state), which need fast sync to 50 devices.

### 8.3 Data model

**Firestore**
```
users/{hostUid}                      { displayName, createdAt }
quizzes/{quizId}                     { ownerUid, title, coverImageUrl, questionCount, createdAt, updatedAt }
quizzes/{quizId}/questions/{qId}     { order, text, imageUrl, timeLimit: 10,
                                       options: [ {text}, ... 2-4 ],
                                       correctIndex }
```

**Realtime Database**
```
games/{gameId}/
  meta:        { hostUid, quizId, code, status, createdAt, settings: {streakBonus:false} }
  state:       { phase, questionIndex, questionStartedAt, totalQuestions }
  publicQuestion: { text, imageUrl, options:[...] }      // NO correct answer here
  players/{playerUid}: { name, joinedAt, score, streak, rank, prevRank, lastPoints }
  answers/{questionIndex}/{playerUid}: { choice, answeredAt, points, order }   // written by function
  results/{questionIndex}: { correctIndex, counts:[...] }                       // written after question closes

gameCodes/{code}: { gameId }        // lookup for joining; removed at game end
```

**Security-critical rule:** `correctIndex` lives only in Firestore (host-readable) and is read by Cloud Functions. It is **never** written to the public game node until the question closes, so players cannot cheat by inspecting network traffic.

### 8.4 Cloud Functions
| Function | Trigger | Purpose |
|---|---|---|
| `createGame` | HTTPS callable (host) | Verify ownership, generate unique 6-digit code, create game nodes |
| `joinGame` | HTTPS callable (anonymous player) | Validate code, lobby open, name unique and clean, cap at 60 players |
| `advanceGame` | HTTPS callable (host) | Move through phases: set `questionStartedAt = ServerValue.TIMESTAMP`, publish next question (without answer) |
| `submitAnswer` | HTTPS callable (player) | Reject if window closed or already answered; store choice with server timestamp |
| `closeQuestion` | Called by host client at timer end (plus scheduled fallback) | Score all answers, compute counts, write `results`, update scores, ranks, `prevRank` |
| `cleanupGames` | Scheduled (hourly) | Delete games ended over 24 hours ago |

`submitAnswer` records the arrival time and never scores. Scoring happens once in `closeQuestion` so all 50 players are ranked consistently by server timestamps.

### 8.5 Handling 40-50 concurrent players
- Each answer is a single small write; 50 writes per question is trivial for Realtime Database.
- Clients subscribe only to `state`, `publicQuestion`, their own `players/{uid}`, and `results/{currentQuestion}`. The host subscribes to the full `players` list.
- Leaderboard is computed once server-side and stored in `players/*/rank`, so clients don't recompute.
- Load test target: 60 simulated players answering within 1 second of each other.

### 8.6 Firebase Security Rules (outline)
- Players: read `state`, `publicQuestion`, `results`; read/write only **their own** `players/{uid}` name field at join (via function); cannot write `score`, `rank`, or `answers` directly.
- Hosts: read/write only games where `meta.hostUid == auth.uid`; only the owner can read/write their quizzes.
- Storage: only authenticated hosts can upload images (max 2 MB, image types only).

---

## 9. Suggested Project Structure

```
/quiz-game
  /apps
    /web                     # React app
      /src
        /pages
          /host   (Login, Dashboard, QuizEditor, Lobby, HostGame, Podium)
          /player (Join, Waiting, Answer, Feedback, MyRank, Final)
        /components  (Timer, AnswerButton, LeaderboardRow, PodiumBar, Mascot, Confetti)
        /hooks       (useGameState, useServerTime, usePlayer, useSound)
        /lib         (firebase.ts, scoring.ts, nicknameFilter.ts)
        /styles
  /functions                 # Cloud Functions (TypeScript)
  firebase.json
  database.rules.json
  firestore.rules
  storage.rules
```

---

## 10. Development Phases

| Phase | Deliverable | Est. |
|---|---|---|
| 1. Setup | Vite + React + TS + Tailwind, Firebase project, emulators, routing, design tokens | 1-2 days |
| 2. Host auth and quiz editor | Login, dashboard, create/edit/delete quiz, image upload | 3-4 days |
| 3. Game creation and lobby | `createGame`, code generation, join flow, player list, kick | 3 days |
| 4. Core gameplay | State machine, 10s synced timer, answering, `closeQuestion` scoring | 4-5 days |
| 5. Rankings and animations | Animated leaderboard, rank arrows, podium, confetti | 3-4 days |
| 6. Kid-friendly polish | Mascot, sounds, illustrations, copy, accessibility, responsive tuning | 3 days |
| 7. Safety and cleanup | Nickname filter, security rules, auto-deletion, privacy page | 2 days |
| 8. Testing and launch | Load test with 60 bots, cross-device testing, deploy to Firebase Hosting | 3 days |

Total: roughly **4-5 weeks** for one developer.

---

## 11. Testing Checklist

- [ ] Scoring: instant answer ≈1000, answer at 10s ≈500, wrong = 0, no answer = 0.
- [ ] Tie-break: two players with equal totals are ordered by earlier answer time.
- [ ] Late answer after the window closes is rejected; double-submit is ignored.
- [ ] Players cannot see `correctIndex` before the question closes (inspect network and DB).
- [ ] Timer stays within about 0.3s across devices, including with a wrong device clock.
- [ ] 60 simultaneous players join and answer without errors.
- [ ] Player who refreshes or loses connection can rejoin with the same nickname and keep their score.
- [ ] Host disconnect: game pauses and can be resumed when the host returns.
- [ ] Works on Chrome, Safari (iOS), and Android Chrome; works on a slow 4G connection.
- [ ] `prefers-reduced-motion` disables heavy animations.

---

## 12. Future Ideas (out of scope for v1)

- Excel/CSV quiz import, and public quiz library to share and duplicate quizzes.
- Team mode, self-paced homework mode.
- Extra question types (multiple correct, type-in answer, ordering).
- Multiple languages (English/Filipino).
- Player avatars chosen from a fixed safe set.
- Post-game reports per question (which items students struggled with).

---

## 13. Open Questions

1. Should the host screen be required (projector), or should a phone-only host mode also be supported?
2. Are quiz images needed in v1, or can they wait?
3. Do you want a preferred mascot or theme (animals, space, jungle)?
4. Should quizzes be private to each teacher, or is a shared library wanted soon?
