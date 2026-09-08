/* ═══════════════════════════════════════════════════════════════
   metricTiles (Phase 82) — pure derivation for the client
   dashboard's 2×2 metric tile grid. Rolling "this week" (Mon–today).

   HONEST-DATA NOTE (documented deviation from the phase brief's
   numeric value lines): the schema has NO numeric water/sleep
   logging (habit_logs stores done flags only; the dashboard's
   numeric recovery/hydration states are unsaved local mocks from
   earlier phases). So Sleep/Hydration tiles derive from REAL
   habit_logs done flags: done-days ÷ elapsed-days-this-week, with
   the "Set a target" state keyed on the matching lifestyle_targets
   field being set. No fabricated numbers anywhere.
   ═══════════════════════════════════════════════════════════════ */

export type TileKey = "activity" | "sleep" | "hydration" | "checkins";

export type TileState = "ready" | "no_target" | "no_logs";

export interface MetricTile {
  key: TileKey;
  label: string;
  /** 0–100 ring percentage; null when no target is set (no ring) */
  pct: number | null;
  /** honest value line, e.g. "2 of 3 sessions" / "4 of 5 days" / "Done" */
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
  /** lifestyle_targets fields (null = not set) */
  sleepTargetSet: boolean;
  waterTargetSet: boolean;
  /** days this week with the matching habit logged done */
  sleepDoneDays: number;
  waterDoneDays: number;
  /** this week's check-in submitted */
  checkinSubmitted: boolean;
}

const cap100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

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

  // 2 · Sleep — done days ÷ elapsed days (target = sleep_hours set)
  if (!input.sleepTargetSet) {
    tiles.push({ key: "sleep", label: "Sleep", pct: null, value: "Set a target", state: "no_target", hint: "Tap to set your sleep target" });
  } else if (input.sleepDoneDays === 0) {
    tiles.push({ key: "sleep", label: "Sleep", pct: 0, value: "No logs yet", state: "no_logs", hint: "Log a night to start the ring" });
  } else {
    tiles.push({
      key: "sleep",
      label: "Sleep",
      pct: cap100((input.sleepDoneDays / Math.max(1, input.elapsedDays)) * 100),
      value: `${input.sleepDoneDays} of ${input.elapsedDays} night${input.elapsedDays === 1 ? "" : "s"}`,
      state: "ready",
      hint: null,
    });
  }

  // 3 · Hydration — done days ÷ elapsed days (target = water_ml set)
  if (!input.waterTargetSet) {
    tiles.push({ key: "hydration", label: "Hydration", pct: null, value: "Set a target", state: "no_target", hint: "Tap to set your water target" });
  } else if (input.waterDoneDays === 0) {
    tiles.push({ key: "hydration", label: "Hydration", pct: 0, value: "No logs yet", state: "no_logs", hint: "Log water to start the ring" });
  } else {
    tiles.push({
      key: "hydration",
      label: "Hydration",
      pct: cap100((input.waterDoneDays / Math.max(1, input.elapsedDays)) * 100),
      value: `${input.waterDoneDays} of ${input.elapsedDays} day${input.elapsedDays === 1 ? "" : "s"}`,
      state: "ready",
      hint: null,
    });
  }

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
