/* ═══════════════════════════════════════════════════════════════
   planSummaryRender (Phase 99e Item 1) — the SINGLE section resolver
   for the Plan Summary. App report (PlanSummaryTab), print view
   (PrintPlanSummary) and the plan-export edge function ALL consume
   this module, so overrides, include ticks, section order, numbering
   and display formatting can never diverge between renderers.

   Input: the plan_summaries row's result JSONB (BlueprintResult).
   Output: ordered resolved sections — each with its dynamic section
   number, its resolved title, and its effective (override-merged)
   display data. Absent (old summaries) and tick-excluded sections
   are simply absent from the list.

   Pure + unit-tested. No React, no DOM, no network. Deno-safe (the
   edge function bundles it) — only dependency is
   src/lib/planSummaryOverrides.ts plus type-only imports.
   ═══════════════════════════════════════════════════════════════ */

import type { BlueprintResult } from "./planBlueprint";
import {
  isIncluded,
  sectionNumber,
  effectiveWelcome,
  effectiveWeeklyTargets,
  effectiveCardio,
  effectiveNutritionGuide,
  effectiveSampleDay,
  effectiveTracking,
  effectiveFaq,
  effectiveRoadmap,
  type SectionKey,
} from "./planSummaryOverrides";

/* ── Local display formatting (mirrors src/lib/utils.ts formatNumber
   and the print view's date style — kept inline so this module stays
   dependency-light for the Deno bundle) ───────────────────────── */
function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** The female-reassurance copy — one source (was hardcoded in the print
 *  view; now the resolver owns it and every renderer reads it here). */
export const FEMALE_NOTE_TEXT =
  'You will NOT bulk up. Women carry roughly 1/10 to 1/20 of the testosterone men do, and in a calorie deficit there is simply no surplus to build size from. Lifting weights in a deficit makes you smaller and firmer — "toned" is just muscle plus less fat. The strength work in this plan is what keeps your shape while the fat comes off.';

/* ── Resolved section union ──────────────────────────────────── */
export interface ResolvedSectionBase {
  /** 0 = the unnumbered welcome cover. */
  number: number;
  /** Resolved display title WITHOUT the number prefix. */
  title: string;
}

export interface ResolvedWelcome extends ResolvedSectionBase {
  key: "welcome";
  data: { title: string; message: string };
}
export interface ResolvedAssessment extends ResolvedSectionBase {
  key: "assessment";
  data: {
    weightKg: number;
    heightCm: number;
    bmi: number;
    bodyFatPct: number | null;
    fatMassKg: number | null;
    leanMassKg: number | null;
    bmr: number;
    bmrMethod: string;
    maintenance: number;
    goalStatement: string;
  };
}
export interface ResolvedFemaleNote extends ResolvedSectionBase {
  key: "femaleNote";
  data: { text: string };
}
export interface ResolvedCalories extends ResolvedSectionBase {
  key: "calories";
  data: {
    maintenance: number;
    target: number;
    isFatLoss: boolean;
    deficitPct: number;
    weeklyLossKg: number | null;
    clampedByFloor: boolean;
  };
}
export interface ResolvedMacros extends ResolvedSectionBase {
  key: "macros";
  data: {
    target: number;
    maintenance: number;
    styles: BlueprintResult["macroStyles"];
    recommended: BlueprintResult["recommended"];
    proteinFloor: BlueprintResult["proteinFloor"];
    anyBelowFloor: boolean;
  };
}
export interface ResolvedWeeklyTargets extends ResolvedSectionBase {
  key: "weeklyTargets";
  data: NonNullable<ReturnType<typeof effectiveWeeklyTargets>> & {
    baselineWeightDisplay: string;
    baselineSub: string;
    goalDisplay: string;
    goalSub: string;
  };
}
export interface ResolvedWarmup extends ResolvedSectionBase {
  key: "warmup";
  data: NonNullable<NonNullable<BlueprintResult["extras"]>["warmup"]>;
}
export interface ResolvedTraining extends ResolvedSectionBase {
  key: "training";
  data: {
    sessions: BlueprintResult["training"]["sessions"];
    restRules: string[];
    stepTarget: number;
    metaNotes: string[];
  };
}
export interface ResolvedCardio extends ResolvedSectionBase {
  key: "cardio";
  data: NonNullable<ReturnType<typeof effectiveCardio>>;
}
export interface ResolvedNutritionGuide extends ResolvedSectionBase {
  key: "nutritionGuide";
  data: NonNullable<ReturnType<typeof effectiveNutritionGuide>>;
}
export interface ResolvedSampleDay extends ResolvedSectionBase {
  key: "sampleDay";
  data: ReturnType<typeof effectiveSampleDay> & { foodRules: string[] };
}
export interface ResolvedSampleDiet extends ResolvedSectionBase {
  key: "sampleDiet";
  data: NonNullable<NonNullable<BlueprintResult["extras"]>["sampleDiet"]>;
}
export interface ResolvedSupplements extends ResolvedSectionBase {
  key: "supplements";
  data: NonNullable<NonNullable<BlueprintResult["extras"]>["supplements"]>;
}
export interface ResolvedTracking extends ResolvedSectionBase {
  key: "tracking";
  data: { rows: ReturnType<typeof effectiveTracking> };
}
export interface ResolvedRoadmap extends ResolvedSectionBase {
  key: "roadmap";
  data: { phases: NonNullable<ReturnType<typeof effectiveRoadmap>> };
}
export interface ResolvedFaq extends ResolvedSectionBase {
  key: "faq";
  data: { items: NonNullable<ReturnType<typeof effectiveFaq>> };
}

