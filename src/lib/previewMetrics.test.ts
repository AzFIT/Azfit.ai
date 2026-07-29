import { describe, it, expect } from "vitest";
import {
  setsPerMuscleGroup,
  inferEquipment,
  equipmentChecklist,
  estimateSessionMinutes,
} from "@/lib/previewMetrics";

describe("setsPerMuscleGroup (Phase 30D)", () => {
  it("aggregates sets by category with percentages; unmatched -> Other", () => {
    const rows = setsPerMuscleGroup([
      { name: "Back Squat", sets: 5 }, // bilateral_quad (if in DB) or Other
      { name: "Totally Made Up Lift", sets: 3 },
    ]);
    const total = rows.reduce((s, r) => s + r.sets, 0);
    expect(total).toBe(8);
    expect(rows.reduce((s, r) => s + r.pct, 0)).toBeGreaterThanOrEqual(99);
    expect(rows.some((r) => r.label === "Other")).toBe(true);
  });

  it("sorts descending by sets", () => {
    const rows = setsPerMuscleGroup([
      { name: "Romanian Deadlift", sets: 4 },
      { name: "Back Squat", sets: 8 },
    ]);
    expect(rows[0].sets).toBeGreaterThanOrEqual(rows[rows.length - 1].sets);
  });
});

describe("inferEquipment", () => {
  it("maps names via the documented regexes", () => {
    expect(inferEquipment("BB Incline Press")).toBe("Barbell");
    expect(inferEquipment("Barbell Back Squat")).toBe("Barbell");
    expect(inferEquipment("DB Preacher Curl")).toBe("Dumbbells");
    expect(inferEquipment("Incline Dumbbell Press")).toBe("Dumbbells");
    expect(inferEquipment("Seated Cable Row")).toBe("Cable");
    expect(inferEquipment("Leg Press")).toBe("Machines");
    expect(inferEquipment("Smith Machine Squat")).toBe("Machines");
    expect(inferEquipment("Pull-Up")).toBe("Bodyweight/Rack");
    expect(inferEquipment("Chin up - Semi supinated")).toBe("Bodyweight/Rack");
    expect(inferEquipment("Face Pull")).toBe("Other");
  });
});

describe("equipmentChecklist", () => {
  const ex = [{ name: "BB Incline Press" }, { name: "DB Curl" }, { name: "Pull-Up" }];

  it("Full Gym covers everything", () => {
    const rows = equipmentChecklist(ex, ["Full Gym"]);
    expect(rows.every((r) => r.covered === true)).toBe(true);
  });

  it("Dumbbells Only leaves Barbell uncovered", () => {
    const rows = equipmentChecklist(ex, ["Dumbbells Only"]);
    expect(rows.find((r) => r.item === "Barbell")?.covered).toBe(false);
    expect(rows.find((r) => r.item === "Dumbbells")?.covered).toBe(true);
  });

  it("null client equipment -> all null (Full Gym assumed in UI)", () => {
    expect(equipmentChecklist(ex, null).every((r) => r.covered === null)).toBe(true);
  });

  it("'Other' equipment is never verifiable (always ⚠️)", () => {
    expect(equipmentChecklist([{ name: "Face Pull" }], ["Full Gym"])[0].covered).toBe(false);
    expect(equipmentChecklist([{ name: "Face Pull" }], null)[0].covered).toBeNull();
  });
});

describe("estimateSessionMinutes", () => {
  it("sets × 40s + Σ rest, rounded to minutes", () => {
    // 2 exercises × 3 sets = 6 sets × 40s = 240s; rests 2:00 + 1:00 = 180s; total 420s = 7m
    expect(
      estimateSessionMinutes([
        { sets: 3, rest: "2:00" },
        { sets: 3, rest: "1:00" },
      ])
    ).toBe(7);
  });
});
