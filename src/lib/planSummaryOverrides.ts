/* ═══════════════════════════════════════════════════════════════
   planSummaryOverrides (Phase 99d Item 1+2, Phase 99g Item 1–3) —
   per-card manual edits and include/exclude ticks for the Plan
   Summary.

   Model: the engine-generated card values in
   plan_summaries.result are NEVER mutated. Trainers' edits are
   stored under result.overrides.<sectionKey> as the FULL editable
   subset of that card; render-time merge = base + defined override
   fields (arrays replace wholesale). result.included maps
   sectionKey → boolean (absent = included).

   Phase 99g extends editability to the remaining core cards
   (assessment / calories / macros / training), adds the free-text
   Coach's Notes card (result.coachNotes — a top-level result field,
   NOT an override) and the report-header override
   (result.headerOverride). Derived values are recomputed from the
   effective inputs where the math is card-local (BMI, fat/lean
   mass, macro below-floor flags, deficit display) so an edited card
   never shows a stale derived number.

   Pure + unit-tested. All renderers (app report, print view,
   export) read cards ONLY through the effective* helpers here, so
   the include ticks and overrides are respected everywhere by
   construction.
   ═══════════════════════════════════════════════════════════════ */

import type { BlueprintResult } from "./planBlueprint";
import type { GbcSession } from "./planBlueprint";

export type SectionKey =
  | "welcome"
  | "assessment"
  | "calories"
  | "macros"
  | "weeklyTargets"
  | "warmup"
  | "training"
  | "cardio"
  | "nutritionGuide"
  | "sampleDay"
  | "sampleDiet"
  | "supplements"
  | "tracking"
  | "roadmap"
  | "faq"
  | "coachNotes";

/* ── Override shapes (each = the full editable subset of a card) ── */
export interface WelcomeOverride {
  title?: string;
  message?: string;
}

export interface ExpectationRow {
  weeks: string;
  focus: string;
  expectation: string;
}

export interface WeeklyTargetsOverride {
  baseline?: { weightKg?: number | null; bodyFatPct?: number | null };
  goal?: { targetWeightKg?: number | null; targetBodyFatPct?: number | null; targetDate?: string | null };
  weeklyRate?: { label?: string } | null;
  expectations?: ExpectationRow[];
  nonScaleVictories?: string[];
}

export interface CardioOverride {
  rows?: import("./blueprintCardio").CardioRow[];
}

export interface NutritionGuideOverride {
  title?: string;
  intro?: string;
  blocks?: { heading: string; points: string[] }[];
  whoShouldNotCut?: string[];
}

export interface SampleMealOverride {
  name: string;
  items: string[];
  macros: { kcal: number; p: number; c: number; f: number };
}

export interface SampleDayOverride {
  meals?: SampleMealOverride[];
}

export interface TrackingOverride {
  rows?: { what: string; frequency: string; note: string }[];
}

export interface FaqOverride {
  items?: { q: string; a: string }[];
}

export interface RoadmapOverride {
  phases?: { weeks: string; name: string; note: string }[];
}

/* ── Phase 99g Item 1: editable core cards ────────────────────── */

export interface AssessmentOverride {
  weightKg?: number;
  heightCm?: number;
  /** null = deliberate clear ("not measured"). */
  bodyFatPct?: number | null;
  goalStatement?: string;
}

export interface CaloriesOverride {
  target?: number;
  /** fraction 0–0.5 (validated at save). */
  deficitPct?: number;
}

export interface MacrosOverride {
  /** key of one of the report's macro styles. */
  recommendedKey?: string;
  /** per-style atTarget grams (full values, validated ≥ 0). */
  styles?: Record<string, { proteinG: number; carbsG: number; fatsG: number }>;
}

export interface TrainingOverride {
  restRules?: string[];
  stepTarget?: number;
  /** full sessions matched by index; name/kind/finisher/rounds are
   *  carried from the base so the stored override is complete. */
  sessions?: GbcSession[];
}

export interface HeaderOverride {
  trainerName?: string;
  /** null = deliberately hide the business name. */
  businessName?: string | null;
}

