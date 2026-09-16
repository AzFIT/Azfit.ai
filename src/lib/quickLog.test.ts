import { describe, it, expect } from "vitest";
import {
  parseQuickLog,
  validateQuickLogJson,
  parseWeight,
  parseWaterLiters,
  parseSleepHours,
  parseMeal,
  inferMealType,
  type QuickLogResult,
} from "./quickLog";

const NOON = new Date("2026-09-15T12:00:00");

const ok = (r: QuickLogResult) => {
  if (r.status !== "ok") throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r;
};
const clarify = (r: QuickLogResult) => {
  if (r.status !== "clarify") throw new Error(`expected clarify, got ${JSON.stringify(r)}`);
  return r.question;
};

describe("parseWeight", () => {
  it("parses kg", () => expect(parseWeight("weight 78.5 kg")).toBe(78.5));
  it("parses plain kg without the word weight", () => expect(parseWeight("78.5kg")).toBe(78.5));
  it("converts lb to kg", () => expect(parseWeight("173 lb")).toBeCloseTo(78.47, 2));
  it("comma decimal", () => expect(parseWeight("78,5 kg")).toBe(78.5));
  it("rejects garbage", () => expect(parseWeight("heavy today")).toBeNull());
});

describe("parseWaterLiters", () => {
  it("liters", () => expect(parseWaterLiters("drank 1.5 l of water")).toBe(1.5));
  it("ml → liters", () => expect(parseWaterLiters("500 ml water")).toBe(0.5));
  it("glass = 250ml", () => expect(parseWaterLiters("2 glasses of water")).toBe(0.5));
  it("cup = 240ml", () => expect(parseWaterLiters("1 cup water")).toBe(0.24));
  it("unitless >10 → ml", () => expect(parseWaterLiters("drank 500 water")).toBe(0.5));
  it("unitless small → liters", () => expect(parseWaterLiters("drank 2 water")).toBe(2));
  it("rejects no number", () => expect(parseWaterLiters("had some water")).toBeNull());
});

describe("parseSleepHours", () => {
  it("hours", () => expect(parseSleepHours("slept 7.5 hours")).toBe(7.5));
  it("h shorthand", () => expect(parseSleepHours("sleep 8h")).toBe(8));
  it("minutes → hours", () => expect(parseSleepHours("sleep 90 min")).toBe(1.5));
  it("unitless with keyword", () => expect(parseSleepHours("slept 7")).toBe(7));
  it("rejects absurd", () => expect(parseSleepHours("slept 30")).toBeNull());
});

describe("parseMeal", () => {
  it("name + calories", () => {
    const m = parseMeal("chicken rice 550 cal")!;
    expect(m.name.toLowerCase()).toContain("chicken");
    expect(m.calories).toBe(550);
  });
  it("macro letters", () => {
    const m = parseMeal("oats 300 kcal 40p 50c 20f")!;
    expect(m.calories).toBe(300);
    expect(m.protein_g).toBe(40);
    expect(m.carbs_g).toBe(50);
    expect(m.fats_g).toBe(20);
  });
  it("gram macros", () => {
    const m = parseMeal("protein shake 30g protein")!;
    expect(m.protein_g).toBe(30);
  });
  it("bare food name → null (honest: needs a number)", () => {
    expect(parseMeal("had some rice earlier")).toBeNull();
  });
});

describe("inferMealType", () => {
  it("explicit words win", () => {
    expect(inferMealType("dinner chicken 500 cal", NOON)).toBe("dinner");
    expect(inferMealType("morning oats 300 cal", NOON)).toBe("breakfast");
  });
  it("hour fallback", () => {
    expect(inferMealType("oats 300 cal", new Date("2026-09-15T08:00:00"))).toBe("breakfast");
    expect(inferMealType("oats 300 cal", new Date("2026-09-15T23:00:00"))).toBe("snacks");
  });
});

describe("parseQuickLog (hinted)", () => {
  it("weight chip with unitless number → kg", () => {
    const r = ok(parseQuickLog("78.5", "weight"));
    expect(r.intent).toBe("weight");
    expect(r.data).toEqual({ kg: 78.5 });
  });
  it("water chip", () => {
    const r = ok(parseQuickLog("drank 750ml water", "water"));
    expect(r.data).toEqual({ liters: 0.75 });
  });
  it("sleep chip", () => {
    const r = ok(parseQuickLog("slept about 7 hours", "sleep"));
    expect(r.data).toEqual({ hours: 7 });
  });
  it("training chip with duration", () => {
    const r = ok(parseQuickLog("did upper body workout for 45 min", "training"));
    expect(r.data).toMatchObject({ duration_min: 45 });
    expect((r.data as { summary: string }).summary.toLowerCase()).toContain("upper");
  });
  it("meal chip with macros", () => {
    const r = ok(parseQuickLog("salmon and rice 600 cal 45p", "meal", NOON));
    expect(r.data).toMatchObject({ calories: 600, protein_g: 45, meal_type: "lunch" });
  });
  it("clarify: ambiguous meal", () => {
    const q = clarify(parseQuickLog("had some rice earlier", "meal"));
    expect(q.length).toBeGreaterThan(10);
  });
  it("clarify: weight without a number", () => {
    expect(parseQuickLog("weigh myself daily", "weight").status).toBe("clarify");
  });
  it("clarify: empty", () => {
    expect(parseQuickLog("   ", "meal").status).toBe("clarify");
  });
  it("clarify: impossible weight", () => {
    expect(parseQuickLog("999 kg", "weight").status).toBe("clarify");
  });
});

describe("parseQuickLog (free-text detection)", () => {
  it("detects weight", () => expect(ok(parseQuickLog("78.5 kg")).intent).toBe("weight"));
  it("detects water", () => expect(ok(parseQuickLog("2 glasses water")).intent).toBe("water"));
  it("detects sleep", () => expect(ok(parseQuickLog("slept 6.5 hours")).intent).toBe("sleep"));
  it("detects training", () => expect(ok(parseQuickLog("ran 5k in 30 minutes")).intent).toBe("training"));
  it("defaults to meal; bare name clarifies", () => {
    expect(parseQuickLog("had some rice earlier").status).toBe("clarify");
  });
});

describe("validateQuickLogJson (AI contract)", () => {
  it("accepts a valid weight payload", () => {
    const r = ok(validateQuickLogJson({ status: "ok", intent: "weight", data: { kg: 78.5 } }));
    expect(r.data).toEqual({ kg: 78.5 });
  });
  it("accepts a valid meal payload", () => {
    const r = ok(validateQuickLogJson({ intent: "meal", data: { name: "Rice", calories: 300, meal_type: "dinner" } }));
    expect(r.data).toMatchObject({ name: "Rice", calories: 300, meal_type: "dinner" });
  });
  it("clarify passthrough with the AI's question", () => {
    const q = clarify(validateQuickLogJson({ status: "clarify", question: "How big was the portion?" }));
    expect(q).toBe("How big was the portion?");
  });
  it("unknown intent → clarify", () => {
    expect(validateQuickLogJson({ intent: "dance", data: {} }).status).toBe("clarify");
  });
  it("negative weight → clarify (never a bad write)", () => {
    expect(validateQuickLogJson({ intent: "weight", data: { kg: -5 } }).status).toBe("clarify");
  });
  it("non-numeric hours → clarify", () => {
    expect(validateQuickLogJson({ intent: "sleep", data: { hours: "a lot" } }).status).toBe("clarify");
  });
  it("garbage input → clarify, no throw", () => {
    expect(validateQuickLogJson(null).status).toBe("clarify");
    expect(validateQuickLogJson("text").status).toBe("clarify");
  });
});
