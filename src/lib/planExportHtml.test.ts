/* Phase 99e Item 2 — planExportHtml unit tests. */
import { describe, expect, it } from "vitest";
import { buildPlanExportHtml, escapeHtml } from "./planExportHtml";
import { resolvePlanSummary } from "./planSummaryRender";
import type { BlueprintResult } from "./planBlueprint";

function baseResult(): BlueprintResult {
  return {
    header: { generatedIso: "2026-03-01T10:00:00", trainerName: "Coach A", businessName: "AzFIT Studio" },
    assessment: {
      weightKg: 90, heightCm: 170, bmi: 31.1, bodyFatPct: 28, fatMassKg: 25.2, leanMassKg: 64.8,
      bmr: 1650, bmrMethod: "mifflin-st-jeor", maintenance: 2200,
    },
    goal: { statement: "Lose 10 kg", isFatLoss: true, programWeeks: 12 },
    calories: { target: 1700, maintenance: 2200, deficitPct: 0.22, clampedByFloor: false },
    outcomes: { weeklyLossKg: 0.7 },
    macroStyles: [
      {
        key: "balanced", name: "Balanced", bestFor: "most people",
        atTarget: { proteinG: 150, carbsG: 170, fatsG: 60, belowFloor: false },
        atMaintenance: { proteinG: 150, carbsG: 250, fatsG: 80, belowFloor: false },
      },
    ],
    recommended: { key: "balanced", name: "Balanced", reason: "sustainable" },
    proteinFloor: { grams: 130, basis: "2.0 g/kg target weight" },
    training: {
      sessions: [
        { name: "Day A", blocks: [{ label: "A1", exercises: "Goblet Squat", setsReps: "4×10", tempo: "4010", rest: "60s" }], rounds: null, finisher: null },
      ],
      restRules: ["rest 60s between supersets"],
      stepTarget: 8000,
    },
    foodRules: ["eat protein at every meal"],
    welcome: { title: "Welcome aboard, Sam!", message: "Generated message." },
    weeklyTargets: {
      baseline: { recordedAt: "2026-01-05", weightKg: 90, bodyFatPct: 28 },
      goal: { label: "fat loss", targetWeightKg: 80, targetBodyFatPct: null, targetDate: null },
      weeklyRate: { minKg: 0.5, maxKg: 0.9, label: "0.5–0.9 kg/week" },
      expectations: [{ weeks: "Weeks 1–2", focus: "Settle in", expectation: "learn the routine" }],
      nonScaleVictories: ["sleep improves"],
      goalDateHonestNote: null,
      realisticWeeksEstimate: 12,
      notes: [],
    },
    cardio: { rows: [{ machine: "Exercise bike", protocol: "LISS", difficulty: "Beginner", intensity: "RPE 4–5", basis: "20 min", schedule: "2×/week", progression: [] }], weeklyMinutes: 40, stepNote: "aim for steps", notes: [] },
    nutritionGuide: { title: "Eating well", intro: "intro", blocks: [{ heading: "Protein", points: ["eat it"] }], safetyCallout: null, whoShouldNotCut: ["pregnant"], notes: [] },
    sampleDay: { meals: [{ name: "Breakfast", items: ["eggs"], macros: { kcal: 400, p: 30, c: 20, f: 20 } }], totals: { kcal: 400, p: 30, c: 20, f: 20 }, withinTolerance: true },
    tracking: [{ what: "Weight", frequency: "Daily", note: "morning" }],
    faq: [{ q: "Q?", a: "A." }],
    roadmap: [{ weeks: "1-4", name: "Base", kcal: "", note: "n" }] as unknown as BlueprintResult["roadmap"],
  } as unknown as BlueprintResult;
}

function buildHtml(r: BlueprintResult, clientName = "Sam Client", logo: string | null = null) {
  return buildPlanExportHtml({
    clientName,
    trainerName: r.header.trainerName,
    businessName: r.header.businessName,
    generatedLabel: "March 1, 2026",
    sections: resolvePlanSummary(r),
    logoDataUrl: logo,
    medicalDisclaimer: "Consult your physician before starting any exercise program.",
  });
}

