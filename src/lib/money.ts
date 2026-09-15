// ═══════════════════════════════════════════════════════════════
// money (Phase 96) — THE money boundary layer.
//
// HARD RULE: all money in the app is INTEGER CENTS (DB columns are
// INT *_cents; JS never does float arithmetic on money). These
// helpers are the only places cents meet human-readable strings:
//   parseMoneyInput  "45" | "45.50" | "$45.50" → 4550 | null
//   formatCents      4550 → "$45.50"
//   sumCents         safe integer-cent sum
//
// Currency is a named constant — the DB stores none. Change it in
// exactly one place when the owner picks a different currency.
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_CURRENCY = "USD";

/** Parse a free-typed amount into integer cents. Returns null for
 *  anything that isn't a plain non-negative decimal (rejecting
 *  negative, NaN, Infinity, and more than 2 decimal places so a
 *  cent can never be silently rounded). */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number((frac ?? "").padEnd(2, "0") || 0);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

/** Integer cents → localized currency string (display only). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: PAYMENT_CURRENCY,
  }).format(cents / 100);
}

/** Sum an array of integer cents without float drift. */
export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + (Number.isSafeInteger(v) ? v : 0), 0);
}
