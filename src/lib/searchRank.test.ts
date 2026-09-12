/* Phase 90d — unit tests for the palette matching + recents logic. */

import { describe, it, expect } from "vitest";
import { scoreLabel, rankMatches, topVisited } from "./searchRank";

describe("scoreLabel", () => {
  it("is case-insensitive at every tier", () => {
    expect(scoreLabel("Settings", "set")).toBe(80); // prefix
    expect(scoreLabel("SETTINGS", "set")).toBe(80);
    expect(scoreLabel("Check-ins", "CHECK")).toBe(80);
  });
  it("scores exact > prefix > word-prefix > substring", () => {
    expect(scoreLabel("schedule", "schedule")).toBe(100);
    expect(scoreLabel("Schedule", "sch")).toBe(80);
    expect(scoreLabel("Ben Sabre", "sab")).toBe(60); // word prefix, not string start
    expect(scoreLabel("Analytics", "lyt")).toBe(30);
  });
  it("returns 0 for no match and empty query", () => {
    expect(scoreLabel("Dashboard", "xyz")).toBe(0);
    expect(scoreLabel("Dashboard", "")).toBe(0);
    expect(scoreLabel("Dashboard", "   ")).toBe(0);
  });
});

describe("rankMatches", () => {
  const items = [
    { label: "Settings", item: "/settings" },
    { label: "Sheets", item: "/sheets" },
    { label: "Analytics", item: "/analytics" },
    { label: "Ben Sabre", item: "client-ben" },
  ];

  it("prefix beats substring regardless of input order", () => {
    const r = rankMatches("she", [...items].reverse());
    expect(r[0].label).toBe("Sheets");
    expect(r[0].score).toBe(80);
    // "Sheets" is the only match.
    expect(r).toHaveLength(1);
  });

  it("excludes non-matches entirely — never fabricates entries", () => {
    const r = rankMatches("zzzz", items);
    expect(r).toHaveLength(0);
  });

  it("word-prefix matches a surname ('ben' → 'Ben Sabre')", () => {
    const r = rankMatches("ben", items);
    expect(r.map((x) => x.label)).toContain("Ben Sabre");
  });

  it("ties break deterministically by length then locale", () => {
    const r = rankMatches("s", [
      { label: "Schedule", item: 1 },
      { label: "Sheets", item: 2 },
    ]);
    expect(r.map((x) => x.label)).toEqual(["Sheets", "Schedule"]);
  });

  it("substring matches rank below any prefix tier", () => {
    // "ana" is a string PREFIX of Analytics (80) but only a mid-word
    // substring of Banana Plan (30).
    const r = rankMatches("ana", [
      { label: "Analytics", item: 1 },
      { label: "Banana Plan", item: 2 },
    ]);
    expect(r[0].label).toBe("Analytics");
    expect(r[1].label).toBe("Banana Plan");
  });
});

describe("topVisited", () => {
  it("orders by visit count desc and caps", () => {
    const v = { "/dashboard": 9, "/schedule": 3, "/settings": 7 };
    expect(topVisited(v, ["/dashboard", "/schedule", "/settings", "/clients"], 2)).toEqual([
      "/dashboard",
      "/settings",
    ]);
  });
  it("ignores unvisited and unknown paths", () => {
    expect(topVisited({ "/ghost": 5 }, ["/dashboard"], 3)).toEqual([]);
    expect(topVisited({ "/dashboard": 1 }, ["/dashboard"], 3)).toEqual(["/dashboard"]);
  });
  it("ties break by path for determinism", () => {
    const v = { "/b": 2, "/a": 2 };
    expect(topVisited(v, ["/b", "/a"], 5)).toEqual(["/a", "/b"]);
  });
});