export interface PlanOverrides {
  welcome?: WelcomeOverride;
  weeklyTargets?: WeeklyTargetsOverride;
  cardio?: CardioOverride;
  nutritionGuide?: NutritionGuideOverride;
  sampleDay?: SampleDayOverride;
  tracking?: TrackingOverride;
  faq?: FaqOverride;
  roadmap?: RoadmapOverride;
  assessment?: AssessmentOverride;
  calories?: CaloriesOverride;
  macros?: MacrosOverride;
  training?: TrainingOverride;
}

/* ── Merge primitives ────────────────────────────────────────── */
/** Shallow merge taking only DEFINED override fields (null is a
 *  deliberate clear for nullable fields → kept as null). */
export function mergeDefined<T extends object>(base: T, ov: Partial<T> | undefined): T {
  if (!ov) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(ov)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Deep-merge the nullable sub-objects of the weekly-targets card. */
export function mergeWeeklyTargets(base: NonNullable<BlueprintResult["weeklyTargets"]>, ov: WeeklyTargetsOverride | undefined) {
  if (!ov) return base;
  return {
    ...base,
    baseline: mergeDefined(base.baseline, ov.baseline),
    goal: mergeDefined(base.goal, ov.goal),
    weeklyRate: ov.weeklyRate === undefined ? base.weeklyRate : ov.weeklyRate === null ? null : mergeDefined(base.weeklyRate ?? { minKg: 0, maxKg: 0, label: "" }, ov.weeklyRate),
    expectations: ov.expectations ?? base.expectations,
    nonScaleVictories: ov.nonScaleVictories ?? base.nonScaleVictories,
  };
}

/* ── Effective-card helpers (the ONLY way renderers read cards) ── */
export function effectiveWelcome(r: BlueprintResult): { title: string; message: string } | undefined {
  if (!r.welcome) return undefined;
  return mergeDefined(r.welcome, r.overrides?.welcome);
}

export function effectiveWeeklyTargets(r: BlueprintResult) {
  if (!r.weeklyTargets) return undefined;
  return mergeWeeklyTargets(r.weeklyTargets, r.overrides?.weeklyTargets);
}

export function effectiveCardio(r: BlueprintResult) {
  if (!r.cardio) return undefined;
  const rows = r.overrides?.cardio?.rows;
  return rows ? { ...r.cardio, rows } : r.cardio;
}

export function effectiveNutritionGuide(r: BlueprintResult) {
  const g = r.nutritionGuide;
  if (!g) return undefined;
  const ov = r.overrides?.nutritionGuide;
  if (!ov) return g;
  return {
    ...g,
    title: ov.title ?? g.title,
    intro: ov.intro ?? g.intro,
    blocks: ov.blocks ?? g.blocks,
    whoShouldNotCut: ov.whoShouldNotCut ?? g.whoShouldNotCut,
  };
}

/** Edited meals replace the generated ones; totals are ALWAYS
 *  recomputed from the effective meals (never stale, never faked). */
export function effectiveSampleDay(r: BlueprintResult) {
  const meals = r.overrides?.sampleDay?.meals;
  if (!meals) return r.sampleDay;
  const totals = meals.reduce(
    (t, m) => ({ kcal: t.kcal + m.macros.kcal, p: t.p + m.macros.p, c: t.c + m.macros.c, f: t.f + m.macros.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const withinTolerance = Math.abs(totals.kcal - r.calories.target) <= r.calories.target * 0.05;
  return { meals, totals, withinTolerance };
}

export function effectiveTracking(r: BlueprintResult) {
  const rows = r.overrides?.tracking?.rows;
  return rows ?? r.tracking;
}

export function effectiveFaq(r: BlueprintResult) {
  const items = r.overrides?.faq?.items;
  return items ?? r.faq;
}

export function effectiveRoadmap(r: BlueprintResult) {
  const phases = r.overrides?.roadmap?.phases;
  return phases ?? r.roadmap;
}

/* ── Phase 99g Item 1: effective core cards ───────────────────── */
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Assessment: weight/height/body-fat/goal-statement edits merge over
 *  the base card; BMI + fat/lean mass are RECOMPUTED from the
 *  effective inputs (pure card-local math) so an edited card never
 *  shows a stale derived number. BMR + maintenance stay base — they
 *  belong to the calorie engine (age/gender live outside this card). */
export function effectiveAssessment(r: BlueprintResult) {
  const ov = r.overrides?.assessment;
  const a = r.assessment;
  const weightKg = ov?.weightKg ?? a.weightKg;
  const heightCm = ov?.heightCm ?? a.heightCm;
  const bodyFatPct = ov?.bodyFatPct === undefined ? a.bodyFatPct : ov.bodyFatPct;
  const leanMassKg = bodyFatPct != null ? round1(weightKg * (1 - bodyFatPct / 100)) : null;
  return {
    weightKg,
    heightCm,
    bmi: round1(weightKg / (heightCm / 100) ** 2),
    bodyFatPct,
    fatMassKg: leanMassKg != null ? round1(weightKg - leanMassKg) : null,
    leanMassKg,
    bmr: a.bmr,
    bmrMethod: a.bmrMethod,
    maintenance: a.maintenance,
    goalStatement: ov?.goalStatement ?? r.goal.statement,
  };
}

/** Calories: target/deficitPct edits merge over the base. When the
 *  target is edited, the displayed deficit is recomputed from
 *  maintenance (never a stale pair), and the "raised to the safety
 *  floor" note no longer applies (the manual target is deliberate —
 *  save-time validation enforces ≥ the 1,200 kcal floor). */
export function effectiveCalories(r: BlueprintResult) {
  const ov = r.overrides?.calories;
  const base = r.calories;
  const overridden = !!(ov && (ov.target !== undefined || ov.deficitPct !== undefined));
  const target = ov?.target ?? base.target;
  const deficitPct =
    ov?.deficitPct ?? (ov?.target != null && base.maintenance > 0
      ? Math.max(0, (base.maintenance - target) / base.maintenance)
      : base.deficitPct);
  return {
    ...base,
    target,
    deficitPct,
    deficitPerDay: base.maintenance - target,
    clampedByFloor: overridden ? false : base.clampedByFloor,
    overridden,
  };
}

/** Macros: the recommended-style pick and per-style atTarget grams
 *  merge over the base table; below-floor flags + notes are
 *  RECOMPUTED from the effective protein vs the protein floor so a
 *  boosted style never carries a stale ⚠ (or a stale all-clear). */
export function effectiveMacros(r: BlueprintResult) {
  const ov = r.overrides?.macros;
  const styles = r.macroStyles.map((s) => {
    const g = ov?.styles?.[s.key];
    if (!g) return s;
    const proteinG = g.proteinG;
    const belowFloor = proteinG < r.proteinFloor.grams;
    return {
      ...s,
      atTarget: {
        proteinG,
        carbsG: g.carbsG,
        fatsG: g.fatsG,
        belowFloor,
        note: belowFloor ? "Below your protein floor — boost protein by trimming carbs" : null,
      },
    };
  });
  let recommended = r.recommended;
  if (ov?.recommendedKey) {
    const style = styles.find((s) => s.key === ov.recommendedKey);
    if (style) {
      recommended = { key: style.key, name: style.name, reason: "your coach's pick for this plan" };
    }
  }
  const anyBelowFloor = styles.some((s) => s.atTarget.belowFloor);
  return { target: r.calories.target, maintenance: r.calories.maintenance, styles, recommended, proteinFloor: r.proteinFloor, anyBelowFloor };
}

/** Training: restRules / stepTarget / session blocks merge over the
 *  base card. (The Phase 81 structured TrainingPlanEditor writes the
 *  program itself via onSaveTraining — this override path only
 *  changes what the SUMMARY displays.) */
export function effectiveTraining(r: BlueprintResult) {
  const ov = r.overrides?.training;
  return {
    sessions: ov?.sessions ?? r.training.sessions,
    restRules: ov?.restRules ?? r.training.restRules,
    stepTarget: ov?.stepTarget ?? r.training.stepTarget,
    metaNotes: r.trainingMeta?.notes ?? [],
  };
}

/* ── Phase 99g Item 2: Coach's Notes ──────────────────────────── */
/** Coach's Notes = a trainer free-text card stored at the TOP level
 *  of result (result.coachNotes), not in overrides — absent or blank
 *  = no card anywhere. */
export function effectiveCoachNotes(r: BlueprintResult): string | null {
  return typeof r.coachNotes === "string" && r.coachNotes.trim().length > 0 ? r.coachNotes : null;
}

/** Markdown-lite paragraphs: split on blank lines, trim, drop
 *  empties. Line breaks inside a paragraph are preserved by the
 *  renderers (whitespace-pre-wrap / <br>) — never interpreted as
 *  HTML. */
export function coachNotesParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/* ── Phase 99g Item 3: header override ────────────────────────── */
/** The report header the renderers show: headerOverride replaces the
 *  generated trainer/business names (an empty trainer name falls
 *  back to the generated one; businessName null hides it). */
export function effectiveHeader(r: BlueprintResult): { trainerName: string; businessName?: string | null } {
  const ov = r.headerOverride;
  const trainerName = ov?.trainerName?.trim() ? ov.trainerName.trim() : r.header.trainerName;
  const businessName = ov?.businessName === undefined ? r.header.businessName : ov.businessName;
  return { trainerName, businessName };
}

/* ── Include ticks ───────────────────────────────────────────── */
export function isIncluded(included: BlueprintResult["included"], key: SectionKey): boolean {
  return included?.[key] !== false;
}

export const ALL_SECTION_KEYS: SectionKey[] = [
  "welcome",
  "assessment",
  "calories",
  "macros",
  "weeklyTargets",
  "warmup",
  "training",
  "cardio",
  "nutritionGuide",
  "sampleDay",
  "sampleDiet",
  "supplements",
  "tracking",
  "roadmap",
  "faq",
  "coachNotes",
];

/** Sections actually present in this report (old summaries lack the
 *  99c/99g cards) — counting only present sections for the last-tick rule. */
export function presentSectionKeys(r: BlueprintResult): SectionKey[] {
  const present: SectionKey[] = ["assessment", "calories", "macros", "training", "sampleDay", "tracking", "roadmap", "faq"];
  if (r.welcome) present.push("welcome");
  if (r.weeklyTargets) present.push("weeklyTargets");
  if (r.extras?.warmup) present.push("warmup");
  if (r.cardio) present.push("cardio");
  if (r.nutritionGuide) present.push("nutritionGuide");
  if (r.extras?.sampleDiet) present.push("sampleDiet");
  if (r.extras?.supplements) present.push("supplements");
  if (effectiveCoachNotes(r)) present.push("coachNotes");
  return present;
}

/** Single-key presence check (shared by the app + print renumbering). */
export function sectionPresent(r: BlueprintResult, key: SectionKey): boolean {
  switch (key) {
    case "welcome": return !!r.welcome;
    case "assessment":
    case "calories":
    case "macros":
    case "training":
    case "sampleDay":
    case "tracking":
    case "roadmap":
    case "faq": return true;
    case "weeklyTargets": return !!r.weeklyTargets;
    case "warmup": return !!r.extras?.warmup;
    case "cardio": return !!r.cardio;
    case "nutritionGuide": return !!r.nutritionGuide;
    case "sampleDiet": return !!r.extras?.sampleDiet;
    case "supplements": return !!r.extras?.supplements;
    case "coachNotes": return effectiveCoachNotes(r) != null;
  }
}

export function includedCount(r: BlueprintResult): number {
  return presentSectionKeys(r).filter((k) => isIncluded(r.included, k)).length;
}

/* ── Dynamic section numbering ───────────────────────────────── */
/** Report section order (welcome is the unnumbered cover). The
 *  "femaleNote" pseudo-section is the female reassurance card — always
 *  included (it has no tick) but only present for female fat-loss
 *  clients. */
const NUMBERED_ORDER: (SectionKey | "femaleNote")[] = [
  "assessment",
  "femaleNote",
  "calories",
  "macros",
  "weeklyTargets",
  "warmup",
  "training",
  "cardio",
  "nutritionGuide",
  "sampleDay",
  "sampleDiet",
  "supplements",
  "tracking",
  "roadmap",
  "faq",
  "coachNotes",
];

/** Section number under presence + include rules. Returns 0 when the
 *  section is absent from this report or excluded via its tick — the
 *  renderers skip sections whose number is 0. Replaces the brittle
 *  shift-constant numbering from 99c, which broke as soon as cards
 *  could be excluded. */
export function sectionNumber(r: BlueprintResult, key: SectionKey | "femaleNote"): number {
  let n = 0;
  for (const k of NUMBERED_ORDER) {
    const present = k === "femaleNote" ? !!r.femaleReassurance : sectionPresent(r, k);
    const inc = k === "femaleNote" ? true : isIncluded(r.included, k);
    if (!present || !inc) continue;
    n += 1;
    if (k === key) return n;
  }
  return 0;
}
