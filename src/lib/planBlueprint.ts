/* ═══════════════════════════════════════════════════════════════
   Plan Blueprint engine (Phase 61) — pure calculation module for
   the client-facing Plan Summary ("Blueprint") report.
   Everything deterministic + unit-tested; the UI only renders the
   BlueprintResult this module returns.
   ═══════════════════════════════════════════════════════════════ */

import { calculateBMR, calculateBMRKatchMcArdle, ACTIVITY_LEVELS, type ActivityLevelKey } from "./tdee";

/* ── Inputs ──────────────────────────────────────────────────── */
export interface BlueprintInputs {
  gender: "male" | "female" | "other";
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  /** existing ACTIVITY_LEVELS key; the form defaults to "office" */
  activityKey: ActivityLevelKey | "office";
  trainerSessionsPerWeek: number;
  soloSessionsPerWeek: number;
  stepTarget: number;
  goalType: string; // lose_weight / reduce_body_fat / build_muscle / increase_strength / improve_fitness / custom
  pace: "conservative" | "standard" | "aggressive";
  programWeeks: number;
  dietBreak: boolean;
  trainerName: string;
  businessName?: string;
}

export const DEFAULT_INPUTS: Omit<BlueprintInputs, "trainerName"> = {
  gender: "female",
  age: 40,
  heightCm: 170,
  weightKg: 75,
  bodyFatPct: null,
  activityKey: "office",
  trainerSessionsPerWeek: 2,
  soloSessionsPerWeek: 1,
  stepTarget: 9000,
  goalType: "lose_weight",
  pace: "standard",
  programWeeks: 16,
  dietBreak: true,
};

/* ── Activity multipliers ──────────────────────────────────────
   Existing ACTIVITY_LEVELS plus the documented conservative bias:
   "office job + ~3 sessions/week" = 1.4 (the form's default). */
export const ACTIVITY_PRESETS: Record<string, { label: string; multiplier: number }> = {
  sedentary: { label: "Sedentary (desk, little movement)", multiplier: ACTIVITY_LEVELS.sedentary },
  light: { label: "Light (some walking)", multiplier: ACTIVITY_LEVELS.light },
  office: { label: "Office job + 3 sessions/week", multiplier: 1.4 },
  moderate: { label: "Moderate (on feet most days)", multiplier: ACTIVITY_LEVELS.moderate },
  very: { label: "Very active (physical job + training)", multiplier: ACTIVITY_LEVELS.very },
};

export function resolveActivityMultiplier(key: string): number {
  return ACTIVITY_PRESETS[key]?.multiplier ?? ACTIVITY_PRESETS.office.multiplier;
}

/* ── Calorie targets ─────────────────────────────────────────── */
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export interface CalorieTargets {
  bmr: number;
  bmrMethod: "katch-mcardle" | "mifflin";
  leanMassKg: number | null;
  fatMassKg: number | null;
  tdee: number;
  maintenance: number;
  target: number;
  deficitPct: number;
  deficitPerDay: number;
  /** true when the hard floor (BMR × 1.05 / 1,200 kcal) had to clamp the target */
  clampedByFloor: boolean;
}

export const PACE_DEFICITS: Record<BlueprintInputs["pace"], number> = {
  conservative: 0.15,
  standard: 0.2,
  aggressive: 0.25,
};

export function computeBodyAndCalories(input: Pick<BlueprintInputs, "gender" | "age" | "heightCm" | "weightKg" | "bodyFatPct" | "activityKey" | "pace">): CalorieTargets {
  const hasBf = input.bodyFatPct != null && input.bodyFatPct > 0;
  const leanMass = hasBf ? input.weightKg * (1 - (input.bodyFatPct as number) / 100) : null;
  const bmr = Math.round(
    hasBf
      ? calculateBMRKatchMcArdle(input.bodyFatPct as number, input.weightKg)
      : calculateBMR(input.weightKg, input.heightCm, input.age, input.gender === "female" ? "female" : "male"),
  );
  const tdee = Math.round(bmr * resolveActivityMultiplier(input.activityKey));
  const maintenance = roundTo(tdee, 50);
  const deficitPct = PACE_DEFICITS[input.pace];
  const rawTarget = roundTo(maintenance * (1 - deficitPct), 10);
  const floor = Math.max(bmr * 1.05, 1200);
  const target = Math.max(rawTarget, roundTo(floor, 10));
  return {
    bmr,
    bmrMethod: hasBf ? "katch-mcardle" : "mifflin",
    leanMassKg: leanMass !== null ? Math.round(leanMass * 10) / 10 : null,
    fatMassKg: leanMass !== null ? Math.round((input.weightKg - leanMass) * 10) / 10 : null,
    tdee,
    maintenance,
    target,
    deficitPct,
    deficitPerDay: maintenance - target,
    clampedByFloor: rawTarget < floor,
  };
}

