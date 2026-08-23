# Gentoo — FTC Team Hub

A cross-platform (iOS / Android / web) app for running a FIRST Tech Challenge team's
in-season operations: projects, parts inventory, scouting, pit-duty scheduling, and
account approval.

Built with **Expo Router**, **NativeWind** + **React Native Reusables**, and **Supabase**.

## Features

- **Projects & tasks** — projects containing assignable tasks (status, assignee, due date,
  priority, tags, blockers, notes), reorderable, with a trash you can restore from.
- **Inventory** — parts catalogue with categories, photos, check-out tracking, low-stock
  flags, and printable labels.
- **Scouting suite** — pit scouting with weighted capability scoring, match-scouting
  assignments and schedule import, and "talkie" pit-intel requests.
- **Picklist** — tiered alliance-selection board with weighted scores and a head-to-head
  compare view for settling a pair during the pick meeting.
- **Competition dashboard** — event-day view: next-match countdown, your pit shifts, and
  open talkie requests.
- **Pit-duty scheduler** — auto-generated, fair rotations for staffing the pit at competition.
- **Cables** — photo-based wiring inventory: a Groq vision model counts the parts in a
  picture of the wiring bin (needs `EXPO_PUBLIC_GROQ_API_KEY`).
- **Accounts** — Apple, Google, and email/password sign-in; the first account becomes admin
  and approves everyone else.
- **Notifications** — in-app realtime + push (Expo) for talkie pings, task assignments, and
  scouting submissions, optionally mirrored into Discord (Settings → Discord to link).

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm start              # then press w (web), i (iOS), a (Android)
```

> **Backend required.** The app needs a Supabase project for auth and data. Follow
> [`supabase/README.md`](supabase/README.md) to create the project, run the migrations in
> `supabase/migrations/` (in order), enable Apple and Google sign-in, and optionally deploy
> the `send-push` and `downloads` Edge Functions. Without credentials the app runs in a
> read-only "not configured" state with setup guidance on the sign-in screen.

### Useful scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run web` / `ios` / `android` | Start on a specific platform |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run Expo lint |
| `npm test` | Run the vitest unit suite (`src/lib/__tests__/`) |
| `npm run test:ui` | Run the jest + React Native Testing Library component tests |
| `npm run export:web` | Export the static web bundle (checks `EXPO_PUBLIC_*` first) |
| `npm run release:all` | Build iOS (upload by hand), build the Android APK, collect artifacts |

> **`release:all` runs anywhere.** Each platform picks the toolchain the machine
> can actually run, so a release works from a Mac or from Linux:
>
> - **iOS** — a local Xcode build on macOS; EAS's macOS workers elsewhere, since
>   Xcode is macOS-only. A local build stops at `ios-build/Gentoo.ipa` and you
>   upload it with [Transporter](https://apps.apple.com/app/transporter/id1450874784),
>   which avoids EAS's submitter queue (often slower than the build itself).
>   `SUBMIT=1 npm run ios:publish` submits through EAS instead. Off macOS there
>   is no Transporter, so the EAS route submits to TestFlight for you.
> - **Android** — a local Gradle build when a JDK 17/21 and the Android SDK are
>   installed; otherwise EAS, and the finished APK is downloaded to
>   `android-build/` so `release:collect` still finds it.
>
> Force a specific route with `ios:publish` / `ios:publish:cloud` and
> `android:apk` / `android:apk:cloud`. Cloud builds need `eas login` and consume
> build credits.

> **The export bakes in the environment.** `EXPO_PUBLIC_*` values are inlined
> when the web bundle is exported, so a build made without `.env` (or without
> those vars on the build host) runs fine but shows "Backend not configured" on
> launch. Every export and every `eas update` runs `scripts/check-public-env.js`
> first and fails with a fix-it message rather than shipping a dead app. `eas
> build` is the exception: it uploads the project without gitignored files, so
> `.env` never reaches the builder — set the values as EAS secrets instead.

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
  app/                   # Expo Router routes (file-based)
    (auth)/              # sign-in + awaiting-approval screens
    (app)/               # authenticated shell + features
      projects/          # projects, their tasks, and the trash
      inventory/         # parts list + part detail
      scouting/          # hub, pit/, matches/, questions.tsx
      picklist/          # tiered alliance-selection board
      competition.tsx    # event-day dashboard
      schedule.tsx       # pit-duty scheduler
      talkie.tsx         # pit-intel requests
      cables.tsx         # photo wiring count (Groq vision)
      admin.tsx, notifications.tsx, downloads.tsx, settings.tsx
  components/
    ui/                  # design-system primitives (Text, Button, Card, …)
    responsive-shell.tsx # sidebar/tab shell + navigation chrome
    facemash.tsx         # head-to-head picklist comparison
  lib/
    auth.tsx, supabase.ts, notify.ts, push.ts
    apple-auth.ts, google-auth.ts    # google-auth.web.ts on web
    scoring.ts           # weighted pick-list score
    scheduler.ts         # fair pit-duty rotation
    nav-items.ts         # single source of truth for navigation
    api/ftcscout.ts      # official event/team stats
    queries/             # TanStack Query hooks per domain
    __tests__/           # vitest unit tests for the pure lib modules
supabase/
  migrations/            # 0001… — run in filename order
  functions/send-push/   # Expo push Edge Function
  functions/downloads/   # installer list + signed GitHub asset redirects
```

The UI is responsive: a sidebar + multi-column layout on tablet/desktop web, and bottom
tabs + single column on phones. Light/dark themes follow the device (toggle in Settings).
