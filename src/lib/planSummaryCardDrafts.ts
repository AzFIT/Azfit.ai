/* ═══════════════════════════════════════════════════════════════
   Plan Summary card drafts (Phase 99d Item 1, Phase 99g Item 1–3) —
   pure draft types and conversions for the per-card override
   system. Kept out of the editors .tsx so that file stays
   component-only (react-refresh).

   A draft = the FULL editable subset of a card. buildDraft
   initializes it from the EFFECTIVE card (generated base + existing
   override); overrideFromDraft converts it back into the stored
   override shape. Textareas that map to string arrays use one item
   per line.

   Phase 99g: assessment / calories / macros / training drafts join
   the editable set; coachNotes is a top-level result field (its
   "draft" is just the text); the welcome draft also carries the
   report-header override fields (Item 3). validateCardDraft is the
   single save-time gate — it REJECTS out-of-range values with an
   honest message (never clamps silently). Pure + unit-tested.
   ═══════════════════════════════════════════════════════════════ */

import type { BlueprintResult, GbcSession } from "./planBlueprint";
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
  effectiveAssessment,
  effectiveCalories,
  effectiveMacros,
  effectiveTraining,
  effectiveHeader,
  type SectionKey,
  type PlanOverrides,
  type HeaderOverride,
  type WelcomeOverride,
  type ExpectationRow,
} from "./planSummaryOverrides";

export type WelcomeDraft = { title: string; message: string; trainerName: string; businessName: string };
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

/* ── Phase 99g drafts ──────────────────────────────────────────── */
export type AssessmentDraft = {
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPct: number | null;
  goalStatement: string;
};
/** deficit as a WHOLE PERCENT (0–50) for the editor; stored as a
 *  fraction in the override. */
export type CaloriesDraft = { target: number | null; deficitPct: number | null };
export type MacrosDraft = {
  recommendedKey: string;
  styles: { key: string; name: string; proteinG: number; carbsG: number; fatsG: number }[];
};
export type TrainingDraft = {
  stepTarget: number | null;
  restRules: string[];
  /** name/kind/finisher/rounds are carried from the base (not editable
   *  in the 99g text-cell editor) so the stored override is complete. */
  sessions: { name: string; kind: "trainer" | "solo"; blocks: { label: string; exercises: string; setsReps: string; tempo: string; rest: string }[]; finisher?: string; rounds?: string }[];
};
export type CoachNotesDraft = { text: string };

export type CardDraft =
  | WelcomeDraft
  | WeeklyTargetsDraft
  | CardioDraft
  | NutritionGuideDraft
  | SampleDayDraft
  | TrackingDraft
  | FaqDraft
  | RoadmapDraft
  | AssessmentDraft
  | CaloriesDraft
  | MacrosDraft
  | TrainingDraft
  | CoachNotesDraft;

/** Cards with a text editor. warmup / sampleDiet / supplements stay
 *  engine-computed (ticks only); the training card has BOTH the 99g
 *  override editor (summary display text) and the Phase 81
 *  structured TrainingPlanEditor (the program itself). */
export const EDITABLE_KEYS: SectionKey[] = [
  "welcome",
  "assessment",
  "calories",
  "macros",
  "weeklyTargets",
  "training",
  "cardio",
  "nutritionGuide",
  "sampleDay",
  "tracking",
  "roadmap",
  "faq",
  "coachNotes",
];

