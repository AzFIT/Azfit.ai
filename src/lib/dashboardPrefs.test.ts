import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRIVACY,
  hideId,
  moveId,
  normalizeDashboardPreferences,
  normalizeOrderHide,
  normalizePrivacy,
  showId,
  toggleHiddenId,
  visibleOrder,
} from "./dashboardPrefs";

const CARDS = ["a", "b", "c", "d"];

describe("normalizeOrderHide", () => {
  it("null → canonical order, nothing hidden", () => {
    expect(normalizeOrderHide(null, CARDS)).toEqual({ hidden: [], order: CARDS });
  });

  it("applies stored order and hidden", () => {
    const r = normalizeOrderHide({ order: ["d", "b", "a", "c"], hidden: ["b"] }, CARDS);
    expect(r.order).toEqual(["d", "b", "a", "c"]);
    expect(r.hidden).toEqual(["b"]);
  });

  it("drops unknown ids (tolerant of stale registries)", () => {
    const r = normalizeOrderHide({ order: ["x", "b"], hidden: ["y", "a"] }, CARDS);
    expect(r.order).toEqual(["b", "a", "c", "d"]);
    expect(r.hidden).toEqual(["a"]);
  });

  it("dedupes repeated order and hidden entries", () => {
    const r = normalizeOrderHide(
      { order: ["b", "b", "a", "a"], hidden: ["c", "c"] },
      CARDS
    );
    expect(r.order).toEqual(["b", "a", "c", "d"]);
    expect(r.hidden).toEqual(["c"]);
  });

  it("appends registry ids missing from a short stored order", () => {
    const r = normalizeOrderHide({ order: ["d"], hidden: [] }, CARDS);
    expect(r.order).toEqual(["d", "a", "b", "c"]);
  });
});

describe("order/hide operations", () => {
  const base = { hidden: [], order: [...CARDS] };

  it("hideId adds once (duplicate-safe)", () => {
    const once = hideId(base, "b");
    expect(once.hidden).toEqual(["b"]);
    expect(hideId(once, "b").hidden).toEqual(["b"]);
  });

  it("showId removes only the target", () => {
    const p = { hidden: ["b", "c"], order: [...CARDS] };
    expect(showId(p, "b").hidden).toEqual(["c"]);
  });

  it("toggleHiddenId flips both ways", () => {
    const h = toggleHiddenId(base, "a");
    expect(h.hidden).toEqual(["a"]);
    expect(toggleHiddenId(h, "a").hidden).toEqual([]);
  });

  it("moveId swaps adjacent slots", () => {
    const p = moveId(base, "c", -1);
    expect(p.order).toEqual(["a", "c", "b", "d"]);
    expect(moveId(p, "c", +1).order).toEqual([...CARDS]);
  });

  it("moveId is a no-op at edges and for unknown ids", () => {
    expect(moveId(base, "a", -1)).toBe(base);
    expect(moveId(base, "d", +1)).toBe(base);
    expect(moveId(base, "zzz", -1)).toBe(base);
  });

  it("visibleOrder excludes hidden, keeps order", () => {
    const p = { hidden: ["b"], order: ["d", "b", "a", "c"] };
    expect(visibleOrder(p)).toEqual(["d", "a", "c"]);
  });
});

describe("normalizePrivacy", () => {
  it("null → defaults (off, never re-blur)", () => {
    expect(normalizePrivacy(null)).toEqual(DEFAULT_PRIVACY);
  });

  it("keeps enabled + positive seconds; coerces non-positive to null", () => {
    expect(normalizePrivacy({ enabled: true, autoReblurSec: 30 })).toEqual({
      enabled: true,
      autoReblurSec: 30,
    });
    expect(normalizePrivacy({ enabled: true, autoReblurSec: 0 })).toEqual({
      enabled: true,
      autoReblurSec: null,
    });
    expect(normalizePrivacy({ enabled: true, autoReblurSec: -5 })).toEqual({
      enabled: true,
      autoReblurSec: null,
    });
  });

  it("garbage shapes fall back to defaults", () => {
    expect(normalizePrivacy("yes")).toEqual(DEFAULT_PRIVACY);
    expect(normalizePrivacy({ autoReblurSec: "30" })).toEqual({
      enabled: false,
      autoReblurSec: null,
    });
  });
});

describe("normalizeDashboardPreferences", () => {
  it("normalizes all three sections independently against their registries", () => {
    const r = normalizeDashboardPreferences(
      {
        cards: { order: ["d", "a"], hidden: ["b"] },
        profileSections: { order: ["s2", "s1"], hidden: ["ghost"] },
        privacy: { enabled: true, autoReblurSec: 60 },
      },
      CARDS,
      ["s1", "s2", "s3"]
    );
    expect(r.cards.order).toEqual(["d", "a", "b", "c"]);
    expect(r.cards.hidden).toEqual(["b"]);
    expect(r.profileSections.order).toEqual(["s2", "s1", "s3"]);
    expect(r.profileSections.hidden).toEqual([]);
    expect(r.privacy).toEqual({ enabled: true, autoReblurSec: 60 });
  });

  it("fully null JSONB → all defaults", () => {
    const r = normalizeDashboardPreferences(null, CARDS, ["s1"]);
    expect(r.cards).toEqual({ hidden: [], order: CARDS });
    expect(r.profileSections).toEqual({ hidden: [], order: ["s1"] });
    expect(r.privacy).toEqual(DEFAULT_PRIVACY);
  });
});