/* ── Macro styles ────────────────────────────────────────────── */
export interface MacroStyle {
  key: string;
  name: string;
  split: [number, number, number]; // P / C / F percent
  bestFor: string;
}

export const MACRO_STYLES: MacroStyle[] = [
  { key: "balanced", name: "Balanced", split: [25, 45, 30], bestFor: "Sustainable everyday eating" },
  { key: "high-protein", name: "High Protein", split: [35, 35, 30], bestFor: "Best muscle retention & satiety with GBC training" },
  { key: "low-carb", name: "Low Carb", split: [35, 25, 40], bestFor: "Carb-sensitive days / fewer cravings" },
  { key: "high-carb", name: "High Carb", split: [25, 55, 20], bestFor: "Hard training blocks & performance" },
  { key: "moderate-carb-low-fat", name: "Moderate Carb / Low Fat", split: [30, 45, 25], bestFor: "Middle ground when fat needs to stay low" },
];

export interface MacroGrams {
  proteinG: number;
  carbsG: number;
  fatsG: number;
}

export function macroGrams(calories: number, split: [number, number, number]): MacroGrams {
  return {
    proteinG: Math.round((calories * split[0]) / 100 / 4),
    carbsG: Math.round((calories * split[1]) / 100 / 4),
    fatsG: Math.round((calories * split[2]) / 100 / 9),
  };
}

/* ── Protein floor ───────────────────────────────────────────── */
export interface ProteinFloor {
  grams: number;
  basis: string;
}

export function proteinFloor(weightKg: number, leanMassKg: number | null): ProteinFloor {
  const raw = leanMassKg != null ? 2.2 * leanMassKg : 1.8 * weightKg;
  const grams = Math.round(Math.min(raw, 2.2 * weightKg));
  return {
    grams,
    basis: leanMassKg != null ? `2.2 g × ${Math.round(leanMassKg)} kg lean mass` : `1.8 g × ${weightKg} kg bodyweight`,
  };
}

export interface StyledMacros extends MacroStyle {
  atTarget: MacroGrams & { belowFloor: boolean; note: string | null };
  atMaintenance: MacroGrams;
}

export function buildMacroTable(target: number, maintenance: number, floorG: number): StyledMacros[] {
  return MACRO_STYLES.map((s) => {
    const t = macroGrams(target, s.split);
    const belowFloor = t.proteinG < floorG;
    return {
      ...s,
      atTarget: {
        ...t,
        belowFloor,
        note: belowFloor ? "Below your protein floor — boost protein by trimming carbs" : null,
      },
      atMaintenance: macroGrams(maintenance, s.split),
    };
  });
}

export const RECOMMENDATION = {
  "high-protein": "best muscle retention & satiety with GBC training",
  balanced: "the most sustainable everyday split for this goal",
} as const;

export function recommendStyle(isFatLoss: boolean): { key: string; reason: string } {
  return isFatLoss ? { key: "high-protein", reason: RECOMMENDATION["high-protein"] } : { key: "balanced", reason: RECOMMENDATION.balanced };
}

/* ── Goals + expected outcomes ───────────────────────────────── */
export function isFatLossGoal(goalType: string): boolean {
  const k = goalType.trim().toLowerCase().replace(/[_-]/g, " ");
  return ["lose weight", "reduce body fat", "fatloss", "fat loss", "lose fat", "recomposition"].includes(k);
}

export interface ExpectedOutcomes {
  weeklyLossKg: number;
  weeklyLossRange: [number, number];
  endWeightKg: number;
  endBodyFatPct: number | null;
  projectedFatLossKg: number;
}

