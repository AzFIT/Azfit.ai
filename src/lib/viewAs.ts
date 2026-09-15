/* ═══════════════════════════════════════════════════════════════
   viewAs (Phase 90e) — pure logic for the trainer "View As Client"
   override. Data-level only: the trainer's auth session is NEVER
   touched; hooks resolve the TARGET client's identity while an
   override is active, and on-behalf writes stamp `logged_by` with
   the trainer's uid (NULL = self-logged).

   Storage: sessionStorage, one scoped key per client id
   (`azfit:view-as:<clientId>`), payload = identity + `savedAt`
   timestamp so the most recently written key wins if several ever
   exist. All parsers never throw.
   ═══════════════════════════════════════════════════════════════ */

export interface ViewAsIdentity {
  /** clients.id of the client being viewed */
  clientId: string;
  email: string;
  name: string;
}

export const VIEW_AS_KEY_PREFIX = "azfit:view-as:";

export function viewAsStorageKey(clientId: string): string {
  return `${VIEW_AS_KEY_PREFIX}${clientId}`;
}

export function serializeViewAs(id: ViewAsIdentity): string {
  return JSON.stringify({ clientId: id.clientId, email: id.email, name: id.name });
}

/** Parse a stored payload (identity plus optional savedAt). Returns
 *  null for null/empty/non-JSON/non-object input and for any missing
 *  or wrongly-typed clientId/email. `name` falls back to "" when
 *  absent (it is display-only). Never throws. */
export function parseViewAs(raw: string | null): ViewAsIdentity | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const rec = parsed as Record<string, unknown>;
  const { clientId, email, name } = rec;
  if (typeof clientId !== "string" || clientId.length === 0) return null;
  if (typeof email !== "string" || email.length === 0) return null;
  if (name !== undefined && typeof name !== "string") return null;
  return { clientId, email, name: name ?? "" };
}

/** `logged_by` value for an on-behalf write: the trainer's uid while
 *  an override is active, NULL when the client logs for themselves.
 *  Defensive: an override with an empty trainer uid yields null. */
export function loggedByForWrite(
  override: ViewAsIdentity | null,
  trainerUid: string,
): string | null {
  if (!override) return null;
  return trainerUid.trim().length > 0 ? trainerUid : null;
}

/* Account-level / trainer-own-data routes that must NOT be rendered
 * while viewing as a client (HONEST DATA guard — ViewAsGuard toasts
 * and redirects instead of silently showing trainer data). Matched
 * by pathname prefix on segment boundaries: /settings blocks
 * /settings/anything but NOT /settings-x. */
export const VIEW_AS_BLOCKED_PREFIXES = [
  "/settings",
  "/trainer-profile",
  "/payments",
  "/onboarding",
  "/bioprint",
  "/progress-photos",
  "/analytics",
  "/coach",
  "/coach-ai",
  "/sheets",
  "/workouts",
  "/plan-summary",
  "/clients",
  "/exercises",
  "/library",
  "/demo",
] as const;

export function isRouteBlockedInViewAs(pathname: string): boolean {
  return VIEW_AS_BLOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Remove every `azfit:view-as:*` key (default: sessionStorage).
 *  Called on sign-out so an override can never outlive the session
 *  that created it. Never throws (private mode). */
export function clearViewAsStorage(storage: Storage = sessionStorage): void {
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(VIEW_AS_KEY_PREFIX)) storage.removeItem(key);
    }
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
