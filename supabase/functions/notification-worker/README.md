# notification-worker edge function (Phase 95)

Scheduled evaluator for the five notification triggers. Reads
`public.notification_due_alerts()` (due-alerts SQL function, applied via
`supabase/notification-triggers-95.sql`), logs each event into
`notification_log` (UNIQUE `(user_id, type, ref_key)` — idempotent), and
sends web pushes for sendable rows. Suppressed rows (`type_disabled`,
`quiet_hours`) are logged with `sent_at NULL` and never sent.

## Auth model

`verify_jwt=false` + `x-cron-key` header matching the `CRON_KEY` secret.
A pure-cron HTTP call cannot use `send-push` (its `verify_jwt=true`
gateway rejects non-JWT callers; new-format `sb_secret_…` service keys
are not JWTs), so this worker holds the VAPID secrets and sends directly.

## Deploy (owner action — no SUPABASE_ACCESS_TOKEN on the build machine)

```bash
supabase functions deploy notification-worker
```

## Secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BNsM4mJsBn93S3XntG3QAsCl5NTWlP4HPY0DfSiAsaLMa4BlXr8tZjwKPJx8w6Y-6YB9bMscyDSuBZNl2Ac2AFo \
  VAPID_PRIVATE_KEY=<from .env.local> \
  VAPID_SUBJECT=mailto:admin@azfit.ai \
  CRON_KEY=<random long string>
```

## Schedule (Supabase dashboard — Database → Cron, or pg_cron if enabled)

Every 15 minutes, POST with the cron key:

```sql
select net.http_post(
  url := '<SUPABASE_URL>/functions/v1/notification-worker',
  headers := jsonb_build_object(
    'x-cron-key', '<CRON_KEY>',
    'Content-Type', 'application/json'),
  body := '{}'::jsonb
);
```

**First-run backlog caveat:** existing stale `scheduled` sessions and
unsubmitted check-ins are legitimately "due" the first time the worker
runs — those alerts fire once, then never again (idempotency log). If a
soft launch is preferred, clean up stale demo data first or temporarily
disable the schedule and inspect
`select * from notification_due_alerts();` as service role.

## send-push (Phase 95 changes)

`send-push` now also allows: the target's own trainer (clients.trainer_id
join, lower-cased emails) and self-send; arbitrary user→user stays 403.
When `payload.type` is a notification type, the target's prefs toggle +
quiet hours are enforced at send time (200 `{suppressed:true, reason}`).
Redeploy after pulling:

```bash
supabase functions deploy send-push
```
