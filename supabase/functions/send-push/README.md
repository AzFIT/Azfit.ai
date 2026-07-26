# send-push edge function (Phase 24A)

Sends a web push notification to every subscribed device of a given user.
Phase 24A restricts callers to sending to **themselves** (test path);
automatic triggers (new message, check-in due, workout assigned) are Phase 24B.

## Deploy (do NOT run from CI yet — one-time manual deploy)

```bash
# from the repo root, with the Supabase CLI linked to project gcurvjprfwecbchreieu
supabase functions deploy send-push
```

## Secrets (set BEFORE first real send)

The VAPID **private** key must never be committed. It currently lives only in
your local `.env.local` (gitignored). The public key is already committed
(`.env.example`, `.github/workflows/deploy.yml`).

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BNsM4mJsBn93S3XntG3QAsCl5NTWlP4HPY0DfSiAsaLMa4BlXr8tZjwKPJx8w6Y-6YB9bMscyDSuBZNl2Ac2AFo \
  VAPID_PRIVATE_KEY=<from .env.local> \
  VAPID_SUBJECT=mailto:admin@azfit.ai
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
auto-provided to edge functions by Supabase — nothing to set.

## Test after deploy

1. Sign in on the deployed site → Settings → enable Push Notifications.
2. Click "Send test" — expect a toast with `{ sent, failed, pruned }` and a
   system notification titled "AzFIT" ("Push is working!").
3. Clicking the notification focuses the app (or opens `/#/dashboard`).

Or via curl:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "Authorization: Bearer <user access token>" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<your profile id>","title":"AzFIT","body":"Push is working!","url":"/#/dashboard"}'
```
