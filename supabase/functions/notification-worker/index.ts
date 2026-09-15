// ============================================================
// notification-worker — Phase 95 (scheduled evaluator)
// Runs the due-alerts SQL evaluator (public.notification_due_alerts)
// and sends web pushes for each due alert — idempotently, via the
// notification_log UNIQUE(user_id, type, ref_key) key.
//
// Auth model: verify_jwt=false, but every call MUST carry the
// x-cron-key header matching the CRON_KEY secret. Supabase dashboard
// cron / pg_cron net.http calls can set custom headers, so this is
// effectively a shared-secret gate. (A pure-cron call to send-push is
// impossible there because verify_jwt=true rejects non-JWT callers at
// the gateway — new-format sb_secret_… service keys are not JWTs —
// which is why this worker holds the VAPID secrets and sends directly.)
//
// Semantics (mirrored in public.notification_due_alerts):
//   suppressed_reason 'type_disabled' / 'quiet_hours' → log with
//     sent_at NULL, NO push (quiet-hours alerts are DROPPED, not deferred).
//   NULL → send to every subscribed device; prune 404/410 endpoints.
// Already-logged events never re-appear (the evaluator excludes them),
// and the ON CONFLICT guard here absorbs any race.
//
// Secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT / CRON_KEY
// Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

interface DueAlert {
  user_id: string;
  type: string;
  ref_key: string;
  title: string;
  body: string;
  url: string | null;
  suppressed_reason: string | null;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
}

serve(async (req) => {
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // ── Cron-key gate (verify_jwt=false — this IS the auth) ──
  const cronKey = Deno.env.get("CRON_KEY");
  if (!cronKey || req.headers.get("x-cron-key") !== cronKey) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@azfit.ai";
    if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
      return json({ error: "Function is not configured (missing env secrets)" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Due alerts (service role — EXECUTE is revoked from app roles) ──
    const { data: due, error: dueError } = await admin.rpc("notification_due_alerts");
    if (dueError) throw dueError;
    const alerts = (due ?? []) as DueAlert[];

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    let sent = 0;
    let suppressed = 0;
    let skipped = 0;
    let failed = 0;
    let pruned = 0;

    for (const alert of alerts) {
      // ── Idempotency: log FIRST (sent_at NULL for suppressed). A
      // conflict means another worker run won the race — skip.
      const { error: logError } = await admin.from("notification_log").insert({
        user_id: alert.user_id,
        type: alert.type,
        ref_key: alert.ref_key,
        sent_at: alert.suppressed_reason ? null : new Date().toISOString(),
        suppressed_reason: alert.suppressed_reason,
      });
      if (logError) {
        // 23505 = unique_violation → already handled.
        if ((logError as { code?: string }).code === "23505") {
          skipped++;
          continue;
        }
        throw logError;
      }

      if (alert.suppressed_reason) {
        suppressed++;
        continue;
      }

      // ── Send to every subscribed device ────────────────────
      const { data: subs, error: subsError } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, subscription")
        .eq("user_id", alert.user_id);
      if (subsError) throw subsError;

      const notification = JSON.stringify({
        title: alert.title,
        body: alert.body,
        url: alert.url ?? null,
      });

      for (const row of (subs ?? []) as SubscriptionRow[]) {
        try {
          await webpush.sendNotification(row.subscription, notification);
          sent++;
          await admin
            .from("push_subscriptions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", row.id);
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          // Prune policy (mirror of src/lib/pushPrune.ts): 404/410 = gone.
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", row.id);
            pruned++;
          } else {
            console.error("worker send failed for", row.endpoint, err);
            failed++;
          }
        }
      }
    }

    return json({ evaluated: alerts.length, sent, suppressed, skipped, failed, pruned });
  } catch (err) {
    console.error("notification-worker error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
