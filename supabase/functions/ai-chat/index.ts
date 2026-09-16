// ============================================================
// ai-chat — Phase 97a AI proxy (trainer-keyed, OpenAI-compatible)
//
// Why this exists: the trainer pastes THEIR OWN AI provider key at
// runtime (Settings → AI Assistant). Client-side JS must never see or
// hold that key — so all LLM traffic routes through this function,
// which reads ai_config with the service role (the table has ZERO RLS
// policies — only the service role can read it) and calls the
// provider's /chat/completions.
//
// Provider resolution:
//   · trainer caller  → own ai_config row
//   · client caller   → THEIR TRAINER's ai_config row (the quick-log
//     chat is a trainer-provided perk; spend is the trainer's own key —
//     no quota layer this phase, documented as future)
//
// Contract:
//   POST { messages: [{ role, content }], json?: boolean }
//   → 200 { content: string }
//   → 404 { error: "no_key" }            caller (or their trainer) has
//                                        no ai_config row
//   → 401 { error: "Unauthorized" }      bad/missing JWT (verify_jwt=true
//                                        at the gateway rejects first)
//   → 502 { error: <provider message>, provider_status }  provider-side
//                                        failure — the KEY IS NEVER
//                                        included in any response.
//
// OpenAI-compatible: OpenAI and Moonshot/Kimi both expose
// POST {base_url}/chat/completions with {model, messages,
// response_format:{type:"json_object"}} — swap base_url/model in
// Settings to change provider.
//
// Secrets: none needed beyond the auto-provided SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // x-app-name: the app's global supabase-js header (src/lib/supabase.ts) —
  // without it in this list the browser CORS-blocks the invoke.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-name",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
    const payload = (await req.json()) as {
      messages?: ChatMessage[];
      json?: boolean;
    };
    if (!Array.isArray(payload?.messages) || payload.messages.length === 0) {
      return json({ error: "Body must include a non-empty messages array" }, 400);
    }
    for (const m of payload.messages) {
      if (
        typeof m?.role !== "string" ||
        typeof m?.content !== "string" ||
        !["system", "user", "assistant"].includes(m.role)
      ) {
        return json({ error: "Each message needs role (system|user|assistant) and string content" }, 400);
      }
    }

    // ── Resolve the provider config (service role — zero RLS) ──
    const admin = createClient(supabaseUrl, serviceRoleKey);
    let trainerId: string | null = caller.id;
    const callerEmail: string = caller.email ?? "";
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    const callerRole = (callerProfile as { role?: string } | null)?.role ?? "client";
    if (callerRole !== "trainer") {
      // Client → their trainer. lower() both sides — Supabase lowercases
      // auth emails (permanent gotcha).
      const { data: clientRow } = await admin
        .from("clients")
        .select("trainer_id")
        .ilike("email", callerEmail)
        .limit(1)
        .maybeSingle();
      trainerId = (clientRow as { trainer_id?: string } | null)?.trainer_id ?? null;
    }
    if (!trainerId) {
      return json({ error: "no_trainer" }, 404);
    }

    const { data: cfg } = await admin
      .from("ai_config")
      .select("api_key, base_url, model")
      .eq("trainer_id", trainerId)
      .maybeSingle();
    if (!cfg) {
      return json({ error: "no_key" }, 404);
    }
    const config = cfg as { api_key: string; base_url: string; model: string };

    // ── Provider call ──────────────────────────────────────────
    const body: Record<string, unknown> = {
      model: config.model,
      messages: payload.messages,
      temperature: 0.2,
    };
    if (payload.json) {
      body.response_format = { type: "json_object" };
    }
    const providerRes = await fetch(`${config.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!providerRes.ok) {
      // Pass the provider's error through honestly but NEVER leak the key:
      // provider error bodies contain status/message, not our headers.
      let providerMsg = `Provider error (${providerRes.status})`;
      try {
        const errBody = await providerRes.json();
        const m = (errBody as { error?: { message?: string } }).error?.message;
        if (m) providerMsg = m;
      } catch {
        /* non-JSON error body — keep the generic message */
      }
      return json({ error: providerMsg, provider_status: providerRes.status }, 502);
    }

    const completion = await providerRes.json();
    const content = (completion as {
      choices?: { message?: { content?: string } }[];
    }).choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return json({ error: "Provider returned no content" }, 502);
    }
    return json({ content });
  } catch (err) {
    console.error("ai-chat error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
