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
- PWA + footer fixes: register SW under `import.meta.env.BASE_URL`, make manifest paths relative, fix manifest link, remove dead footer links, keep Features/Pricing anchors + Exercise Library + GitHub (feat/pwa-footer-fixes)
## Next
- Check-in forms + habit tracking (Phase 5)
- Voice notes + push notifications
- Stripe payments (HUMAN GATE — needs founder approval)
## Deferred (mocks to wire later)
- Dashboard rings (steps/sleep/HRV) — manual entry, no wearables yet
- Check-in due card → currently links to /bioprint placeholder
- AI pages (CoachAI, AIProgramBuilder) — local logic, no edge function
- Storage bucket for progress photos

## DB fixes
- workout_log_entries created live on 2026-07-17, matching schema.sql
- Recreated on_auth_user_created trigger live on 2026-07-17 — was missing; signups were getting no profiles row.

## Notes
- The `exercises` table does not have a `tempo` column yet; the session screen falls back to a default tempo of `3-0-1-0` and allows per-set edits. A schema change is deferred until a later phase.
