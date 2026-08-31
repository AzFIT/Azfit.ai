/* ═══════════════════════════════════════════════════════════════
   Schedule drag-and-drop math (Owner Tasks, Task 4) — snap-to-slot,
   duration-preserving moves, and drop validation for the calendar's
   native-DnD rescheduling. Pure + unit-tested; DOM work stays in
   Schedule.tsx.
   ═══════════════════════════════════════════════════════════════ */

import { durationFromTimes } from "./sessionDuration";

/** Grid increment — the same 30-minute slots as the Book Session picker. */
export const SLOT_INCREMENT_MIN = 30;

/** Snap raw minutes-since-midnight to the nearest slot (half rounds up). */
export function snapMinutesToSlot(minutes: number, increment: number = SLOT_INCREMENT_MIN): number {
  if (!Number.isFinite(minutes) || increment <= 0) return 0;
  return Math.round(minutes / increment) * increment;
}

/** Minutes-since-midnight → "HH:MM", clamped into the day. */
export function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Move an event to a new date + start time, preserving its duration.
 *  Returns ISO instants (local → UTC) ready for the sessions row. */
export function movedSessionTimes(
  event: { startTime: string; endTime: string },
  newDate: string,
  newStartTime: string,
): { startsAt: string; endsAt: string } {
  const durationMs = durationFromTimes(event.startTime, event.endTime) * 60_000;
  const start = new Date(`${newDate}T${newStartTime}`);
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + durationMs).toISOString(),
  };
}

/** A drop is allowed when no availability template applies, or when BOTH
 *  the new start and end fit the coach's windows/blocked dates. */
export function dropAllowed(
  availabilityCheck: ((date: string, time: string) => boolean) | undefined,
  date: string,
  startTime: string,
  endTime: string,
): boolean {
  if (!availabilityCheck) return true;
  return availabilityCheck(date, startTime) && availabilityCheck(date, endTime);
}
