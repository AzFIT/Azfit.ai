// ============================================================
// send-push — Phase 24A (write-only; deploy separately)
// Sends a web push notification to all of a user's subscribed devices.
// Caller must be authenticated and may only send to themselves
// (automatic triggers with elevated targeting come in Phase 24B).
//
// Secrets (set at deploy time — see README.md):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
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
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
      return json({ error: "Function is not configured (missing env secrets)" }, 500);
    }

    // ── Caller auth (JWT) ────────────────────────────────────
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
    // Phase 24A: callers may only push to themselves (test path).
    if (payload.user_id !== caller.id) {
      return json({ error: "Cannot send push to another user" }, 403);
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
