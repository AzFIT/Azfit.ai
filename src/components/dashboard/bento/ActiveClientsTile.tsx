/* Phase 59, Item 3 — Active Clients tile: big numeral, month delta,
   real initials stack, at-risk line. */

import { Users } from "lucide-react";
import { GlassCard } from "../shared/GlassCard";
import { initialsOf } from "@/lib/dashboardBento";

export default function ActiveClientsTile({
  active,
  newThisMonth,
  atRisk,
  names,
  onClick,
}: {
  active: number | null;
  newThisMonth: number | null;
  atRisk: number | null;
  /** active client names (first 4 get initials bubbles) */
  names: string[];
  onClick?: () => void;
}) {
  const shown = names.slice(0, 4);
  return (
    <GlassCard title="Active Clients" titleIcon={<Users className="h-4 w-4" />} glass hover accentColor="var(--azfit-accent)" onClick={onClick}>
      <div className="flex flex-col items-center py-3">
        <p className="stat-numeral text-5xl" style={{ color: "var(--page-text)" }}>
          {active ?? "—"}
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
          active clients
        </p>
        {newThisMonth !== null && newThisMonth > 0 && (
          <span
            className="mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}
          >
            +{newThisMonth} this month
          </span>
        )}
      </div>
      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex -space-x-2">
          {shown.map((n) => (
            <span
              key={n}
              title={n}
              className="flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold"
              style={{
                backgroundColor: "var(--dark-elevated)",
                borderColor: "var(--card-border)",
                color: "var(--azfit-primary)",
              }}
            >
              {initialsOf(n)}
            </span>
          ))}
          {names.length > 4 && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold"
              style={{ backgroundColor: "var(--light-elevated)", borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
            >
              +{names.length - 4}
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium" style={{ color: atRisk ? "var(--danger)" : "var(--light-text-muted)" }}>
          {atRisk ?? "—"} at risk
        </span>
      </div>
    </GlassCard>
  );
}
