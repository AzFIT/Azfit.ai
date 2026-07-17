## Done
- Nav fixes, /reset-password, breadcrumbs (da6c0ff)
- Client dashboard restructure: coach card, quick log, dedup (888efb8)
- Trainer dashboard: needs-attention strip, quick actions (b74140b)
- Real-time messaging via Supabase Realtime (30d7ead)
- Sessions table + booking requests + realtime (dfa953f)
- DB reconciliation: RLS fixes on category tables, program-library schema dump, notifications table
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
