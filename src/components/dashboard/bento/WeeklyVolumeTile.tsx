/* Phase 59, Item 4 — Weekly Volume tile: 7 bars (Mon–Sun) from real
   workout_log_entries weight×reps; brand gradient on the max day. */

import { BarChart3 } from "lucide-react";
import { GlassCard } from "../shared/GlassCard";
import { formatVolumeKg, type WeeklyVolume } from "@/lib/dashboardBento";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function WeeklyVolumeTile({ volume, loading }: { volume: WeeklyVolume | null; loading: boolean }) {
  const totalLabel = volume ? formatVolumeKg(volume.total) : null;
  return (
    <GlassCard title="Weekly Volume" titleIcon={<BarChart3 className="h-4 w-4" />} glass hover accentColor="var(--azfit-primary)">
      <p className="-mt-1 mb-2 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
        <span className="stat-numeral text-base font-bold" style={{ color: "var(--page-text)" }}>
          {loading ? "…" : (totalLabel ?? "—")}
        </span>{" "}
        lifted this week
      </p>
      {!loading && (!volume || volume.total === 0) ? (
        <p className="py-4 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
          No logged sets this week — volume appears once clients complete sessions.
        </p>
      ) : (
        <div className="flex items-end justify-between gap-1.5 px-1 pt-1" style={{ height: 96 }}>
          {(volume?.dayTotals ?? [0, 0, 0, 0, 0, 0, 0]).map((v, i) => {
            const max = volume?.max ?? 0;
            const h = max > 0 ? Math.max(6, Math.round((v / max) * 72)) : 6;
            const isMax = volume != null && i === volume.maxDayIdx;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: h,
                    background: isMax
                      ? "linear-gradient(180deg, var(--azfit-primary), var(--azfit-accent))"
                      : "var(--dark-elevated)",
                  }}
                  title={`${Math.round(v)} kg`}
                />
                <span className="text-[9px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                  {DAY_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
