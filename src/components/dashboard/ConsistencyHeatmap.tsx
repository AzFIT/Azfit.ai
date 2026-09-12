/* ═══════════════════════════════════════════════════════════════
   ConsistencyHeatmap (Phase 86) — GitHub-style 12-week consistency
   map for clients (and the trainer's client-profile view). Mounted
   on the client dashboard below InsightsStrip, and in the trainer's
   Overview tab. All math in src/lib/consistencyMap.ts; data via
   useConsistencyMap (one range query per source).

   LAYOUT (owner rule, locked in PROGRESS): 7 rows (Mon–Sun) × 12
   columns (weeks), Monday-start. At 390px the grid COMPRESSES to
   fit the card width — NO horizontal scroll. Structural pads (days
   after today) are neutral: no color, no tooltip, aria-hidden.

   MOBILE LABELS: no hover at 390px — tapping a cell shows
   "Wed 3 Sep — 2 activities" in the caption row under the grid;
   every data cell carries the same text as its aria-label. The
   Less→More legend includes the numeric ranges (not color-only).
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { GlassCard } from "./shared/GlassCard";
import { useConsistencyMap } from "@/hooks/useConsistencyMap";
import { LEVEL_RANGES, type ConsistencyCell } from "@/lib/consistencyMap";

/** Intensity fill per level — theme tokens only, surface → brand
 *  cyan via color-mix (no new hex literals). Level 0 is a neutral
 *  trace so the grid structure stays visible. */
const LEVEL_FILL: Record<number, string> = {
  0: "color-mix(in srgb, var(--page-text) 7%, transparent)",
  1: "color-mix(in srgb, var(--azfit-primary) 25%, transparent)",
  2: "color-mix(in srgb, var(--azfit-primary) 45%, transparent)",
  3: "color-mix(in srgb, var(--azfit-primary) 70%, transparent)",
  4: "var(--azfit-primary)",
};

function Cell({ cell, onSelect }: { cell: ConsistencyCell; onSelect: (c: ConsistencyCell) => void }) {
  if (cell.dateKey === null) {
    // Structural pad — layout only, never data
    return <div aria-hidden="true" className="aspect-square w-full rounded-lg" />;
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(cell)}
      aria-label={cell.label}
      aria-pressed={cell.isToday}
      className="aspect-square w-full rounded-lg transition-transform motion-reduce:transition-none hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--azfit-primary)]"
      style={{
        backgroundColor: LEVEL_FILL[cell.level],
        boxShadow: cell.isToday ? "0 0 0 1.5px var(--azfit-accent)" : undefined,
      }}
    />
  );
}

export default function ConsistencyHeatmap({
  clientId,
  clientEmail,
}: {
  /** trainer view (client profile Overview tab) */
  clientId?: string;
  clientEmail?: string;
}) {
  const { grid, loading, error } = useConsistencyMap({ clientId, clientEmail });
  const [selected, setSelected] = useState<ConsistencyCell | null>(null);

  if (loading) {
    return (
      <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-[var(--page-bg)]" />
        <div className="h-[96px] animate-pulse rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)]" />
      </GlassCard>
    );
  }

  /* Consistent with the existing dashboard cards (MetricTiles/
     InsightsStrip): render nothing rather than filler on error. */
  if (error || !grid) return null;

  const sparse = grid.totalActiveDays < 7;

  return (
    <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} style={{ color: "var(--azfit-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Consistency
          </h3>
        </div>
        <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
          Last 12 weeks
        </span>
      </div>

      {/* Month labels — one row aligned to the 12 columns */}
      <div className="mb-1 grid grid-cols-[repeat(12,minmax(0,1fr))] gap-[3px] pl-[26px]">
        {grid.monthLabels.map((m, i) => (
          <div key={i} className="truncate text-[8px] leading-none" style={{ color: "var(--light-text-muted)" }}>
            {m ?? ""}
          </div>
        ))}
      </div>

      {/* Grid: 7 day-rows × 12 week-columns, Monday-start. Fit-width
          compressed — no horizontal scroll at 390px (owner rule). */}
      <div className="flex gap-[3px]">
        <div className="grid w-[26px] shrink-0 grid-rows-[repeat(7,minmax(0,1fr))] gap-[3px] pt-[1px]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="flex items-center text-[8px] leading-none" style={{ color: "var(--light-text-muted)" }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-[repeat(12,minmax(0,1fr))] grid-rows-[repeat(7,minmax(0,1fr))] gap-[3px]">
          {/* columns[week][day] → render row-major across weeks */}
          {[0, 1, 2, 3, 4, 5, 6].map((day) =>
            grid.columns.map((col, w) => (
              <Cell key={`${w}-${day}`} cell={col[day]} onSelect={setSelected} />
            )),
          )}
        </div>
      </div>

      {/* Tap caption (mobile has no hover) */}
      <p className="mt-2 min-h-[14px] text-[10px]" style={{ color: "var(--light-text-secondary)" }} aria-live="polite">
        {selected ? selected.label : "Tap a day to see what you logged"}
      </p>

      {/* Honest sparse-data caption — grid is real, never fake-filled */}
      {sparse && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
          Your consistency map builds as you log — every mark here is a real session, plan item, habit or check-in.
        </p>
      )}

      {/* Legend — numeric ranges included (not color-only) */}
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <span className="text-[9px]" style={{ color: "var(--light-text-muted)" }}>Less</span>
        {LEVEL_RANGES.map((range, level) => (
          <span key={range} className="flex items-center gap-0.5">
            <span className="block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: LEVEL_FILL[level] }} />
            <span className="text-[8px]" style={{ color: "var(--light-text-muted)" }}>{range}</span>
          </span>
        ))}
        <span className="text-[9px]" style={{ color: "var(--light-text-muted)" }}>More</span>
      </div>
    </GlassCard>
  );
}
