// ═══════════════════════════════════════════════════════════════
// bookingRoster (Phase 90h Item 3) — pure roster join for the
// booking client picker. The picker must list EVERY non-archived
// client; sessions.client_id references profiles(id), so the join
// resolves each client's app account (or null when they have none —
// those sessions persist via sessions.client_record_id instead,
// see Phase 35). GOTCHA: Supabase lowercases auth emails, so the
// join is case-INSENSITIVE on both sides.
// ═══════════════════════════════════════════════════════════════

export interface BookingClient {
  /** profiles.id when the client has an app account, else null. */
  profileId: string | null;
  /** clients.id — the stable, always-present picker key. */
  recordId: string;
  name: string;
  email: string;
  status: string;
}

export interface BookingRosterInput {
  id: string;
  full_name: string;
  email: string | null;
  status?: string | null;
}

export interface BookingProfileInput {
  id: string;
  email: string | null;
}

/** Join the trainer's clients rows to profiles rows by lowercased,
 * trimmed email. Input order is preserved; account-less clients stay
 * in the roster with profileId: null. */
export function buildBookingRoster(
  clients: BookingRosterInput[],
  profiles: BookingProfileInput[],
): BookingClient[] {
  const profileByEmail = new Map<string, string>();
  for (const p of profiles) {
    const key = (p.email ?? "").trim().toLowerCase();
    if (key && !profileByEmail.has(key)) profileByEmail.set(key, p.id);
  }
  return clients.map((c) => {
    const email = (c.email ?? "").trim();
    return {
      profileId: email ? (profileByEmail.get(email.toLowerCase()) ?? null) : null,
      recordId: c.id,
      name: c.full_name,
      email,
      status: c.status ?? "active",
    };
  });
}
