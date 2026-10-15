# PIVOT (working name)

A coaching app where a coach and their athletes work from one shared, live record of training, food, progress and check-ins — and the athlete decides exactly what the coach can see.

- **App:** Expo (React Native + TypeScript, Expo Router) — iOS, Android and web from one codebase
- **Backend:** Supabase — Postgres with row-level security, Auth, Storage
- **Design reference:** [`prototype/PIVOT_Design.html`](prototype/PIVOT_Design.html)

## Status

| Phase | What | State |
| --- | --- | --- |
| 1 · Foundation | Schema + permission rules, sign-in, onboarding, athlete/coach tabs | ✅ built and live on the `gym-app-dev` Supabase project |
| 2 · Coach connect | Invites, links, sharing scopes, roster | ✅ built |
| 3 · Training | Exercise library, program builder, assign, workout logging | next |
| 4 · Nutrition and progress | Food, targets, water, measurements, photos | |
| 5 · Check-ins and communication | Check-ins, feedback, pain reports, chat, reminders, push | |
| 6 · Beta, then launch | TestFlight / Play internal testing with real coaches | |

## Database

All tables, permission rules and starter data are in `supabase/migrations/`, applied in file order:

1. `…0100_core.sql` — profiles, coach profiles, invites, coaching links, `coach_can_see()`
2. `…0200_training.sql` — exercises, program templates, assignments, workout sessions, sets
3. `…0300_nutrition_progress.sql` — foods, meals, water, targets, measurements, photos
4. `…0400_checkins_comms.sql` — check-ins, feedback, recovery, pain reports, reminders, messages, notifications
5. `…0500_storage.sql` — private photo buckets and their access rules
6. `…0600_library_seed.sql` — 48 exercises and a starter food list
7. `…0700_function_grants.sql` — locks the database functions to signed-in users (from Supabase's security advisor)

`npm run db:test` runs every migration on a throwaway local Postgres and checks 56 permission rules — for example: a coach sees workouts only when Training is shared, sees nothing while coaching is paused, cannot widen sharing, and loses all access when coaching ends, while the athlete keeps their history.

## Run it

```bash
npm install
npm start        # scan the QR code with Expo Go on your phone, or press w for web
```

For development, turn off **Authentication → Sign In / Providers → Email → Confirm email** in the Supabase dashboard so new test accounts can sign in immediately.
