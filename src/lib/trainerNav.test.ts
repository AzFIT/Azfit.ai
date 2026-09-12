import { describe, it, expect } from "vitest";
import {
  TRAINER_NAV_ITEMS,
  normalizeNavPreferences,
  visibleNavItems,
  toggleHiddenId,
  toNavPreferences,
} from "./trainerNav";

describe("TRAINER_NAV_ITEMS", () => {
  it("has exactly the 8 curated items in order", () => {
    expect(TRAINER_NAV_ITEMS.map((i) => i.id)).toEqual([
      "dashboard",
      "coach",
      "clients",
      "schedule",
      "analytics",
      "sheets",
      "plan-summary",
      "settings",
    ]);
  });

  it("only Dashboard is permanent", () => {
    expect(TRAINER_NAV_ITEMS.filter((i) => i.permanent).map((i) => i.id)).toEqual([
      "dashboard",
    ]);
  });

  it("every item has a non-empty label and path", () => {
    for (const item of TRAINER_NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.path.startsWith("/")).toBe(true);
    }
  });
});

describe("normalizeNavPreferences", () => {
  it("null/undefined → all visible ([])", () => {
    expect(normalizeNavPreferences(null)).toEqual([]);
    expect(normalizeNavPreferences(undefined)).toEqual([]);
  });

  it("valid hidden list passes through", () => {
    expect(normalizeNavPreferences({ hidden: ["analytics", "sheets"] })).toEqual([
      "analytics",
      "sheets",
    ]);
  });

  it("drops the permanent dashboard id even if stored", () => {
    expect(normalizeNavPreferences({ hidden: ["dashboard", "sheets"] })).toEqual([
      "sheets",
    ]);
  });

  it("drops unknown ids, non-strings, and duplicates", () => {
    expect(
      normalizeNavPreferences({ hidden: ["nope", 42, "sheets", "sheets", null] }),
    ).toEqual(["sheets"]);
  });

  it("malformed shapes → []", () => {
    expect(normalizeNavPreferences("analytics")).toEqual([]);
    expect(normalizeNavPreferences({ hidden: "analytics" })).toEqual([]);
    expect(normalizeNavPreferences(42)).toEqual([]);
    expect(normalizeNavPreferences(["analytics"])).toEqual(["analytics"]); // bare array accepted defensively
  });

  it("empty hidden array → []", () => {
    expect(normalizeNavPreferences({ hidden: [] })).toEqual([]);
  });
});

describe("visibleNavItems", () => {
  it("returns all 8 in order when nothing is hidden", () => {
    expect(visibleNavItems([])).toHaveLength(8);
    expect(visibleNavItems(["unknown-id"])).toHaveLength(8);
  });

  it("hides toggleable items, keeps dashboard, preserves order", () => {
    const visible = visibleNavItems(["analytics", "sheets"]);
    expect(visible.map((i) => i.id)).toEqual([
      "dashboard",
      "coach",
      "clients",
      "schedule",
      "plan-summary",
      "settings",
    ]);
  });

  it("dashboard can never be hidden", () => {
    const visible = visibleNavItems(["dashboard"]);
    expect(visible.map((i) => i.id)).toContain("dashboard");
    expect(visible).toHaveLength(8);
  });
});

describe("toggleHiddenId", () => {
  it("adds then removes", () => {
    const added = toggleHiddenId([], "sheets");
    expect(added).toEqual(["sheets"]);
    expect(toggleHiddenId(added, "sheets")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = ["sheets"];
    toggleHiddenId(input, "analytics");
    expect(input).toEqual(["sheets"]);
  });
});

describe("toNavPreferences", () => {
  it("round-trips through normalize", () => {
    const prefs = toNavPreferences(["analytics", "dashboard", "bogus"]);
    expect(prefs).toEqual({ hidden: ["analytics"] });
    expect(normalizeNavPreferences(prefs)).toEqual(["analytics"]);
  });
});
