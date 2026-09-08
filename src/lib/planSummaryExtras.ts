/* ═══════════════════════════════════════════════════════════════
   planSummaryExtras (Phase 80 Item 1) — blueprint-driven sections
   for the EXISTING Phase 61 Plan Summary report. Pure, deterministic,
   rule-based ONLY (no LLM). Every exercise/food/number traces to
   exercise_library / foods_cache / the client's real rows.

   Sections:
   · buildWarmupProtocol — 4-step dynamic warm-up from the library,
     filtered by equipment access + injury keywords (map below).
   · buildSampleDiet — one sample day from the client's included
     staple foods, restriction-wins, scaled toward the report's real
     macro targets (actuals reported honestly, ±10% tolerance flag).
   · SUPPLEMENT_BLOCK + hydrationMl — static general guidance.
   ═══════════════════════════════════════════════════════════════ */

import type { EquipmentAccess, DietaryRestriction, MealCategory } from "./planBlueprintInput";

/* ── Shared row shapes (fetched by the caller) ───────────────── */
export interface LibraryExercise {
  id: string;
  name: string;
  primary_muscle: string | null;
  secondary_muscle: string | null;
  equipment: string | null;
  exercise_type: string | null;
}

export interface StapleFoodMacros {
  name: string;
  category: string;
  calories: number; // per 100 g
  protein: number;
  carbs: number;
  fats: number;
}

/* ═══════════════════════════════════════════════════════════════
   DYNAMIC WARM-UP
   ═══════════════════════════════════════════════════════════════ */

/** INJURY KEYWORD MAP (documented, rule-based): keyword found in
 *  injuries_notes → primary-muscle groups whose exercises are
 *  EXCLUDED from the warm-up (conservative: loaded work on the
 *  flagged area is left to the coach). Matching is case-insensitive
 *  substring on the raw notes. */
export const INJURY_KEYWORD_MAP: Record<string, { muscles: string[]; why: string }> = {
  knee: { muscles: ["Quadriceps", "Hamstrings", "Glutes", "Calves"], why: "knee-dominant patterns" },
  back: { muscles: ["Posterior Chain", "Lower Back", "Back"], why: "spinal loading" },
  shoulder: { muscles: ["Shoulders"], why: "overhead/shoulder loading" },
  hip: { muscles: ["Glutes", "Quadriceps"], why: "hip-dominant patterns" },
  ankle: { muscles: ["Calves"], why: "ankle loading" },
  wrist: { muscles: ["Forearms"], why: "grip loading" },
  neck: { muscles: ["Traps", "Upper Back"], why: "neck/trap loading" },
};

export interface InjuryParse {
  flaggedMuscles: Set<string>;
  matchedKeywords: string[];
  /** honest note when no recognized keyword appears in the notes */
  unrecognizedNote: string | null;
}

export function parseInjuries(notes: string): InjuryParse {
  const lower = notes.toLowerCase();
  const flagged = new Set<string>();
  const matched: string[] = [];
  for (const [kw, rule] of Object.entries(INJURY_KEYWORD_MAP)) {
    if (lower.includes(kw)) {
      matched.push(kw);
      for (const m of rule.muscles) flagged.add(m);
    }
  }
  return {
    flaggedMuscles: flagged,
    matchedKeywords: matched,
    unrecognizedNote:
      notes.trim().length > 0 && matched.length === 0
        ? "No recognized injury keywords in the notes — the warm-up is unfiltered; review it against the client's limitations."
        : null,
  };
}

/** Equipment gate: which library `equipment` values an access level
 *  can use. Bodyweight-only is always safe; each tier adds tools. */
const EQUIPMENT_TIERS: Record<EquipmentAccess, (eq: string | null) => boolean> = {
  bodyweight_only: (eq) => !eq || /bodyweight|none/i.test(eq),
  dumbbells_only: (eq) => !eq || /bodyweight|none|dumbbell/i.test(eq),
  home_gym_bb_db: (eq) => !eq || !/cable|machine/i.test(eq),
  full_gym: () => true,
};

