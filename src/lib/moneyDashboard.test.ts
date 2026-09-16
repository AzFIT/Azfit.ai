// Phase 96b — unit tests for src/lib/moneyDashboard.ts.
// Wall-clock is injected everywhere; month-boundary cases use
// constructed Dates so the tests are TZ-independent in intent and
// explicitly exercise LOCAL bucketing (90g convention).
import { describe, it, expect } from "vitest";
import {
  monthKeyLocal,
  lastNMonthKeys,
  monthlyRevenue,
  kpiSums,
  byKindBreakdown,
  topClientsByRevenue,
  monthExpenses,
  netProfit,
  type PaymentLike,
  type ExpenseLike,
} from "./moneyDashboard";

const P = (client_id: string, amount_cents: number, kind: string, paid_at: string | null): PaymentLike =>
  ({ client_id, amount_cents, kind, paid_at });

describe("monthKeyLocal (90g convention)", () => {
  it("buckets by local calendar month", () => {
    // 23:30 on Jan 31 local — must be January, never February via UTC shift
    expect(monthKeyLocal(new Date(2026, 0, 31, 23, 30))).toBe("2026-01");
    expect(monthKeyLocal(new Date(2026, 1, 1, 0, 30))).toBe("2026-02");
    expect(monthKeyLocal(new Date(2026, 11, 15, 12, 0))).toBe("2026-12");
  });
});

describe("lastNMonthKeys", () => {
  it("returns n keys ending at the current month, oldest first, across a year boundary", () => {
    const now = new Date(2026, 1, 10); // Feb 2026
    expect(lastNMonthKeys(now, 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("monthlyRevenue — month boundary", () => {
  it("buckets a payment near month end into its LOCAL month", () => {
    const now = new Date(2026, 2, 15); // Mar 2026
    const payments = [
      P("c1", 10000, "single_session", new Date(2026, 1, 28, 23, 0).toISOString()), // Feb 28 23:00 local
      P("c1", 20000, "package", new Date(2026, 2, 1, 1, 0).toISOString()), // Mar 1 01:00 local
    ];
    const buckets = monthlyRevenue(payments, now, 6);
    const feb = buckets.find((b) => b.key === "2026-02");
    const mar = buckets.find((b) => b.key === "2026-03");
    expect(feb?.cents).toBe(10000);
    expect(mar?.cents).toBe(20000);
    expect(buckets).toHaveLength(6);
  });

  it("skips payments with no paid_at (honest data)", () => {
    const now = new Date(2026, 2, 15);
    const buckets = monthlyRevenue([P("c1", 5000, "other", null)], now, 6);
    expect(buckets.every((b) => b.cents === 0)).toBe(true);
  });
});

describe("kpiSums", () => {
  it("splits this month / last month / all-time and counts rows", () => {
    const now = new Date(2026, 2, 15); // March
    const payments = [
      P("c1", 1000, "single_session", new Date(2026, 2, 10).toISOString()), // this
      P("c2", 2000, "single_session", new Date(2026, 2, 1).toISOString()), // this
      P("c1", 4000, "package", new Date(2026, 1, 28).toISOString()), // last
      P("c1", 8000, "package", new Date(2025, 8, 1).toISOString()), // older
    ];
    expect(kpiSums(payments, now)).toEqual({
      thisMonth: 3000,
      lastMonth: 4000,
      allTime: 15000,
      count: 4,
    });
  });
});

describe("byKindBreakdown — reconciles to exactly 100%", () => {
  it("shares always sum to exactly 100", () => {
    const cases: PaymentLike[][] = [
      [P("c1", 1, "package", "x"), P("c1", 1, "single_session", "x"), P("c1", 1, "other", "x")],
      [P("c1", 333, "package", "x"), P("c1", 333, "single_session", "x"), P("c1", 334, "other", "x")],
      [P("c1", 7, "package", "x"), P("c1", 3, "single_session", "x")],
      [P("c1", 100, "package_session", "x")],
    ];
    for (const payments of cases) {
      const breakdown = byKindBreakdown(payments);
      const total = payments.reduce((a, p) => a + p.amount_cents, 0);
      expect(breakdown.reduce((a, k) => a + k.sharePct, 0)).toBe(100);
      expect(breakdown.reduce((a, k) => a + k.cents, 0)).toBe(total);
    }
  });

  it("empty input → empty breakdown (honest empty, no zero rows)", () => {
    expect(byKindBreakdown([])).toEqual([]);
  });
});

describe("topClientsByRevenue", () => {
  it("orders by lifetime revenue, ties alphabetical, caps at n, includes account-less", () => {
    const payments = [
      P("a", 5000, "package", "x"),
      P("b", 5000, "package", "x"), // tie with a
      P("c", 9000, "package", "x"),
      P("d", 1000, "package", "x"),
      P("e", 100, "package", "x"),
      P("f", 50, "package", "x"),
    ];
    const names: Record<string, string> = {
      a: "Zoe",
      b: "Amy", // alphabetical tie-break: Amy before Zoe
      c: "Bob",
      d: "Cyd",
      e: "Dan",
      f: "Eli",
    };
    const top = topClientsByRevenue(payments, (id) => names[id] ?? id, 5);
    expect(top.map((t) => t.clientId)).toEqual(["c", "b", "a", "d", "e"]);
    expect(top[1].name).toBe("Amy");
    expect(top).toHaveLength(5);
  });
});

describe("monthExpenses + netProfit — recurring vs one-off", () => {
  const expenses: ExpenseLike[] = [
    { amount_cents: 12000, expense_date: "2026-03-01", recurring: true }, // this month, recurring
    { amount_cents: 5000, expense_date: "2026-03-14", recurring: false }, // this month, one-off
    { amount_cents: 3000, expense_date: "2026-04-01", recurring: true }, // FUTURE — must not count in March
    { amount_cents: 7000, expense_date: "2026-02-10", recurring: true }, // last month
  ];

  it("counts recurring + one-off only in their expense_date month; future excluded", () => {
    expect(monthExpenses(expenses, "2026-03")).toBe(17000);
    expect(monthExpenses(expenses, "2026-02")).toBe(7000);
    expect(monthExpenses(expenses, "2026-04")).toBe(3000);
  });

  it("net profit = revenue − month expenses (integer cents, can be negative)", () => {
    expect(netProfit(50000, 17000)).toBe(33000);
    expect(netProfit(5000, 17000)).toBe(-12000);
  });
});
