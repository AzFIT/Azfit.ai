import { describe, it, expect } from "vitest";
import {
  decideSessionBilling,
  isPackageExpired,
  isPackageExhausted,
  remainingSessions,
  daysUntilExpiry,
  showExpiryWarning,
  EXPIRY_WARN_DAYS,
  type BillingPackage,
} from "./sessionBilling";

const NOW = new Date("2026-09-15T12:00:00Z");

const pkg = (over: Partial<BillingPackage> = {}): BillingPackage => ({
  id: "p1",
  name: "10-pack",
  total_sessions: 10,
  sessions_used: 3,
  expires_at: null,
  active: true,
  ...over,
});

describe("package state", () => {
  it("remainingSessions never goes negative", () => {
    expect(remainingSessions(pkg({ sessions_used: 12 }))).toBe(0);
  });
  it("exhausted at used >= total", () => {
    expect(isPackageExhausted(pkg({ sessions_used: 10 }))).toBe(true);
    expect(isPackageExhausted(pkg({ sessions_used: 9 }))).toBe(false);
  });
  it("expiry: null never expires; past date does; future does not", () => {
    expect(isPackageExpired(pkg(), NOW)).toBe(false);
    expect(isPackageExpired(pkg({ expires_at: "2026-09-14T23:59:59Z" }), NOW)).toBe(true);
    expect(isPackageExpired(pkg({ expires_at: "2026-10-01T00:00:00Z" }), NOW)).toBe(false);
  });
  it("daysUntilExpiry + warning window (7d)", () => {
    expect(daysUntilExpiry(pkg(), NOW)).toBeNull();
    expect(daysUntilExpiry(pkg({ expires_at: "2026-09-18T00:00:00Z" }), NOW)).toBe(3);
    expect(showExpiryWarning(pkg({ expires_at: "2026-09-18T00:00:00Z" }), NOW)).toBe(true);
    expect(showExpiryWarning(pkg({ expires_at: "2026-10-15T00:00:00Z" }), NOW)).toBe(false);
    expect(EXPIRY_WARN_DAYS).toBe(7);
  });
});

describe("decideSessionBilling", () => {
  it("no package → none", () => {
    expect(decideSessionBilling(null, 5000, false, NOW)).toEqual({ kind: "none" });
  });
  it("inactive package → blocked", () => {
    expect(decideSessionBilling(pkg({ active: false }), 5000, false, NOW)).toEqual({
      kind: "blocked",
      reason: "inactive",
    });
  });
  it("expired package → blocked", () => {
    expect(
      decideSessionBilling(pkg({ expires_at: "2026-09-01T00:00:00Z" }), 5000, false, NOW),
    ).toEqual({ kind: "blocked", reason: "expired" });
  });
  it("exhausted package → blocked", () => {
    expect(decideSessionBilling(pkg({ sessions_used: 10 }), 5000, false, NOW)).toEqual({
      kind: "blocked",
      reason: "exhausted",
    });
  });
  it("prepaid package → decrement only (no payment row)", () => {
    expect(decideSessionBilling(pkg(), 5000, true, NOW)).toEqual({ kind: "decrement_only" });
  });
  it("eligible + rate → decrement_and_log with the rate", () => {
    const d = decideSessionBilling(pkg(), 5000, false, NOW);
    expect(d.kind).toBe("decrement_and_log");
    if (d.kind === "decrement_and_log") {
      expect(d.amountCents).toBe(5000);
      expect(d.note).toContain("10-pack");
    }
  });
  it("eligible + no rate → amount 0 with honest note", () => {
    const d = decideSessionBilling(pkg(), null, false, NOW);
    expect(d.kind).toBe("decrement_and_log");
    if (d.kind === "decrement_and_log") {
      expect(d.amountCents).toBe(0);
      expect(d.note).toContain("no per-session rate set");
    }
  });
});