export function computeExpectedOutcomes(
  deficitPerDay: number,
  programWeeks: number,
  weightKg: number,
  bodyFatPct: number | null,
): ExpectedOutcomes {
  const weeklyLoss = (deficitPerDay * 7) / 7700;
  const projected = weeklyLoss * programWeeks;
  const endWeight = Math.max(weightKg - projected, 40);
  const endBf =
    bodyFatPct != null
      ? Math.max(0, ((weightKg * (bodyFatPct / 100) - projected) / endWeight) * 100)
      : null;
  return {
    weeklyLossKg: Math.round(weeklyLoss * 100) / 100,
    weeklyLossRange: [Math.round(weeklyLoss * 0.8 * 100) / 100, Math.round(weeklyLoss * 1.2 * 100) / 100],
    endWeightKg: Math.round(endWeight * 10) / 10,
    endBodyFatPct: endBf !== null ? Math.round(endBf * 10) / 10 : null,
    projectedFatLossKg: Math.round(projected * 10) / 10,
  };
}

/* ── Roadmap ─────────────────────────────────────────────────── */
export interface RoadmapPhase {
  weeks: string;
  name: string;
  note: string;
}

export function buildRoadmap(programWeeks: number, dietBreak: boolean, target: number, maintenance: number): RoadmapPhase[] {
  const phases: RoadmapPhase[] = [];
  phases.push({
    weeks: "1–2",
    name: "Habit Building",
    note: `Learn the sessions, RPE 6–7. Eat at ${target.toLocaleString()} kcal — precision matters more than perfection.`,
  });
  const useBreak = dietBreak && programWeeks >= 12;
  const breakStart = 11;
  const mainEnd = useBreak ? breakStart - 1 : Math.max(programWeeks - 1, 3);
  if (mainEnd >= 3) {
    phases.push({
      weeks: `3–${mainEnd}`,
      name: "Main Deficit Block",
      note: `Steady deficit at ${target.toLocaleString()} kcal. Add reps before weight; review the weekly average every Sunday.`,
    });
  }
  if (useBreak) {
    phases.push({
      weeks: `${breakStart}–${breakStart + 1}`,
      name: "Diet Break",
      note: `Two weeks at maintenance (~${maintenance.toLocaleString()} kcal). Adherence and hormones recover — fat loss resumes after.`,
    });
  }
  const pushStart = useBreak ? breakStart + 2 : mainEnd + 1;
  if (programWeeks - 1 >= pushStart) {
    phases.push({
      weeks: `${pushStart}–${programWeeks - 1}`,
      name: "Final Push",
      note: `Back to ${target.toLocaleString()} kcal. Cut rest periods by ~10s per pair to keep the stimulus climbing.`,
    });
  }
  phases.push({
    weeks: `${programWeeks}`,
    name: "Re-assessment",
    note: "Full measurements, photos and BioPrint review. Ramp back to maintenance over 2 weeks and set the next block.",
  });
  return phases;
}

/* ── GBC training template ───────────────────────────────────── */
export interface GbcBlock {
  label: string;
  exercises: string;
  setsReps: string;
  tempo: string;
  rest: string;
}

export interface GbcSession {
  name: string;
  kind: "trainer" | "solo";
  blocks: GbcBlock[];
  finisher?: string;
  rounds?: string;
}

const SESSION_A: GbcSession = {
  name: "Session A — Lower Emphasis (trainer)",
  kind: "trainer",
  blocks: [
    { label: "A1", exercises: "Goblet Squat", setsReps: "3 × 10–12", tempo: "40X0", rest: "30s" },
    { label: "A2", exercises: "Lat Pulldown", setsReps: "3 × 10–12", tempo: "3010", rest: "60s" },
    { label: "B1", exercises: "DB Romanian Deadlift", setsReps: "3 × 10–12", tempo: "3010", rest: "30s" },
    { label: "B2", exercises: "Incline DB Press", setsReps: "3 × 10–12", tempo: "3010", rest: "60s" },
    { label: "C1", exercises: "Reverse Lunge", setsReps: "2 × 10/side", tempo: "2010", rest: "30s" },
    { label: "C2", exercises: "Seated Row", setsReps: "2 × 10–12", tempo: "2010", rest: "60s" },
  ],
  finisher: "Farmer's Carry — 2 × 40 m",
};

