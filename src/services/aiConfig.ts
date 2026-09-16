import { supabase } from '@/lib/supabase';

/**
 * Phase 97a — AI key management + ai-chat edge proxy.
 *
 * SECURITY MODEL (permanent, mirrors supabase/ai-config-97a.sql):
 *  · The trainer's AI provider key lives ONLY in the ai_config table, which
 *    has RLS enabled with ZERO policies — authenticated roles cannot read it
 *    at all. Only the service role (the ai-chat edge function) reads it.
 *  · Writes go through shape-validated SECURITY DEFINER RPCs scoped to
 *    auth.uid(). The key is NEVER returned to the app — the UI is
 *    presence-only ("Key saved ········" via has_ai_config()).
 *  · No key exists in the repo and none may ever be committed.
 */

export async function saveAiKey(apiKey: string, baseUrl: string, model: string): Promise<void> {
  const { error } = await supabase.rpc('save_ai_config', {
    p_api_key: apiKey,
    p_base_url: baseUrl,
    p_model: model,
  });
  if (error) throw new Error(error.message);
}

export async function clearAiKey(): Promise<void> {
  const { error } = await supabase.rpc('clear_ai_config');
  if (error) throw new Error(error.message);
}

/** Presence-only — never the key itself. */
export async function hasAiKey(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_ai_config');
  if (error) return false;
  return data === true;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatResult {
  content: string;
}

/** Error carrying the server's honest message (never key material). */
export class AiChatError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Invoke the ai-chat edge function as the signed-in user.
 * Plain fetch (NOT supabase.functions.invoke) — see src/lib/push.ts:164.
 *
 * Throws AiChatError:
 *  · 401 — not signed in
 *  · 404 {code:'no_key'} — this account (or the client's trainer) has no key
 *  · 502 {code:'provider'} — provider rejected the key / call failed
 */
export async function invokeAiChat(
  messages: AiChatMessage[],
  opts: { json?: boolean } = {},
): Promise<AiChatResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new AiChatError(401, 'Not signed in');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ messages, ...(opts.json ? { json: true } : {}) }),
  });

  let body: { content?: string; error?: string; code?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body — fall through to status-based message */
  }

  if (!res.ok) {
    throw new AiChatError(
      res.status,
      body.error ?? `ai-chat failed (${res.status})`,
      body.code,
    );
  }
  return { content: body.content ?? '' };
}
