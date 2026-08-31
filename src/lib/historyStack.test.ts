import { describe, it, expect } from "vitest";
import { advanceHistory } from "./historyStack";

describe("advanceHistory (Task 5)", () => {
  it("first navigation seeds the stack", () => {
    const r = advanceHistory([], 0, "/dashboard");
    expect(r).toEqual({ stack: ["/dashboard"], pointer: 0 });
  });

  it("new paths push and prune forward history", () => {
    let r = advanceHistory([], 0, "/dashboard");
    r = advanceHistory(r.stack, r.pointer, "/clients");
    r = advanceHistory(r.stack, r.pointer, "/schedule");
    expect(r).toEqual({ stack: ["/dashboard", "/clients", "/schedule"], pointer: 2 });
  });

  it("back steps move the pointer without duplicating", () => {
    let r = advanceHistory(["/a", "/b", "/c"], 2, "/b");
    expect(r.pointer).toBe(1);
    r = advanceHistory(r.stack, r.pointer, "/a");
    expect(r.pointer).toBe(0);
    expect(r.stack).toEqual(["/a", "/b", "/c"]);
  });

  it("forward steps move the pointer up", () => {
    const r = advanceHistory(["/a", "/b", "/c"], 0, "/b");
    expect(r.pointer).toBe(1);
  });

  it("a new path after going back prunes the forward branch", () => {
    const r = advanceHistory(["/a", "/b", "/c"], 1, "/x");
    expect(r).toEqual({ stack: ["/a", "/b", "/x"], pointer: 2 });
  });

  it("re-navigating to the current path is a no-op", () => {
    const r = advanceHistory(["/a", "/b"], 1, "/b");
    expect(r).toEqual({ stack: ["/a", "/b"], pointer: 1 });
  });

  it("caps the stack at 50 entries", () => {
    const big = Array.from({ length: 50 }, (_, i) => `/p${i}`);
    const r = advanceHistory(big, 49, "/overflow");
    expect(r.stack).toHaveLength(50);
    expect(r.stack[49]).toBe("/overflow");
    expect(r.pointer).toBe(49);
  });
});
