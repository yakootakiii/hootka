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

- **Root Directory:** the repository root. It must NOT be `apps/web`: the
  serverless routes live in `/api` at the root and import shared game logic
  from `/packages/core`, and Vercel only deploys files inside the root
  directory.
- **Framework preset:** Vite (or Other; `vercel.json` overrides it either way).
- **Node version:** any supported version works. You will see
  `npm warn EBADENGINE` for `@hootka/functions`, which pins Node 20 because
  that is the Cloud Functions runtime. It is a warning about a package Vercel
  never builds, and it is safe to ignore.
- **Environment Variables** → click **Import** and upload
  `apps/web/.env.production.local`, which you fill in first:

  ```bash
  cp apps/web/.env.example apps/web/.env.production.local
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

### If the build fails to find its tools

Two failures are possible here, and both come from the same place. npm installs
tool binaries only into the **root** `node_modules/.bin` - `apps/web/node_modules/.bin`
does not exist at all - so anything that relies on npm putting an ancestor bin
directory on PATH is fragile, and npm 11 on Vercel does not do it.

The repo now avoids the problem from both directions:

- every workspace script calls its tool through `npx`, which finds the binary by
  walking up `node_modules` rather than by reading PATH;
- `npm run build` means "build the web app" in the repo root *and* in
  `apps/web`, so it works wherever Vercel runs it;
- there is a `vercel.json` in both places, and Vercel reads whichever one sits
  in your configured Root Directory.

So either Root Directory works. If you want to be deliberate, `apps/web` is the
conventional choice for a monorepo and is what Vercel usually auto-detects;
leave the Build Command field in the dashboard **empty** so `vercel.json`
decides, rather than pinning a command that only works in one directory.

For the same reason the Tailwind and PostCSS configs resolve their paths
relative to themselves rather than to `process.cwd()`.

## 3b. Frontend on Firebase Hosting instead

```bash
npm run build -w @hootka/web
firebase deploy --only hosting
```

`firebase.json` already points at `apps/web/dist` with the same SPA rewrite.
For this path put the seven variables in `apps/web/.env.production.local`
rather than in a dashboard.

## The server routes

`/api/*.ts` are Vercel serverless functions - one per operation, sharing the
game logic in `/api/_lib/game.ts`. They are same-origin with the app, so there
is no CORS to configure, and the browser sends its Firebase ID token as a
bearer token which each route verifies with the Admin SDK.

Two of them are worth knowing about:

- `submitAnswer` records a choice with a server timestamp and never scores.
  `closeQuestion` scores every player at once, so all 50 are judged against the
  same clock.
- `cleanupGames` replaces the scheduled Cloud Function. `vercel.json` runs it
  daily at 03:00 UTC and Vercel sends `CRON_SECRET` as a bearer token; nothing
  else can trigger a bulk delete.

**Function region.** On Vercel's Hobby plan the routes run in one region,
usually `iad1` (US East), while the Realtime Database is in `asia-southeast1`.
Every route reads or writes the game node, so each call crosses the Pacific.
It works, but if games feel sluggish, set the region under Project Settings ->
Functions to the one nearest your database.

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
