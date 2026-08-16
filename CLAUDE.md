# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                # Expo dev server (dev client); press w / i / a
npm run web              # web only — the fastest way to see a change
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm test                 # vitest: pure logic (src/**/*.test.ts + supabase/functions/**/*.test.ts)
npm run test:ui          # jest + RNTL: components (src/**/*.test.tsx)
```

Single test:

```bash
npx vitest run src/lib/__tests__/csv.test.ts
npx jest src/components/ui/auto-growing-text-input.test.tsx
```

CI (`.github/workflows/ci.yml`) runs `typecheck`, `lint`, and `test` — **not** `test:ui`.

### Two test suites, split by file extension

`jest.config.js` matches `*.test.tsx`, `vitest.config.ts` matches `*.test.ts`. The globs are
deliberately disjoint; keep them that way. Pure logic belongs in `src/lib/` with a `.test.ts`
under `src/lib/__tests__/` — the house pattern is to extract the tricky decision into a pure
function taking explicit arguments (see `label-origin.ts`, `function-url.ts`, `scheduler.ts`)
rather than test around module-level env reads.

`supabase/functions/` is excluded from `tsconfig.json` (it's Deno) but its `.test.ts` files
**are** run by vitest.

## Architecture

### Routing and the auth gate

Expo Router, file-based, rooted at `src/app`. Two groups: `(auth)/` (sign-in, pending) and
`(app)/` (everything behind approval). `src/app/_layout.tsx` owns the gate and is the one file
to read before touching startup:

- `routeSettled` is **derived, not state** — the overlay lifts only once the current route
  agrees with the auth state, so no frame ever shows the wrong screen mid-redirect.
- `settled = themeRestored && routeSettled` also drives removal of the static splash injected
  by `public/index.html` (`#gentoo-static-splash`, `z-index: 2147483647`). `themeRestored`
  flips inside a `requestAnimationFrame`, so in a **hidden/background tab rAF never fires and
  the splash never lifts** — expected, and it clears on focus. Worth knowing before diagnosing
  "the web app is unclickable" in a headless browser.

`src/lib/nav-items.ts` is the single source of truth for navigation; `responsive-shell.tsx`
renders sidebar (tablet/desktop web) or bottom tabs + drawer (phone) from it.

### Data layer: every query branches on demo mode first

Each hook in `src/lib/queries/*` is written as:

```ts
queryFn: async () => {
  if (isDemoMode()) return demoProjects();
  // ...supabase
}
```

`src/lib/demo.ts` is a complete offline workspace (seeded fixtures in AsyncStorage) — the app
is fully usable with no backend. Enable it from the sign-in screen's email/password form, or
by setting the `gentoo.demo.enabled.v1` AsyncStorage key to `'true'` and reloading.

`isDemoMode()` reads a **mutable module global** set asynchronously by `initDemoAuth()`. Two
consequences:

- Render logic must not call it. The React Compiler is enabled and memoizes on the assumption
  of purity; a cached stale `false` wedges the sign-in flow. `auth.tsx` exposes it as React
  state (`isDemo`) for that reason. Effects and callbacks may call it directly.
- Screens mounted before `initDemoAuth()` resolves fire their queries against Supabase and
  cache empty results. `auth.tsx` recovers with `queryClient.resetQueries()` (not `clear()`,
  which strands active observers).

### Unconfigured builds are a supported state

`EXPO_PUBLIC_*` values are inlined at export time, so a build made without them launches and
shows "Backend not configured" rather than crashing. `isSupabaseConfigured` gates real usage;
`supabase.ts` falls back to placeholder credentials so imports never throw.

When building a URL from `SUPABASE_URL`, go through `functionUrl()` (`src/lib/function-url.ts`).
Interpolating an empty `SUPABASE_URL` yields a *relative* `/functions/v1/...`, which resolves
against the app's own origin — where the SPA fallback answers **200 with index.html**, so the
fetch appears to succeed and only fails inside `res.json()`.

`scripts/check-public-env.js` runs before every web export and fails the build rather than
shipping a dead bundle.

### Mutations and cache coherence

- Optimistic updates: pure cache-shape edits in `src/lib/optimistic-patch.ts` (always return a
  new array/object, or the *same reference* when nothing matched — that's the "nothing to undo"
  signal), driven by cancel/snapshot/rollback in `src/lib/queries/optimistic.ts`. Query keys are
  matched by **prefix**, so one entry covers every `['project', <id>]` in the cache.
- Realtime: `src/lib/use-database-realtime.ts` runs one app-level Supabase channel and maps each
  table to the query-key roots it invalidates, batched so a bulk import refetches each family
  once. **Adding a table means adding it to `REALTIME_QUERY_ROOTS`** or its screens go stale.

### Styling

NativeWind v4 (`className`) with `tailwind.config.js`; design-system primitives in
`src/components/ui/`. Dark mode is `darkMode: 'class'`, which has no media-query fallback, so
`theme-mode.ts` resolves `'system'` to the actual OS scheme itself on web.

React Native 0.85: `pointerEvents` goes in `style`, **not** as a prop (the prop is deprecated).
The whole codebase was migrated in 24dc64e — don't reintroduce the prop form.

## Backend

`supabase/migrations/` runs in filename order (see `supabase/README.md`). Note two files share
the `0012` prefix (`0012_discord_task_pings`, `0012_event_data`); they're independent, so order
between them doesn't matter — but don't renumber applied migrations.

Edge functions: `send-push` (Expo push) and `downloads` (lists installers and 302s to signed
GitHub asset URLs; deployed `--no-verify-jwt` so plain `<a>` links work).

The `kowalski/` directory is a Python Discord bot sharing the same Supabase project. It is
currently untracked by git.
