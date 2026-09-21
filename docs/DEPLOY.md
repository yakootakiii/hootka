# Deploying Hootka

The backend always lives on Firebase. The frontend is a static site, so it can
go on Vercel or on Firebase Hosting - that choice changes nothing else.

## 1. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project.
2. **Authentication** → Sign-in method → enable **Email/Password**, **Google**,
   and **Anonymous**.

   **Anonymous is not optional.** It is what gives each player a secure UID
   without an account. With it off, the join screen accepts a game code and a
   nickname and then the "Let's go!" button stays disabled, because the player
   never gets an identity to join with. The screen now says so, but it is easy
   to miss when enabling the other two.
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

## 2. Deploy the rules

There are no Cloud Functions in this project - the server logic runs as Vercel
serverless routes in `/api`. Firebase still provides Auth, Firestore, the
Realtime Database and Storage, and **the rules are the security model**: skip
them and your database is wide open or completely shut, depending on what the
console defaulted to.

```bash
npm install
firebase login
firebase deploy --only firestore,database,storage --project <your-project>
```

This needs no billing plan. The Spark (free) tier is enough for everything
Hootka uses on Firebase.

## 3a. Frontend on Vercel

`vercel.json` in the repo root already sets the build for you. In the Vercel
dashboard:

- **Root Directory:** leave it alone. The project is a single package at the
  repository root, so there is no workspace for Vercel to auto-select and
  nothing to configure. (It used to be a monorepo, and Vercel kept picking
  `apps/web` as the root, which left the `/api` routes undeployed.)
- **Framework preset:** Vite.
- **Build Command / Output Directory: leave both EMPTY.** A value typed into
  either field overrides `vercel.json` silently, and the two then disagree -
  which shows up as "No Output Directory named 'dist' found after the Build
  completed" even though the build clearly succeeded. If you have ever typed a
  command into those fields, clear them.
- **Node version:** any supported version works. You will see
  `npm warn EBADENGINE` for `@hootka/functions`, which pins Node 20 because
  that is the Cloud Functions runtime. It is a warning about a package Vercel
  never builds, and it is safe to ignore.
- **Environment Variables** → click **Import** and upload
  `.env.production.local`, which you fill in first:

  ```bash
  cp .env.example .env.production.local
  # then edit it - each key says where in the Firebase console to find it
  ```

  The file is gitignored, so it stays on your machine. Filling it in also lets
  you run a real production build locally with `npm run build`.

  Five keys are required: `API_KEY`, `AUTH_DOMAIN`, `DATABASE_URL`,
  `PROJECT_ID`, `APP_ID`. `STORAGE_BUCKET` matters only if you attach images to
  questions, and `MESSAGING_SENDER_ID` is unused by Hootka.

  Do **not** add `VITE_USE_EMULATORS`.

None of these are secret - Vite bakes them into the JavaScript that every
visitor downloads, by design. Firebase security comes from the rules files, not
from hiding the config. But they are read at *build* time, so set them before
the first deploy or redeploy afterwards.

`vercel.json` rewrites every unmatched path to `index.html`. Without that,
`/play/<gameId>` would 404 on refresh, and refreshing to rejoin is something
players do constantly.

### Layout

The repo is deliberately a single package at the root: `src` is the app,
`src/core` the shared game rules, `api` the serverless routes. It was a
monorepo (`apps/web` + `packages/core`), but Vercel auto-detects npm workspaces
and kept selecting `apps/web` as the Root Directory, which silently left the
`/api` routes out of the deployment. With one package there is nothing to
auto-select.

`vercel.json` sets the build and output, and every path in it is relative to
the repository root. If a deploy ever fails with "No Output Directory named
'dist' found", check whether a Build Command or Output Directory has been typed
into the dashboard - those override `vercel.json`.

## 3b. Firebase Hosting?

Not supported any more. The server logic runs as Vercel serverless routes in
`/api`, which Firebase Hosting cannot serve: you would get the front end and
every game action would fail.

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
| `.env.development.local` | `npm run dev` only | Emulator config. Committed; holds no secrets. |
| `.env.production.local` | production builds | Your real project, if you are not using a host's dashboard. Not committed. |
| `.env.example` | never | The list of variables to copy. |

The emulator config is deliberately `.env.development.local` and not
`.env.local`: Vite loads `.env.local` in *every* mode, so a variable you forgot
to set in the dashboard would silently fall back to the emulator value and point
your production app at `127.0.0.1`.

## Cost

Realtime Database, Firestore and Auth stay inside the free tier for classroom
use. Blaze is required for Cloud Functions, but a game of 50 players makes
roughly 50 small writes and a handful of function calls per question. Set a
budget alert in Google Cloud if you want a hard floor under the worry.
