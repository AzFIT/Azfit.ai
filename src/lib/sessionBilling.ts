// ═══════════════════════════════════════════════════════════════
// sessionBilling (Phase 96) — PURE billing decisions for the
// session-confirm hook. No I/O, no supabase — the service layer
// (src/services/payments.ts) executes the decision this returns.
//
// MONEY MODEL (documented in PROGRESS.md):
//  - packages carry price_cents (bundle price — feeds 96b
//    profitability) but the per-session money event uses the
//    client's client_rates.rate_cents.
//  - PREPAID GUARD: if a 'package' payment row already exists for
//    the package (client paid upfront), confirming a session only
//    decrements — an extra per-session row would double-count.
//  - Otherwise the confirm auto-logs a payment row
//    (kind 'package_session') for the per-session amount; when no
//    rate is set the amount is 0 with an explanatory note — never
//    a fabricated number.
//  - Revenue displayed anywhere is ALWAYS SUM(payments.amount_cents).
// ═══════════════════════════════════════════════════════════════

export interface BillingPackage {
  id: string;
  name: string;
  total_sessions: number;
  sessions_used: number;
  /** ISO timestamp or null (null = never expires). */
  expires_at: string | null;
  active: boolean;
}

export type BillingDecision =
  | { kind: "decrement_and_log"; amountCents: number; note: string }
  | { kind: "decrement_only" }
  | { kind: "blocked"; reason: "expired" | "exhausted" | "inactive" }
  | { kind: "none" };

export function isPackageExpired(pkg: BillingPackage, now: Date): boolean {
  return pkg.expires_at !== null && new Date(pkg.expires_at).getTime() <= now.getTime();
}

/** Remaining sessions on a package (never negative). */
export function remainingSessions(pkg: BillingPackage): number {
  return Math.max(0, pkg.total_sessions - pkg.sessions_used);
}

export function isPackageExhausted(pkg: BillingPackage): boolean {
  return remainingSessions(pkg) <= 0;
}

/** Days until expiry; null when the package never expires. */
export function daysUntilExpiry(pkg: BillingPackage, now: Date): number | null {
  if (pkg.expires_at === null) return null;
  return Math.ceil((new Date(pkg.expires_at).getTime() - now.getTime()) / 86_400_000);
}

/** Expiry-warning window (rendered inside the payments UI). */
export const EXPIRY_WARN_DAYS = 7;
export function showExpiryWarning(pkg: BillingPackage, now: Date): boolean {
  const days = daysUntilExpiry(pkg, now);
  return days !== null && days >= 0 && days <= EXPIRY_WARN_DAYS;
}

/** Decide what a session-confirm does for a client.
 *  `activePackage`: the client's first eligible package (service
 *  layer picks active, non-expired, remaining > 0 — when there is
 *  none it passes null and this returns "none" so the UI can show
 *  the honest "no active package" prompt). */
export function decideSessionBilling(
  activePackage: BillingPackage | null,
  rateCents: number | null,
  isPrepaid: boolean,
  now: Date = new Date(),
): BillingDecision {
  if (!activePackage) return { kind: "none" };
  if (!activePackage.active) return { kind: "blocked", reason: "inactive" };
  if (isPackageExpired(activePackage, now)) return { kind: "blocked", reason: "expired" };
  if (isPackageExhausted(activePackage)) return { kind: "blocked", reason: "exhausted" };
  if (isPrepaid) return { kind: "decrement_only" };
  const amountCents = rateCents ?? 0;
  const note = rateCents
    ? `Session against package "${activePackage.name}"`
    : `Session against package "${activePackage.name}" — no per-session rate set, amount unknown`;
  return { kind: "decrement_and_log", amountCents, note };
}
