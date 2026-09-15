// ============================================================
// send-push — Phase 24A (self-send) + Phase 95 (elevated targeting)
// Sends a web push notification to all of a user's subscribed devices.
//
// Targeting (never arbitrary user→user):
//   1. Self-send: caller.id === payload.user_id (Phase 24A test path).
//   2. Trainer → own client: caller is the target's trainer
//      (clients.trainer_id, joined via lower()-cased email — Supabase
//      lowercases auth emails, permanent gotcha).
//   3. Cron/scheduler key: x-cron-key header === CRON_KEY secret.
//      NOTE: with verify_jwt=true the gateway rejects non-JWT callers
//      before this code runs, so a pure-cron HTTP call cannot reach
//      here — the scheduled evaluator is the notification-worker edge
//      function (verify_jwt=false), which sends directly. This path is
//      kept for completeness/manual ops only.
//
// Phase 95 server-side enforcement: when payload.type is one of the
// notification types, the TARGET's profiles.notifications prefs are
// honored at send time — toggle OFF → 200 {suppressed:true, reason:
// 'type_disabled'}; quiet-hours window → {suppressed:true, reason:
// 'quiet_hours'}. This mirrors (duplicates) src/lib/notificationPrefs.ts
// — the unit-tested source of truth; edge functions can't import from
// src/. Quiet hours are evaluated in UTC here (server has no per-user
// timezone) — same documented limitation as the SQL evaluator.
//
// Secrets (set at deploy time — see README.md):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT / CRON_KEY
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // x-app-name: the app's global supabase-js header (src/lib/supabase.ts) —
  // without it in this list the browser CORS-blocks every functions.invoke.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-name, x-cron-key",
};

const NOTIFICATION_TYPE_IDS = [
  "session_reminder",
  "checkin_due",
  "missed_workout",
  "streak_at_risk",
  "achievement_unlocked",
];

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  /** One of NOTIFICATION_TYPE_IDS — when present, the target's prefs
   *  toggle + quiet hours are enforced at send time (Phase 95). */
  type?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
}

/** Mirrors isQuietHoursTime (src/lib/notificationPrefs.ts) in UTC. */
function isQuietHoursNow(q: unknown, at: Date): boolean {
  if (typeof q !== "object" || q === null) return false;
  const from = (q as Record<string, unknown>).from;
  const to = (q as Record<string, unknown>).to;
  if (typeof from !== "string" || typeof to !== "string") return false;
  if (!HM.test(from) || !HM.test(to) || from === to) return false;
  const mins = at.getUTCHours() * 60 + at.getUTCMinutes();
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const f = (fh ?? 0) * 60 + (fm ?? 0);
  const t = (th ?? 0) * 60 + (tm ?? 0);
  return f < t ? mins >= f && mins < t : mins >= f || mins < t;
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
    // ── Env ──────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@azfit.ai";
    const cronKey = Deno.env.get("CRON_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
      return json({ error: "Function is not configured (missing env secrets)" }, 500);
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

    // ── Payload ──────────────────────────────────────────────
    const payload = (await req.json()) as PushPayload;
    if (!payload?.user_id || !payload?.title || !payload?.body) {
      return json({ error: "Body must include user_id, title and body" }, 400);
    }

    // ── Targeting authorization (Phase 95) ───────────────────
    const isSelf = payload.user_id === caller.id;
    const isCron = cronKey !== undefined &&
      req.headers.get("x-cron-key") === cronKey;
    let isOwnTrainer = false;
    if (!isSelf && !isCron) {
      // Caller must be the target's trainer: find the target's email,
      // then a clients row whose trainer_id = caller. lower() on both
      // sides — Supabase lowercases auth emails (permanent gotcha).
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: targetProfile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", payload.user_id)
        .maybeSingle();
      if (targetProfile?.email) {
        const { data: clientRows } = await admin
          .from("clients")
          .select("id")
          .eq("trainer_id", caller.id)
          .ilike("email", targetProfile.email);
        isOwnTrainer = (clientRows ?? []).length > 0;
      }
    }
    if (!isSelf && !isCron && !isOwnTrainer) {
      return json({ error: "Cannot send push to another user" }, 403);
    }

    // ── Server-side prefs enforcement (Phase 95) ─────────────
    if (payload.type && NOTIFICATION_TYPE_IDS.includes(payload.type)) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: targetProfile } = await admin
        .from("profiles")
        .select("notifications")
        .eq("id", payload.user_id)
        .maybeSingle();
      const raw = (targetProfile as { notifications?: unknown } | null)?.notifications;
      const types = (typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>).types
        : null) as Record<string, unknown> | null;
      // Toggle OFF → suppress (NULL/missing = default ON, like normalizeNotificationPrefs).
      if (types && types[payload.type] === false) {
        return json({ sent: 0, failed: 0, pruned: 0, suppressed: true, reason: "type_disabled" });
      }
      const quietHours = (typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>).quietHours
        : null);
      if (isQuietHoursNow(quietHours, new Date())) {
        return json({ sent: 0, failed: 0, pruned: 0, suppressed: true, reason: "quiet_hours" });
      }
    }

    // ── Subscriptions (service role — RLS is owner-only) ─────
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, subscription")
      .eq("user_id", payload.user_id);
    if (subsError) throw subsError;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    let sent = 0;
    let failed = 0;
    let pruned = 0;
    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? null,
    });

    for (const row of (subs ?? []) as SubscriptionRow[]) {
      try {
        await webpush.sendNotification(row.subscription, notification);
        sent++;
        // Touch last_seen_at so stale devices are visible.
        await admin
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // Prune policy (mirror of src/lib/pushPrune.ts — the unit-tested
        // source of truth; edge functions can't import from src/): 404/410
        // = subscription gone → DELETE. 429/5xx/undefined = transient, keep.
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone — prune it.
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          pruned++;
        } else {
          console.error("send-push failed for", row.endpoint, err);
          failed++;
        }
      }
    }

    return json({ sent, failed, pruned });
  } catch (err) {
    console.error("send-push error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
