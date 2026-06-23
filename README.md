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
npm start          # then press w (web), i (iOS), a (Android)
```

### Useful scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run web` / `ios` / `android` | Start on a specific platform |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run Expo lint |

## Project structure

```
src/
  app/            # Expo Router routes (file-based)
    (app)/        # authenticated app shell + feature screens
  components/
    ui/           # design-system primitives (Text, Button, Card, …)
  lib/            # utils, theme, navigation config, hooks
```

> Backend setup (Supabase project, Google OAuth, push) is documented in later phases as those
> features land.
