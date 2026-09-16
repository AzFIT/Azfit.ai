# ai-chat edge function (Phase 97a)

AI proxy for the quick-log chat (and future AI surfaces). The trainer's
provider key never touches client JS: this function reads `ai_config`
with the service role (the table has **zero RLS policies** — only the
service role can read it) and calls the provider's OpenAI-compatible
`/chat/completions`.

- Trainer caller → own `ai_config` row.
- Client caller → **their trainer's** row (quick-log is a
  trainer-provided perk; spend is the trainer's own key — no quota
  layer this phase, documented as future).
- Never returns the key; provider errors pass through sanitized (502).
- `verify_jwt=true` (the Supabase default) — unauthenticated calls are
  rejected at the gateway.

## Deploy (one-time, manual — same as send-push)

```bash
# from the repo root, with the Supabase CLI linked to project gcurvjprfwecbchreieu
supabase functions deploy ai-chat
# confirm verify_jwt is ON for ai-chat in the dashboard (Edge Functions → ai-chat → Settings)
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
auto-provided — no secrets to set.

## Test after deploy

1. Trainer: Settings → AI Assistant → paste a real key → "Key saved".
2. Client (or trainer): AI Log → type `weight 78.5 kg` → confirm row in
   `body_composition`.
3. With a deliberately wrong key: chat shows an honest provider-error
   bubble (and falls back to on-device parsing for that message).

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-chat" \
  -H "Authorization: Bearer $USER_JWT" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"weight 78.5 kg"}],"json":true}'
```
