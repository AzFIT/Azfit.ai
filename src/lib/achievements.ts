/* ═══════════════════════════════════════════════════════════════
   achievements (Phase 87) — rule-based achievement engine for the
   client dashboard. Pure, deterministic, unit-tested.

   DATA SOURCES (no parallel query layer — the hook reuses the
   Phase 86 useConsistencyMap 12-week fetch and extends it with:
   an all-time completed-session COUNT, and 12-week habit_logs with
   values for the numeric water habit):
   · computeStreaks (src/lib/insights.ts, Phase 83) — longest run
     of consecutive ACTIVE days (any activity) in the window
   · countByDay (src/lib/consistencyMap.ts, Phase 86) — distinct
     active-day count over the same window
   · check-in / plan-item week grouping below — built from the same
     date arrays the heatmap fetches
   · numericHabits.weekValues (Phase 85) shapes for Hydration Hero

   HONEST-DATA RULE (permanent): a locked achievement shows its
   requirement text ONLY — never a fabricated progress bar or "0%".
   A progress sub-line appears ONLY when real partial progress
   exists in the computed data, and every number traces to it.
   Evidence lines on unlocked cards state the real numbers that
   satisfied the rule. No latching: derived from the trailing
   12-week window, documented per rule.
   ═══════════════════════════════════════════════════════════════ */

import { computeStreaks } from "@/lib/insights";
import { countByDay } from "@/lib/consistencyMap";

export interface AchievementInputs {
  /** local date key of today (formatDateKeyLocal) */
  todayKey: string;
  /** all-time completed session count (head count query) */
  completedSessionsAllTime: number;
  /** 12-week local date keys — completed sessions */
  sessionDates: string[];
  /** 12-week plan items (done or not) */
  planItems: { date: string; done: boolean }[];
  /** 12-week local date keys — done habit logs */
  habitDates: string[];
  /** 12-week local date keys — check-in submissions */
  checkinDates: string[];
  /** numeric water habit: per Mon-start week daily values (null =
   *  not logged), or null when the client has no numeric water habit */
  waterWeeks: { weekStartKey: string; values: (number | null)[] }[] | null;
  /** the water habit's target (null with waterWeeks) */
  waterTarget: number | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** always present — locked cards show this and nothing else fake */
  requirement: string;
  unlocked: boolean;
  /** real partial progress ONLY (e.g. "5 of 7 days"); null otherwise */
  progress: string | null;
  /** real numbers behind an unlock; null when locked */
  evidence: string | null;
}

/** Monday-start week key for a local date key. */
export function weekKeyFor(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Mon=0
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Longest run of consecutive Mon-start weeks each having ≥1 date. */
export function longestWeekRun(dateKeys: string[]): number {
  const weeks = new Set(dateKeys.map(weekKeyFor));
  if (weeks.size === 0) return 0;
  const sorted = [...weeks].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    prev.setDate(prev.getDate() + 7);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
    run = sorted[i] === prevKey ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function computeAchievements(input: AchievementInputs): Achievement[] {
  // Shared derivations — the SAME shapes Phases 83–86 compute.
  const merged = [...input.sessionDates, ...input.habitDates, ...input.checkinDates];
  const { longestStreak } = computeStreaks(merged, input.todayKey);
  const activeDays = countByDay({
    sessionDates: input.sessionDates,
    planDates: input.planItems.filter((p) => p.done).map((p) => p.date),
    habitDates: input.habitDates,
    checkinDates: input.checkinDates,
  }).size;

  // Plan weeks: done/total per Mon-start week
  const planByWeek = new Map<string, { done: number; total: number }>();
  for (const p of input.planItems) {
    const wk = weekKeyFor(p.date);
    const entry = planByWeek.get(wk) ?? { done: 0, total: 0 };
    entry.total++;
    if (p.done) entry.done++;
    planByWeek.set(wk, entry);
  }
  const thisWeek = planByWeek.get(weekKeyFor(input.todayKey)) ?? null;
  const bestPlanWeek = [...planByWeek.entries()].find(([, v]) => v.total > 0 && v.done === v.total) ?? null;

  // Check-in week run
  const checkinRun = longestWeekRun(input.checkinDates);

  // Water: best week count of days meeting target
  let waterBest = 0;
  if (input.waterWeeks && input.waterTarget != null) {
    for (const w of input.waterWeeks) {
      const met = w.values.filter((v) => v != null && v >= (input.waterTarget as number)).length;
      if (met > waterBest) waterBest = met;
    }
  }

  const out: Achievement[] = [
    {
      id: "first-steps",
      title: "First Steps",
      description: "You completed your first training session.",
      requirement: "Complete your first session",
      unlocked: input.completedSessionsAllTime >= 1,
      progress: null, // locked means zero sessions — nothing real to show
      evidence: input.completedSessionsAllTime >= 1 ? `${plural(input.completedSessionsAllTime, "session")} completed` : null,
    },
    ...[3, 7, 14].map((n, i) => ({
      id: `streak-${n}`,
      title: `Streak Builder ${["I", "II", "III"][i]}`,
      description: `You logged activity ${n} days in a row.`,
      requirement: `Log activity ${n} days in a row`,
      unlocked: longestStreak >= n,
      progress: longestStreak > 0 && longestStreak < n ? `${plural(longestStreak, "day")} — longest streak` : null,
      evidence: longestStreak >= n ? `${plural(longestStreak, "day")} longest streak in your window` : null,
    })),
    {
      id: "checkin-regular",
      title: "Check-in Regular",
      description: "You submitted a weekly check-in four weeks running.",
      requirement: "Submit a check-in 4 weeks in a row",
      unlocked: checkinRun >= 4,
      progress: checkinRun > 0 && checkinRun < 4 ? `${plural(checkinRun, "week")} in a row — best run` : null,
      evidence: checkinRun >= 4 ? `${plural(checkinRun, "week")} check-in run` : null,
    },
    {
      id: "plan-finisher",
      title: "Plan Finisher",
      description: "You ticked off every plan item in a week.",
      requirement: "Tick off 100% of your plan items in a week",
      unlocked: bestPlanWeek != null,
      progress:
        !bestPlanWeek && thisWeek && thisWeek.total > 0
          ? `${thisWeek.done} of ${thisWeek.total} this week`
          : null,
      evidence: bestPlanWeek ? `Week of ${bestPlanWeek[0]} — ${bestPlanWeek[1].done} of ${bestPlanWeek[1].total}` : null,
    },
    {
      id: "hydration-hero",
      title: "Hydration Hero",
      description: "You met your water target at least 5 days in one week.",
      requirement: "Meet your water target 5 days in one week",
      unlocked: input.waterWeeks != null && waterBest >= 5,
      progress:
        input.waterWeeks != null && waterBest > 0 && waterBest < 5
          ? `${plural(waterBest, "day")} in your best week`
          : null,
      evidence: waterBest >= 5 ? `${plural(waterBest, "day")} at target in your best week` : null,
    },
    {
      id: "consistency-crown",
      title: "Consistency Crown",
      description: "You stayed active 20+ days across the last 12 weeks.",
      requirement: "20+ active days in the last 12 weeks",
      unlocked: activeDays >= 20,
      progress: activeDays > 0 && activeDays < 20 ? `${activeDays} of 20 days` : null,
      evidence: activeDays >= 20 ? `${plural(activeDays, "active day")} in 12 weeks` : null,
    },
  ];

  return out;
}
