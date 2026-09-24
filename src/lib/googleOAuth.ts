/**
 * OAUTH-1 — Google OAuth refresh-token auth for the export edge functions.
 *
 * Background: service accounts have ZERO Drive storage quota (Google's own
 * API verdict), so plan-export cannot CREATE Google Docs as the SA. The
 * durable fix is an OAuth 2.0 refresh token provisioned by POV for the
 * owner's Google account (azwarhktrl@gmail.com): the functions exchange it
 * for a short-lived access token acting AS the owner, who has normal quota.
 *
 * This module is PURE (no Deno.env, no jose) so it is unit-testable under
 * Vitest and flat-bundle deployable into the edge functions (same pattern
 * as planSummaryRender.ts — sibling import, MCP-deployable). Each function
 * passes its Deno.env view in; fetch is injectable for tests.
 *
 * Runtime contract (NOT a flag day):
 *   - GOOGLE_OAUTH_REFRESH_TOKEN set (+ client id/secret) → OAuth path.
 *   - refresh token absent/empty → legacy service-account JWT flow,
 *     unchanged (sheets-export keeps working before POV provisions secrets).
 *   - refresh token set but client id/secret missing → "incomplete": the
 *     owner intended OAuth; failing loudly (honest 503) beats silently
 *     falling back to the quota-less SA.
 */

export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleAuthMode =
  | { mode: "oauth"; refreshToken: string; clientId: string; clientSecret: string }
  | { mode: "legacy_sa" }
  | { mode: "incomplete" };

/**
 * Resolve which Google auth path the functions should use from their env.
 * Reads GOOGLE_OAUTH_REFRESH_TOKEN / GOOGLE_OAUTH_CLIENT_ID /
 * GOOGLE_OAUTH_CLIENT_SECRET. Whitespace-only values count as missing.
 */
export function resolveGoogleAuthMode(
  env: Record<string, string | undefined>,
): GoogleAuthMode {
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() ?? "";
  if (!refreshToken) return { mode: "legacy_sa" };
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return { mode: "incomplete" };
  return { mode: "oauth", refreshToken, clientId, clientSecret };
}

/**
 * Exchange a refresh token for an access token (OAuth 2.0 refresh grant).
 * The caller picks the effective scopes — a refresh token's granted scopes
 * are fixed at consent time, so both functions use the same helper and the
 * POV-provisioned token simply carries the union (spreadsheets +
 * drive.file).
 *
 * Throws Error with a SANITIZED message on any failure — tokens and client
 * secrets are never echoed, logged, or returned.
 */
export async function refreshGoogleAccessToken(
  cfg: { refreshToken: string; clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cfg.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  if (!res.ok) {
    // Sanitized: Google's error body can echo client metadata — surface
    // only the status.
    throw new Error(`Google OAuth refresh failed (status ${res.status})`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("Google OAuth refresh returned no access token");
  }
  return body.access_token;
}
