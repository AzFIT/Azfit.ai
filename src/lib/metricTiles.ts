/* ═══════════════════════════════════════════════════════════════
   metricTiles (Phase 82, numeric path Phase 85) — pure derivation
   for the client dashboard's 2×2 metric tile grid. Rolling "this
   week" (Mon–today).

   SLEEP / HYDRATION: when the client has a NUMERIC habit for the
   target (habits.target_value + unit, Phase 85), the tile shows the
   real aggregate — average of this week's logged habit_logs.value
   vs the habit's own target ("7.5 of 8 h", pct = avg÷target capped
   at 100; see src/lib/numericHabits.ts for the formula). Days with
   no log are excluded, never counted as 0.

   Flag-only habits (no target_value) keep the Phase 82 fallback:
   done-days ÷ elapsed-days-this-week, with the "Set a target"
   state keyed on the matching lifestyle_targets field being set.
   No fabricated numbers anywhere.
   ═══════════════════════════════════════════════════════════════ */

import {
  numericPct,
  numericValueLine,
  type NumericWeekAggregate,
} from "@/lib/numericHabits";

export type TileKey = "activity" | "sleep" | "hydration" | "checkins";

export type TileState = "ready" | "no_target" | "no_logs";

export interface MetricTile {
  key: TileKey;
  label: string;
  /** 0–100 ring percentage; null when no target is set (no ring) */
  pct: number | null;
  /** honest value line, e.g. "2 of 3 sessions" / "7.5 of 8 h" / "Done" */
  value: string;
  state: TileState;
  /** sub-hint for no_target / no_logs states */
  hint: string | null;
}

export interface MetricInputs {
  /** sessions this week (non-cancelled) */
  sessionsScheduled: number;
  sessionsCompleted: number;
  /** elapsed days this week (Mon..today) */
  elapsedDays: number;
  /** lifestyle_targets fields (null = not set) — flag-only fallback */
  sleepTargetSet: boolean;
  waterTargetSet: boolean;
  /** days this week with the matching habit logged done — fallback */
  sleepDoneDays: number;
  waterDoneDays: number;
  /** Phase 85: numeric-habit aggregates (null = no numeric habit) */
  sleepNumeric?: NumericWeekAggregate | null;
  waterNumeric?: NumericWeekAggregate | null;
  /** this week's check-in submitted */
  checkinSubmitted: boolean;
}

const cap100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Numeric path for sleep/hydration tiles (Phase 85). Returns the
 *  tile when a numeric habit exists, else null (caller falls back). */
function numericTile(
  key: "sleep" | "hydration",
  label: string,
  agg: NumericWeekAggregate | null | undefined,
): MetricTile | null {
  if (!agg) return null;
  if (agg.avg == null) {
    return {
      key,
      label,
      pct: 0,
      value: "No logs yet",
      state: "no_logs",
      hint: "Log to start the ring",
    };
  }
  return {
    key,
    label,
    pct: numericPct(agg.avg, agg.target),
    value: numericValueLine(agg.avg, agg.target, agg.unit),
    state: "ready",
    hint: null,
  };
}

export function computeMetricTiles(input: MetricInputs): MetricTile[] {
  const tiles: MetricTile[] = [];

  // 1 · Activity — completed ÷ scheduled sessions this week
  if (input.sessionsScheduled === 0) {
    tiles.push({
      key: "activity",
      label: "Activity",
      pct: null,
      value: "No sessions this week",
      state: "no_logs",
      hint: "Nothing scheduled — book one",
    });
  } else {
    tiles.push({
      key: "activity",
      label: "Activity",
      pct: cap100((input.sessionsCompleted / input.sessionsScheduled) * 100),
      value: `${input.sessionsCompleted} of ${input.sessionsScheduled} session${input.sessionsScheduled === 1 ? "" : "s"}`,
      state: "ready",
      hint: null,
    });
  }

  // 2 · Sleep — numeric habit aggregate (Phase 85), else done-days fallback
  tiles.push(
    numericTile("sleep", "Sleep", input.sleepNumeric) ?? (
      !input.sleepTargetSet ? (
        { key: "sleep", label: "Sleep", pct: null, value: "Set a target", state: "no_target", hint: "Tap to set your sleep target" }
      ) : input.sleepDoneDays === 0 ? (
        { key: "sleep", label: "Sleep", pct: 0, value: "No logs yet", state: "no_logs", hint: "Log a night to start the ring" }
      ) : (
        {
          key: "sleep",
          label: "Sleep",
          pct: cap100((input.sleepDoneDays / Math.max(1, input.elapsedDays)) * 100),
          value: `${input.sleepDoneDays} of ${input.elapsedDays} night${input.elapsedDays === 1 ? "" : "s"}`,
          state: "ready",
          hint: null,
        }
      )
    ),
  );

  // 3 · Hydration — numeric habit aggregate (Phase 85), else done-days fallback
  tiles.push(
    numericTile("hydration", "Hydration", input.waterNumeric) ?? (
      !input.waterTargetSet ? (
        { key: "hydration", label: "Hydration", pct: null, value: "Set a target", state: "no_target", hint: "Tap to set your water target" }
      ) : input.waterDoneDays === 0 ? (
        { key: "hydration", label: "Hydration", pct: 0, value: "No logs yet", state: "no_logs", hint: "Log water to start the ring" }
      ) : (
        {
          key: "hydration",
          label: "Hydration",
          pct: cap100((input.waterDoneDays / Math.max(1, input.elapsedDays)) * 100),
          value: `${input.waterDoneDays} of ${input.elapsedDays} day${input.elapsedDays === 1 ? "" : "s"}`,
          state: "ready",
          hint: null,
        }
      )
    ),
  );

  // 4 · Check-ins — this week's check-in submitted or not
  tiles.push({
    key: "checkins",
    label: "Check-ins",
    pct: input.checkinSubmitted ? 100 : 0,
    value: input.checkinSubmitted ? "Done" : "Due this week",
    state: input.checkinSubmitted ? "ready" : "no_logs",
    hint: input.checkinSubmitted ? null : "Tap to check in",
  });

  return tiles;
}

/** Monday-start week key (local) — Monday of the current week. */
export function weekStartMonday(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dow);
  return d;
}

/** Elapsed days this week (Mon..today, inclusive). */
export function elapsedDaysThisWeek(now: Date = new Date()): number {
  return ((now.getDay() + 6) % 7) + 1;
}