/** Mobility/activation name signals (warm-up moves, not strength work). */
const WARMUP_NAME_RE =
  /lunge|squat|hinge|rotation|cat[- ]?cow|bridge|circle|walkout|inchworm|world'?s greatest|leg swing|arm swing|hip|glute|plank|dead ?bug|bird ?dog|bear|crawl|dislocate|pull-?apart|band/i;

export interface WarmupResult {
  steps: { name: string; muscle: string }[];
  note: string | null;
}

/** 4-step dynamic warm-up from the exercise library, filtered by
 *  equipment access + injury keywords. Deterministic: alphabetical
 *  within each slot's pool, rotating muscle families so the steps
 *  cover different areas. Fewer than 4 steps (with an honest note)
 *  when the filtered pool can't fill the slots — never fabricated. */
export function buildWarmupProtocol(
  equipmentAccess: EquipmentAccess | null,
  injuriesNotes: string,
  library: LibraryExercise[],
): WarmupResult {
  const parse = parseInjuries(injuriesNotes ?? "");
  const gate = EQUIPMENT_TIERS[equipmentAccess ?? "bodyweight_only"]; // safest default
  const pool = library
    .filter((e) => WARMUP_NAME_RE.test(e.name))
    .filter((e) => gate(e.equipment))
    .filter((e) => !parse.flaggedMuscles.has(e.primary_muscle ?? ""))
    .map((e) => ({ name: e.name, muscle: e.primary_muscle ?? "Full Body" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const steps: { name: string; muscle: string }[] = [];
  const usedMuscles = new Set<string>();
  // slot 1: legs/hips mobility · slot 2: upper-body mobility ·
  // slot 3: activation (different family) · slot 4: core
  const slotPreference: ((m: string) => boolean)[] = [
    (m) => /quadriceps|glutes|hamstrings|calves|hip/i.test(m),
    (m) => /shoulders|chest|back/i.test(m),
    (m) => !usedMuscles.has(m),
    (m) => /core|abdominals|full body/i.test(m) || !usedMuscles.has(m),
  ];
  for (const prefer of slotPreference) {
    const pick =
      pool.find((e) => !steps.includes(e) && !usedMuscles.has(e.muscle) && prefer(e.muscle)) ??
      pool.find((e) => !steps.includes(e) && !usedMuscles.has(e.muscle));
    if (pick) {
      steps.push(pick);
      usedMuscles.add(pick.muscle);
    }
  }

  const notes: string[] = [];
  if (parse.matchedKeywords.length > 0) {
    notes.push(`Filtered for: ${parse.matchedKeywords.join(", ")} (keyword map in code).`);
  }
  if (parse.unrecognizedNote) notes.push(parse.unrecognizedNote);
  if (steps.length < 4) {
    notes.push(`Only ${steps.length} honest warm-up step${steps.length === 1 ? "" : "s"} available after equipment/injury filtering — ask the coach to add the rest.`);
  }
  return { steps, note: notes.length > 0 ? notes.join(" ") : null };
}

/* ═══════════════════════════════════════════════════════════════
   SAMPLE DIET DAY
   ═══════════════════════════════════════════════════════════════ */

/** RESTRICTION RULES (documented, restriction WINS over included
 *  foods): category- and keyword-level exclusion applied on top of
 *  the client's own include/exclude lists. */
const RESTRICTION_RULES: Record<Exclude<DietaryRestriction, "none">, { categories: string[]; keywords: RegExp }> = {
  vegan: {
    categories: ["dairy"],
    keywords: /chicken|beef|pork|lamb|turkey|duck|fish|salmon|tuna|prawn|sardine|cod|haddock|mackerel|sirloin|mince|egg|whey|honey|gelatin/i,
  },
  vegetarian: {
    categories: [],
    keywords: /chicken|beef|pork|lamb|turkey|duck|fish|salmon|tuna|prawn|sardine|cod|haddock|mackerel|sirloin|mince(?!.*\b(soy|quorn)\b)/i,
  },
  pescatarian: {
    categories: [],
    keywords: /chicken|beef|pork|lamb|turkey|duck|sirloin/i,
  },
  dairy_free: {
    categories: ["dairy"],
    keywords: /whey|milk|yogurt|yoghurt|cheese|quark|skyr/i,
  },
  gluten_free: {
    categories: [],
    keywords: /wheat|bread|pasta|bagel|wrap|couscous|cornflakes|granola|rye|wholemeal|noodle|barley/i,
  },
};

function allowedFoods(
  foods: StapleFoodMacros[],
  foodInclude: string[],
  foodExclude: string[],
  restriction: DietaryRestriction | null,
): StapleFoodMacros[] {
  const excluded = new Set(foodExclude);
  const rule = restriction && restriction !== "none" ? RESTRICTION_RULES[restriction] : null;
  return foods
    .filter((f) => foodInclude.includes(f.name))
    .filter((f) => !excluded.has(f.name))
    .filter((f) => !rule || (!rule.categories.includes(f.category) && !rule.keywords.test(f.name)));
}

export interface DietMealOut {
  name: string;
  items: { food: string; grams: number }[];
}

export interface SampleDietResult {
  meals: DietMealOut[];
  totals: { kcal: number; proteinG: number; carbsG: number; fatsG: number };
  withinTolerance: boolean; // ±10% of target kcal
  note: string | null;
}

const MEAL_SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snack",
  dinner: "Dinner",
};

/** One sample day built ONLY from allowed included foods. Portions:
 *  fixed sensible bases, then deterministic scaling of the most
 *  energy-dense carb + protein anchors toward the kcal target.
 *  Returns null when there are no usable included foods (section
 *  omitted — never fabricated). */
export function buildSampleDiet(
  foodInclude: string[],
  foodExclude: string[],
  dietaryRestriction: DietaryRestriction | null,
  mealPreferences: Record<MealCategory, string[]>,
  macroTargets: { kcal: number; proteinG: number; carbsG: number; fatsG: number },
  foods: StapleFoodMacros[],
): SampleDietResult | null {
  const pool = allowedFoods(foods, foodInclude, foodExclude, dietaryRestriction);
  if (pool.length === 0) return null;

  const byName = new Map(pool.map((f) => [f.name, f]));
  const prefAllowed = (cat: MealCategory): StapleFoodMacros[] =>
    (mealPreferences[cat] ?? []).map((n) => byName.get(n)).filter((f): f is StapleFoodMacros => !!f);

  const proteinPool = pool.filter((f) => f.category === "protein" || f.category === "dairy");
  const carbPool = pool.filter((f) => f.category === "carbs");
  const fatPool = pool.filter((f) => f.category === "fats");
  const vegPool = pool.filter((f) => f.category === "vegetables" || f.category === "fruit");

  const pick = (arr: StapleFoodMacros[], i = 0) => (arr.length > 0 ? arr[i % arr.length] : null);

  const meals: DietMealOut[] = [];
  const usedSlots: [MealCategory, string][] = [
    ["breakfast", "breakfast"],
    ["lunch", "lunch"],
    ["snacks", "snacks"],
    ["dinner", "dinner"],
  ];

  const slotItems: { food: StapleFoodMacros; grams: number }[][] = [];
  for (const [cat, slotLabel] of usedSlots) {
    void slotLabel;
    const prefs = prefAllowed(cat);
    const items: { food: StapleFoodMacros; grams: number }[] = [];
    if (cat === "breakfast") {
      const main = prefs[0] ?? pick(proteinPool);
      const side = prefs[1] ?? pick(carbPool);
      if (main) items.push({ food: main, grams: main.category === "carbs" ? 60 : 150 });
      if (side && side !== main) items.push({ food: side, grams: side.category === "carbs" ? 60 : 100 });
    } else if (cat === "snacks") {
      const main = prefs[0] ?? pick(fatPool) ?? pick(proteinPool);
      if (main) items.push({ food: main, grams: main.category === "fats" ? 30 : 100 });
      const side = prefs[1] ?? pick(vegPool);
      if (side) items.push({ food: side, grams: 100 });
    } else {
      // lunch / dinner: protein + carb + veg
      const p = prefs.find((f) => f.category === "protein" || f.category === "dairy") ?? pick(proteinPool, cat === "dinner" ? 1 : 0);
      const c = prefs.find((f) => f.category === "carbs") ?? pick(carbPool, cat === "dinner" ? 1 : 0);
      const v = prefs.find((f) => f.category === "vegetables" || f.category === "fruit") ?? pick(vegPool, cat === "dinner" ? 1 : 0);
      if (p) items.push({ food: p, grams: 150 });
      if (c) items.push({ food: c, grams: 150 });
      if (v) items.push({ food: v, grams: 150 });
    }
    if (items.length > 0) slotItems.push(items);
    meals.push({ name: MEAL_SLOT_LABELS[cat] ?? cat, items: [] });
  }

  if (slotItems.length === 0) return null;

  // ── Deterministic kcal scaling: scale every portion by one factor
  //    (clamped 0.5–2.5) so the day approaches the kcal target; the
  //    honest totals are reported regardless (±10% flag).
  const kcalOf = (f: StapleFoodMacros, g: number) => (f.calories * g) / 100;
  const base = slotItems.flat().reduce((s, i) => s + kcalOf(i.food, i.grams), 0);
  const factor = Math.min(2.5, Math.max(0.5, macroTargets.kcal / Math.max(base, 1)));
  const scaled = slotItems.map((items) =>
    items.map((i) => ({ food: i.food, grams: Math.max(20, Math.round((i.grams * factor) / 10) * 10) })),
  );

  meals.forEach((m, i) => {
    m.items = (scaled[i] ?? []).map((s) => ({ food: s.food.name, grams: s.grams }));
  });

  const totals = scaled.flat().reduce(
    (a, i) => ({
      kcal: a.kcal + kcalOf(i.food, i.grams),
      proteinG: a.proteinG + (i.food.protein * i.grams) / 100,
      carbsG: a.carbsG + (i.food.carbs * i.grams) / 100,
      fatsG: a.fatsG + (i.food.fats * i.grams) / 100,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatsG: 0 },
  );
  const rounded = {
    kcal: Math.round(totals.kcal),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatsG: Math.round(totals.fatsG),
  };

  const notes: string[] = [];
  if (dietaryRestriction && dietaryRestriction !== "none") {
    notes.push(`Restriction applied (${dietaryRestriction.replace("_", " ")}) — it overrides the include list.`);
  }
  const usedPrefs = (["breakfast", "lunch", "dinner", "snacks"] as MealCategory[]).filter(
    (c) => prefAllowed(c).length > 0,
  );
  if (usedPrefs.length > 0) notes.push(`Meal preferences honored for: ${usedPrefs.join(", ")}.`);

  return {
    meals: meals.filter((m) => m.items.length > 0),
    totals: rounded,
    withinTolerance: Math.abs(rounded.kcal - macroTargets.kcal) <= macroTargets.kcal * 0.1,
    note: notes.length > 0 ? notes.join(" ") : null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   SUPPLEMENTATION & HYDRATION (static, general guidance)
   ═══════════════════════════════════════════════════════════════ */

export const SUPPLEMENT_BLOCK: { name: string; dose: string; note: string }[] = [
  { name: "Creatine monohydrate", dose: "3–5 g daily", note: "Any time of day — consistency matters, not timing." },
  { name: "Omega-3 (EPA/DHA)", dose: "1–2 g daily", note: "With a meal containing fat." },
  { name: "Vitamin D3", dose: "1000–2000 IU daily", note: "Especially through autumn/winter." },
];

export const SUPPLEMENT_DISCLAIMER =
  "General guidance only — consult a qualified professional before starting any supplement.";

/** Hydration baseline: 30–35 ml per kg of real bodyweight. */
export function hydrationMl(weightKg: number): { min: number; max: number } {
  return { min: Math.round((weightKg * 30) / 50) * 50, max: Math.round((weightKg * 35) / 50) * 50 };
}

export const MEDICAL_DISCLAIMER =
  "This plan is for informational purposes only and is not medical advice. Consult a physician before beginning any exercise or nutrition program.";
