# plan-export — Phase 99e

Trainer-authorized Plan Summary export to an **editable Google Doc**. The
app invokes this function with the trainer's JWT; the service-account
credential is the **existing** Supabase secret `SHEETS_SA_JSON` (the same
service account as `sheets-export`) — **never in the repo, never
client-side**.

## How it works (design — verifier-approved deviation from the earlier
docx plan)

No client-side docx library (KC audit: no new npm deps). The function
renders the Plan Summary to a clean, self-contained HTML document
**server-side** (`src/lib/planExportHtml.ts`) and uploads it to Google
Drive with Google's **native HTML→Google-Doc conversion**
(`files.create`, `uploadType=multipart`, metadata
`mimeType: application/vnd.google-apps.document`). The trainer gets an
editable Google Doc in the service account's Drive and can move/share it
from there.

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
  `../../src/lib/planSummaryExtras.ts`
- `planSummaryRender.ts` → `./planSummaryOverrides.ts`
- `planExportHtml.ts` → `./planSummaryRender.ts`

The CLI resolves these at deploy time, but **MCP cannot resolve
`../../src/lib`** — a verifier re-deploy must reproduce the flat bundle
like sheets-export v4: copy `index.ts`, `planSummaryRender.ts`,
`planSummaryOverrides.ts`, `planExportHtml.ts` (and
`planSummaryExtras.ts`, or paste the disclaimer constant) into one flat
directory and rewrite the imports to sibling paths
(`./planSummaryRender.ts` etc.). All type-only imports
(`./planBlueprint`, inline `import("./blueprintCardio")`) are erased at
transpile and need no bundling.

## Prerequisites

1. **SHEETS_SA_JSON secret** — already in place for sheets-export
   (Dashboard → Edge Functions → Secrets). If missing, the function
   answers an honest 503 `not_configured`.
2. **Drive API enabled** on the GCP project (already required by
   sheets-export). The SA needs the `drive.file` scope only — this
   function creates Google Docs, it does not touch Sheets.
3. The AzFIT logo is fetched from the live site
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
→ 503 { error, code: "not_configured" }   SHEETS_SA_JSON missing/malformed
→ 502 { error }         Google/provider failure (sanitized)
```

Ownership is verified server-side via the chain
`summary → clients.trainer_id = auth.uid()` using the service role; the
payload is never trusted for scoping. The service account is never
logged or returned.
