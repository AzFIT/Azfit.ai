// ═══════════════════════════════════════════════════════════════
// payments service (Phase 96) — all DB access for client_rates,
// packages and payments. Money is integer cents everywhere (see
// src/lib/money.ts); billing DECISIONS are pure
// (src/lib/sessionBilling.ts) — this file only executes them.
//
// Attendance is derived, not stored: a client's attended sessions
// are sessions WHERE client_record_id = <clients.id>
//   AND status = 'completed'
// (plus account-having clients via client_id = profiles(id)).
// ═══════════════════════════════════════════════════════════════
import { supabase } from "@/lib/supabase";
import { buildBookingRoster, type BookingClient } from "@/lib/bookingRoster";
import {
  decideSessionBilling,
  isPackageExpired,
  isPackageExhausted,
  remainingSessions,
  type BillingDecision,
} from "@/lib/sessionBilling";
export interface ClientRate {
  client_id: string;
  rate_cents: number;
  billing_unit: string;
  updated_by: string | null;
  updated_at: string | null;
}

export interface Package {
  id: string;
  client_id: string;
  name: string;
  total_sessions: number;
  sessions_used: number;
  price_cents: number;
  purchased_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Payment {
  id: string;
  client_id: string;
  package_id: string | null;
  amount_cents: number;
  kind: string;
  note: string | null;
  paid_at: string | null;
  logged_by: string | null;
  created_at: string | null;
}

export interface ClientBilling {
  rate: ClientRate | null;
  packages: Package[];
  payments: Payment[];
}

async function myUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Full non-archived roster for the client picker (Phase 90h
 *  pattern — one clients query + one profiles .in query, joined
 *  case-insensitively by buildBookingRoster). Account-less clients
 *  are included (profileId: null) — they can hold rates, packages
 *  and payments too. */
export async function loadPaymentsRoster(trainerId: string): Promise<BookingClient[]> {
  const { data: rows } = await supabase
    .from("clients")
    .select("id, full_name, email, status")
    .eq("trainer_id", trainerId)
    .neq("status", "archived")
    .order("full_name", { ascending: true });
  if (!rows) return [];
  const emails = rows.map((r) => r.email).filter((e): e is string => !!e);
  const { data: profs } = emails.length
    ? await supabase.from("profiles").select("id, email").in("email", emails)
    : { data: [] as { id: string; email: string | null }[] };
  return buildBookingRoster(rows, profs ?? []);
}

export async function getClientBilling(recordId: string): Promise<ClientBilling> {
  const [{ data: rate }, { data: packages }, { data: payments }] = await Promise.all([
    supabase.from("client_rates").select("*").eq("client_id", recordId).maybeSingle(),
    supabase
      .from("packages")
      .select("*")
      .eq("client_id", recordId)
      .order("purchased_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*")
      .eq("client_id", recordId)
      .order("paid_at", { ascending: false })
      .limit(100),
  ]);
  return {
    rate: (rate as ClientRate | null) ?? null,
    packages: (packages as Package[] | null) ?? [],
    payments: (payments as Payment[] | null) ?? [],
  };
}

export async function upsertRate(
  recordId: string,
  rateCents: number,
  billingUnit: "session" | "month",
): Promise<{ ok: boolean; error?: string }> {
  const uid = await myUid();
  const { error } = await supabase.from("client_rates").upsert({
    client_id: recordId,
    rate_cents: rateCents,
    billing_unit: billingUnit,
    updated_by: uid,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function createPackage(
  recordId: string,
  input: { name: string; totalSessions: number; priceCents: number; expiresAt: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("packages").insert({
    client_id: recordId,
    name: input.name,
    total_sessions: input.totalSessions,
    price_cents: input.priceCents,
    expires_at: input.expiresAt,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setPackageActive(
  packageId: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("packages")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", packageId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function logPayment(
  recordId: string,
  input: {
    amountCents: number;
    kind: string;
    packageId?: string | null;
    note?: string;
    paidAt?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const uid = await myUid();
  const { error } = await supabase.from("payments").insert({
    client_id: recordId,
    package_id: input.packageId ?? null,
    amount_cents: input.amountCents,
    kind: input.kind,
    note: input.note?.trim() || null,
    paid_at: input.paidAt ?? new Date().toISOString(),
    logged_by: uid,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type ConfirmOutcome =
  | { outcome: "logged"; packageName: string; remaining: number; amountCents: number }
  | { outcome: "decremented"; packageName: string; remaining: number }
  | { outcome: "no_package" }
  | { outcome: "blocked"; reason: "expired" | "exhausted" | "inactive" };

/** Session-confirm hook (Phase 96 Item 2): trainer marks a session
 *  completed → the client's oldest eligible paid package decrements
 *  by exactly 1 (guarded UPDATE, never below zero, race-safe) and,
 *  unless the package was prepaid, a payment row auto-logs for the
 *  per-session rate. Idempotent by construction: the UI only calls
 *  this on the scheduled→completed transition, and the guarded
 *  UPDATE makes a second call a no-op. */
export async function confirmSessionBilling(
  clientRecordId: string | null | undefined,
  clientName?: string,
  now: Date = new Date(),
): Promise<ConfirmOutcome> {
  if (!clientRecordId) return { outcome: "no_package" };

  const [{ data: rate }, { data: pkgs }] = await Promise.all([
    supabase
      .from("client_rates")
      .select("rate_cents")
      .eq("client_id", clientRecordId)
      .maybeSingle(),
    supabase
      .from("packages")
      .select("*")
      .eq("client_id", clientRecordId)
      .eq("active", true)
      .order("purchased_at", { ascending: true }),
  ]);

  const rateCents =
    rate && (rate as { rate_cents: number }).rate_cents > 0
      ? (rate as { rate_cents: number }).rate_cents
      : null;

  // Eligible: active (query), not expired, has remaining. Oldest first.
  const eligible = ((pkgs as Package[] | null) ?? []).find(
    (p) => !isPackageExpired(p, now) && !isPackageExhausted(p),
  );
  if (!eligible) {
    // Honest distinction: has packages but all blocked → blocked; none at all → no_package.
    const anyPkgs = ((pkgs as Package[] | null) ?? []).length > 0;
    if (!anyPkgs) return { outcome: "no_package" };
    const first = (pkgs as Package[])[0];
    if (isPackageExpired(first, now)) return { outcome: "blocked", reason: "expired" };
    if (isPackageExhausted(first)) return { outcome: "blocked", reason: "exhausted" };
    return { outcome: "blocked", reason: "inactive" };
  }

  // Prepaid guard: an upfront 'package' payment for this package means
  // per-session rows would double-count — decrement only.
  const { data: prepay } = await supabase
    .from("payments")
    .select("id")
    .eq("package_id", eligible.id)
    .eq("kind", "package")
    .gt("amount_cents", 0)
    .limit(1);
  const decision: BillingDecision = decideSessionBilling(
    eligible,
    rateCents,
    (prepay ?? []).length > 0,
    now,
  );

  if (decision.kind === "blocked") return { outcome: "blocked", reason: decision.reason };
  if (decision.kind === "none") return { outcome: "no_package" };

  // Guarded decrement — the WHERE clause makes double-decrement impossible.
  const { data: decremented } = await supabase
    .from("packages")
    .update({ sessions_used: eligible.sessions_used + 1, updated_at: now.toISOString() })
    .eq("id", eligible.id)
    .lt("sessions_used", eligible.total_sessions)
    .select("id, sessions_used");
  if (!decremented || decremented.length === 0) {
    return { outcome: "blocked", reason: "exhausted" };
  }
  const remaining = remainingSessions({
    ...eligible,
    sessions_used: (decremented[0] as { sessions_used: number }).sessions_used,
  });

  if (decision.kind === "decrement_only") {
    return { outcome: "decremented", packageName: eligible.name, remaining };
  }

  const uid = await myUid();
  await supabase.from("payments").insert({
    client_id: clientRecordId,
    package_id: eligible.id,
    amount_cents: decision.amountCents,
    kind: "package_session",
    note:
      (clientName ? `${clientName} — ` : "") +
      (decision.kind === "decrement_and_log" ? decision.note : ""),
    paid_at: now.toISOString(),
    logged_by: uid,
  });
  return {
    outcome: "logged",
    packageName: eligible.name,
    remaining,
    amountCents: decision.amountCents,
  };
}
