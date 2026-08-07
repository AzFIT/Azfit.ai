/* ═══════════════════════════════════════════════════════════════
   PulseRing math (Phase 58) — pure, unit-tested.
   ═══════════════════════════════════════════════════════════════ */

/** Clamp to a renderable 0–100 percent; NaN/±Infinity → 0. */
export function clampPercent(p: number): number {
  if (typeof p !== "number" || !Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

export function ringGeometry(size: number, strokeWidth: number): { radius: number; circumference: number } {
  const radius = (size - strokeWidth) / 2;
  return { radius, circumference: 2 * Math.PI * radius };
}

/** stroke-dashoffset for a given percent of the circumference (0% → full offset). */
export function ringDashOffset(percent: number, circumference: number): number {
  return circumference - (clampPercent(percent) / 100) * circumference;
}
