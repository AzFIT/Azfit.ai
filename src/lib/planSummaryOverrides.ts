/* ═══════════════════════════════════════════════════════════════
   planSummaryOverrides (Phase 99d Item 1+2) — per-card manual edits
   and include/exclude ticks for the Plan Summary.

   Model: the engine-generated card values in
   plan_summaries.result are NEVER mutated. Trainers' edits are
   stored under result.overrides.<sectionKey> as the FULL editable
   subset of that card; render-time merge = base + defined override
   fields (arrays replace wholesale). result.included maps
   sectionKey → boolean (absent = included).

   Pure + unit-tested. Both renderers (app report + print/export)
   read cards ONLY through the effective* helpers here, so the
   include ticks and overrides are respected everywhere by
   construction.
   ═══════════════════════════════════════════════════════════════ */

import type { BlueprintResult } from "./planBlueprint";

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
  | "faq";

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

export interface PlanOverrides {
  welcome?: WelcomeOverride;
  weeklyTargets?: WeeklyTargetsOverride;
  cardio?: CardioOverride;
  nutritionGuide?: NutritionGuideOverride;
  sampleDay?: SampleDayOverride;
  tracking?: TrackingOverride;
  faq?: FaqOverride;
  roadmap?: RoadmapOverride;
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
];

/** Sections actually present in this report (old summaries lack the
 *  99c cards) — counting only present sections for the last-tick rule. */
export function presentSectionKeys(r: BlueprintResult): SectionKey[] {
  const present: SectionKey[] = ["assessment", "calories", "macros", "training", "sampleDay", "tracking", "roadmap", "faq"];
  if (r.welcome) present.push("welcome");
  if (r.weeklyTargets) present.push("weeklyTargets");
  if (r.extras?.warmup) present.push("warmup");
  if (r.cardio) present.push("cardio");
  if (r.nutritionGuide) present.push("nutritionGuide");
  if (r.extras?.sampleDiet) present.push("sampleDiet");
  if (r.extras?.supplements) present.push("supplements");
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
