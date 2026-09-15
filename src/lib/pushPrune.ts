/* ═══════════════════════════════════════════════════════════════
   Phase 94 — push send outcome classification (pure).

   Single source of truth for the prune policy, unit-tested here and
   MIRRORED in the send-push edge function (supabase/functions/send-
   push/index.ts) — edge functions are standalone Deno deploys and
   cannot import from src/, so both sides carry the same policy and
   point at each other. Policy:
     404 / 410  → 'prune'    subscription is gone — DELETE the row
     429 / 5xx  → 'retryable' transient — keep the row
     other 4xx  → 'failed'   request problem — keep the row, log it
     no status  → 'retryable' network-level failure — keep the row
   ═══════════════════════════════════════════════════════════════ */

export type PushSendErrorClass = "prune" | "retryable" | "failed";

export function classifyPushSendError(statusCode: number | undefined): PushSendErrorClass {
  if (statusCode === 404 || statusCode === 410) return "prune";
  if (statusCode === undefined) return "retryable";
  if (statusCode === 429 || statusCode >= 500) return "retryable";
  return "failed";
}