const SESSION_B: GbcSession = {
  name: "Session B — Upper Emphasis (trainer)",
  kind: "trainer",
  blocks: [
    { label: "A1", exercises: "Seated DB Shoulder Press", setsReps: "3 × 10–12", tempo: "3010", rest: "30s" },
    { label: "A2", exercises: "Leg Press", setsReps: "3 × 10–12", tempo: "4010", rest: "60s" },
    { label: "B1", exercises: "Chest-Supported Row", setsReps: "3 × 10–12", tempo: "3010", rest: "30s" },
    { label: "B2", exercises: "Hip Thrust", setsReps: "3 × 8–10", tempo: "2010", rest: "60s" },
    { label: "C1", exercises: "Lateral Raise", setsReps: "2 × 12–15", tempo: "2010", rest: "30s" },
    { label: "C2", exercises: "Stability-Ball Leg Curl", setsReps: "2 × 10–12", tempo: "3010", rest: "60s" },
  ],
  finisher: "Sled push or incline intervals — 6 × 30s on / 60s off",
};

const SESSION_C: GbcSession = {
  name: "Session C — Solo Circuit (home/gym)",
  kind: "solo",
  blocks: [
    { label: "1", exercises: "Goblet Squat", setsReps: "× 12", tempo: "controlled", rest: "—" },
    { label: "2", exercises: "Incline Push-up", setsReps: "× 8–12", tempo: "controlled", rest: "—" },
    { label: "3", exercises: "1-arm DB Row", setsReps: "× 10/side", tempo: "controlled", rest: "—" },
    { label: "4", exercises: "Glute Bridge", setsReps: "× 15", tempo: "controlled", rest: "—" },
    { label: "5", exercises: "Dead Bug", setsReps: "× 8/side", tempo: "slow", rest: "—" },
  ],
  finisher: "10-min incline walk to finish",
  rounds: "3 rounds · 60–75s between rounds",
};

export function buildGbcPlan(trainerSessions: number, soloSessions: number): GbcSession[] {
  const out: GbcSession[] = [];
  const rotation = [SESSION_A, SESSION_B];
  for (let i = 0; i < Math.max(0, trainerSessions); i++) {
    const base = rotation[i % 2];
    out.push(i < 2 ? base : { ...base, name: `${base.name} (rotation ${Math.floor(i / 2) + 1})` });
  }
  for (let i = 0; i < Math.max(0, soloSessions); i++) out.push(SESSION_C);
  return out;
}

export const REST_RULES = [
  "Rest 30s after the first exercise of a pair, 60s after the second — then go straight into the next round.",
  "Weeks 1–2: RPE 6–7 (leave 3–4 reps in the tank) while you learn the movements.",
  "Then progress reps → weight: hit the top of the rep range on every set before adding ~2.5 kg (upper) or ~5 kg (lower).",
  "Weeks 9+: cut rests by ~10s per pair to raise the density.",
];

/* ── Sample day of eating ────────────────────────────────────── */
/* Per-100g macro table mirroring the foods_cache seed-staples
   (USDA values, Phase 39) — embedded so the engine stays pure. */
const FOODS: Record<string, { kcal: number; p: number; c: number; f: number }> = {
  greekYogurt: { kcal: 59, p: 10.3, c: 3.6, f: 0.4 },
  berries: { kcal: 50, p: 0.7, c: 11.9, f: 0.3 },
  oats: { kcal: 389, p: 16.9, c: 66, f: 6.9 },
  chicken: { kcal: 120, p: 22.5, c: 0, f: 2.6 },
  rice: { kcal: 130, p: 2.7, c: 28.2, f: 0.3 },
  broccoli: { kcal: 34, p: 2.8, c: 6.6, f: 0.4 },
  whey: { kcal: 400, p: 80, c: 6.7, f: 5 }, // powder (30 g scoop = 120/24/2/1.5)
  apple: { kcal: 52, p: 0.3, c: 13.8, f: 0.2 },
  salmon: { kcal: 208, p: 20, c: 0, f: 13 },
  skyr: { kcal: 63, p: 11, c: 4, f: 0.2 },
  oliveOil: { kcal: 884, p: 0, c: 0, f: 100 },
};

