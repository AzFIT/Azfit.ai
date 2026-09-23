/* ═══════════════════════════════════════════════════════════════
   blueprintWeeklyTargets (Phase 99c Item 3) — "where you start,
   where you're going, what to expect each week". Built from the
   client's FIRST recorded measurements (honest baseline) and their
   client_goals row. Fat-loss rates are the documented 0.5–1% of
   body weight per week; when the goal date implies a faster rate,
   the plan says so honestly instead of pretending.

   Pure + deterministic — no DB, no wall clock (weeks are relative).
   ═══════════════════════════════════════════════════════════════ */

export interface MeasurePoint {
  recordedAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
}

export interface GoalRowLike {
  goal_type: string | null;
  custom_label: string | null;
  target_weight_kg: number | null;
  target_body_fat_pct: number | null;
  target_date: string | null;
  notes: string | null;
}

export interface PhaseExpectation {
  weeks: string;
  focus: string;
  expectation: string;
}

export interface WeeklyTargetsResult {
  baseline: {
    recordedAt: string;
    weightKg: number | null;
    bodyFatPct: number | null;
  };
  goal: {
    label: string;
    targetWeightKg: number | null;
    targetBodyFatPct: number | null;
    targetDate: string | null;
  };
  weeklyRate: { minKg: number; maxKg: number; label: string } | null;
  /** true when the goal date demands faster than the safe max rate */
  goalDateHonestNote: string | null;
  /** weeks at the STANDARD rate to reach the target — never faked */
  realisticWeeksEstimate: number | null;
  expectations: PhaseExpectation[];
  nonScaleVictories: string[];
  notes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildWeeklyTargets(input: {
  first: MeasurePoint | null;
  latest: MeasurePoint | null;
  goalRow: GoalRowLike | null;
  weightKgNow: number | null;
  programWeeks: number;
  isFatLoss: boolean;
  gender: string;
  /** injectable clock for tests — defaults to now */
  nowIso?: string;
}): WeeklyTargetsResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const notes: string[] = [];
  const baselinePoint = input.first ?? input.latest;
  const baselineWeight = baselinePoint?.weightKg ?? input.weightKgNow;
  const baselineBf = baselinePoint?.bodyFatPct ?? null;

  const goal = input.goalRow;
  const goalLabel =
    goal?.custom_label?.trim() ||
    (goal?.goal_type ? goal.goal_type.replace(/_/g, " ") : null) ||
    (input.isFatLoss ? "fat loss" : "strength & muscle");

  let weeklyRate: WeeklyTargetsResult["weeklyRate"] = null;
  let goalDateHonestNote: string | null = null;
  let realisticWeeksEstimate: number | null = null;

  if (input.isFatLoss && baselineWeight != null && baselineWeight > 0) {
    // Documented safe range: 0.5–1.0% of body weight per week.
    weeklyRate = {
      minKg: round1(baselineWeight * 0.005),
      maxKg: round1(baselineWeight * 0.01),
      label: `${round1(baselineWeight * 0.005)}–${round1(baselineWeight * 0.01)} kg/week (${round1(baselineWeight * 0.5)}–${round1(baselineWeight * 1)}% of body weight)`,
    };
    if (goal?.target_weight_kg != null && goal.target_weight_kg < baselineWeight) {
      const toLose = baselineWeight - goal.target_weight_kg;
      realisticWeeksEstimate = Math.ceil(toLose / (baselineWeight * 0.0075));
      if (goal.target_date) {
        const weeksAvailable = Math.max(
          0,
          Math.floor((new Date(goal.target_date).getTime() - new Date(nowIso).getTime()) / (7 * 24 * 3600 * 1000)),
        );
        const impliedRate = weeksAvailable > 0 ? toLose / weeksAvailable : Infinity;
        if (impliedRate > baselineWeight * 0.01) {
          goalDateHonestNote = `The ${goal.target_date} target implies ${round1(impliedRate)} kg/week — faster than the safe maximum (${weeklyRate.maxKg} kg/week). Expect to reach ${goal.target_weight_kg} kg in ~${realisticWeeksEstimate} weeks at a sustainable pace; the date should move, not the rate.`;
        }
      }
    }
  }

  /* Phase expectations — honest, program-weeks aware. */
  const w = Math.max(1, input.programWeeks);
  const expectations: PhaseExpectation[] = input.isFatLoss
    ? [
        { weeks: `Weeks 1–2`, focus: "Settle in", expectation: `${weeklyRate?.minKg ?? 0.5}–1 kg down — mostly water/glycogen; learn the routine` },
        { weeks: `Weeks 3–${Math.min(6, w)}`, focus: "Steady loss", expectation: `${weeklyRate?.label ?? "0.5–1% BW"} · strength holds or climbs` },
        ...(w > 6 ? [{ weeks: `Weeks 7–${Math.min(12, w)}`, focus: "Grind", expectation: "Rate may slow slightly — normal; adherence beats intensity" }] : []),
        ...(w > 12 ? [{ weeks: `Weeks 13–${w}`, focus: "Finish / transition", expectation: "Approach goal range; plan the reverse diet" }] : []),
      ]
    : [
        { weeks: `Weeks 1–3`, focus: "Technique base", expectation: "Learn the lifts — load rises fast from skill, not muscle" },
        { weeks: `Weeks 4–${Math.min(8, w)}`, focus: "Build", expectation: "Visible strength gains; weight steady at maintenance" },
        ...(w > 8 ? [{ weeks: `Weeks 9–${w}`, focus: "Accumulate", expectation: "Progressive overload; measurements trend up before scale does" }] : []),
      ];

  const nonScaleVictories = input.isFatLoss
    ? [
        "Waistband looser / clothes fit differently by week 3–4",
        "Energy and sleep improve before the scale confirms it",
        "Steps target hit 5+ days/week",
        "Training log shows stable or improving numbers while lighter",
      ]
    : [
        "Reps or load up on the main lifts by week 3–4",
        "Sleep and appetite settle at the higher intake",
        "Progress photos show density before the scale moves",
        "Steps target hit 5+ days/week",
      ];

  if (baselinePoint == null) notes.push("No recorded measurements yet — baseline numbers appear as the client logs them.");
  if (input.isFatLoss && baselineWeight == null) notes.push("Weight unknown — weekly rate cannot be computed until the first weigh-in.");
  if (input.gender === "female" && input.isFatLoss) {
    notes.push("Cycle weeks can shift scale weight ±1–2 kg — judge progress on the 2-week trend, not single weigh-ins.");
  }

  return {
    baseline: {
      recordedAt: baselinePoint?.recordedAt ?? "",
      weightKg: baselineWeight,
      bodyFatPct: baselineBf,
    },
    goal: {
      label: goalLabel,
      targetWeightKg: goal?.target_weight_kg ?? null,
      targetBodyFatPct: goal?.target_body_fat_pct ?? null,
      targetDate: goal?.target_date ?? null,
    },
    weeklyRate,
    goalDateHonestNote,
    realisticWeeksEstimate,
    expectations,
    nonScaleVictories,
    notes,
  };
}
