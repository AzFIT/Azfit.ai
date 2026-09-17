// ═══════════════════════════════════════════════════════════════
// sheets-export invoke helper (Phase 98a).
// Plain fetch (NOT supabase.functions.invoke) — same lesson as
// src/services/aiConfig.ts. The trainer's JWT authorizes the edge
// function; the response carries only url/spreadsheet_id/row_counts
// — never any credential.
// ═══════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

export interface SheetsExportResult {
  url: string;
  spreadsheet_id: string;
  row_counts: { clients: number; sessions: number; payments: number; packages: number };
}

export class SheetsExportError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Invoke the sheets-export edge function as the signed-in trainer. */
export async function invokeSheetsExport(): Promise<SheetsExportResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new SheetsExportError(401, "Not signed in");

  let res: Response;
  try {
    res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-export`,
      {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
  } catch {
    // Network/CORS failure (e.g. function not deployed yet — the
    // gateway answers the preflight with no CORS headers). Honest,
    // sanitized, retryable.
    throw new SheetsExportError(
      0,
      "Export service unreachable — it may not be deployed yet",
    );
  }

  let body: {
    url?: string;
    spreadsheet_id?: string;
    row_counts?: SheetsExportResult["row_counts"];
    error?: string;
    code?: string;
  } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body — fall through to status-based message */
  }

  if (!res.ok) {
    throw new SheetsExportError(
      res.status,
      body.error ?? `sheets-export failed (${res.status})`,
      body.code,
    );
  }
  return {
    url: body.url ?? "",
    spreadsheet_id: body.spreadsheet_id ?? "",
    row_counts: body.row_counts ?? { clients: 0, sessions: 0, payments: 0, packages: 0 },
  };
}
