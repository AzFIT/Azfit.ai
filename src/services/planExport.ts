// ═══════════════════════════════════════════════════════════════
// plan-export invoke helper (Phase 99e).
// Plain fetch (NOT supabase.functions.invoke) — same lesson as
// src/services/sheetsExport.ts. The trainer's JWT authorizes the edge
// function; the response carries only url/document_id — never any
// credential.
// ═══════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

export interface PlanExportResult {
  url: string;
  document_id: string;
}

export class PlanExportError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Invoke the plan-export edge function as the signed-in trainer. */
export async function invokePlanExport(summaryId: string): Promise<PlanExportResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new PlanExportError(401, "Not signed in");

  let res: Response;
  try {
    res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan-export`,
      {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ summary_id: summaryId }),
      },
    );
  } catch {
    // Network/CORS failure (e.g. function not deployed yet — the
    // gateway answers the preflight with no CORS headers). Honest,
    // sanitized, retryable.
    throw new PlanExportError(
      0,
      "Export service unreachable — it may not be deployed yet",
    );
  }

  let body: {
    url?: string;
    document_id?: string;
    error?: string;
    code?: string;
  } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body — fall through to status-based message */
  }

  if (!res.ok) {
    throw new PlanExportError(
      res.status,
      body.error ?? `plan-export failed (${res.status})`,
      body.code,
    );
  }
  return {
    url: body.url ?? "",
    document_id: body.document_id ?? "",
  };
}
