import { describe, it, expect } from "vitest";
import {
  blueprintFromRow,
  blueprintToPayload,
  toggleInList,
  EMPTY_BLUEPRINT,
  MEAL_CATEGORIES,
  type BlueprintRow,
} from "./planBlueprintInput";

const ROW: BlueprintRow = {
  id: "r1",
  client_id: "c1",
  equipment_access: "home_gym_bb_db",
  injuries_notes: "Left knee — avoid deep flexion",
  stress_level: 6,
  sleep_quality: 7,
  dietary_restriction: "dairy_free",
  food_include: ["Chicken breast", "White rice"],
  food_exclude: ["Milk"],
  meal_preferences: { breakfast: ["Oats"], dinner: ["Salmon", "Broccoli"] },
};

describe("blueprintFromRow", () => {
  it("maps a full row to typed state, filling missing meal categories", () => {
    const b = blueprintFromRow(ROW);
    expect(b.equipmentAccess).toBe("home_gym_bb_db");
    expect(b.injuriesNotes).toContain("knee");
    expect(b.stressLevel).toBe(6);
    expect(b.sleepQuality).toBe(7);
    expect(b.dietaryRestriction).toBe("dairy_free");
    expect(b.dietPreferences.included).toEqual(["Chicken breast", "White rice"]);
    expect(b.dietPreferences.excluded).toEqual(["Milk"]);
    expect(b.dietPreferences.meals.breakfast).toEqual(["Oats"]);
    expect(b.dietPreferences.meals.dinner).toEqual(["Salmon", "Broccoli"]);
    expect(b.dietPreferences.meals.snacks).toEqual([]); // missing → []
    expect(b.dietPreferences.meals.cheat_day).toEqual([]);
  });

  it("degrades unknown enum values to null instead of throwing", () => {
    const b = blueprintFromRow({ ...ROW, equipment_access: "space_station", dietary_restriction: "carnivore" });
    expect(b.equipmentAccess).toBeNull();
    expect(b.dietaryRestriction).toBeNull();
  });

  it("filters non-string jsonb junk out of arrays", () => {
    const b = blueprintFromRow({
      ...ROW,
      food_include: ["Eggs", 42, null] as unknown as string[],
      meal_preferences: { lunch: "not-an-array" } as unknown as Record<string, string[]>,
    });
    expect(b.dietPreferences.included).toEqual(["Eggs"]);
    expect(b.dietPreferences.meals.lunch).toEqual([]);
  });
});

describe("blueprintToPayload", () => {
  it("serializes typed state to the DB payload (blank notes → null)", () => {
    const p = blueprintToPayload(blueprintFromRow(ROW));
    expect(p.equipment_access).toBe("home_gym_bb_db");
    expect(p.food_include).toEqual(["Chicken breast", "White rice"]);
    expect(p.meal_preferences).toEqual(blueprintFromRow(ROW).dietPreferences.meals);
    expect(p.updated_at).toBeTruthy();
    expect(blueprintToPayload(EMPTY_BLUEPRINT).injuries_notes).toBeNull();
  });

  it("round-trips cleanly: fromRow(toPayload-as-row) preserves all values", () => {
    const original = blueprintFromRow(ROW);
    const payload = blueprintToPayload(original);
    const asRow: BlueprintRow = {
      id: ROW.id,
      client_id: ROW.client_id,
      equipment_access: payload.equipment_access,
      injuries_notes: payload.injuries_notes,
      stress_level: payload.stress_level,
      sleep_quality: payload.sleep_quality,
      dietary_restriction: payload.dietary_restriction,
      food_include: payload.food_include,
      food_exclude: payload.food_exclude,
      meal_preferences: payload.meal_preferences,
    };
    expect(blueprintFromRow(asRow)).toEqual(original);
  });

  it("payload is JSON-serializable (jsonb-safe)", () => {
    const p = blueprintToPayload(blueprintFromRow(ROW));
    expect(() => JSON.stringify(p)).not.toThrow();
    expect(JSON.parse(JSON.stringify(p.meal_preferences))).toEqual(p.meal_preferences);
  });
});

describe("toggleInList", () => {
  it("adds missing and removes present, immutably", () => {
    const start = ["A", "B"];
    expect(toggleInList(start, "C")).toEqual(["A", "B", "C"]);
    expect(toggleInList(start, "A")).toEqual(["B"]);
    expect(start).toEqual(["A", "B"]); // untouched
  });
});

describe("MEAL_CATEGORIES", () => {
  it("covers the six mockup sections", () => {
    expect(MEAL_CATEGORIES).toEqual(["breakfast", "lunch", "dinner", "snacks", "refeed", "cheat_day"]);
  });
});
