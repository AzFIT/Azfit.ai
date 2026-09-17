# sheets-export — Phase 98a

Trainer-authorized Google Sheets export. The app invokes this function
with the trainer's JWT; the service-account credential is the Supabase
secret `SHEETS_SA_JSON` — **never in the repo, never client-side**.

## Deploy

```bash
supabase functions deploy sheets-export --project-ref gcurvjprfwecbchreieu
```

The verifier deploys via MCP after the phase gates pass.

## Owner setup (one-time)

1. **GCP project**: enable the **Sheets API** and the **Drive API**
   (APIs & Services → Library). The function errors honestly until both
   are enabled.
2. **Service account** (APIs & Services → Credentials → Create service
   account → create a JSON key). The SA needs **no IAM role** — access
   comes from enabling the APIs; the spreadsheets it creates are owned
   by the SA.
3. **Supabase secret**: Dashboard → Edge Functions → Secrets → add
   `SHEETS_SA_JSON` = the **full JSON** of the service-account key file
   (the whole object: `client_email`, `private_key`, …).

## Contract

```
POST (no body)          (authenticated trainer JWT)
→ 200 { url, spreadsheet_id, row_counts: {clients, sessions, payments, packages} }
→ 401 { error }         bad/missing JWT (verify_jwt=true at the gateway)
→ 403 { error }         caller is not a trainer
→ 503 { error, code: "not_configured" }   SHEETS_SA_JSON missing/malformed
→ 502 { error }         Google/provider failure (sanitized)
```

First run creates a spreadsheet **"AzFIT Export — YYYY-MM"** and stores
its identity in `profiles.sheets_config` (written only by this function).
Later runs reuse it and clear-and-rewrite the Clients / Sessions /
Payments / Packages worksheets. Export scope is the caller's own data,
filtered by explicit `trainer_id`.
