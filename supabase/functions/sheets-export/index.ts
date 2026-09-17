// ============================================================
// sheets-export — Phase 98a trainer-authorized Google Sheets export.
//
// Why this exists: the owner exports business data to Google Sheets.
// The service-account credential NEVER lives in the repo or the
// client — it is the Supabase secret SHEETS_SA_JSON, read only here.
// The app invokes this function with the trainer's JWT; the export
// scope is the caller's OWN data, filtered by explicit trainer_id
// via the service-role client (the payload is never trusted for
// scoping — there is no payload at all).
//
// Contract:
//   POST (no body)   (authenticated trainer JWT; verify_jwt=true at
//                    the gateway rejects bad JWTs first)
//   → 200 { url, spreadsheet_id, row_counts: {clients, sessions,
//           payments, packages} }   — real counts only
//   → 401 { error: "Unauthorized" }           bad/missing JWT
//   → 403 { error }                           caller is not a trainer
//   → 503 { error, code: "not_configured" }   SHEETS_SA_JSON missing
//                                             or malformed (owner:
//                                             add the secret via the
//                                             Dashboard)
//   → 5xx { error }                           Google/provider failure,
//                                             sanitized — the service
//                                             account is NEVER logged
//                                             or returned.
//
// First run: creates a spreadsheet "AzFIT Export — <YYYY-MM>" via the
// Drive API and stores {spreadsheet_id, url, created_at,
// last_export_at, row_counts} in profiles.sheets_config (written only
// here). Later runs reuse it and clear-and-rewrite the worksheets.
//
// OWNER PREREQUISITES (README.md in this folder):
//   1. Sheets API + Drive API enabled on the GCP project.
//   2. SHEETS_SA_JSON secret = the service account's full JSON.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";
import {
  buildClientsSheet,
  buildPackagesSheet,
  buildPaymentsSheet,
  buildSessionsSheet,
  dataRowCount,
  mergeSheetsConfig,
  type ExportClientRow,
  type ExportPackageRow,
  type ExportPaymentRow,
  type ExportSessionRow,
} from "../../src/lib/sheetsExportRows.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

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

interface SheetsConfigDoc {
  spreadsheet_id?: string | null;
  url?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

/** Google API call with a sanitized, uniformly-shaped error. */
async function google<T>(url: string, accessToken: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
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

    // ── Service account (before anything else — cheap honest 503) ──
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
      .select("role, sheets_config")
      .eq("id", caller.id)
      .maybeSingle();
    const profile = callerProfile as { role?: string; sheets_config?: SheetsConfigDoc | null } | null;
    if (profile?.role !== "trainer") {
      return json({ error: "Only trainers can export" }, 403);
    }

    // ── Data — scoped by EXPLICIT trainer_id, never the payload ──
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, full_name, email, status, fitness_goal, created_at")
      .eq("trainer_id", caller.id);
    const clients = (clientRows ?? []) as (ExportClientRow & { id: string })[];
    const clientNameById = new Map(clients.map((c) => [c.id, c.full_name]));
    const clientIds = clients.map((c) => c.id);

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sessionRows } = await admin
      .from("sessions")
      .select("starts_at, type, status, client_record_id, client_id")
      .eq("trainer_id", caller.id)
      .gte("starts_at", since);
    const sessions = (sessionRows ?? []) as ExportSessionRow[];

    let payments: ExportPaymentRow[] = [];
    let packages: ExportPackageRow[] = [];
    if (clientIds.length > 0) {
      const { data: paymentRows } = await admin
        .from("payments")
        .select("paid_at, kind, amount_cents, client_id")
        .in("client_id", clientIds);
      payments = (paymentRows ?? []) as unknown as ExportPaymentRow[];
      const { data: packageRows } = await admin
        .from("packages")
        .select("name, total_sessions, sessions_used, expires_at, client_id")
        .in("client_id", clientIds);
      packages = (packageRows ?? []) as unknown as ExportPackageRow[];
    }

    const sessionName = (r: ExportSessionRow): string =>
      r.client_record_id && clientNameById.has(r.client_record_id)
        ? clientNameById.get(r.client_record_id)!
        : r.client_id
          ? "(account client)"
          : "(no client)";
    const clientName = (r: { client_record_id: string }): string =>
      clientNameById.get(r.client_record_id) ?? "";

    const sheets = [
      { title: "Clients", values: buildClientsSheet(clients) },
      { title: "Sessions", values: buildSessionsSheet(sessions, sessionName, new Date()) },
      { title: "Payments", values: buildPaymentsSheet(payments, clientName) },
      { title: "Packages", values: buildPackagesSheet(packages, clientName) },
    ];
    const rowCounts = {
      clients: dataRowCount(sheets[0].values),
      sessions: dataRowCount(sheets[1].values),
      payments: dataRowCount(sheets[2].values),
      packages: dataRowCount(sheets[3].values),
    };

    // ── Google auth ────────────────────────────────────────────
    const accessToken = await googleAccessToken(sa);

    // ── Spreadsheet: reuse the stored one, else create ─────────
    const prevConfig = profile?.sheets_config ?? null;
    let spreadsheetId = prevConfig?.spreadsheet_id ?? null;
    let spreadsheetUrl = prevConfig?.url ?? null;

    if (!spreadsheetId) {
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM (label only)
      const created = await google<{ id: string; webViewLink?: string }>(
        "https://www.googleapis.com/drive/v3/files",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            name: `AzFIT Export — ${month}`,
            mimeType: "application/vnd.google-apps.spreadsheet",
          }),
        },
      );
      spreadsheetId = created.id;
      spreadsheetUrl = created.webViewLink ?? `https://docs.google.com/spreadsheets/d/${created.id}`;
    }

    // ── Worksheets: create if missing, then clear-and-rewrite ──
    const meta = await google<{ sheets?: { properties?: { title?: string } }[] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      accessToken,
      { method: "GET" },
    );
    const existingTitles = new Set(
      (meta.sheets ?? []).map((s) => s.properties?.title ?? ""),
    );
    for (const sheet of sheets) {
      if (!existingTitles.has(sheet.title)) {
        await google(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          accessToken,
          {
            method: "POST",
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: sheet.title } } }],
            }),
          },
        );
      }
      // Clear first so stale rows from a bigger previous export never
      // survive below the new data.
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet.title)}!A1:Z10000`,
        {
          method: "POST", // values.clear is a POST in the Sheets API
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      ).catch(() => undefined); // clear failure surfaces on the update below
      await google(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet.title)}!A1?valueInputOption=RAW`,
        accessToken,
        { method: "PUT", body: JSON.stringify({ values: sheet.values }) },
      );
    }

    // ── Persist bookkeeping (function owns the config write — the
    //    client never saves it) ─────────────────────────────────
    const lastExportAt = new Date().toISOString();
    const nextConfig = mergeSheetsConfig(prevConfig, {
      spreadsheet_id: spreadsheetId,
      url: spreadsheetUrl,
      last_export_at: lastExportAt,
      row_counts: rowCounts,
    });
    await admin.from("profiles").update({ sheets_config: nextConfig }).eq("id", caller.id);

    return json({
      url: spreadsheetUrl,
      spreadsheet_id: spreadsheetId,
      row_counts: rowCounts,
    });
  } catch (err) {
    // Sanitized: err may carry provider internals — never the SA material,
    // but keep the response to a safe label regardless.
    console.error("sheets-export error:", err instanceof Error ? err.message : "unknown");
    return json({ error: "Export failed — please try again" }, 502);
  }
});