export interface SampleMeal {
  name: string;
  items: string[];
  macros: { kcal: number; p: number; c: number; f: number };
}

export interface SampleDay {
  meals: SampleMeal[];
  totals: { kcal: number; p: number; c: number; f: number };
  withinTolerance: boolean;
}

const scale = (food: keyof typeof FOODS, grams: number) => {
  const f = FOODS[food];
  return {
    kcal: (f.kcal * grams) / 100,
    p: (f.p * grams) / 100,
    c: (f.c * grams) / 100,
    f: (f.f * grams) / 100,
  };
};

const sum = (parts: ReturnType<typeof scale>[]) =>
  parts.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

/**
 * Build a sample day that lands within ±5% of the recommended style's
 * macro targets. Sane fixed portions for the staples; three clean
 * anchors close the gap: chicken (protein), rice (carbs), olive oil (fats).
 */
export function buildSampleDay(targetKcal: number, proteinG: number, carbsG: number, fatsG: number): SampleDay {
  const yogurtG = 250;
  const salmonG = 180;
  const skyrG = 150;
  const wheyG = 30;
  const oatsG = 30;
  const berriesG = 100;
  const appleG = 150;
  const broccoliG = 300;

  // fixed-portion contributions
  const fixed = sum([
    scale("greekYogurt", yogurtG),
    scale("berries", berriesG),
    scale("oats", oatsG),
    scale("whey", wheyG),
    scale("apple", appleG),
    scale("salmon", salmonG),
    scale("broccoli", broccoliG),
    scale("skyr", skyrG),
  ]);

  // anchors: rice first (carbs), then chicken (protein — rice protein
  // counts toward the target too), olive oil closes the fat gap
  const riceG = Math.max(0, Math.round(((carbsG - fixed.c) / (FOODS.rice.c / 100)) / 10) * 10);
  const chickenG = Math.max(0, Math.round(((proteinG - fixed.p - (FOODS.rice.p * riceG) / 100) / (FOODS.chicken.p / 100)) / 10) * 10);
  const fatsAfterAnchors = fixed.f + ((FOODS.chicken.f * chickenG) + (FOODS.rice.f * riceG)) / 100;
  const oilG = Math.max(0, Math.round(fatsG - fatsAfterAnchors));

  const meals: SampleMeal[] = [
    {
      name: "Breakfast — Greek yogurt bowl",
      items: [`Greek yogurt ${yogurtG} g`, `Mixed berries ${berriesG} g`, `Rolled oats ${oatsG} g`],
      macros: round1(sum([scale("greekYogurt", yogurtG), scale("berries", berriesG), scale("oats", oatsG)])),
    },
    {
      name: "Lunch — chicken + rice + greens",
      items: [`Chicken breast ${Math.round(chickenG * 0.55)} g`, `White rice ${Math.round(riceG * 0.5)} g`, `Broccoli ${broccoliG / 2} g`, `Olive oil ${Math.round(oilG / 2)} g (dressing)`],
      macros: round1(sum([scale("chicken", chickenG * 0.55), scale("rice", riceG * 0.5), scale("broccoli", broccoliG / 2), scale("oliveOil", oilG / 2)])),
    },
    {
      name: "Snack — shake + fruit",
      items: [`Whey protein 1 scoop (${wheyG} g)`, `Apple ${appleG} g`],
      macros: round1(sum([scale("whey", wheyG), scale("apple", appleG)])),
    },
    {
      name: "Dinner — salmon + rice + greens",
      items: [`Salmon ${salmonG} g`, `White rice ${Math.round(riceG * 0.5)} g`, `Broccoli ${broccoliG / 2} g`, `Olive oil ${Math.round(oilG / 2)} g (for cooking)`],
      macros: round1(sum([scale("salmon", salmonG), scale("rice", riceG * 0.5), scale("broccoli", broccoliG / 2), scale("oliveOil", oilG / 2)])),
    },
    {
      name: "Evening — skyr + chicken wrap",
      items: [`Skyr ${skyrG} g`, `Chicken breast ${Math.round(chickenG * 0.45)} g (cold, in a wrap or salad)`],
      macros: round1(sum([scale("skyr", skyrG), scale("chicken", chickenG * 0.45)])),
    },
  ];

  const totals = round1(meals.reduce((a, m) => ({ kcal: a.kcal + m.macros.kcal, p: a.p + m.macros.p, c: a.c + m.macros.c, f: a.f + m.macros.f }), { kcal: 0, p: 0, c: 0, f: 0 }));
  const within =
    Math.abs(totals.kcal - targetKcal) <= targetKcal * 0.06 &&
    Math.abs(totals.p - proteinG) <= proteinG * 0.06 &&
    Math.abs(totals.c - carbsG) <= carbsG * 0.06 &&
    Math.abs(totals.f - fatsG) <= fatsG * 0.08;
  return { meals, totals, withinTolerance: within };
}