export type ResolvedSection =
  | ResolvedWelcome
  | ResolvedAssessment
  | ResolvedFemaleNote
  | ResolvedCalories
  | ResolvedMacros
  | ResolvedWeeklyTargets
  | ResolvedWarmup
  | ResolvedTraining
  | ResolvedCardio
  | ResolvedNutritionGuide
  | ResolvedSampleDay
  | ResolvedSampleDiet
  | ResolvedSupplements
  | ResolvedTracking
  | ResolvedRoadmap
  | ResolvedFaq;

export type ResolvedSectionKey = ResolvedSection["key"];

/* ── Title resolution ────────────────────────────────────────── */
const FIXED_TITLES = {
  assessment: "Starting Assessment",
  calories: "Calorie Targets",
  macros: "Macro Targets — All Options",
  weeklyTargets: "Your Weekly Targets & Expectations",
  warmup: "Dynamic Warm-Up & Mobility",
  cardio: "Cardio — Machines, Intensity & Progression",
  sampleDiet: "Sample Diet Day — Your Foods",
  supplements: "Supplementation & Hydration",
  tracking: "Tracking & Accountability",
  faq: "FAQ",
} as const;

type FixedTitleKey = keyof typeof FIXED_TITLES;

function titleFor(r: BlueprintResult, key: SectionKey): string {
  switch (key) {
    case "training":
      return `Training Plan (GBC) · ${r.training.sessions.length} sessions + ${fmt(r.training.stepTarget)} steps/day`;
    case "sampleDay":
      return `Sample Day of Eating (${r.recommended.name})`;
    case "roadmap":
      return `Program Roadmap (${r.goal.programWeeks} weeks)`;
    case "nutritionGuide":
      return effectiveNutritionGuide(r)?.title ?? "Nutrition Guide";
    default:
      return FIXED_TITLES[key as FixedTitleKey];
  }
}

/** Display title: "N · Title" for numbered sections, plain title for the
 *  unnumbered welcome cover. */
export function displayTitle(s: ResolvedSection): string {
  return s.number > 0 ? `${s.number} · ${s.title}` : s.title;
}

/* ── The resolver ────────────────────────────────────────────── */
/** Ordered, numbered, filtered resolved sections for ANY renderer.
 *  Presence + include ticks are applied here — a section that is
 *  absent from this report or excluded by its tick never appears. */
