/* ═══════════════════════════════════════════════════════════════
   Phase 54 — Plan Pack supplement guidance.
   Static, curated, goal-keyed. General guidance only — the print
   page carries the consult-a-professional disclaimer with it.
   ═══════════════════════════════════════════════════════════════ */

export interface Supplement {
  name: string;
  dose: string;
  rationale: string;
  /** client_goals.goal_type keys this applies to; "general" = everyone */
  goals: string[];
}

export const SUPPLEMENTS: Supplement[] = [
  {
    name: "Creatine Monohydrate",
    dose: "3–5 g daily",
    rationale: "The most researched sports supplement — supports strength, power and lean-mass gain.",
    goals: ["build_muscle", "increase_strength"],
  },
  {
    name: "Whey Protein",
    dose: "1 scoop (≈25 g protein) as needed",
    rationale: "Convenient way to hit the daily protein target when whole food falls short.",
    goals: ["build_muscle", "increase_strength", "lose_weight", "reduce_body_fat", "improve_fitness"],
  },
  {
    name: "Omega-3 (EPA/DHA)",
    dose: "1–2 g combined EPA+DHA daily",
    rationale: "Supports heart health, recovery and inflammation management.",
    goals: ["lose_weight", "reduce_body_fat", "improve_fitness", "general"],
  },
  {
    name: "Vitamin D3",
    dose: "1000–2000 IU daily",
    rationale: "Commonly low, especially with limited sunlight — supports bone, immune and hormonal health.",
    goals: ["build_muscle", "increase_strength", "lose_weight", "reduce_body_fat", "improve_fitness", "general"],
  },
  {
    name: "Magnesium",
    dose: "200–400 mg in the evening",
    rationale: "Supports sleep quality and muscle relaxation; often under-consumed.",
    goals: ["improve_fitness", "general"],
  },
];

/** Goal-keyed filter: supplements matching ANY of the client's goal types,
 *  plus "general" entries. Empty/unknown goals → the general set. Curated
 *  order preserved, duplicates removed. */
export function supplementsForGoals(goalTypes: string[]): Supplement[] {
  const keys = new Set(goalTypes.filter(Boolean));
  const matches = SUPPLEMENTS.filter((s) => s.goals.some((g) => keys.has(g)));
  const general = SUPPLEMENTS.filter((s) => s.goals.includes("general"));
  const out: Supplement[] = [];
  for (const s of [...matches, ...general]) {
    if (!out.some((o) => o.name === s.name)) out.push(s);
  }
  return out;
}