function round1(m: { kcal: number; p: number; c: number; f: number }) {
  return { kcal: Math.round(m.kcal), p: Math.round(m.p * 10) / 10, c: Math.round(m.c * 10) / 10, f: Math.round(m.f * 10) / 10 };
}

export const FOOD_RULES = [
  "Protein at every meal — palm-sized portion minimum.",
  "Half the plate vegetables at lunch and dinner.",
  "Put most of your carbs around training (before/after).",
  "Alcohol ≤ 1–2 drinks per week while we're in a deficit.",
  "2–2.5 L water daily (more on training days).",
  "The 80/20 rule: 80% whole foods, 20% flexibility — no forbidden foods, just honest portions.",
];

/* ── Tracking table ──────────────────────────────────────────── */
export interface TrackingRow {
  what: string;
  frequency: string;
  note: string;
}

export const TRACKING_ROWS: TrackingRow[] = [
  { what: "Weight", frequency: "Daily (after waking)", note: "Judged on the weekly average — never a single day." },
  { what: "Waist / hips", frequency: "Every 2 weeks", note: "Same spot, same time of day." },
  { what: "Progress photos", frequency: "Every 4 weeks", note: "Front, side, back — same lighting and poses." },
  { what: "Body fat %", frequency: "Every 4 weeks", note: "Same device/protocol every time (BioPrint skinfolds)." },
  { what: "Training log", frequency: "Every session", note: "Weights × reps × RPE — this drives your progression." },
  { what: "Energy / sleep / hunger", frequency: "Weekly check-in", note: "Flags when to adjust calories or the diet break." },
];

/* ── FAQ ─────────────────────────────────────────────────────── */
export interface FaqItem {
  q: string;
  a: string;
}

export function buildFaq(includeBulking: boolean): FaqItem[] {
  const items: FaqItem[] = [];
  if (includeBulking) {
    items.push({
      q: "Will lifting weights make me bulky?",
      a: "No — women carry roughly 1/10 to 1/20 of the testosterone men do, and in a calorie deficit there is no surplus to build size from. Weights in a deficit make you smaller and firmer: 'toned' is simply muscle plus less fat.",
    });
  }
  items.push(
    {
      q: "The scale is stuck but my clothes feel looser — what's happening?",
      a: "You're recomposing: holding muscle while losing fat and water shifts. Judge the weekly average, waist measurements and photos — not one weigh-in.",
    },
    {
      q: "Can I have cheat days?",
      a: "Planned treats, not cheat days. One flexible meal a week inside the 80/20 rule keeps adherence high without erasing the week's deficit.",
    },
    {
      q: "Does age / do hormones make this harder?",
      a: "Metabolism shifts a few percent per decade — that's already priced into your numbers. The plan (protein floor, diet break, strength work) is specifically built to protect muscle and hormones through the deficit.",
    },
    {
      q: "How fast will I see results?",
      a: "Energy and sleep improve in 1–2 weeks, the weekly average drops from week 2–3, visible changes land around weeks 4–6. Trust the roadmap, not the day-to-day scale.",
    },
  );
  return items;
}

export const FEMALE_REASSURANCE =
  "You will NOT bulk up. Women carry roughly 1/10 to 1/20 of the testosterone men do, and in a calorie deficit there is simply no surplus to build size from. Lifting weights in a deficit makes you smaller and firmer — 'toned' is just muscle plus less fat. The strength work in this plan is what keeps your shape while the fat comes off.";

