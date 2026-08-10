/* Phase 59, Item 2 — Compliance hero tile (PulseRing, hero size). */

import PulseRing from "@/components/ui/PulseRing";
import { GlassCard } from "../shared/GlassCard";
import DeltaChip from "./DeltaChip";

export default function ComplianceHeroTile({
  pct,
  onTrack,
  total,
  deltaPct,
  onClick,
}: {
  /** Ring percent; null when there's no roster */
  pct: number | null;
  onTrack: number;
  total: number;
  /** WoW delta in percentage points; null → no chip (honest) */
  deltaPct: number | null;
  onClick?: () => void;
}) {
  return (
    <GlassCard title="Client Compliance" glass hover accentColor="var(--azfit-secondary)" onClick={onClick}>
      <div className="flex flex-col items-center justify-center py-4">
        <PulseRing
          size={180}
          strokeWidth={13}
          percent={pct ?? 0}
          centerLabel={pct === null ? "—" : `${pct}%`}
          subLabel={total > 0 ? `${onTrack} of ${total} on track` : "no clients yet"}
          ariaLabel={`Client compliance this week: ${pct ?? 0}%`}
        />
        <div className="mt-3 min-h-[18px]">
          <DeltaChip pct={deltaPct} />
        </div>
      </div>
    </GlassCard>
  );
}
