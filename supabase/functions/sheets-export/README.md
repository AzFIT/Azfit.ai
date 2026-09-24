# sheets-export — Phase 98a (+ OAUTH-1 auth model)

Trainer-authorized Google Sheets export. The app invokes this function
with the trainer's JWT; the Google credential is a Supabase secret —
**never in the repo, never client-side**.

## Google auth (OAUTH-1)

**Why OAuth:** service accounts have **zero Drive storage quota**
(Google's own API verdict). sheets-export currently survives on the SA
only because it writes rows into an existing spreadsheet; any future
file creation would hit the same wall plan-export did. The durable fix
is an OAuth 2.0 refresh token for the owner's Google account
(`azwarhktrl@gmail.com`), so exports act AS the owner.

**Runtime model (not a flag day):**

| Secrets | Auth path |
|---|---|
| `GOOGLE_OAUTH_REFRESH_TOKEN` + `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` all set | **OAuth refresh grant** — the spreadsheet lives in the owner's Drive |
| `GOOGLE_OAUTH_REFRESH_TOKEN` set, client id/secret missing | Honest 503 `not_configured` (owner intended OAuth — failing loudly beats silently using the SA) |
| `GOOGLE_OAUTH_REFRESH_TOKEN` absent/empty | **Legacy SA JWT flow** via `SHEETS_SA_JSON` — unchanged pre-OAUTH-1 behavior, keeps working even before POV provisions the OAuth secrets |

One refresh token serves both export functions: the scopes are fixed at
consent time, so POV provisions a token carrying `spreadsheets` +
`drive.file` (the union both functions need).

## Deploy

```bash
supabase functions deploy sheets-export --project-ref gcurvjprfwecbchreieu
```

The verifier deploys via MCP after the phase gates pass. **MCP
flat-bundle gotcha:** `index.ts` imports `../../src/lib/sheetsExportRows.ts`
and (OAUTH-1) `../../src/lib/googleOAuth.ts` — a verifier re-deploy must
copy both into the flat bundle and rewrite imports to sibling paths
(`./sheetsExportRows.ts`, `./googleOAuth.ts`).

## Owner setup (one-time)

1. **GCP project**: enable the **Sheets API** and the **Drive API**
   (APIs & Services → Library). The function errors honestly until both
   are enabled.
2. **OAuth consent + refresh token (preferred, OAUTH-1):** POV
   provisions `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`,
   `GOOGLE_OAUTH_CLIENT_SECRET` (Dashboard → Edge Functions → Secrets).
   The OAuth client needs the `spreadsheets` + `drive.file` scopes.
3. **Legacy fallback:** `SHEETS_SA_JSON` = the **full JSON** of the
   service-account key file (the whole object: `client_email`,
   `private_key`, …). Only used while the OAuth refresh token is absent.

## Contract

```
POST (no body)          (authenticated trainer JWT)
→ 200 { url, spreadsheet_id, row_counts: {clients, sessions, payments, packages} }
→ 401 { error }         bad/missing JWT (verify_jwt=true at the gateway)
→ 403 { error }         caller is not a trainer
→ 503 { error, code: "not_configured" }   Google credential missing/malformed
                        (OAuth secrets incomplete, or SA path active
                        without SHEETS_SA_JSON)
→ 502 { error }         Google/provider failure (sanitized)
```

First run creates a spreadsheet **"AzFIT Export — YYYY-MM"** and stores
its identity in `profiles.sheets_config` (written only by this function).
Later runs reuse it and clear-and-rewrite the Clients / Sessions /
Payments / Packages worksheets. Export scope is the caller's own data,
filtered by explicit `trainer_id`. The Google credential (SA key, OAuth
tokens, client secrets) is never logged or returned.
