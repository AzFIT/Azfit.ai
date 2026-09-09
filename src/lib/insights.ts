/* ═══════════════════════════════════════════════════════════════
   insights (Phase 83 Item 1) — rule-based, template-only insight
   cards for the client dashboard. NO LLM, NO fabricated numbers:
   every rule fires ONLY when its inputs are real and meaningful;
   a rule with missing inputs simply doesn't render.

   RANKING (documented): action-needed first (warn: check-in
   reminder, negative momentum), then positive impact — bigger
   momentum deltas first, then habit highlight, plan completion,
   streak. Max 3 cards. Zero rules → ONE honest neutral card.

   STREAK DEFINITION (documented): consecutive days with ≥1 real
   activity row (habit_logs.done / session completed / plan item
   done / check-in submission), ending today or yesterday (the
   current day can't break the streak until it ends).
   ═══════════════════════════════════════════════════════════════ */

export type InsightTone = "success" | "brand" | "warn";

export interface InsightCard {
  key: string;
  tone: InsightTone;
  /** one-line insight (template with the real numbers baked in) */
  text: string;
  /** sub-line stating the raw numbers it was computed from */
  numbers: string;
  /** optional tap-through */
  path?: string;
  rank: number;
}

export interface InsightsInput {
  sessionsCompletedThisWeek: number;
  sessionsCompletedLastWeek: number;
  sessionsScheduledThisWeek: number;
  sessionsScheduledLastWeek: number;
  currentStreak: number;
  /** longest streak within the fetched history window (90d) */
  longestStreak: number;
  planDoneLastWeek: number;
  planTotalLastWeek: number;
  checkinSubmittedThisWeek: boolean;
  /** Mon=1 … Sun=7 (how far into the week we are) */
  dayOfWeek: number;
  habitDaysThisWeek: number;
  habitDaysLastWeek: number;
}

export const MAX_CARDS = 3;

export function computeInsights(input: InsightsInput): InsightCard[] {
  const cards: InsightCard[] = [];

  // Workout momentum — only when BOTH weeks have scheduled sessions
  if (input.sessionsScheduledThisWeek > 0 && input.sessionsScheduledLastWeek > 0) {
    const diff = input.sessionsCompletedThisWeek - input.sessionsCompletedLastWeek;
    if (diff > 0) {
      cards.push({
        key: "momentum-up",
        tone: "success",
        text: `${diff} more workout${diff === 1 ? "" : "s"} than last week — great consistency`,
        numbers: `${input.sessionsCompletedThisWeek} completed this week vs ${input.sessionsCompletedLastWeek} last week`,
        path: "/schedule",
        rank: 20 + diff,
      });
    } else if (diff < 0) {
      cards.push({
        key: "momentum-down",
        tone: "warn",
        text: `${-diff} fewer workout${-diff === 1 ? "" : "s"} than last week — let's get back on track`,
        numbers: `${input.sessionsCompletedThisWeek} completed this week vs ${input.sessionsCompletedLastWeek} last week`,
        path: "/schedule",
        rank: 10 + -diff,
      });
    }
  }

  // Streak recognition — ≥3 days
  if (input.currentStreak >= 3) {
    const best = input.currentStreak >= input.longestStreak;
    cards.push({
      key: "streak",
      tone: "success",
      text: best
        ? `${input.currentStreak}-day streak — your best yet`
        : `${input.currentStreak}-day streak — keep it rolling`,
      numbers: `longest run in the last 90 days: ${input.longestStreak} days`,
      rank: 6,
    });
  }

  // Plan completion — last week ≥ 80%
  if (input.planTotalLastWeek > 0) {
    const pct = Math.round((input.planDoneLastWeek / input.planTotalLastWeek) * 100);
    if (pct >= 80) {
      cards.push({
        key: "plan",
        tone: "success",
        text: `You ticked off ${pct}% of your plan last week`,
        numbers: `${input.planDoneLastWeek} of ${input.planTotalLastWeek} plan items done last week`,
        rank: 5,
      });
    }
  }

  // Check-in reminder — not submitted AND ≥3 days into the week
  if (!input.checkinSubmittedThisWeek && input.dayOfWeek >= 3) {
    cards.push({
      key: "checkin-due",
      tone: "warn",
      text: "Your weekly check-in is due — takes 2 minutes",
      numbers: `no check-in submitted yet this week (day ${input.dayOfWeek} of 7)`,
      path: "/check-ins",
      rank: 15,
    });
  }

  // Habit highlight — both weeks have data AND this week is up
  if (input.habitDaysThisWeek > input.habitDaysLastWeek && input.habitDaysLastWeek >= 0 && input.habitDaysThisWeek > 0) {
    cards.push({
      key: "habits",
      tone: "success",
      text: `You hit your habit targets ${input.habitDaysThisWeek} day${input.habitDaysThisWeek === 1 ? "" : "s"} this week — up from ${input.habitDaysLastWeek}`,
      numbers: `habit-target days: ${input.habitDaysThisWeek} this week vs ${input.habitDaysLastWeek} last week`,
      rank: 8,
    });
  }

  // Rank (action-needed first, then impact) and cap
  const sorted = cards.sort((a, b) => {
    const aWarn = a.tone === "warn" ? 1 : 0;
    const bWarn = b.tone === "warn" ? 1 : 0;
    if (aWarn !== bWarn) return bWarn - aWarn;
    return b.rank - a.rank;
  });
  const top = sorted.slice(0, MAX_CARDS);
  if (top.length > 0) return top;

  // Honest neutral fallback — never an empty strip, never filler
  return [
    {
      key: "neutral",
      tone: "brand",
      text: "Log a session or habit to start seeing insights",
      numbers: "insights appear once there's real data to read",
      rank: 0,
    },
  ];
}

/* ── Streak computation (from real activity dates) ───────────── */

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

/** Consecutive-day streaks from a set of local date keys (YYYY-MM-DD).
 *  Current streak counts back from today or yesterday. */
export function computeStreaks(activityDates: string[], todayKey: string): StreakResult {
  const days = new Set(activityDates);
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date(`${todayKey}T00:00:00`);

  // current streak: start at today if active, else yesterday
  let current = 0;
  const cursor = new Date(today);
  if (!days.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // longest run over the whole set
  const sortedKeys = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sortedKeys) {
    if (prev) {
      const next = new Date(`${prev}T00:00:00`);
      next.setDate(next.getDate() + 1);
      run = toKey(next) === k ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = k;
  }

  return { currentStreak: current, longestStreak: longest };
}
