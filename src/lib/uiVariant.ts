/**
 * Phase 92c — "Pulse Metal" opt-in card style.
 *
 * Activation is a `data-ui-variant="metal"` attribute on <html> (all metal
 * rules in src/index.css are scoped to it; absent = byte-identical classic).
 * Stored per user in profiles.ui_variant ('metal' | NULL) — applied on load
 * by App.tsx, toggled instantly from Settings (optimistic; reverts on save
 * failure so the UI never diverges from what persisted).
 */

export type UiVariant = 'default' | 'metal';

export function applyUiVariant(variant: UiVariant | null): void {
  if (typeof document === 'undefined') return;
  if (variant === 'metal') {
    document.documentElement.setAttribute('data-ui-variant', 'metal');
  } else {
    document.documentElement.removeAttribute('data-ui-variant');
  }
}

export function currentUiVariant(): UiVariant {
  if (typeof document === 'undefined') return 'default';
  return document.documentElement.getAttribute('data-ui-variant') === 'metal'
    ? 'metal'
    : 'default';
}

/**
 * Phase 92c-fix Item 1 — persist with fetch `keepalive`.
 *
 * Root cause of the real-account failure: the Phase 33A auto-reload on
 * SW controllerchange aborts in-flight page fetches. The owner clicked
 * Pulse Metal in that window (seconds after the 92c deploy); the
 * optimistic UI applied, the supabase-js PATCH was killed by the reload,
 * and the DB stayed NULL — control, attribute, and DB silently diverged.
 * `keepalive` requests are guaranteed to complete through navigation,
 * so the write lands even when the reload races it. supabase-js does not
 * expose keepalive, hence the raw REST call (same URL/RLS as the
 * supabase-js path — verified live in the 92c-fix repro).
 */
export async function persistUiVariant(
  userId: string,
  variant: UiVariant,
  getAccessToken: () => Promise<string | null>,
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase is not configured' };
  const token = await getAccessToken();
  if (!token) return { ok: false, error: 'Not signed in' };
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify({ ui_variant: variant === 'metal' ? 'metal' : null }),
        keepalive: true,
      },
    );
    if (!res.ok) return { ok: false, error: `profiles update failed (${res.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
