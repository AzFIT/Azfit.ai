# plan-export — Phase 99e (+ OAUTH-1 auth model)

Trainer-authorized Plan Summary export to an **editable Google Doc**. The
app invokes this function with the trainer's JWT; the Google credential
is a Supabase secret — **never in the repo, never client-side**.

## Google auth (OAUTH-1 — read this first)

**Why OAuth:** service accounts have **zero Drive storage quota**
(Google's own API verdict — file creation as the SA is impossible, which
is why this function 502'd at the Drive boundary). The durable fix is an
OAuth 2.0 refresh token for the owner's Google account
(`azwarhktrl@gmail.com`), so exports act AS the owner, who has normal
quota.

**Runtime model (not a flag day):**

| Secrets | Auth path |
|---|---|
| `GOOGLE_OAUTH_REFRESH_TOKEN` + `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` all set | **OAuth refresh grant** — files created in the owner's Drive |
| `GOOGLE_OAUTH_REFRESH_TOKEN` set, client id/secret missing | Honest 503 `not_configured` (owner intended OAuth — failing loudly beats silently using the quota-less SA) |
| `GOOGLE_OAUTH_REFRESH_TOKEN` absent/empty | **Legacy SA JWT flow** via `SHEETS_SA_JSON` — unchanged pre-OAUTH-1 behavior |

**Owner prerequisite:** POV provisions the three `GOOGLE_OAUTH_*`
secrets (Dashboard → Edge Functions → Secrets) after deploying. The
OAuth client must have the `drive.file` scope (the refresh token granted
at consent time fixes the scopes — one token serves both export
functions). Tokens and client secrets are never logged or returned;
refresh failures surface as a sanitized 502.

## How it works (design — verifier-approved deviation from the earlier
docx plan)

No client-side docx library (KC audit: no new npm deps). The function
renders the Plan Summary to a clean, self-contained HTML document
**server-side** (`src/lib/planExportHtml.ts`) and uploads it to Google
Drive with Google's **native HTML→Google-Doc conversion**
(`files.create`, `uploadType=multipart`, metadata
`mimeType: application/vnd.google-apps.document`). The trainer gets an
editable Google Doc in the owner's Drive (OAuth path) or the service
account's Drive (legacy fallback) and can move/share it from there.

**Single source of truth:** section resolution (overrides, include
ticks, order, numbering, display formatting) comes from the SAME pure
resolver the app report and print view consume —
`src/lib/planSummaryRender.ts`. There is no third renderer divergence by
construction. **Phase 99g:** the resolver also carries the core-card
effective values (assessment / calories / macros / training overrides),
the **Coach's Notes** card (`result.coachNotes` — rendered last, plain
escaped paragraphs) and the **header override**
(`result.headerOverride`, applied via `effectiveHeader`) — the export
shows exactly what the app shows.

## Deploy

```bash
supabase functions deploy plan-export --project-ref gcurvjprfwecbchreieu
```

The verifier deploys via MCP after the phase gates pass.

### MCP flat-bundle gotcha (IMPORTANT — same lesson as sheets-export v4)

The repo sources import each other by relative path:

- `supabase/functions/plan-export/index.ts` →
  `../../src/lib/planSummaryRender.ts`,
  `../../src/lib/planExportHtml.ts`,
  `../../src/lib/planSummaryExtras.ts`,
  `../../src/lib/googleOAuth.ts` (OAUTH-1)
- `planSummaryRender.ts` → `./planSummaryOverrides.ts`
- `planExportHtml.ts` → `./planSummaryRender.ts`

The CLI resolves these at deploy time, but **MCP cannot resolve
`../../src/lib`** — a verifier re-deploy must reproduce the flat bundle
like sheets-export v4: copy `index.ts`, `planSummaryRender.ts`,
`planSummaryOverrides.ts`, `planExportHtml.ts`,
`planSummaryExtras.ts` (or paste the disclaimer constant), and
**`googleOAuth.ts`** (OAUTH-1) into one flat
directory and rewrite the imports to sibling paths
(`./planSummaryRender.ts` etc.). All type-only imports
(`./planBlueprint`, inline `import("./blueprintCardio")`) are erased at
transpile and need no bundling.

## Prerequisites

1. **OAuth secrets (preferred, OAUTH-1):** `GOOGLE_OAUTH_REFRESH_TOKEN`,
   `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` — POV
   provisions after deploy. When present, exports act as the owner's
   Google account (see the auth table above).
2. **Legacy fallback:** `SHEETS_SA_JSON` secret (already in place for
   sheets-export). Only used when the OAuth refresh token is absent.
   If neither credential is usable, the function answers an honest 503
   `not_configured`.
3. **Drive API enabled** on the GCP project (already required by
   sheets-export). The OAuth token / SA needs the `drive.file` scope
   only — this function creates Google Docs, it does not touch Sheets.
4. The AzFIT logo is fetched from the live site
   (`https://azfit.fit/azfit-logo-header.png`) and inlined
   base64; if the fetch fails the doc renders a text fallback — no
   external asset references in the export.

## Contract

```
POST { summary_id }     (authenticated trainer JWT; verify_jwt=true)
→ 200 { url, document_id }
→ 400 { error }         missing summary_id
→ 401 { error }         bad/missing JWT
→ 403 { error }         caller is not a trainer
→ 404 { error }         unknown summary OR another trainer's summary
                        (identical response — no existence leak)
→ 422 { error }         summary with zero exportable sections
→ 503 { error, code: "not_configured" }   Google credential missing/malformed
                        (OAuth secrets incomplete, or SA path active
                        without SHEETS_SA_JSON)
→ 502 { error }         Google/provider failure (sanitized)
```

Ownership is verified server-side via the chain
`summary → clients.trainer_id = auth.uid()` using the service role; the
payload is never trusted for scoping. The Google credential (SA key,
OAuth tokens, client secrets) is never logged or returned.
