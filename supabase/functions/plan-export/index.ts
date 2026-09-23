// ============================================================
// plan-export — Phase 99e trainer-authorized Plan Summary export.
//
// Why this exists: the owner sends clients an editable copy of their
// Plan Summary. No client-side docx library (KC audit: no new npm
// deps): this function renders the summary to a clean standalone
// HTML document SERVER-SIDE and uploads it to Google Drive with
// Google's native HTML→Google-Doc conversion (Drive files.create,
// mimeType application/vnd.google-apps.document). The trainer gets
// an editable Google Doc in the SA's Drive.
//
// The service-account credential is the EXISTING Supabase secret
// SHEETS_SA_JSON (same SA as sheets-export) — NEVER in the repo,
// NEVER client-side.
//
// Section resolution comes from the SAME pure resolver the app and
// print views consume (src/lib/planSummaryRender.ts) — bundled via
// relative import. See README.md for the MCP flat-bundle gotcha.
//
// Contract:
//   POST { summary_id }   (authenticated trainer JWT; verify_jwt=true
//                         at the gateway rejects bad JWTs first)
//   → 200 { url, document_id }
//   → 400 { error }       missing summary_id
//   → 401 { error }       bad/missing JWT
//   → 403 { error }       caller is not a trainer
//   → 404 { error }       unknown summary OR not this trainer's
//                         client's summary (404 for both — no
//                         existence leak)
//   → 503 { error, code: "not_configured" } SHEETS_SA_JSON missing
//                         or malformed
//   → 5xx { error }       Google/provider failure, sanitized — the
//                         service account is NEVER logged/returned.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";
import { resolvePlanSummary } from "../../src/lib/planSummaryRender.ts";
import { buildPlanExportHtml } from "../../src/lib/planExportHtml.ts";
import { MEDICAL_DISCLAIMER } from "../../src/lib/planSummaryExtras.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
// Drive-only scope: this function creates Google Docs, no Sheets.
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";
const DOCS_MIME = "application/vnd.google-apps.document";

// The deployed site's public logo — fetched and inlined base64 so the
// export has zero external assets (a fetch failure omits the logo
// honestly; the HTML builder has a text fallback).
const SITE_BASE = "https://azfit.github.io/Azfit.ai";
const LOGO_URL = `${SITE_BASE}/azfit-logo-header.png`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // x-app-name: the app's global supabase-js header (src/lib/supabase.ts) —
  // without it in this list the browser CORS-blocks the invoke (ai-chat
  // lesson).
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-name",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** Google API call with a sanitized, uniformly-shaped error. */
async function google<T>(url: string, accessToken: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Sanitized: the response body can contain project-internal details —
    // surface only status + a safe label.
    const label = res.status === 403 ? "access denied" : `status ${res.status}`;
    throw new Error(`Google API error (${label})`);
  }
  return (await res.json()) as T;
}

/** Service-account JWT flow: sign a JWT with the SA private key, exchange
 *  it for an access token at the oauth2 token endpoint. */
