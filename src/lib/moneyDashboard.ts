// ═══════════════════════════════════════════════════════════════
// moneyDashboard (Phase 96b) — pure trainer-wide money math for the
// /payments Overview. No DB access, no floats: integer cents in,
// integer cents out. Wall-clock is ALWAYS injected by the caller
// (Fix Pack 2 lesson: the quickLog noon-pin flake) — every function
// takes `now: Date`.
//
// Month bucketing follows the Phase 90g convention: LOCAL calendar
// months via getFullYear()/getMonth() — never iso.split("T")[0],
// which would bucket by UTC and shift month ends for TZ≠UTC users.
// ═══════════════════════════════════════════════════════════════

export interface PaymentLike {
  client_id: string;
  amount_cents: number;
  kind: string;
  /** ISO timestamp (payments.paid_at) — interpreted in LOCAL time. */
  paid_at: string | null;
}

export interface ExpenseLike {
  amount_cents: number;
  /** DATE as 'YYYY-MM-DD' — already local, no TZ interpretation. */
  expense_date: string;
  recurring: boolean;
}

/** Local calendar month key "YYYY-MM" (Phase 90g convention). */
export function monthKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** The N most recent local month keys ending at now's month, oldest first. */
export function lastNMonthKeys(now: Date, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKeyLocal(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

/** Short month label for chart axes: "Sep", "Oct", … */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export interface MonthBucket {
  key: string;
  label: string;
  cents: number;
}

/** Revenue per local month for the last `n` months ending at now's month.
 *  Payments with paid_at = NULL are skipped (honest data — no date, no bucket). */
export function monthlyRevenue(payments: PaymentLike[], now: Date, n = 6): MonthBucket[] {
  const keys = lastNMonthKeys(now, n);
  const sums = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const p of payments) {
    if (!p.paid_at) continue;
    const key = monthKeyLocal(new Date(p.paid_at));
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + p.amount_cents);
  }
  return keys.map((key) => ({ key, label: monthLabel(key), cents: sums.get(key) ?? 0 }));
}

/** KPI sums for the overview cards. */
export function kpiSums(payments: PaymentLike[], now: Date) {
  const thisKey = monthKeyLocal(now);
  const lastKey = monthKeyLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  let thisMonth = 0;
  let lastMonth = 0;
  let allTime = 0;
  for (const p of payments) {
    allTime += p.amount_cents;
    if (!p.paid_at) continue;
    const key = monthKeyLocal(new Date(p.paid_at));
    if (key === thisKey) thisMonth += p.amount_cents;
    else if (key === lastKey) lastMonth += p.amount_cents;
  }
  return { thisMonth, lastMonth, allTime, count: payments.length };
}

export interface KindShare {
  kind: string;
  cents: number;
  /** Integer percent 0–100; the set ALWAYS sums to exactly 100 when
   *  total > 0 (largest-remainder reconciliation). */
  sharePct: number;
}

/** By-kind breakdown with shares that reconcile to exactly 100%.
 *  Kinds present in the data are returned sorted by cents desc. */
export function byKindBreakdown(payments: PaymentLike[]): KindShare[] {
  const sums = new Map<string, number>();
  for (const p of payments) {
    sums.set(p.kind, (sums.get(p.kind) ?? 0) + p.amount_cents);
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const entries = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  // Largest-remainder: floor first, then hand out the leftover points to
  // the biggest fractional remainders so Σ sharePct === 100 exactly.
  const floors = entries.map(([, cents]) => Math.floor((cents * 100) / total));
  let leftover = 100 - floors.reduce((a, b) => a + b, 0);
  const remainders = entries
    .map(([kind], i) => ({ kind, i, rem: ((entries[i][1] * 100) % total) }))
    .sort((a, b) => b.rem - a.rem || a.kind.localeCompare(b.kind));
  const shares = floors.slice();
  for (const r of remainders) {
    if (leftover <= 0) break;
    shares[r.i] += 1;
    leftover -= 1;
  }
  return entries.map(([kind, cents], i) => ({ kind, cents, sharePct: shares[i] }));
}

export interface ClientRevenue {
  clientId: string;
  name: string;
  cents: number;
}

/** Top-N clients by lifetime revenue. Ties broken alphabetically by
 *  name (localeCompare, deterministic). `nameOf` resolves display names
 *  from the roster — account-less clients included. */
export function topClientsByRevenue(
  payments: PaymentLike[],
  nameOf: (clientId: string) => string,
  n = 5,
): ClientRevenue[] {
  const sums = new Map<string, number>();
  for (const p of payments) {
    sums.set(p.client_id, (sums.get(p.client_id) ?? 0) + p.amount_cents);
  }
  return [...sums.entries()]
    .map(([clientId, cents]) => ({ clientId, name: nameOf(clientId), cents }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Expenses that count toward a given local month: ANY expense counts in
 *  the month of its expense_date only — recurring vs one-off does NOT
 *  change month attribution (a recurring expense counts in its
 *  expense_date month, not every month after), and future-dated expenses
 *  never count toward an earlier month (this follows trivially from the
 *  date match, and is stated for the record). */
export function monthExpenses(expenses: ExpenseLike[], monthKey: string): number {
  return expenses
    .filter((e) => e.expense_date.startsWith(monthKey))
    .reduce((a, e) => a + e.amount_cents, 0);
}

/** Net profit for a local month: revenue − expenses (both integer cents). */
export function netProfit(revenueCents: number, expensesCents: number): number {
  return revenueCents - expensesCents;
}
