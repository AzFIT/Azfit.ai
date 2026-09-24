/* PHASE FIX-2 — Plan Summary persist-path regression tests.
 *
 * The AUDIT-2 dual-persona audit reported per-card edits + include ticks
 * "silently dead" (no requests, overrides/included stayed NULL). Root-cause
 * investigation showed the wiring intact and both paths working end-to-end
 * on current main (PATCH 204 + SQL-verified land) — the audit's fetch
 * instrumentation was blind to supabase-js (it binds fetch at client
 * creation). These tests lock the persist contract permanently so a real
 * silent death can never ship again:
 *   - include ticks call onPersistResult with the toggled `included` map
 *   - the last-included guard blocks with an error toast and NO persist
 *   - card edits call onPersistResult with the per-card override
 *   - Reset calls onPersistResult with the override key removed
 *   - a rejected persist surfaces an error toast AND reloads (never silent)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// act() semantics need the React act environment flag (src/test/setup.ts
// only installs jest-dom).
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BlueprintReportView } from "@/components/client/PlanSummaryTab";
import type { BlueprintResult } from "@/lib/planBlueprint";
import { toast } from "sonner";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) },
}));
vi.mock("@/hooks/useExerciseTaxonomy", () => ({
  useExerciseTaxonomy: () => ({ rows: [] }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function baseResult(): BlueprintResult {
  return {
    header: { trainerName: "Coach Demo", businessName: null },
    goal: { type: "fat_loss", isFatLoss: true, pace: "standard", programWeeks: 16, statement: "Lose 10 kg of fat", dietBreak: true },
    assessment: {
      weightKg: 90,
      heightCm: 180,
      bmi: 27.8,
      bodyFatPct: 28,
      fatMassKg: 25.2,
      leanMassKg: 64.8,
      bmrMethod: "mifflin",
      bmr: 1800,
      maintenance: 2500,
    },
    calories: { target: 1700, maintenance: 2200, deficitPct: 0.2, clampedByFloor: false },
    outcomes: {
      projectedFatLossKg: 7.2,
      weeklyLossRange: [0.45, 0.9],
      endWeightKg: 82.8,
      endBodyFatPct: null,
    },
    proteinFloor: { grams: 135, basis: "1.8 g × 75 kg bodyweight" },
    recommended: { key: "high-protein", name: "High Protein", reason: "muscle retention" },
    macroStyles: [
      {
        key: "high-protein",
        name: "High Protein",
        split: [35, 35, 30],
        bestFor: "muscle retention",
        atTarget: { proteinG: 150, carbsG: 149, fatsG: 57, belowFloor: false, note: null },
        atMaintenance: { proteinG: 150, carbsG: 193, fatsG: 73 },
      },
    ],
    training: { sessions: [], stepTarget: 9000, restRules: ["90s between sets"] },
    foodRules: ["hit protein first"],
    welcome: { title: "Welcome aboard, Sam!", message: "Generated message." },
    weeklyTargets: {
      baseline: { recordedAt: "2026-01-05", weightKg: 90, bodyFatPct: 28 },
      goal: { label: "fat loss", statement: "Lose 10 kg of fat", targetWeightKg: 80, targetBodyFatPct: null, targetDate: null },
      weeklyRate: { minKg: 0.5, maxKg: 0.9, label: "0.5–0.9 kg/week" },
      expectations: [{ weeks: "Weeks 1–2", focus: "Settle in", expectation: "learn the routine" }],
      nonScaleVictories: ["sleep improves"],
      goalDateHonestNote: null,
      realisticWeeksEstimate: 12,
      notes: [],
    },
    cardio: {
      rows: [
        { machine: "Exercise bike", protocol: "LISS", difficulty: "Beginner", intensity: "RPE 4–5", basis: "20 min", schedule: "2×/week", progression: [] },
      ],
      weeklyMinutes: 40,
      stepNote: "steps",
      notes: [],
    },
    nutritionGuide: {
      title: "Eating well",
      intro: "intro",
      blocks: [{ heading: "Protein", points: ["eat it"] }],
      safetyCallout: null,
      whoShouldNotCut: ["pregnant"],
      notes: [],
    },
    sampleDay: {
      meals: [{ name: "Breakfast", items: ["eggs"], macros: { kcal: 400, p: 30, c: 20, f: 20 } }],
      totals: { kcal: 400, p: 30, c: 20, f: 20 },
      withinTolerance: true,
    },
    tracking: [{ what: "Weight", frequency: "Daily", note: "morning" }],
    faq: [{ q: "Q?", a: "A." }],
    roadmap: [{ weeks: "1-4", name: "Base", kcal: "", note: "n" }] as unknown as BlueprintResult["roadmap"],
  } as unknown as BlueprintResult;
}

let container: HTMLDivElement;
let root: Root;

const onDelete = () => {};
const onSaveTraining = () => Promise.resolve();
const onSaveTargets = () => Promise.resolve();

async function renderView(report: BlueprintResult, onPersistResult: (next: BlueprintResult, message: string) => Promise<void>, onReload: () => Promise<void> = () => Promise.resolve()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <BlueprintReportView
        report={report}
        createdAt="2026-09-24T10:00:00Z"
        canEdit={true}
        onDelete={onDelete}
        onSaveTraining={onSaveTraining}
        onSaveTargets={onSaveTargets}
        onPersistResult={onPersistResult}
        onReload={onReload}
      />,
    );
  });
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/* jsdom's querySelector mis-parses "&" inside attribute-value selectors
 * (nwsapi quirk) — find aria-labelled elements by getAttribute instead. */