async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  const key = await importPKCS8(sa.private_key, "RS256");
  const assertion = await new SignJWT({ scope: GOOGLE_SCOPES.join(" ") })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(GOOGLE_TOKEN_URL)
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(key);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (status ${res.status})`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Google token exchange returned no token");
  return body.access_token;
}

/** Fetch the AzFIT logo and inline it as a base64 data URL. Any
 *  failure → null (the HTML builder renders a text fallback). */
async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Function is not configured (missing env secrets)" }, 500);
    }

    // ── Payload ────────────────────────────────────────────────
    let summaryId: string | null = null;
    try {
      const body = (await req.json()) as { summary_id?: unknown };
      if (typeof body.summary_id === "string" && body.summary_id.length > 0) {
        summaryId = body.summary_id;
      }
    } catch {
      /* non-JSON body → same 400 as a missing field */
    }
    if (!summaryId) {
      return json({ error: "summary_id is required" }, 400);
    }

    // ── Service account (cheap honest 503 before any work) ─────
    const saRaw = Deno.env.get("SHEETS_SA_JSON");
    let sa: ServiceAccount | null = null;
    if (saRaw) {
      try {
        const parsed = JSON.parse(saRaw) as Partial<ServiceAccount>;
        if (
          typeof parsed.client_email === "string" &&
          parsed.client_email.includes("@") &&
          typeof parsed.private_key === "string" &&
          parsed.private_key.includes("BEGIN PRIVATE KEY")
        ) {
          sa = { client_email: parsed.client_email, private_key: parsed.private_key };
        }
      } catch {
        sa = null; // malformed secret → same honest 503 as missing
      }
    }
    if (!sa) {
      return json(
        {
          error: "Export is not configured — the service account secret needs to be added",
          code: "not_configured",
        },
        503,
      );
    }

    // ── Caller auth (JWT) — verify_jwt=true at the gateway too ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    const caller = userData?.user;
    if (userError || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Caller must be a trainer ───────────────────────────────
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    if ((callerProfile as { role?: string } | null)?.role !== "trainer") {
      return json({ error: "Only trainers can export" }, 403);
    }

    // ── Load the summary (service role — the ownership check is
    //    explicit below, NOT delegated to the payload) ──────────
    const { data: summaryRow } = await admin
      .from("plan_summaries")
      .select("id, client_id, result, created_at")
      .eq("id", summaryId)
      .maybeSingle();
    if (!summaryRow) {
      return json({ error: "Summary not found" }, 404);
    }
    const summary = summaryRow as {
      id: string;
      client_id: string;
      result: Record<string, unknown>;
      created_at: string;
    };

    // ── Ownership chain: summary → client → trainer_id ─────────
    // 404 (not 403) for a row the caller doesn't own — same response
    // as unknown, so the endpoint leaks no existence information.
    const { data: clientRow } = await admin
      .from("clients")
      .select("id, trainer_id, full_name")
      .eq("id", summary.client_id)
      .maybeSingle();
    const client = clientRow as { id: string; trainer_id: string | null; full_name: string } | null;
    if (!client || client.trainer_id !== caller.id) {
      return json({ error: "Summary not found" }, 404);
    }

    // ── Resolve sections via the SHARED resolver (same input the
    //    app + print views consume — no third renderer divergence) ──
    const result = summary.result as Parameters<typeof resolvePlanSummary>[0];
    const sections = resolvePlanSummary(result);
    if (sections.length === 0) {
      return json({ error: "This summary has no sections to export" }, 422);
    }

    const generatedLabel = new Date(summary.created_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const header = (result.header ?? {}) as { trainerName?: string; businessName?: string | null };
    const logoDataUrl = await fetchLogoDataUrl();

    const html = buildPlanExportHtml({
      clientName: client.full_name,
      trainerName: header.trainerName ?? "your coach",
      businessName: header.businessName ?? null,
      generatedLabel,
      sections,
      logoDataUrl,
      medicalDisclaimer: MEDICAL_DISCLAIMER,
    });

    // ── Google auth ────────────────────────────────────────────
    const accessToken = await googleAccessToken(sa);

    // ── Upload with native HTML→Google-Doc conversion ──────────
    const metadata = {
      name: `AzFIT Plan Summary — ${client.full_name} — ${generatedLabel}`,
      mimeType: DOCS_MIME,
    };
    const boundary = "azfit_plan_export_boundary";
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
      `${html}\r\n` +
      `--${boundary}--`;
    const created = await google<{ id: string; webViewLink?: string }>(
      DRIVE_UPLOAD_URL,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      },
    );

    return json({
      url: created.webViewLink ?? `https://docs.google.com/document/d/${created.id}`,
      document_id: created.id,
    });
  } catch (err) {
    // Sanitized: err may carry provider internals — never the SA material,
    // but keep the response to a safe label regardless.
    console.error("plan-export error:", err instanceof Error ? err.message : "unknown");
    return json({ error: "Export failed — please try again" }, 502);
  }
});
