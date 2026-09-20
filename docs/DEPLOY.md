# Deploying Hootka

The backend always lives on Firebase. The frontend is a static site, so it can
go on Vercel or on Firebase Hosting - that choice changes nothing else.

## 1. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project.
2. **Authentication** → Sign-in method → enable **Email/Password**, **Google**,
   and **Anonymous**. Anonymous is what gives each player a secure UID without
   an account; without it nobody can join.
3. **Realtime Database** → create one. Note the region.
4. **Firestore Database** → create one.
5. **Storage** → create a bucket (only needed if you use question images).
6. Upgrade to the **Blaze** plan. Cloud Functions and the hourly cleanup job
   need it. A classroom's usage costs pennies, and you can set a budget alert.

Then point the repo at it:

```bash
# .firebaserc
{ "projects": { "default": "your-project-id" } }
```

## 2. Deploy the backend

Do this whichever host you pick. **The rules are the security model** - if you
skip them, your database is wide open or completely shut, depending on what the
console defaulted to.

```bash
npm install
firebase login
firebase deploy --only functions,database,firestore,storage
```

That ships the eight Cloud Functions, the Realtime Database rules, the Firestore
rules and indexes, and the Storage rules.

Confirm the functions landed:

```bash
firebase functions:list
# expect: advanceGame, cleanupGames, closeQuestion, createGame,
#         endGame, joinGame, kickPlayer, submitAnswer
```

## 3a. Frontend on Vercel

`vercel.json` in the repo root already sets the build for you. In the Vercel
dashboard:

- **Root Directory:** leave it at the repository root. Do *not* set it to
  `apps/web` - the build needs the npm workspace at the root to resolve
  `@hootka/core`.
- **Framework preset:** Vite (or Other; `vercel.json` overrides it either way).
- **Node version:** any supported version works. You will see
  `npm warn EBADENGINE` for `@hootka/functions`, which pins Node 20 because
  that is the Cloud Functions runtime. It is a warning about a package Vercel
  never builds, and it is safe to ignore.
- **Environment Variables** → add these seven, from Firebase console →
  ⚙ Project settings → Your apps → SDK setup and configuration:

  ```
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_DATABASE_URL
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  ```

  Do **not** set `VITE_USE_EMULATORS`.

None of these are secret - Vite bakes them into the JavaScript that every
visitor downloads, by design. Firebase security comes from the rules files, not
from hiding the config. But they are read at *build* time, so set them before
the first deploy or redeploy afterwards.

`vercel.json` rewrites every unmatched path to `index.html`. Without that,
`/play/<gameId>` would 404 on refresh, and refreshing to rejoin is something
players do constantly.

The build runs `npm run build:web` from the repo root rather than
`npm run build -w @hootka/web` from the workspace. npm only installs tool
binaries into the root `node_modules/.bin`, and running a workspace script
relies on npm walking up to that ancestor directory - which some npm versions
do not do, giving `sh: tsc: command not found`. A root script always gets the
root bin directory on PATH. For the same reason the Tailwind and PostCSS
configs resolve their paths relative to themselves rather than to
`process.cwd()`.

## 3b. Frontend on Firebase Hosting instead

```bash
npm run build -w @hootka/web
firebase deploy --only hosting
```

`firebase.json` already points at `apps/web/dist` with the same SPA rewrite.
For this path put the seven variables in `apps/web/.env.production.local`
rather than in a dashboard.

## 4. Authorize your domain (easy to miss)

Firebase console → **Authentication → Settings → Authorized domains** → add your
`*.vercel.app` domain and any custom domain.

Skip this and the teacher's "Continue with Google" button fails with
`auth/unauthorized-domain`. Email/password and the players' anonymous sign-in
are unaffected, so the game still works - which is exactly why this one is easy
to miss until a teacher complains.

Firebase Hosting domains are authorized automatically.

## 5. Check it end to end

1. Open the deployed site, sign in as a teacher, write a two-question quiz.
2. Press Play. A 6-digit code appears.
3. On a phone, join with that code and a nickname.
4. Run the questions through to the podium.
5. Download the CSV.

If players can join but never see a question, the Realtime Database rules did
not deploy. If nobody can join at all, Anonymous sign-in is off.

If the site shows **"Hootka is not configured yet"**, the build had no Firebase
environment variables - set them and redeploy. The page lists exactly which ones
are missing. It also appears when the database URL is set but malformed, which
is otherwise a silent blank page.

## Environment files, and which is loaded when

| File | Loaded in | Purpose |
|---|---|---|
| `apps/web/.env.development.local` | `npm run dev` only | Emulator config. Committed; holds no secrets. |
| `apps/web/.env.production.local` | production builds | Your real project, if you are not using a host's dashboard. Not committed. |
| `apps/web/.env.example` | never | The list of variables to copy. |

The emulator config is deliberately `.env.development.local` and not
`.env.local`: Vite loads `.env.local` in *every* mode, so a variable you forgot
to set in the dashboard would silently fall back to the emulator value and point
your production app at `127.0.0.1`.

## Cost

Realtime Database, Firestore and Auth stay inside the free tier for classroom
use. Blaze is required for Cloud Functions, but a game of 50 players makes
roughly 50 small writes and a handful of function calls per question. Set a
budget alert in Google Cloud if you want a hard floor under the worry.
