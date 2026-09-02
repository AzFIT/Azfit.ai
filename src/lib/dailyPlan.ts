/* ═══════════════════════════════════════════════════════════════
   Phase 67 — "My Plan for Today" logic. Pure, DB-free.

   Design decisions (documented in PROGRESS.md):
   - Auto items (session / lifestyle target / check-in) are DERIVED at
     render and never stored — idempotent by construction; the table's
     unique index protects custom adds against double-click dupes.
   - Auto items never fake completion: done comes from the real action
     (session status, habit log, check-in submission). A target with no
     trackable signal stays unticked and untrackable ("auto" tag in UI).
   - Tracking ranges compute per-day plans from the same derivation over
     range-scoped rows; days with no items don't count.
   ═══════════════════════════════════════════════════════════════ */

export type PlanItemSource = "custom" | "session" | "target" | "checkin";

export interface PlanItemRow {
  id: string;
  client_id: string;
  plan_date: string;
  label: string;
  source: string;
  done: boolean;
  sort_order: number;
}

export interface PlanItem {
  /** row id for customs, stable derived key for autos */
  key: string;
  label: string;
  source: PlanItemSource;
  done: boolean;
  /** true for derived items (session/target/check-in) */
  auto: boolean;
  /** false when no reliable signal exists — UI shows the 'auto' tag and
   *  the item stays unticked instead of faking completion */
  trackable: boolean;
  /** daily_plan_items row id (customs only) */
  rowId?: string;
}

/* ── Target → habit signal matching ────────────────────────── */

const TARGET_HABIT_KEYWORDS: Record<"water" | "steps" | "sleep", RegExp> = {
  water: /water|hydrat/i,
  steps: /step|walk/i,
  sleep: /sleep/i,
};

export interface TargetSignal {
  available: boolean;
  done: boolean;
}

/** Match active habits to lifestyle targets by name keyword; done when a
 *  matching habit is logged done on the given day. */
export function habitSignalsForTargets(
  habits: { id: string; name: string; is_active?: boolean }[],
  logsToday: { habit_id: string; done: boolean }[],
): Record<"water" | "steps" | "sleep", TargetSignal> {
  const doneIds = new Set(logsToday.filter((l) => l.done).map((l) => l.habit_id));
  const out = {} as Record<"water" | "steps" | "sleep", TargetSignal>;
  for (const key of Object.keys(TARGET_HABIT_KEYWORDS) as ("water" | "steps" | "sleep")[]) {
    const matching = habits.filter(
      (h) => h.is_active !== false && TARGET_HABIT_KEYWORDS[key].test(h.name),
    );
    out[key] = { available: matching.length > 0, done: matching.some((h) => doneIds.has(h.id)) };
  }
  return out;
}

/* ── Today-plan derivation ─────────────────────────────────── */

export interface TodayPlanInput {
  customRows: PlanItemRow[];
  /** today's booked session (sessions table), if any */
  sessionTitle?: string | null;
  sessionDone?: boolean;
  /** lifestyle_targets jsonb from the client row */
  targets?: { steps?: number | null; sleep_hours?: number | null; water_ml?: number | null } | null;
  targetSignals?: Record<"water" | "steps" | "sleep", TargetSignal>;
  checkinDue?: boolean;
  checkinDone?: boolean;
}

const NO_SIGNALS: Record<"water" | "steps" | "sleep", TargetSignal> = {
  water: { available: false, done: false },
  steps: { available: false, done: false },
  sleep: { available: false, done: false },
};

const fmtInt = (n: number) => n.toLocaleString("en-US");