/* ── Full report model ───────────────────────────────────────── */
export interface BlueprintResult {
  header: { trainerName: string; businessName?: string; generatedIso: string };
  assessment: {
    weightKg: number;
    heightCm: number;
    bmi: number;
    bodyFatPct: number | null;
    fatMassKg: number | null;
    leanMassKg: number | null;
    bmr: number;
    bmrMethod: CalorieTargets["bmrMethod"];
    maintenance: number;
  };
  goal: {
    type: string;
    isFatLoss: boolean;
    pace: BlueprintInputs["pace"];
    programWeeks: number;
    statement: string;
  };
  calories: CalorieTargets;
  proteinFloor: ProteinFloor;
  recommended: { key: string; name: string; reason: string };
  macroStyles: StyledMacros[];
  outcomes: ExpectedOutcomes | null;
  training: {
    stepTarget: number;
    sessions: GbcSession[];
    restRules: string[];
  };
  sampleDay: SampleDay;
  foodRules: string[];
  tracking: TrackingRow[];
  roadmap: RoadmapPhase[];
  faq: FaqItem[];
  femaleReassurance: boolean;
}

export function computeBlueprint(input: BlueprintInputs, generatedIso = new Date().toISOString()): BlueprintResult {
  const cal = computeBodyAndCalories(input);
  const isFatLoss = isFatLossGoal(input.goalType);
  const floor = proteinFloor(input.weightKg, cal.leanMassKg);
  const recommended = recommendStyle(isFatLoss);
  const recStyle = MACRO_STYLES.find((s) => s.key === recommended.key) ?? MACRO_STYLES[0];
  const recTargetG = macroGrams(cal.target, recStyle.split);
  const outcomes = isFatLoss
    ? computeExpectedOutcomes(cal.deficitPerDay, input.programWeeks, input.weightKg, input.bodyFatPct)
    : null;
  const recName = recStyle.name;

  const goalStatement = isFatLoss
    ? `${input.goalType === "reduce_body_fat" ? "Reduce body fat" : "Lose weight"}${input.bodyFatPct != null && outcomes ? ` from ${input.bodyFatPct}% → ${outcomes.endBodyFatPct}%` : ""} in ${input.programWeeks} weeks — ~${outcomes?.projectedFatLossKg} kg fat at ${outcomes?.weeklyLossRange[0]}–${outcomes?.weeklyLossRange[1]} kg/week.`
    : `Build on your current base over ${input.programWeeks} weeks at maintenance calories — strength, skill and habit quality first.`;

  return {
    header: { trainerName: input.trainerName, businessName: input.businessName, generatedIso },
    assessment: {
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      bmi: Math.round((input.weightKg / (input.heightCm / 100) ** 2) * 10) / 10,
      bodyFatPct: input.bodyFatPct,
      fatMassKg: cal.fatMassKg,
      leanMassKg: cal.leanMassKg,
      bmr: cal.bmr,
      bmrMethod: cal.bmrMethod,
      maintenance: cal.maintenance,
    },
    goal: {
      type: input.goalType,
      isFatLoss,
      pace: input.pace,
      programWeeks: input.programWeeks,
      statement: goalStatement,
    },
    calories: cal,
    proteinFloor: floor,
    recommended: { key: recommended.key, name: recName, reason: recommended.reason },
    macroStyles: buildMacroTable(cal.target, cal.maintenance, floor.grams),
    outcomes,
    training: {
      stepTarget: input.stepTarget,
      sessions: buildGbcPlan(input.trainerSessionsPerWeek, input.soloSessionsPerWeek),
      restRules: REST_RULES,
    },
    sampleDay: buildSampleDay(cal.target, recTargetG.proteinG, recTargetG.carbsG, recTargetG.fatsG),
    foodRules: FOOD_RULES,
    tracking: TRACKING_ROWS,
    roadmap: buildRoadmap(input.programWeeks, input.dietBreak, cal.target, cal.maintenance),
    faq: buildFaq(input.gender === "female" && isFatLoss),
    femaleReassurance: input.gender === "female" && isFatLoss,
  };
}