export function buildDraft(key: SectionKey, report: BlueprintResult): CardDraft | null {
  switch (key) {
    case "welcome": {
      const w = effectiveWelcome(report);
      if (!w) return null;
      const h = effectiveHeader(report);
      return { title: w.title, message: w.message, trainerName: h.trainerName, businessName: h.businessName ?? "" };
    }
    case "assessment": {
      const a = effectiveAssessment(report);
      return { weightKg: a.weightKg, heightCm: a.heightCm, bodyFatPct: a.bodyFatPct, goalStatement: a.goalStatement };
    }
    case "calories": {
      const c = effectiveCalories(report);
      return { target: c.target, deficitPct: Math.round(c.deficitPct * 1000) / 10 };
    }
    case "macros": {
      const m = effectiveMacros(report);
      return {
        recommendedKey: m.recommended.key,
        styles: m.styles.map((s) => ({
          key: s.key,
          name: s.name,
          proteinG: s.atTarget.proteinG,
          carbsG: s.atTarget.carbsG,
          fatsG: s.atTarget.fatsG,
        })),
      };
    }
    case "training": {
      const t = effectiveTraining(report);
      return {
        stepTarget: t.stepTarget,
        restRules: [...t.restRules],
        sessions: t.sessions.map((s) => ({
          name: s.name,
          kind: s.kind,
          finisher: s.finisher,
          rounds: s.rounds,
          blocks: s.blocks.map((b) => ({ label: b.label, exercises: b.exercises, setsReps: b.setsReps, tempo: b.tempo, rest: b.rest })),
        })),
      };
    }
    case "coachNotes":
      return { text: typeof report.coachNotes === "string" ? report.coachNotes : "" };
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

/** Overload: the welcome branch always produces a WelcomeOverride (never
 *  undefined) — narrows the return for callers persisting it into
 *  overrides.welcome. */
export function overrideFromDraft(key: "welcome", draft: CardDraft): WelcomeOverride;
export function overrideFromDraft(key: SectionKey, draft: CardDraft): PlanOverrides[keyof PlanOverrides] | undefined;
export function overrideFromDraft(key: SectionKey, draft: CardDraft): PlanOverrides[keyof PlanOverrides] | undefined {
  switch (key) {
    case "welcome":
      return { title: (draft as WelcomeDraft).title, message: (draft as WelcomeDraft).message };
    case "assessment": {
      const d = draft as AssessmentDraft;
      return {
        weightKg: d.weightKg ?? undefined,
        heightCm: d.heightCm ?? undefined,
        bodyFatPct: d.bodyFatPct,
        goalStatement: d.goalStatement,
      };
    }
    case "calories": {
      const d = draft as CaloriesDraft;
      return {
        target: d.target ?? undefined,
        deficitPct: d.deficitPct == null ? undefined : d.deficitPct / 100,
      };
    }
    case "macros": {
      const d = draft as MacrosDraft;
      const styles: NonNullable<PlanOverrides["macros"]>["styles"] = {};
      for (const s of d.styles) styles[s.key] = { proteinG: s.proteinG, carbsG: s.carbsG, fatsG: s.fatsG };
      return { recommendedKey: d.recommendedKey, styles };
    }
    case "training": {
      const d = draft as TrainingDraft;
      return {
        stepTarget: d.stepTarget ?? undefined,
        restRules: d.restRules,
        sessions: d.sessions as GbcSession[],
      };
    }
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

/* ── Save-time validation (Phase 99g) ────────────────────────────
   Returns an honest message when a draft value is out of range, or
   null when everything is saveable. REJECTS — never clamps silently
   (the saveCard caller toasts the message and aborts the persist).
   coachNotes is free text (no validation). */
export function validateCardDraft(key: SectionKey, draft: CardDraft): string | null {
  switch (key) {
    case "welcome": {
      const d = draft as WelcomeDraft;
      if (!d.title.trim()) return "Welcome title can't be empty.";
      if (!d.message.trim()) return "Welcome message can't be empty.";
      return null;
    }
    case "assessment": {
      const d = draft as AssessmentDraft;
      if (d.weightKg == null || d.weightKg <= 0 || d.weightKg > 500) return "Weight must be between 0 and 500 kg.";
      if (d.heightCm == null || d.heightCm < 100 || d.heightCm > 250) return "Height must be between 100 and 250 cm.";
      if (d.bodyFatPct != null && (d.bodyFatPct < 2 || d.bodyFatPct > 70)) return "Body fat must be between 2% and 70% (or clear it).";
      if (!d.goalStatement.trim()) return "Goal statement can't be empty.";
      return null;
    }
    case "calories": {
      const d = draft as CaloriesDraft;
      if (d.target == null || d.target < 1200 || d.target > 10000)
        return "Calorie target must be between 1,200 kcal (the safety floor) and 10,000 kcal.";
      if (d.deficitPct == null || d.deficitPct < 0 || d.deficitPct > 50) return "Deficit must be between 0% and 50%.";
      return null;
    }
    case "macros": {
      const d = draft as MacrosDraft;
      if (!d.styles.some((s) => s.key === d.recommendedKey)) return "Pick a recommended style from the list.";
      for (const s of d.styles) {
        if (s.proteinG < 0 || s.carbsG < 0 || s.fatsG < 0) return `${s.name}: grams can't be negative.`;
        if (s.proteinG > 500 || s.carbsG > 1000 || s.fatsG > 500) return `${s.name}: those grams look too high — check the numbers.`;
      }
      return null;
    }
    case "training": {
      const d = draft as TrainingDraft;
      if (d.stepTarget == null || d.stepTarget < 0 || d.stepTarget > 60000) return "Step target must be between 0 and 60,000.";
      for (const s of d.sessions) {
        for (const b of s.blocks) {
          if (!b.exercises.trim()) return `${s.name} · block ${b.label}: exercise can't be empty.`;
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/** The headerOverride payload derived from a saved welcome draft —
 *  fields matching the GENERATED header are omitted (undefined = no
 *  override), so saving the welcome card without touching the header
 *  never marks the card "Edited". A blanked business name that the
 *  generated header had hides it (null). A blanked trainer name is
 *  NOT persisted (effectiveHeader falls back to the generated one). */
export function headerOverrideFromDraft(draft: WelcomeDraft, report: BlueprintResult): HeaderOverride {
  const out: HeaderOverride = {};
  const genTrainer = report.header.trainerName;
  const trainerName = draft.trainerName.trim();
  if (trainerName && trainerName !== genTrainer) out.trainerName = trainerName;
  const genBiz = (report.header.businessName ?? "").trim();
  const biz = draft.businessName.trim();
  if (biz !== genBiz) out.businessName = biz ? biz : null;
  return out;
}
