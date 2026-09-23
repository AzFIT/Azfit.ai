/* ═══════════════════════════════════════════════════════════════
   Plan Summary card drafts (Phase 99d Item 1) — pure draft types and
   conversions for the per-card override system. Kept out of the
   editors .tsx so that file stays component-only (react-refresh).

   A draft = the FULL editable subset of a card. buildDraft
   initializes it from the EFFECTIVE card (generated base + existing
   override); overrideFromDraft converts it back into the stored
   override shape. Textareas that map to string arrays use one item
   per line.
   ═══════════════════════════════════════════════════════════════ */

import type { BlueprintResult } from "./planBlueprint";
import type { CardioRow } from "./blueprintCardio";
import {
  effectiveWelcome,
  effectiveWeeklyTargets,
  effectiveCardio,
  effectiveNutritionGuide,
  effectiveSampleDay,
  effectiveTracking,
  effectiveFaq,
  effectiveRoadmap,
  type SectionKey,
  type PlanOverrides,
  type ExpectationRow,
} from "./planSummaryOverrides";

export type WelcomeDraft = { title: string; message: string };
export type WeeklyTargetsDraft = {
  baseline: { weightKg: number | null; bodyFatPct: number | null };
  goal: { targetWeightKg: number | null; targetBodyFatPct: number | null; targetDate: string | null };
  weeklyRate: { label: string } | null;
  expectations: ExpectationRow[];
  nonScaleVictories: string[];
};
export type CardioDraft = { rows: CardioRow[] };
export type NutritionGuideDraft = {
  title: string;
  intro: string;
  blocks: { heading: string; points: string[] }[];
  whoShouldNotCut: string[];
};
export type SampleDayDraft = { meals: { name: string; items: string[]; macros: { kcal: number; p: number; c: number; f: number } }[] };
export type TrackingDraft = { rows: { what: string; frequency: string; note: string }[] };
export type FaqDraft = { items: { q: string; a: string }[] };
export type RoadmapDraft = { phases: { weeks: string; name: string; note: string }[] };
export type CardDraft =
  | WelcomeDraft
  | WeeklyTargetsDraft
  | CardioDraft
  | NutritionGuideDraft
  | SampleDayDraft
  | TrackingDraft
  | FaqDraft
  | RoadmapDraft;

/** Cards with a text editor. Assessment / calories / macros / warmup /
 *  sampleDiet / supplements are engine-computed (ticks only); training
 *  keeps its bespoke TrainingPlanEditor. */
export const EDITABLE_KEYS: SectionKey[] = [
  "welcome",
  "weeklyTargets",
  "cardio",
  "nutritionGuide",
  "sampleDay",
  "tracking",
  "roadmap",
  "faq",
];

export function buildDraft(key: SectionKey, report: BlueprintResult): CardDraft | null {
  switch (key) {
    case "welcome": {
      const w = effectiveWelcome(report);
      return w ? { title: w.title, message: w.message } : null;
    }
    case "weeklyTargets": {
      const wt = effectiveWeeklyTargets(report);
      if (!wt) return null;
      return {
        baseline: { weightKg: wt.baseline.weightKg, bodyFatPct: wt.baseline.bodyFatPct },
        goal: {
          targetWeightKg: wt.goal.targetWeightKg,
          targetBodyFatPct: wt.goal.targetBodyFatPct,
          targetDate: wt.goal.targetDate,
        },
        weeklyRate: wt.weeklyRate ? { label: wt.weeklyRate.label } : null,
        expectations: wt.expectations.map((e) => ({ ...e })),
        nonScaleVictories: [...wt.nonScaleVictories],
      };
    }
    case "cardio": {
      const c = effectiveCardio(report);
      return c ? { rows: c.rows.map((r) => ({ ...r, progression: r.progression.map((p) => ({ ...p })) })) } : null;
    }
    case "nutritionGuide": {
      const g = effectiveNutritionGuide(report);
      return g
        ? {
            title: g.title,
            intro: g.intro,
            blocks: g.blocks.map((b) => ({ heading: b.heading, points: [...b.points] })),
            whoShouldNotCut: [...g.whoShouldNotCut],
          }
        : null;
    }
    case "sampleDay": {
      const s = effectiveSampleDay(report);
      return { meals: s.meals.map((m) => ({ name: m.name, items: [...m.items], macros: { ...m.macros } })) };
    }
    case "tracking":
      return { rows: effectiveTracking(report).map((r) => ({ ...r })) };
    case "faq":
      return { items: effectiveFaq(report).map((f) => ({ ...f })) };
    case "roadmap":
      return { phases: effectiveRoadmap(report).map((p) => ({ ...p })) };
    default:
      return null;
  }
}

export function overrideFromDraft(key: SectionKey, draft: CardDraft): PlanOverrides[keyof PlanOverrides] | undefined {
  switch (key) {
    case "welcome":
      return draft as PlanOverrides["welcome"];
    case "weeklyTargets": {
      const d = draft as WeeklyTargetsDraft;
      return {
        baseline: { ...d.baseline },
        goal: { ...d.goal },
        weeklyRate: d.weeklyRate ? { label: d.weeklyRate.label } : null,
        expectations: d.expectations,
        nonScaleVictories: d.nonScaleVictories,
      };
    }
    case "cardio":
      return { rows: (draft as CardioDraft).rows };
    case "nutritionGuide": {
      const d = draft as NutritionGuideDraft;
      return { title: d.title, intro: d.intro, blocks: d.blocks, whoShouldNotCut: d.whoShouldNotCut };
    }
    case "sampleDay":
      return { meals: (draft as SampleDayDraft).meals };
    case "tracking":
      return { rows: (draft as TrackingDraft).rows };
    case "faq":
      return { items: (draft as FaqDraft).items };
    case "roadmap":
      return { phases: (draft as RoadmapDraft).phases };
    default:
      return undefined;
  }
}
