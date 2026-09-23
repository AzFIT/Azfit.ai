/* ═══════════════════════════════════════════════════════════════
   blueprintNutritionGuide (Phase 99c Item 4) — the "eating on
   low calories" card for the Plan Summary. Goal-adaptive:
   fat-loss clients get deficit-specific hunger/volume/safety
   guidance (with a LOUDER safety callout when the calorie floor
   clamped their target); muscle/strength clients get a
   "you are NOT dieting — eat" variant so the plan never reads
   like a cut for a client who should be at maintenance.

   Pure + deterministic — no DB, no wall clock.
   ═══════════════════════════════════════════════════════════════ */

export interface NutritionGuideBlock {
  heading: string;
  points: string[];
}

export interface NutritionGuideResult {
  title: string;
  intro: string;
  blocks: NutritionGuideBlock[];
  /** present only when the calorie target hit the hard floor —
   *  the coach must see this before the client does */
  safetyCallout: string | null;
  whoShouldNotCut: string[];
  notes: string[];
}

export function buildNutritionGuide(input: {
  isFatLoss: boolean;
  targetKcal: number;
  maintenanceKcal: number;
  clampedByFloor: boolean;
  proteinG: number;
  dietBreak: boolean;
}): NutritionGuideResult {
  const notes: string[] = [];
  const deficit = input.maintenanceKcal - input.targetKcal;
  const deficitPct = input.maintenanceKcal > 0 ? Math.round((deficit / input.maintenanceKcal) * 100) : 0;

  const safetyCallout = input.clampedByFloor
    ? `⚠️ The target of ${input.targetKcal.toLocaleString()} kcal sits at the safety floor (below BMR×1.05 / 1,200 kcal). This is a ceiling on how hard we can push — if progress stalls, we add activity, never drop food further.`
    : null;

  const whoShouldNotCut = [
    "Pregnant or breastfeeding clients — no deficit, full stop.",
    "Any history of disordered eating — coach reviews the plan with the client first.",
    "Chronic fatigue, poor sleep, or elevated stress — fix recovery before cutting.",
    "Teenagers — no deficit without medical supervision.",
    "Clients already very lean (men <10%, women <18% body fat) — recomposition, not a cut.",
  ];

  if (!input.isFatLoss) {
    return {
      title: "Eating for your goal — fuel the work",
      intro: `You are NOT dieting. Targets sit at or above maintenance (${input.maintenanceKcal.toLocaleString()} kcal) — the job is consistency, not restriction.`,
      blocks: [
        {
          heading: "Protein leads every meal",
          points: [
            `${Math.round(input.proteinG)} g/day minimum — spread across 3–5 feedings of ~0.4 g/kg`,
            "Build each plate: protein first, then carbs around training, then fats",
          ],
        },
        {
          heading: "Surplus quality, not just quantity",
          points: [
            "Add calories via carbs + a little fat — not junk volume",
            "If weight isn't trending up after 2–3 weeks, we add 150–200 kcal, not double portions",
          ],
        },
        {
          heading: "Hunger is data, not failure",
          points: [
            "Maintenance eating should feel easy — persistent fullness struggles usually mean food quality is too low",
            "Whole-food carb sources at each meal beat liquid calories for appetite control",
          ],
        },
      ],
      safetyCallout,
      whoShouldNotCut,
      notes,
    };
  }

  /* ── Fat-loss variant ── */
  const hungerTier = deficitPct >= 25 ? "high" : deficitPct >= 18 ? "moderate" : "mild";
  if (deficitPct < 10) notes.push("Deficit is under 10% — hunger should be minimal; if it isn't, food quality is the first lever.");

  return {
    title: `Eating well on ${input.targetKcal.toLocaleString()} kcal — hunger management for a ${deficitPct}% deficit`,
    intro: `A ${deficitPct}% deficit (${deficit.toLocaleString()} kcal below maintenance) works when hunger is managed deliberately — these are the tools, not optional extras.`,
    blocks: [
      {
        heading: "Protein first — the anchor",
        points: [
          `${Math.round(input.proteinG)} g/day: the most satiating macro per calorie and the muscle protector`,
          "30–40 g at breakfast measurably reduces evening snacking",
          "Lean sources stretch the budget: chicken, white fish, egg whites, skyr, protein powder",
        ],
      },
      {
        heading: "Volume eating — fill the plate, not the calories",
        points: [
          "Half the plate vegetables/salad before the main — volume drives satiety",
          "Soup or a large salad as a starter drops total meal intake ~10–15%",
          "Water before meals; diet drinks are fine tools, not cheats",
        ],
      },
      {
        heading: `Hunger hacks for a ${hungerTier} deficit`,
        points: [
          "Eat slowly — 15+ minutes per meal; satiety lags by ~20 min",
          "Front-load calories: bigger breakfast/lunch, lighter dinner",
          "Planned evening protein snack (skyr/casein) kills late-night raids",
          "Sleep 7+ h — short sleep raises ghrelin ~15% and cravings the next day",
        ],
      },
      {
        heading: "Diet breaks & refeeds — planned, not failed",
        points: input.dietBreak
          ? [
              `Every 6–8 weeks: 1–2 weeks at maintenance (${input.maintenanceKcal.toLocaleString()} kcal) — resets hormones and adherence`,
              "A diet break is a tool, not a reward — schedule it before you need it",
            ]
          : ["No diet break scheduled this block — if adherence slips for 2+ weeks, tell the coach early and we'll plan one."],
      },
      {
        heading: "What the deficit is NOT",
        points: [
          "Not a punishment day after eating out — one meal never ruins a week",
          "Not zero carbs — training quality and steps both need fuel",
          "Not forever — this block ends, maintenance skills are the real goal",
        ],
      },
    ],
    safetyCallout,
    whoShouldNotCut,
    notes,
  };
}
