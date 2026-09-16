/**
 * Fix Pack 2 Item 1 — generalized keepalive save helpers.
 *
 * Root cause (hit twice: ui_variant in 92c-fix, ai_config in 97a): the Phase
 * 33A auto-reload on service-worker `controllerchange` aborts every in-flight
 * page fetch — including supabase-js writes, which do not send `keepalive`.
 * A save racing the reload is silently killed: the optimistic UI applied, the
 * DB stayed NULL, and control/DB diverged with no error anywhere.
 *
 * `keepalive: true` requests are guaranteed to complete through navigation,
 * so these raw REST calls land even when the SW reload races them. They hit
 * the same PostgREST URL with the same anon key + user JWT as the supabase-js
 * path — identical RLS behavior (verified live in the 92c-fix repro).
 *
 * Rule: every profile/persisted write that can race the SW reload goes
 * through here. Failure paths must stay loud (toast + console.error at the
 * caller) — nothing fails silently.
 */

import { supabase } from '@/lib/supabase';

async function getToken(getAccessToken?: () => Promise<string | null>): Promise<string | null> {
  if (getAccessToken) return getAccessToken();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function restHeaders(anonKey: string, token: string) {
  return {
    apikey: anonKey,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    prefer: 'return=minimal',
  };
}

/**
 * PATCH a single profiles row (id = the signed-in user's profile id) with
 * keepalive. Returns { ok } or { ok: false, error } — the caller owns the
 * optimistic revert + toast.
 */
export async function keepaliveProfilePatch(
  userId: string,
  patch: Record<string, unknown>,
  getAccessToken?: () => Promise<string | null>,
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase is not configured' };
  const token = await getToken(getAccessToken);
  if (!token) return { ok: false, error: 'Not signed in' };
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: restHeaders(anonKey, token),
        body: JSON.stringify(patch),
        keepalive: true,
      },
    );
    if (!res.ok) return { ok: false, error: `profiles update failed (${res.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

/**
 * Invoke a SECURITY DEFINER RPC with keepalive (used for writes like
 * save_ai_config / clear_ai_config that must survive the SW-reload race).
 */
export async function keepaliveRpc(
  fn: string,
  args: Record<string, unknown>,
  getAccessToken?: () => Promise<string | null>,
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase is not configured' };
  const token = await getToken(getAccessToken);
  if (!token) return { ok: false, error: 'Not signed in' };
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
      method: 'POST',
      headers: restHeaders(anonKey, token),
      body: JSON.stringify(args),
      keepalive: true,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as { message?: string };
        detail = body.message ? ` — ${body.message}` : '';
      } catch {
        /* non-JSON error body */
      }
      return { ok: false, error: `${fn} failed (${res.status})${detail}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
