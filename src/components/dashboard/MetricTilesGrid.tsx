/* ═══════════════════════════════════════════════════════════════
   MetricTilesGrid (Phase 82) — Hume-style 2×2 metric tile grid on
   the client dashboard: Activity / Sleep / Hydration / Check-ins.
   Every value is derived in src/lib/metricTiles.ts from real rows
   (rolling this week, Mon–today). Unset targets show an honest
   "Set a target" state; zero logs show an honest 0% "No logs yet".
   Tiles are fully tappable (≥44px) and navigate to the matching
   surface.
   ═══════════════════════════════════════════════════════════════ */

import { useNavigate } from "react-router";
import { Activity, BedDouble, Droplets, ClipboardCheck, ChevronRight } from "lucide-react";
import PulseRing from "@/components/ui/PulseRing";
import IconTile, { type IconTileTone } from "@/components/ui/IconTile";
import { GlassCard } from "./shared/GlassCard";
import { useMetricTiles } from "@/hooks/useMetricTiles";
import type { MetricTile, TileKey } from "@/lib/metricTiles";

const TILE_META: Record<TileKey, { icon: typeof Activity; tone: IconTileTone; path: string }> = {
  activity: { icon: Activity, tone: "brand", path: "/schedule" },
  sleep: { icon: BedDouble, tone: "accent", path: "/settings" },
  hydration: { icon: Droplets, tone: "success", path: "/nutrition" },
  checkins: { icon: ClipboardCheck, tone: "warn", path: "/check-ins" },
};

function Tile({ tile }: { tile: MetricTile }) {
  const navigate = useNavigate();
  const meta = TILE_META[tile.key];
  return (
    <button
      type="button"
      onClick={() => navigate(meta.path)}
      aria-label={`${tile.label}: ${tile.value}`}
      className="min-h-[44px] w-full rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--azfit-primary)]/40 active:scale-[0.98] motion-reduce:transition-none"
    >
      <span className="flex items-center gap-2.5">
        <IconTile icon={meta.icon} size="sm" tone={meta.tone} />
        <span className="flex-1 text-[11px] font-semibold" style={{ color: "var(--page-text)" }}>{tile.label}</span>
        {tile.pct !== null && (
          <PulseRing
            percent={tile.pct}
            size={32}
            strokeWidth={3.5}
            centerLabel={`${tile.pct}%`}
            ariaLabel={`${tile.label} ${tile.pct}%`}
          />
        )}
        <ChevronRight size={14} className="shrink-0 text-[var(--light-text-muted)]" />
      </span>
      <span className="mt-1.5 block text-[10px] leading-tight" style={{ color: "var(--light-text-secondary)" }}>
        {tile.value}
      </span>
      {tile.hint && (
        <span className="block text-[9px] leading-tight" style={{ color: "var(--light-text-muted)" }}>
          {tile.hint}
        </span>
      )}
    </button>
  );
}

export default function MetricTilesGrid() {
  const { tiles, loading, error } = useMetricTiles();

  if (loading) {
    return (
      <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[64px] animate-pulse rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)]" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error || !tiles) return null; // honest: render nothing rather than fake numbers

  return (
    <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile key={t.key} tile={t} />
        ))}
      </div>
    </GlassCard>
  );
}
