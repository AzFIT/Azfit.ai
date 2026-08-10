/* Phase 59 — WoW delta chip. Null percent renders NOTHING (honest-data rule). */
export default function DeltaChip({ pct, suffix = "vs last wk", invert = false }: { pct: number | null; suffix?: string; invert?: boolean }) {
  if (pct === null) return null;
  // invert: metrics where up is bad (e.g. cancellations)
  const positive = invert ? pct < 0 : pct > 0;
  const zero = pct === 0;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{
        backgroundColor: zero ? "var(--light-elevated)" : positive ? "var(--success-bg)" : "var(--danger-bg)",
        color: zero ? "var(--light-text-muted)" : positive ? "var(--success)" : "var(--danger)",
      }}
    >
      {pct > 0 ? "+" : ""}
      {pct}% {suffix}
    </span>
  );
}
