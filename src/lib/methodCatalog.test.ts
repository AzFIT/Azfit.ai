import { describe, it, expect } from "vitest";
import {
  rankMethods,
  groupByCategory,
  resolveMethodName,
  WIZARD_GOAL_TO_DB,
  customGoalId,
  isCustomGoalId,
  dbNamesForGoalSelection,
  methodTagSet,
  matchesMetadataFilters,
  customGoalTiles,
  type DbMethod,
  type DbMethodCategory,
} from "@/lib/methodCatalog";

const m = (id: string, name: string, slug = name.toLowerCase().replace(/\s+/g, "-"), category_id = 1): DbMethod => ({
  id,
  name,
  slug,
  category: "Classic Strength Protocols",
  category_id,
  description: null,
  tags: "#strength",
  display_order: 0,
});

const cats: DbMethodCategory[] = [
  { id: 2, name: "Conditioning & Intervals", display_order: 2 },
  { id: 1, name: "Classic Strength Protocols", display_order: 1 },
];

describe("WIZARD_GOAL_TO_DB", () => {
  it("maps all six wizard goals (power intentionally unranked)", () => {
    expect(WIZARD_GOAL_TO_DB.hypertrophy).toEqual(["Hypertrophy", "Build Muscle"]);
    expect(WIZARD_GOAL_TO_DB.fatloss).toEqual(["Fat Loss", "Lose Weight"]);
    expect(WIZARD_GOAL_TO_DB.strength).toEqual(["Strength"]);
    expect(WIZARD_GOAL_TO_DB.endurance).toEqual(["Endurance", "Conditioning"]);
    expect(WIZARD_GOAL_TO_DB.power).toEqual([]);
    expect(WIZARD_GOAL_TO_DB.rehab).toEqual(["Injury Rehab", "Prehab / Rehab"]);
  });
});

describe("rankMethods", () => {
  const methods = [m("a", "Beta Method"), m("b", "Alpha Method"), m("c", "Gamma Method")];

  it("sorts scored desc, unscored after alphabetically", () => {
    const ranked = rankMethods(methods, [
      { method_id: "b", score: 40 },
      { method_id: "c", score: 55 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(ranked[2].score).toBeNull();
  });

  it("takes the best score across multiple mapped goals", () => {
    const ranked = rankMethods(methods, [
      { method_id: "a", score: 30 },
      { method_id: "a", score: 48 },
    ]);
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].score).toBe(48);
  });

  it("empty scores -> pure alphabetical, all null", () => {
    const ranked = rankMethods(methods, []);
    expect(ranked.map((r) => r.name)).toEqual(["Alpha Method", "Beta Method", "Gamma Method"]);
    expect(ranked.every((r) => r.score === null)).toBe(true);
  });
});

describe("groupByCategory", () => {
  it("groups under categories ordered by display_order; uncategorized last as Other", () => {
    const ranked = rankMethods(
      [m("a", "A", "a", 2), m("b", "B", "b", 1), m("c", "C", "c", null)],
      []
    );
    const groups = groupByCategory(ranked, cats);
    expect(groups.map((g) => g.category)).toEqual([
      "Classic Strength Protocols",
      "Conditioning & Intervals",
      "Other",
    ]);
    expect(groups[0].methods[0].name).toBe("B");
    expect(groups[2].methods[0].name).toBe("C");
  });

  it("drops empty categories", () => {
    const groups = groupByCategory(rankMethods([m("a", "A", "a", 1)], []), cats);
    expect(groups.map((g) => g.category)).toEqual(["Classic Strength Protocols"]);
  });
});

describe("resolveMethodName", () => {
  const db = [m("x", "German Volume Training (10x10)", "german-volume-training-10x10")];

  it("DB slug -> live name", () => {
    expect(resolveMethodName("german-volume-training-10x10", db)).toBe("German Volume Training (10x10)");
  });

  it("legacy id -> legacy label", () => {
    expect(resolveMethodName("german-volume", [])).toBe("German Volume Training");
    expect(resolveMethodName("5x5", [])).toBe("5x5 Stronglifts");
  });

  it("unknown -> humanized raw value; empty -> dash", () => {
    expect(resolveMethodName("wave-loading", [])).toBe("Wave Loading");
    expect(resolveMethodName("", [])).toBe("—");
  });
});

describe("Phase 56 — multi-goal selection", () => {
  const custom = [
    { id: "g1", name: "Marathon Prep", slug: "marathon-prep", is_active: true },
    { id: "g2", name: "Archived Thing", slug: "archived-thing", is_active: false },
  ];

  it("customGoalId / isCustomGoalId round-trip + namespace", () => {
    expect(customGoalId("marathon-prep")).toBe("db:marathon-prep");
    expect(isCustomGoalId("db:marathon-prep")).toBe(true);
    expect(isCustomGoalId("strength")).toBe(false);
  });

  it("dbNamesForGoalSelection unions hardcoded + custom goal names, deduped", () => {
    const names = dbNamesForGoalSelection(["strength", "hypertrophy", "db:marathon-prep"], custom);
    expect(names).toEqual(expect.arrayContaining(["Strength", "Hypertrophy", "Build Muscle", "Marathon Prep"]));
    expect(new Set(names).size).toBe(names.length);
  });

  it("archived custom goals still resolve (existing programs keep working)", () => {
    expect(dbNamesForGoalSelection(["db:archived-thing"], custom)).toEqual(["Archived Thing"]);
  });

  it("unknown tile id → empty (unranked, no crash)", () => {
    expect(dbNamesForGoalSelection(["nonsense"], [])).toEqual([]);
  });

  it("rankMethods takes max score per method across multi-goal rows (documented aggregation)", () => {
    const methods = [m("a", "GVT"), m("b", "5x5")];
    const scores = [
      { method_id: "a", score: 60 }, // goal 1
      { method_id: "a", score: 85 }, // goal 2 — max wins
      { method_id: "b", score: 70 },
    ];
    const ranked = rankMethods(methods, scores);
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].score).toBe(85);
  });
});

