/* ═══════════════════════════════════════════════════════════════
   Phase 68 Item 2 — month-grid math for the Schedule page's new
   month view. Pure, local-timezone (the Phase 64 rule: human-visible
   day keys are local). Weeks start MONDAY (matches the existing
   week/day views).
   ═══════════════════════════════════════════════════════════════ */

import { formatDateKeyLocal } from "./utils";

export interface MonthCell {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
}

/** 42 cells (6 Monday-start weeks) covering the given month, with
 *  leading/trailing spill days from adjacent months. */
export function monthCells(year: number, month: number, today: Date = new Date()): MonthCell[] {
  const first = new Date(year, month, 1);
  // Monday-start offset: getDay() Sun=0 … Sat=6 → Monday is 0 back
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const todayKey = formatDateKeyLocal(today);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = formatDateKeyLocal(d);
    return {
      date: d,
      dateKey: key,
      inMonth: d.getMonth() === month,
      isToday: key === todayKey,
    };
  });
}

/** 'September 2026' — en-US pinned (repo date convention). */
export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
