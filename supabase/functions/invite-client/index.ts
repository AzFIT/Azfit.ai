// ============================================================
// invite-client — Phase 99a trainer-authorized client invitation
//
// Why this exists: trainers must be able to invite a real client to the
// app from the client roster. Only the SERVICE ROLE may create auth users
// (admin invite) — client JS never holds it — so the invite flows through
// this function, which validates the caller→client relationship before
// spending the privilege. The invited_at stamp happens here too, so the
// client code holds no write path for it (no keepalive concerns).
//
// Contract:
//   POST { client_id }   (authenticated trainer JWT)
//   → 200 { ok: true, invited_at }
//   → 200 { ok: false, code: "already_has_account" }   account exists —
//                                        the client can log in already;
//                                        NOT an error, the UI hides Invite
//   → 400 { error }      missing/invalid client_id, or client has no email
//   → 401 { error: "Unauthorized" }    bad/missing JWT (verify_jwt=true at
//                                      the gateway rejects first too)
//   → 403 { error }      caller is not a trainer, or the client belongs to
//                        a different trainer
//   → 404 { error }      unknown client row
//   → 409 { error, retry_after_s }     invited within the last 24h
//                                      (re-invite allowed after)
//   → 500 { error }      invite/send failure (sanitized — never leaks
//                        service-role or GoTrue internals beyond a safe
//                        message)
//
// Idempotency: inviteUserByEmail is safe to re-call after 24h; a duplicate
// within the window is rejected by the invited_at check BEFORE any auth
// call, so no duplicate emails/magic links are ever sent.
//
// Secrets: none beyond the auto-provided SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INVITE_WINDOW_MS = 24 * 60 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // x-app-name: the app's global supabase-js header (src/lib/supabase.ts) —
  // without it in this list the browser CORS-blocks the invoke (ai-chat
  // lesson).
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-name",
};

interface ClientRow {
  id: string;
  trainer_id: string;
  email: string | null;
  invited_at: string | null;
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

    // ── Payload ────────────────────────────────────────────────
    let payload: { client_id?: unknown } = {};
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Body must be JSON with a client_id" }, 400);
    }
    const clientId = typeof payload?.client_id === "string" ? payload.client_id : "";
    if (!clientId) {
      return json({ error: "client_id is required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Caller must be a trainer ───────────────────────────────
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    if ((callerProfile as { role?: string } | null)?.role !== "trainer") {
      return json({ error: "Only trainers can invite clients" }, 403);
    }

    // ── Client row + ownership ─────────────────────────────────
    const { data: clientData } = await admin
      .from("clients")
      .select("id, trainer_id, email, invited_at")
      .eq("id", clientId)
      .maybeSingle();
    const client = clientData as ClientRow | null;
    if (!client) {
      return json({ error: "Client not found" }, 404);
    }
    if (client.trainer_id !== caller.id) {
      return json({ error: "This client is not yours" }, 403);
    }
    const email = (client.email ?? "").trim();
    if (!email) {
      return json({ error: "This client has no email address" }, 400);
    }

    // ── Already has an account? (profiles row ⇒ they signed up) ──
    // ilike both sides — auth emails are lowercased by Supabase, the
    // clients row may hold the original casing (permanent gotcha, same
    // as ai-chat's resolution).
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (existingProfile) {
      return json({ ok: false, code: "already_has_account" });
    }

    // ── Invited within the last 24h? (re-invite allowed after) ──
    if (client.invited_at) {
      const invitedMs = new Date(client.invited_at).getTime();
      if (!Number.isNaN(invitedMs)) {
        const elapsed = Date.now() - invitedMs;
        if (elapsed < INVITE_WINDOW_MS) {
          return json(
            {
              error: "Already invited within the last 24 hours",
              retry_after_s: Math.ceil((INVITE_WINDOW_MS - elapsed) / 1000),
            },
            409
          );
        }
      }
    }

    // ── Send the invite (service role only) ────────────────────
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      // "User already registered" → same honest answer as the profiles
      // check (covers an orphan auth user without a profiles row).
      const msg = inviteError.message ?? "";
      if (/already been registered|already exists|duplicate/i.test(msg)) {
        return json({ ok: false, code: "already_has_account" });
      }
      console.error("inviteUserByEmail failed:", msg);
      return json({ error: "Could not send the invitation email" }, 500);
    }

    // ── Stamp invited_at (the UI's single source of truth) ─────
    const invitedAt = new Date().toISOString();
    const { error: stampError } = await admin
      .from("clients")
      .update({ invited_at: invitedAt })
      .eq("id", client.id);
    if (stampError) {
      // The invite WAS sent — report success but say the stamp failed so
      // the UI can refresh rather than show a stale "never invited".
      console.error("invited_at stamp failed:", stampError.message);
      return json({ ok: true, invited_at: null });
    }

    return json({ ok: true, invited_at: invitedAt });
  } catch (err) {
    console.error("invite-client error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