export function resolvePlanSummary(r: BlueprintResult): ResolvedSection[] {
  const out: ResolvedSection[] = [];
  const push = (s: ResolvedSection | null) => {
    if (s) out.push(s);
  };

  /* Welcome cover — unnumbered, override-merged. */
  const welcome = effectiveWelcome(r);
  if (welcome && isIncluded(r.included, "welcome")) {
    push({ key: "welcome", number: 0, title: welcome.title, data: welcome });
  }

  /* Numbered sections — presence + include via sectionNumber (0 = skip),
   *  same rules the 99d renderers used, now in one place. */
  const a = r.assessment;
  if (sectionNumber(r, "assessment") > 0) {
    push({
      key: "assessment",
      number: sectionNumber(r, "assessment"),
      title: titleFor(r, "assessment"),
      data: {
        weightKg: a.weightKg,
        heightCm: a.heightCm,
        bmi: a.bmi,
        bodyFatPct: a.bodyFatPct,
        fatMassKg: a.fatMassKg,
        leanMassKg: a.leanMassKg,
        bmr: a.bmr,
        bmrMethod: a.bmrMethod,
        maintenance: a.maintenance,
        goalStatement: r.goal.statement,
      },
    });
  }

  if (r.femaleReassurance) {
    const n = sectionNumber(r, "femaleNote");
    if (n > 0) push({ key: "femaleNote", number: n, title: "A note before we start", data: { text: FEMALE_NOTE_TEXT } });
  }

  if (sectionNumber(r, "calories") > 0) {
    push({
      key: "calories",
      number: sectionNumber(r, "calories"),
      title: titleFor(r, "calories"),
      data: {
        maintenance: r.calories.maintenance,
        target: r.calories.target,
        isFatLoss: r.goal.isFatLoss,
        deficitPct: r.calories.deficitPct,
        weeklyLossKg: r.outcomes?.weeklyLossKg ?? null,
        clampedByFloor: r.calories.clampedByFloor,
      },
    });
  }

  if (sectionNumber(r, "macros") > 0) {
    push({
      key: "macros",
      number: sectionNumber(r, "macros"),
      title: titleFor(r, "macros"),
      data: {
        target: r.calories.target,
        maintenance: r.calories.maintenance,
        styles: r.macroStyles,
        recommended: r.recommended,
        proteinFloor: r.proteinFloor,
        anyBelowFloor: r.macroStyles.some((s) => s.atTarget.belowFloor),
      },
    });
  }

  const weeklyTargets = effectiveWeeklyTargets(r);
  if (weeklyTargets && sectionNumber(r, "weeklyTargets") > 0) {
    const { baseline, goal } = weeklyTargets;
    push({
      key: "weeklyTargets",
      number: sectionNumber(r, "weeklyTargets"),
      title: titleFor(r, "weeklyTargets"),
      data: {
        ...weeklyTargets,
        baselineWeightDisplay: baseline.weightKg != null ? `${baseline.weightKg} kg` : "Not recorded yet",
        baselineSub:
          (baseline.bodyFatPct != null ? `${baseline.bodyFatPct}% body fat · ` : "") +
          (baseline.recordedAt ? `first logged ${fmtDate(baseline.recordedAt)}` : "log your first weigh-in"),
        goalDisplay: goal.targetWeightKg != null ? `${goal.targetWeightKg} kg` : goal.label,
        goalSub:
          [
            goal.targetBodyFatPct != null ? `${goal.targetBodyFatPct}% BF` : null,
            goal.targetDate ? `by ${fmtDate(goal.targetDate)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || goal.label,
      },
    });
  }

  if (r.extras?.warmup && sectionNumber(r, "warmup") > 0) {
    push({ key: "warmup", number: sectionNumber(r, "warmup"), title: titleFor(r, "warmup"), data: r.extras.warmup });
  }

  if (sectionNumber(r, "training") > 0) {
    push({
      key: "training",
      number: sectionNumber(r, "training"),
      title: titleFor(r, "training"),
      data: {
        sessions: r.training.sessions,
        restRules: r.training.restRules,
        stepTarget: r.training.stepTarget,
        metaNotes: r.trainingMeta?.notes ?? [],
      },
    });
  }

  const cardio = effectiveCardio(r);
  if (cardio && sectionNumber(r, "cardio") > 0) {
    push({ key: "cardio", number: sectionNumber(r, "cardio"), title: titleFor(r, "cardio"), data: cardio });
  }

  const nutritionGuide = effectiveNutritionGuide(r);
  if (nutritionGuide && sectionNumber(r, "nutritionGuide") > 0) {
    push({
      key: "nutritionGuide",
      number: sectionNumber(r, "nutritionGuide"),
      title: titleFor(r, "nutritionGuide"),
      data: nutritionGuide,
    });
  }

  if (sectionNumber(r, "sampleDay") > 0) {
    push({
      key: "sampleDay",
      number: sectionNumber(r, "sampleDay"),
      title: titleFor(r, "sampleDay"),
      data: { ...effectiveSampleDay(r), foodRules: r.foodRules },
    });
  }

  if (r.extras?.sampleDiet && sectionNumber(r, "sampleDiet") > 0) {
    push({
      key: "sampleDiet",
      number: sectionNumber(r, "sampleDiet"),
      title: titleFor(r, "sampleDiet"),
      data: r.extras.sampleDiet,
    });
  }

  if (r.extras?.supplements && sectionNumber(r, "supplements") > 0) {
    push({
      key: "supplements",
      number: sectionNumber(r, "supplements"),
      title: titleFor(r, "supplements"),
      data: r.extras.supplements,
    });
  }

  const tracking = effectiveTracking(r);
  if (tracking && sectionNumber(r, "tracking") > 0) {
    push({ key: "tracking", number: sectionNumber(r, "tracking"), title: titleFor(r, "tracking"), data: { rows: tracking } });
  }

  const roadmap = effectiveRoadmap(r);
  if (roadmap && sectionNumber(r, "roadmap") > 0) {
    push({ key: "roadmap", number: sectionNumber(r, "roadmap"), title: titleFor(r, "roadmap"), data: { phases: roadmap } });
  }

  const faq = effectiveFaq(r);
  if (faq && sectionNumber(r, "faq") > 0) {
    push({ key: "faq", number: sectionNumber(r, "faq"), title: titleFor(r, "faq"), data: { items: faq } });
  }

  return out;
}

/** Key → resolved section lookup for renderers that keep per-section
 *  JSX (app report, print view). Excluded/absent → undefined. */
export function resolveByKey(r: BlueprintResult): Map<ResolvedSectionKey, ResolvedSection> {
  return new Map(resolvePlanSummary(r).map((s) => [s.key, s]));
}

/** Typed single-section accessor for renderers that keep per-section
 *  JSX — narrows the union by key. */
export type ResolvedSectionOf<K extends ResolvedSectionKey> = Extract<ResolvedSection, { key: K }>;