describe("escapeHtml", () => {
  it("escapes the five critical characters", () => {
    expect(escapeHtml(`<a href="x">&'"</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&quot;&lt;/a&gt;",
    );
  });
});

describe("buildPlanExportHtml", () => {
  it("renders header with client, trainer, business and generated label", () => {
    const html = buildHtml(baseResult());
    expect(html).toContain("Prepared for <strong>Sam Client</strong> by Coach A · AzFIT Studio — March 1, 2026");
    expect(html).toContain("Your Plan Summary");
  });

  it("every resolved section renders with its numbered title", () => {
    const r = baseResult();
    const html = buildHtml(r);
    const sections = resolvePlanSummary(r);
    for (const s of sections) {
      if (s.key === "welcome") {
        expect(html).toContain("Welcome aboard, Sam!");
        expect(html).toContain("Generated message.");
      } else {
        expect(html).toContain(`${s.number} · ${escapeHtml(s.title)}`);
      }
    }
    // spot-check section content
    expect(html).toContain("Goblet Squat");
    expect(html).toContain("Exercise bike");
    expect(html).toContain("eat protein at every meal");
    expect(html).toContain("1,650 kcal"); // BMR formatted with grouping
  });

  it("excluded sections never appear in the HTML", () => {
    const r = baseResult();
    r.included = { cardio: false, faq: false };
    const html = buildHtml(r);
    expect(html).not.toContain("Cardio — Machines, Intensity & Progression");
    expect(html).not.toContain("Exercise bike");
    expect(html).not.toContain("> FAQ<");
    // cardio's number slot is gone — nutrition guide renumbered
    expect(html).not.toContain("7 · Eating well"); // would be 7 with cardio present
  });

  it("override text wins in the export (same resolver as app/print)", () => {
    const r = baseResult();
    r.overrides = { welcome: { message: "Custom trainer welcome with <b>markup</b>." } };
    const html = buildHtml(r);
    expect(html).toContain("Custom trainer welcome with &lt;b&gt;markup&lt;/b&gt;.");
    expect(html).not.toContain("<b>markup</b>");
  });

  it("HTML-special client names are escaped (no injection)", () => {
    const html = buildHtml(baseResult(), `<img src=x onerror=alert(1)>`);
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("logo data URL is inlined when provided, text fallback when not", () => {
    const withLogo = buildHtml(baseResult(), "Sam", "data:image/png;base64,AAAA");
    expect(withLogo).toContain('class="logo" src="data:image/png;base64,AAAA"');
    const without = buildHtml(baseResult());
    expect(without).toContain('class="logo-text"');
    expect(without).not.toContain('class="logo"');
  });

  it("medical disclaimer lands in the footer", () => {
    const html = buildHtml(baseResult());
    expect(html).toContain("Consult your physician before starting any exercise program.");
  });
});

describe("Phase 99g — Coach's Notes in the export", () => {
  it("renders paragraphs with line breaks, escaped (never HTML)", () => {
    const r = baseResult();
    r.coachNotes = "Great work this week.\n\nNext week: <script>alert(1)</script>\nkeep it up.";
    const html = buildHtml(r);
    expect(html).toContain("Coach&#39;s Notes");
    expect(html).toContain("Great work this week.");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    // single newlines inside a paragraph become <br>
    expect(html).toContain("keep it up.");
  });

  it("include tick removes the card from the export entirely", () => {
    const r = baseResult();
    r.coachNotes = "secret notes";
    r.included = { coachNotes: false };
    const html = buildHtml(r);
    expect(html).not.toContain("Coach's Notes");
    expect(html).not.toContain("secret notes");
  });

  it("core-card overrides export the effective values (same resolver)", () => {
    const r = baseResult();
    r.overrides = {
      assessment: { weightKg: 100 },
      training: { stepTarget: 12000 },
    };
    const html = buildHtml(r);
    expect(html).toContain("100 kg");
    expect(html).toContain("rest");
    expect(html).toContain("12,000"); // steps not a table cell — check title separately
    const sections = resolvePlanSummary(r);
    const t = sections.find((s) => s.key === "training");
    expect(t?.title).toContain("12,000 steps/day");
  });
});
