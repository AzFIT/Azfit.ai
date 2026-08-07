/* ═══════════════════════════════════════════════════════════════
   Phase 55 — shared weight-trend math (extracted from Analytics;
   used by Analytics and the client dashboard mini-chart).
   ═══════════════════════════════════════════════════════════════ */

export interface WeightPoint {
  date: string; // recorded_at (ISO)
  weight: number;
  movingAvg?: number;
}

/** Trailing moving average over up to `windowSize` points (default 3). */
export function withMovingAverage(points: WeightPoint[], windowSize = 3): WeightPoint[] {
  return points.map((p, i) => {
    const windowPts = points.slice(Math.max(0, i - (windowSize - 1)), i + 1);
    const avg = windowPts.reduce((s, x) => s + x.weight, 0) / windowPts.length;
    return { ...p, movingAvg: +avg.toFixed(1) };
  });
}
