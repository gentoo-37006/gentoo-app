# Gentoo — FTC Team Hub

A cross-platform (iOS / Android / web) app for running a FIRST Tech Challenge team's
in-season operations: scouting, task management, pit-duty scheduling, and account approval.

Built with **Expo Router**, **NativeWind** + **React Native Reusables**, and **Supabase**.

## Features

- **Scouting suite** — pit scouting with weighted capability scoring, match-scouting
  assignments, "talkie" pit-intel requests, and pick-list meeting tooling.
- **Tasks** — projects containing assignable tasks (status, assignee, due date, priority, tags).
- **Pit-duty scheduler** — auto-generated, fair rotations for staffing the pit at competition.
- **Accounts** — Google sign-in; the first account becomes admin and approves everyone else.
- **Notifications** — in-app realtime + push (Expo) for talkie pings and scouting submissions.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm start              # then press w (web), i (iOS), a (Android)
```

> **Backend required.** The app needs a Supabase project for auth and data. Follow
> [`supabase/README.md`](supabase/README.md) to create the project, run the migrations in
> `supabase/migrations/` (in order), enable Google sign-in, and optionally deploy the
> `send-push` Edge Function. Without credentials the app runs in a read-only "not configured"
> state with setup guidance on the sign-in screen.

### Useful scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run web` / `ios` / `android` | Start on a specific platform |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run Expo lint |
| `npm run mac:preview` | Build the web bundle and open it in the desktop shell |

> **Desktop builds bake in the environment.** `EXPO_PUBLIC_*` values are inlined
> when the web bundle is exported, so a desktop build made without `.env` (or
> without those vars on the build host) installs fine but shows "Backend not
> configured" on launch. Every export runs `scripts/check-public-env.js` first
> and fails with a fix-it message rather than shipping a dead app.

## Render deploys

The web app is exported as static files, so `EXPO_PUBLIC_*` values are baked into
the bundle during the Render build. Configure these environment variables on
both Render services before deploying:

- `gentoo-web`
- `gentoo-web-nightly`

Required variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Optional variable:

- `EXPO_PUBLIC_GROQ_API_KEY`

In Render, open the service, go to **Environment**, add the values from your
Supabase project settings, save, and redeploy. GitHub Actions secrets are used
for desktop builds only; the nightly web deploy runs inside Render and cannot
see those GitHub secrets.

## Project structure

```
src/
  app/                 # Expo Router routes (file-based)
    (auth)/            # sign-in + awaiting-approval screens
    (app)/             # authenticated shell + features
      scouting/        # hub, pit/, matches/, picklist/
      tasks/           # projects + tasks
      schedule.tsx     # pit-duty scheduler
      admin.tsx, notifications.tsx, settings.tsx
  components/
    ui/                # design-system primitives (Text, Button, Card, …)
    responsive-shell.tsx
  lib/
    auth.tsx, supabase.ts, notify.ts, push.ts
    scoring.ts         # weighted pick-list score
    scheduler.ts       # fair pit-duty rotation
    queries/           # TanStack Query hooks per domain
supabase/
  migrations/          # 0001…0008 — run in order
  functions/send-push/ # Expo push Edge Function
```

The UI is responsive: a sidebar + multi-column layout on tablet/desktop web, and bottom
tabs + single column on phones. Light/dark themes follow the device (toggle in Settings).