describe("Phase 56 — Step 2 metadata filters", () => {
  it("methodTagSet parses hashtags lowercase", () => {
    expect(methodTagSet("#Advanced #Fat-Loss")).toEqual(new Set(["advanced", "fat-loss"]));
    expect(methodTagSet(null)).toEqual(new Set());
  });

  it("no chips → everything visible", () => {
    expect(matchesMetadataFilters("#advanced", [], [])).toBe(true);
    expect(matchesMetadataFilters(null, [], [])).toBe(true);
  });

  it("experience chip narrows only positively-tagged methods", () => {
    expect(matchesMetadataFilters("#advanced #hypertrophy", ["Beginner"], [])).toBe(false);
    expect(matchesMetadataFilters("#beginner-friendly", ["Beginner"], [])).toBe(true);
    // lacks experience metadata → stays visible
    expect(matchesMetadataFilters("#hypertrophy", ["Beginner"], [])).toBe(true);
    expect(matchesMetadataFilters(null, ["Beginner"], [])).toBe(true);
  });

  it("#all-levels satisfies any experience selection", () => {
    expect(matchesMetadataFilters("#all-levels #strength", ["Elite"], [])).toBe(true);
  });

  it("equipment chip narrows only when equipment metadata exists", () => {
    expect(matchesMetadataFilters("#bodyweight", [], ["Full Gym"])).toBe(false);
    expect(matchesMetadataFilters("#bodyweight", [], ["Bodyweight"])).toBe(true);
    // no equipment metadata (the whole live catalog today) → stays visible
    expect(matchesMetadataFilters("#advanced", [], ["Full Gym"])).toBe(true);
  });

  it("multi-select unions within a dimension", () => {
    expect(matchesMetadataFilters("#intermediate", ["Beginner", "Intermediate"], [])).toBe(true);
  });
});

describe("customGoalTiles (Step 1 tile filtering)", () => {
  it("excludes archived + names covered by the hardcoded tiles", () => {
    const goals = [
      { id: "1", name: "Marathon Prep", slug: "marathon-prep", is_active: true },
      { id: "2", name: "Hypertrophy", slug: "hypertrophy", is_active: true }, // covered by a fixed tile
      { id: "3", name: "Lose Weight", slug: "lose-weight", is_active: true }, // covered
      { id: "4", name: "Old Goal", slug: "old-goal", is_active: false }, // archived
    ];
    expect(customGoalTiles(goals).map((g) => g.name)).toEqual(["Marathon Prep"]);
  });
});
