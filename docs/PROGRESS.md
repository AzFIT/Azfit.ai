## Done
- Nav fixes, /reset-password, breadcrumbs (da6c0ff)
- Client dashboard restructure: coach card, quick log, dedup (888efb8)
- Trainer dashboard: needs-attention strip, quick actions (b74140b)
- Real-time messaging via Supabase Realtime (30d7ead)
- Sessions table + booking requests + realtime (dfa953f)
- DB reconciliation: RLS fixes on category tables, program-library schema dump, notifications table
- Body Composition Assessments: skinfold_assessments table, JP3/JP7/Poliquin math, Katch-McArdle TDEE, BioPrint rebuild, trainer ClientProfile card (7398f5f)
- Workout Session Experience: DB-backed launcher, active session hook, phase breadcrumb chips, sticky summary bar with target volume, exercise cards with set logging, PB detection, rest timer, finish/summary modal (feature/session-experience)
- Auth/login flow fix: removed Supabase calls inside `onAuthStateChange` callback (fix/auth-hang, bb35d92), replaced self-referencing `profiles` RLS policy with `public.is_trainer()` SECURITY DEFINER function and made `Login.tsx` redirect wait for auth context (fix/login-flow, ac0684c)
- Foundation Sprint — test harness: Vitest + Playwright smoke tests, CI runs lint/typecheck/unit/e2e/build (foundation/sprint-1)
- Foundation Sprint — PWA activation: `registerServiceWorker()` called in `App.tsx` (foundation/sprint-1)
- Foundation Sprint — Sentry wiring: `@sentry/react` + `@sentry/vite-plugin`, runtime init gated by `VITE_SENTRY_DSN`, one-time dev test error, production ErrorBoundary (foundation/sprint-1)
- Foundation Sprint — product analytics: `posthog-js` + Plausible script injection, `useAnalytics()` hook for SPA pageviews (foundation/sprint-1)
- Foundation Sprint — brand consolidation: honest stats, unified AzFIT/AzTechFit story, removed fake "10,000+ athletes" claims, App Store/Google Play marked "Coming Soon", footer dead links cleaned (foundation/sprint-1)
- Foundation Sprint — environment documentation: comprehensive `.env.example` with dev/staging/prod strategy and all env vars (foundation/sprint-1)
- Foundation Sprint — RLS audit: static SQL checks for self-referencing policies, `is_trainer()` usage, missing ENABLE RLS; `docs/RLS-AUDIT.md` + `src/services/rlsAudit.test.ts` (4 tests) (foundation/sprint-1)
- PWA + footer fixes: register SW under `import.meta.env.BASE_URL`, make manifest paths relative, fix manifest link, remove dead footer links, keep Features/Pricing anchors + Exercise Library + GitHub (feat/pwa-footer-fixes)
- Progress Photos: Supabase Storage bucket `progress-photos` with folder-per-user RLS; page now uploads, lists, signs URLs, compares two selected photos, and deletes (feat/progress-photos)
- Check-in Forms + Habits schema: `check_in_forms`, `check_in_submissions`, `habits`, `habit_logs` tables with folder-per-user RLS using email-match and trainer ownership patterns (feat/checkins-schema)
- Check-in Forms UI: trainer form builder + client submission flow at `/check-ins`, demo seed data for trainer@azfit.demo/client@azfit.demo (feat/checkins-ui)
- Client management Supabase migration: QuickAddClientModal writes to `clients` table, Clients list loads from Supabase with edit/archive + legacy import banner, ClientProfile crash-guards bad/missing UUIDs (fix/clients-supabase)
- Habit tracker UI: `useHabits` hook + `HabitRow` component, client "My Habits" and trainer "Client Habits" sections on `/check-ins`, "Today's Habits" card on client dashboard; all data via Supabase, no localStorage (feat/habits-ui)
- Real client health grid: replaced `MOCK_HEALTH_GRID` with Supabase-backed `useClientHealth`, per-client RAG status from sessions/workout_logs/check-ins, real attention-strip counts, archive button default filter fix (feat/health-grid)
- Workout logger polish: RPE auto-adjust hints (≥9 drop/keep, ≤7 with target-rep hit increase), plate calculator under client load, rest-timer preset chips (0:30–5:00) with per-exercise in-memory last preset (feat/logger-polish)
- AI Chat Stage 1: chat logging (`chat_messages`, `chat_events`, `chat_feedback`), FAQ table, safety guards (crisis + medical), real-data responses for deload/analyze, removed fake apply actions, wired floating chat + Coach AI page (feat/ai-chat-stage1)
- AI Chat Stage 1B: guided weight/habit flows, thumbs feedback on assistant messages, role-aware quick chips in the bubble (feat/ai-chat-stage1b)
- Exercise swap engine: ranked substitution suggestions from the library (category/equipment/muscle/keyword scoring), wired into the session swap picker and AI chat fallback (feat/exercise-swap)

## Next
- Voice notes + push notifications
- Stripe payments (HUMAN GATE — needs founder approval)

## Deferred (mocks to wire later)
- Dashboard rings (steps/sleep/HRV) — manual entry, no wearables yet
- Check-in due card → currently links to /bioprint placeholder
- AI Chat Stage 2 (live edge function) — pending; Stage 1 uses real DB + local logic
- AI Insights panel, Revenue snapshot, Weekly metrics, Active Clients card — still mock data on trainer dashboard (noted for later phases)

## DB fixes
- workout_log_entries created live on 2026-07-17, matching schema.sql
- Recreated on_auth_user_created trigger live on 2026-07-17 — was missing; signups were getting no profiles row.

## Notes
- The `exercises` table does not have a `tempo` column yet; the session screen falls back to a default tempo of `3-0-1-0` and allows per-set edits. A schema change is deferred until a later phase.
