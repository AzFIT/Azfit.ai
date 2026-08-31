/* ═══════════════════════════════════════════════════════════════
   Session duration math (Task 1) — the Book Session wizard picks a
   duration; the end time is DERIVED (start + duration). Pure + tested.
   ═══════════════════════════════════════════════════════════════ */

export const DURATION_OPTIONS = [30, 45, 60, 90] as const;
export const DEFAULT_DURATION_MIN = 60;

/** "HH:MM" + duration minutes → derived end "HH:MM". */
export function endTimeFromDuration(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(durationMin)) return "";
  const total = h * 60 + m + durationMin;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

/** start + end "HH:MM" → duration in minutes (same-day; 0 when invalid). */
export function durationFromTimes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/** Nearest duration chip for edit-prefill (keeps the exact derived end when
 *  the saved duration isn't one of the four chips). */
export function nearestDurationOption(durationMin: number): number {
  let best: number = DEFAULT_DURATION_MIN;
  let bestDist = Infinity;
  for (const opt of DURATION_OPTIONS) {
    const d = Math.abs(durationMin - opt);
    if (d < bestDist) {
      bestDist = d;
      best = opt;
    }
  }
  return best;
}
