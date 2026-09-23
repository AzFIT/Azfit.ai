/* FIX-1 Item 2 — CSV formula-injection hardening (escapeCSV). */
import { describe, expect, it } from "vitest";
import { exportWorkoutsToCSV, exportNutritionToCSV } from "./exportUtils";

describe("escapeCSV — formula injection neutralized", () => {
  it("cells starting with =, +, - or @ get a single-quote prefix", () => {
    const csv = exportWorkoutsToCSV([
      {
        date: "2026-09-24",
        workoutName: "=1+1",
        exercises: "+SUM(A1)",
        sets: 1,
        volume: 2,
        duration: 3,
      },
    ]);
    const lines = csv.split("\n");
    const dataRow = lines[1];
    expect(dataRow).toContain("'=1+1");
    expect(dataRow).toContain("'+SUM(A1)");
  });

  it("-2 and @cmd stay data", () => {
    const csv = exportNutritionToCSV([
      { date: "2026-09-24", calories: 2000, protein: 150, fats: 60, carbs: 200, water: 2500 },
    ]);
    // every cell in this row is a number or a plain date — unchanged
    expect(csv.split("\n")[1]).toBe("2026-09-24,2000,150,60,200,2500");
    const csv2 = exportWorkoutsToCSV([
      { date: "2026-09-24", workoutName: "-2", exercises: "@cmd", sets: 1, volume: 1, duration: 1 },
    ]);
    expect(csv2.split("\n")[1]).toContain("'-2");
    expect(csv2.split("\n")[1]).toContain("'@cmd");
  });

  it("formula prefix composes with comma quoting", () => {
    const csv = exportWorkoutsToCSV([
      { date: "2026-09-24", workoutName: "=HYPERLINK(\"http://x\")", exercises: "a,b", sets: 1, volume: 1, duration: 1 },
    ]);
    const row = csv.split("\n")[1];
    // quoted because of the comma, single-quoted because of the leading =
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("normal values pass through unchanged", () => {
    const csv = exportWorkoutsToCSV([
      { date: "2026-09-24", workoutName: "Upper Body — Strength", exercises: "Bench Press, Row", sets: 12, volume: 5400, duration: 60 },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Date,Workout,Exercises,Total Sets,Volume (kg),Duration (min)");
    expect(lines[1]).toBe('2026-09-24,Upper Body — Strength,"Bench Press, Row",12,5400,60');
  });

  it("quoted-field doubling still works", () => {
    const csv = exportWorkoutsToCSV([
      { date: "2026-09-24", workoutName: 'He said "hi"', exercises: "x", sets: 1, volume: 1, duration: 1 },
    ]);
    expect(csv.split("\n")[1]).toContain('"He said ""hi"""');
  });
});