export function buildTodayPlan(input: TodayPlanInput): PlanItem[] {
  const items: PlanItem[] = [];
  const customs = [...input.customRows].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  for (const r of customs) {
    items.push({ key: r.id, label: r.label, source: "custom", done: r.done, auto: false, trackable: true, rowId: r.id });
  }

  if (input.sessionTitle) {
    items.push({
      key: "auto-session",
      label: `Workout: ${input.sessionTitle}`,
      source: "session",
      done: !!input.sessionDone,
      auto: true,
      trackable: true,
    });
  }

  const signals = input.targetSignals ?? NO_SIGNALS;
  const t = input.targets;
  if (t?.water_ml && t.water_ml > 0) {
    items.push({
      key: "auto-water",
      label: `Drink ${fmtInt(t.water_ml)} ml water`,
      source: "target",
      done: signals.water.done,
      auto: true,
      trackable: signals.water.available,
    });
  }
  if (t?.steps && t.steps > 0) {
    items.push({
      key: "auto-steps",
      label: `${fmtInt(t.steps)} steps`,
      source: "target",
      done: signals.steps.done,
      auto: true,
      trackable: signals.steps.available,
    });
  }
  if (t?.sleep_hours && t.sleep_hours > 0) {
    items.push({
      key: "auto-sleep",
      label: `Sleep ${t.sleep_hours} h`,
      source: "target",
      done: signals.sleep.done,
      auto: true,
      trackable: signals.sleep.available,
    });
  }

  if (input.checkinDue) {
    items.push({
      key: "auto-checkin",
      label: "Complete weekly check-in",
      source: "checkin",
      done: !!input.checkinDone,
      auto: true,
      trackable: true,
    });
  }
  return items;
}

/* ── Completion math + celebration rule ────────────────────── */

export function planCompletion(items: PlanItem[]): { done: number; total: number; pct: number } {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Owner rule: celebrate only at 100% AND more than 5 items; the caller
 *  gates once-per-day via localStorage (celebrationDismissed). */
export function shouldCelebrate(items: PlanItem[], alreadyDismissed: boolean): boolean {
  if (alreadyDismissed) return false;
  const { done, total } = planCompletion(items);
  return total > 5 && done === total;
}

const CELEBRATION_PREFIX = "azfit-plan-celebration:";

export function celebrationDismissed(dateKey: string): boolean {
  try {
    return localStorage.getItem(CELEBRATION_PREFIX + dateKey) === "1";
  } catch {
    return false;
  }
}

export function dismissCelebration(dateKey: string): void {
  try {
    localStorage.setItem(CELEBRATION_PREFIX + dateKey, "1");
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/* ── Tracking ranges (Daily / Weekly / Monthly / Yearly) ───── */

export type TrackingRange = "daily" | "weekly" | "monthly" | "yearly";

const DAY_MS = 86400000;

function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local date keys covered by a range, never past today. Weekly runs
 *  Monday-start (same convention as checkinWeek). */
export function rangeDateKeys(range: TrackingRange, now: Date = new Date()): string[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  switch (range) {
    case "daily":
      start = today;
      break;
    case "weekly":
      start = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS);
      break;
    case "monthly":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "yearly":
      start = new Date(today.getFullYear(), 0, 1);
      break;
  }
  const out: string[] = [];
  for (let d = start; d <= today; d = new Date(d.getTime() + DAY_MS)) out.push(dateKey(d));
  return out;
}

export interface DayCompletion {
  dateKey: string;
  done: number;
  total: number;
}

export interface RangeSummary {
  done: number;
  total: number;
  /** null when the range has no items — honest empty state, not 0% */
  pct: number | null;
  daysWithItems: number;
  dayCount: number;
}

export function summarizeRange(days: DayCompletion[]): RangeSummary {
  const withItems = days.filter((d) => d.total > 0);
  const done = withItems.reduce((s, d) => s + d.done, 0);
  const total = withItems.reduce((s, d) => s + d.total, 0);
  return {
    done,
    total,
    pct: total === 0 ? null : Math.round((done / total) * 100),
    daysWithItems: withItems.length,
    dayCount: days.length,
  };
}

/** Per-day pct for the weekly mini chart (null when the day had no items). */
export function weeklyBars(days: DayCompletion[]): (number | null)[] {
  return days.map((d) => (d.total === 0 ? null : Math.round((d.done / d.total) * 100)));
}

/** Display label for a range summary, e.g. 'This week: 68% (34/50)'. */
export function rangeLabel(range: TrackingRange, s: RangeSummary): string {
  const name = { daily: "Today", weekly: "This week", monthly: "This month", yearly: "This year" }[range];
  if (s.pct == null) return `${name}: no plans yet`;
  return `${name}: ${s.pct}% of plans completed (${s.done}/${s.total})`;
}