function byAriaLabel(label: string): HTMLElement | undefined {
  return [...document.querySelectorAll("[aria-label]")].find(
    (el) => el.getAttribute("aria-label") === label,
  ) as HTMLElement | undefined;
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("Plan Summary persist paths (FIX-2)", () => {
  it("include tick calls onPersistResult with the toggled included map", async () => {
    const onPersist = vi.fn<(next: BlueprintResult, message: string) => Promise<void>>(() => Promise.resolve());
    await renderView(baseResult(), onPersist);
    const cb = document.querySelector('label[aria-label="Include FAQ in summary"] input') as HTMLInputElement;
    expect(cb).toBeTruthy();
    await click(cb);
    expect(onPersist).toHaveBeenCalledTimes(1);
    const [next, message] = onPersist.mock.calls[0];
    expect(next.included).toEqual({ faq: false });
    expect(message).toMatch(/excluded/i);
  });

  it("blocks un-ticking the last included section — toast, no persist", async () => {
    const onPersist = vi.fn<(next: BlueprintResult, message: string) => Promise<void>>(() => Promise.resolve());
    const r = baseResult();
    r.included = {
      // every section present in this fixture is excluded except FAQ, so
      // un-ticking FAQ would leave zero included → the guard must trip
      welcome: false, weeklyTargets: false, cardio: false, nutritionGuide: false,
      sampleDay: false, tracking: false, roadmap: false, training: false,
      assessment: false, calories: false, macros: false, faq: true,
    };
    await renderView(r, onPersist);
    const cb = document.querySelector('label[aria-label="Include FAQ in summary"] input') as HTMLInputElement;
    await click(cb);
    expect(onPersist).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/at least one section/i));
  });

  it("card edit calls onPersistResult with the per-card override", async () => {
    const onPersist = vi.fn<(next: BlueprintResult, message: string) => Promise<void>>(() => Promise.resolve());
    await renderView(baseResult(), onPersist);
    const editBtn = byAriaLabel("Edit Tracking & Accountability")!;
    expect(editBtn).toBeTruthy();
    await click(editBtn);
    const input = document.querySelector('input[aria-label="Tracking 1 what"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "Weight (kg)");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Save changes")!;
    await click(save);
    expect(onPersist).toHaveBeenCalledTimes(1);
    const [next] = onPersist.mock.calls[0];
    expect(next.overrides?.tracking?.rows?.[0]?.what).toBe("Weight (kg)");
    // generated base untouched — overrides are additive
    expect(next.tracking[0].what).toBe("Weight");
  });

  it("Reset calls onPersistResult with the override key removed", async () => {
    const onPersist = vi.fn<(next: BlueprintResult, message: string) => Promise<void>>(() => Promise.resolve());
    const r = baseResult();
    r.overrides = { tracking: { rows: [{ what: "Weight (kg)", frequency: "Daily", note: "morning" }] } } as BlueprintResult["overrides"];
    await renderView(r, onPersist);
    const reset = byAriaLabel("Reset Tracking & Accountability to generated")!;
    expect(reset).toBeTruthy();
    await click(reset);
    expect(onPersist).toHaveBeenCalledTimes(1);
    const [next] = onPersist.mock.calls[0];
    expect("tracking" in (next.overrides as Record<string, unknown>)).toBe(false);
  });

  it("a rejected persist toasts AND reloads — never silent", async () => {
    const onPersist = vi.fn<(next: BlueprintResult, message: string) => Promise<void>>(() => Promise.reject(new Error("network down")));
    const onReload = vi.fn(() => Promise.resolve());
    await renderView(baseResult(), onPersist, onReload);
    const cb = document.querySelector('label[aria-label="Include FAQ in summary"] input') as HTMLInputElement;
    await click(cb);
    await act(async () => {});
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/couldn't update the include tick/i));
    expect(onReload).toHaveBeenCalled();
  });
});
