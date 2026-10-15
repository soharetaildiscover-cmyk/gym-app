# PIVOT (working name) — coach + athlete fitness app

Read `AGENTS.md` for Expo rules (SDK 57 — check versioned docs, never trust memory).

## What this is
- One Expo app (iOS, Android, web) with two sides: athlete (`src/app/(athlete)`) and coach (`src/app/(coach)`).
- Backend is Supabase only: Postgres + row-level security, Auth, Storage. No custom server.
- `prototype/PIVOT_Design.html` is the design and flow reference. Match its look (tokens in `src/theme.ts`) and its product decisions. Do not copy its code: it is a single-file, local-storage demo.
- The PRD and data model live in the "PIVOT v1 — PRD & Data Model" doc.

## The one rule
An athlete owns their data. A coach reads it only through an **active** coaching link
whose matching **scope** is switched on. This is enforced in the database by
`public.coach_can_see(athlete, scope)` inside RLS policies — never only in the UI.
Every new athlete-data table needs: `athlete_id`, RLS on, an "athlete owns" policy,
a "coach reads with <scope>" policy, and tests in `supabase/tests/permissions_test.sql`.

## Conventions
- Schema changes only as new files in `supabase/migrations/` (timestamped, never edit an applied one).
- Things that must be atomic or cross permissions (accept invite, assign program, review check-in) are `security definer` SQL functions called with `supabase.rpc`.
- Weights stored in kg, lengths in cm; convert for display only.
- Child rows carry `athlete_id` with a composite FK to the parent `(id, athlete_id)`, so RLS stays a simple column check.
- Logs written from the phone carry a `client_id` uuid so offline retries never duplicate.
- UI: build screens from `src/components/ui.tsx`. Acid = the one primary action; gold = anything the coach owns; red = pain/errors.
- Copy is plain, short and honest. Unbuilt features show a `ComingSoon` card naming the phase, never fake data.

## Commands
- `npm start` — dev server (Expo Go on a phone, or `w` for web)
- `npm run typecheck`
- `npm run db:test` — applies all migrations to a throwaway local Postgres and runs the permission tests (needs Postgres binaries; must not run as root)
- Install packages with `npx expo install <pkg>` (offline fallback: `EXPO_OFFLINE=1`).
