// Fix Pack 2 Item 3 — client-scope PostgREST filters.
//
// Root cause of the five 400s on the client dashboard for an account with NO
// clients row: `${null}` / `${undefined ?? ""}` was interpolated straight
// into .eq() / .or() filters, producing `id=eq.` and
// `client_record_id.eq.null` — PostgREST rejects both with 400/22P02.
//
// Rule: build the ownership scope with clientScopeOr(); when it returns null
// (neither id exists) the caller MUST skip the query — an unfiltered query
// would match every row in the table.

/**
 * Ownership scope for a client spanning both id spaces: sessions owned by the
 * account profile (client_id) OR by the trainer-managed clients row
 * (client_record_id). Returns null when neither id exists — the caller must
 * skip the query in that case (an empty scope would match all rows).
 */
export function clientScopeOr(
  profileId: string | null | undefined,
  clientId: string | null | undefined
): string | null {
  const parts = [
    profileId ? `client_id.eq.${profileId}` : null,
    clientId ? `client_record_id.eq.${clientId}` : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(",") : null;
}
