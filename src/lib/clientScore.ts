// ═══════════════════════════════════════════════════════════════
// clientScore (Phase 78) — the client "score" hero. 100% honest,
// computed from stored data ONLY. NO population comparisons (we
// have no dataset — none fabricated).
//
// FORMULA (owner-specified, implement exactly):
//   Score 0–100 = Σ(component% × weight) over INCLUDED components,
//   weights renormalized when components are excluded.
//
//   · Training consistency — 40%: completed sessions ÷ scheduled
//     (all non-cancelled) sessions, trailing 28 days.
//   · Daily plan completion — 25%: ticked daily_plan_items ÷ total,
//     trailing 7 days.
//   · Habit targets — 20%: days where ALL set lifestyle_targets were
//     met ÷ days with any habit_logs entry, trailing 7 days.
//     No targets set → NO DATA (excluded).
//   · Check-in engagement — 15%: submitted weekly check-ins ÷
//     expected (1/week → 4 per 28d), capped at 100%.
//
// EXCLUSION RULE: a component with zero underlying data is EXCLUDED
//   (weights renormalize) — never silently counted as 0 or 100.
//   Check-ins with zero submissions count as NO DATA (absence, not
//   a real 0% — documented choice: you can't measure engagement of
//   someone who never engaged).
// EMPTY STATE: all components excluded → score null (UI shows
//   "Your score appears once you start logging", never a fake 0).
//
// LABELS: 0–39 Getting Started · 40–64 Building Momentum ·
//   65–84 Strong · 85–100 Excellent.
// ═══════════════════════════════════════════════════════════════

export type ScoreComponentKey = "training" | "plan" | "habits" | "checkins";

export interface ScoreInputs {
  /** sessions status='completed' in trailing 28d */
  sessionsCompleted28d: number;
  /** all non-cancelled sessions in trailing 28d */
  sessionsScheduled28d: number;
  /** ticked daily_plan_items in trailing 7d */
  planDone7d: number;
  /** total daily_plan_items in trailing 7d */
  planTotal7d: number;
  /** days where ALL set targets were met, trailing 7d */
  habitDaysAllMet7d: number;
  /** days with any habit_logs entry, trailing 7d */
  habitDaysWithLogs7d: number;
  /** any lifestyle_targets set on the client row */
  hasLifestyleTargets: boolean;
  /** submitted check-ins, trailing 28d */
  checkinsSubmitted28d: number;
}

export interface ScoreComponent {
  key: ScoreComponentKey;
  label: string;
  weight: number;
  /** raw 0–100 percentage; null = excluded (no data) */
  pct: number | null;
  /** honest raw inputs, e.g. "6 of 8 sessions" */
  detail: string;
}

export interface ClientScoreResult {
  /** null = no data anywhere → honest empty state */
  score: number | null;
  label: string | null;
  components: ScoreComponent[];
}

export const SCORE_WEIGHTS: Record<ScoreComponentKey, number> = {
  training: 0.4,
  plan: 0.25,
  habits: 0.2,
  checkins: 0.15,
};

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 40) return "Building Momentum";
  return "Getting Started";
}

export function computeClientScore(input: ScoreInputs): ClientScoreResult {
  const components: ScoreComponent[] = [];

  // Training consistency — 40%
  const trainingPct =
    input.sessionsScheduled28d > 0
      ? (input.sessionsCompleted28d / input.sessionsScheduled28d) * 100
      : null;
  components.push({
    key: "training",
    label: "Training consistency",
    weight: SCORE_WEIGHTS.training,
    pct: trainingPct,
    detail:
      trainingPct === null
        ? "Not enough data yet"
        : `${input.sessionsCompleted28d} of ${input.sessionsScheduled28d} sessions completed`,
  });

  // Daily plan completion — 25%
  const planPct =
    input.planTotal7d > 0 ? (input.planDone7d / input.planTotal7d) * 100 : null;
  components.push({
    key: "plan",
    label: "Daily plan completion",
    weight: SCORE_WEIGHTS.plan,
    pct: planPct,
    detail:
      planPct === null
        ? "Not enough data yet"
        : `${input.planDone7d} of ${input.planTotal7d} plans ticked`,
  });

  // Habit targets — 20% (no targets set OR no log days → no data)
  const habitsPct =
    input.hasLifestyleTargets && input.habitDaysWithLogs7d > 0
      ? (input.habitDaysAllMet7d / input.habitDaysWithLogs7d) * 100
      : null;
  components.push({
    key: "habits",
    label: "Habit targets",
    weight: SCORE_WEIGHTS.habits,
    pct: habitsPct,
    detail:
      habitsPct === null
        ? "Not enough data yet"
        : `${input.habitDaysAllMet7d} of ${input.habitDaysWithLogs7d} logged days all targets met`,
  });

  // Check-in engagement — 15% (0 submissions = no data, capped at 100%)
  const checkinPct =
    input.checkinsSubmitted28d > 0
      ? Math.min(100, (input.checkinsSubmitted28d / 4) * 100)
      : null;
  components.push({
    key: "checkins",
    label: "Check-in engagement",
    weight: SCORE_WEIGHTS.checkins,
    pct: checkinPct,
    detail:
      checkinPct === null
        ? "Not enough data yet"
        : `${input.checkinsSubmitted28d} of 4 weekly check-ins`,
  });

  const included = components.filter((c) => c.pct !== null);
  if (included.length === 0) {
    return { score: null, label: null, components };
  }
  const weightSum = included.reduce((s, c) => s + c.weight, 0);
  const weighted = included.reduce((s, c) => s + (c.pct as number) * c.weight, 0);
  const score = Math.round(weighted / weightSum);
  return { score, label: scoreLabel(score), components };
}
