import { describe, it, expect } from "vitest";
import { parseMoneyInput, formatCents, sumCents } from "./money";

describe("parseMoneyInput", () => {
  it("parses whole dollars to cents", () => {
    expect(parseMoneyInput("45")).toBe(4500);
  });
  it("parses decimals, 1 or 2 places", () => {
    expect(parseMoneyInput("45.5")).toBe(4550);
    expect(parseMoneyInput("45.50")).toBe(4550);
  });
  it("tolerates a leading $ and commas", () => {
    expect(parseMoneyInput("$45.50")).toBe(4550);
    expect(parseMoneyInput("1,200")).toBe(120000);
  });
  it("rejects garbage, negatives, 3+ decimals", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("4.555")).toBeNull();
    expect(parseMoneyInput("45.50.5")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats cents as currency", () => {
    expect(formatCents(4550)).toBe("$45.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(120000)).toBe("$1,200.00");
  });
  it("round-trips with parseMoneyInput", () => {
    expect(parseMoneyInput(formatCents(9999))).toBe(9999);
  });
});

describe("sumCents", () => {
  it("sums exactly (no float drift)", () => {
    expect(sumCents([1001, 2002, 3003])).toBe(6006);
    expect(sumCents([0.1 * 100, 0.2 * 100])).toBe(30); // 10 + 20 cents
    expect(sumCents([])).toBe(0);
  });
});
