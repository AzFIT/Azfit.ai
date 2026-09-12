/* ═══════════════════════════════════════════════════════════════
   AchievementsGrid (Phase 87) — rule-based achievement cards on
   the client dashboard, mounted below ConsistencyHeatmap. Engine:
   src/lib/achievements.ts (real data only; Phases 83–86 shapes).

   HONEST-DATA (permanent rule): unlocked = filled IconTile + brand
   token accent; locked = muted surface token + requirement text
   ONLY — no fabricated progress bars, no "0%". A progress sub-line
   appears only when the engine reports real partial progress, and
   the tap-through detail shows real numbers only (evidence /
   progress from the same computed data).
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Trophy, Footprints, Flame, ClipboardCheck, ListChecks, Droplets, Crown, Lock } from "lucide-react";
import IconTile from "@/components/ui/IconTile";
import { GlassCard } from "./shared/GlassCard";
import { useAchievements } from "@/hooks/useAchievements";
import type { Achievement } from "@/lib/achievements";

const ACH_ICONS: Record<string, typeof Trophy> = {
  "first-steps": Footprints,
  "streak-3": Flame,
  "streak-7": Flame,
  "streak-14": Flame,
  "checkin-regular": ClipboardCheck,
  "plan-finisher": ListChecks,
  "hydration-hero": Droplets,
  "consistency-crown": Crown,
};

function AchievementCard({
  ach,
  selected,
  onSelect,
}: {
  ach: Achievement;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = ACH_ICONS[ach.id] ?? Trophy;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${ach.title}: ${ach.unlocked ? "unlocked" : "locked"} — ${ach.requirement}`}
      className={`flex min-h-[44px] w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-all motion-reduce:transition-none ${
        selected ? "border-[var(--azfit-primary)]/60" : "border-[var(--card-border)]"
      } hover:-translate-y-0.5 hover:border-[var(--azfit-primary)]/40 active:scale-[0.98]`}
      style={{
        backgroundColor: "var(--page-bg)",
        opacity: ach.unlocked ? 1 : 0.75,
      }}
    >
      <span className={ach.unlocked ? "" : "grayscale"}>
        <IconTile icon={Icon} size="sm" tone={ach.unlocked ? "brand" : "muted"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: "var(--page-text)" }}>
            {ach.title}
          </span>
          {!ach.unlocked && <Lock size={10} style={{ color: "var(--light-text-muted)" }} aria-hidden />}
        </span>
        {/* Locked: requirement text only. Unlocked: description. */}
        <span className="mt-0.5 block text-[9px] leading-tight" style={{ color: "var(--light-text-secondary)" }}>
          {ach.unlocked ? ach.description : ach.requirement}
        </span>
        {/* Real partial progress ONLY — never a fabricated bar or 0% */}
        {!ach.unlocked && ach.progress && (
          <span className="mt-0.5 block text-[9px] font-semibold leading-tight" style={{ color: "var(--azfit-primary)" }}>
            {ach.progress}
          </span>
        )}
      </span>
    </button>
  );
}

export default function AchievementsGrid() {
  const { achievements, loading, error } = useAchievements();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) {
    return (
      <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
        <div className="mb-3 h-4 w-36 animate-pulse rounded bg-[var(--page-bg)]" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[64px] animate-pulse rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)]" />
          ))}
        </div>
      </GlassCard>
    );
  }

  /* Consistent with MetricTiles/InsightsStrip: nothing rather than filler */
  if (error || !achievements) return null;

  const selected = achievements.find((a) => a.id === selectedId) ?? null;
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={14} style={{ color: "var(--azfit-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Achievements
          </h3>
        </div>
        <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
          {unlocked} of {achievements.length} unlocked
        </span>
      </div>

      {/* 2-col fit-width grid — no horizontal scroll at 390 */}
      <div className="grid grid-cols-2 gap-3">
        {achievements.map((a) => (
          <AchievementCard key={a.id} ach={a} selected={selectedId === a.id} onSelect={() => setSelectedId(selectedId === a.id ? null : a.id)} />
        ))}
      </div>

      {/* Tap-through detail — real numbers only */}
      {selected && (
        <div
          className="mt-3 rounded-xl border p-3"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--page-bg)" }}
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold" style={{ color: "var(--page-text)" }}>
            {selected.title} {selected.unlocked ? "— unlocked" : "— locked"}
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--light-text-secondary)" }}>
            {selected.description}
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            Requirement: {selected.requirement}
          </p>
          {/* Evidence/progress lines state the real numbers from the engine */}
          {selected.unlocked && selected.evidence && (
            <p className="mt-1 text-[10px] font-semibold" style={{ color: "var(--azfit-primary)" }}>
              {selected.evidence}
            </p>
          )}
          {!selected.unlocked && selected.progress && (
            <p className="mt-1 text-[10px] font-semibold" style={{ color: "var(--azfit-primary)" }}>
              {selected.progress}
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
