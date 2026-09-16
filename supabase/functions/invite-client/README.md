# invite-client edge function (Phase 99a)

Trainer-authorized client invitation. Only the **service role** may create
auth users (`auth.admin.inviteUserByEmail`) — client JS never holds it — so
the invite flows through this function, which validates the
caller→client relationship before spending the privilege. It also stamps
`clients.invited_at` (the UI's single source of invite state), so client
code holds no write path for it.

## Contract

`POST { client_id }` with an authenticated trainer JWT.

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ ok: true, invited_at }` | invite sent + stamped (`invited_at` is `null` only if the stamp itself failed after a successful send — the UI should refresh) |
| 200 | `{ ok: false, code: "already_has_account" }` | a `profiles` row exists for that email (or GoTrue says already registered) — the client can log in already; **not an error**, the UI hides Invite |
| 400 | `{ error }` | missing `client_id`, or the client row has no email |
| 401 | `{ error: "Unauthorized" }` | bad/missing JWT (`verify_jwt=true` at the gateway rejects first) |
| 403 | `{ error }` | caller is not a trainer, or the client belongs to another trainer |
| 404 | `{ error }` | unknown client row |
| 409 | `{ error, retry_after_s }` | invited within the last 24h — re-invite allowed after |

Email matching is `ilike` both sides: Supabase lowercases auth emails while
the `clients` row may hold the original casing (permanent gotcha).

Idempotency: the 24h `invited_at` check runs **before** any auth call, so a
duplicate within the window never sends a second magic link.

## Deploy (one-time, manual — the verifier deploys via MCP after gates pass)

```bash
# from the repo root, with the Supabase CLI linked to project gcurvjprfwecbchreieu
supabase functions deploy invite-client --project-ref gcurvjprfwecbchreieu
# confirm verify_jwt is ON for invite-client (Edge Functions → invite-client → Settings)
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
auto-provided — no secrets to set.

## Test after deploy

1. Trainer: a client profile with an email and no account → **Invite** →
   "Invitation sent" toast; the button becomes "Invited ✓ · resend
   tomorrow" (disabled). `clients.invited_at` is set (SQL-checkable).
2. Re-invite within 24h → 409 (the UI's disabled state prevents this path
   in normal use).
3. After 24h (or with a stale `invited_at`) → **Resend invite** works.
4. Client with an existing account → no Invite button at all.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/invite-client" \
  -H "Authorization: Bearer $TRAINER_JWT" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "00000000-0000-0000-0000-000000000000"}'
```
