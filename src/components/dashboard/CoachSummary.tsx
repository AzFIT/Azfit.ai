// ═══════════════════════════════════════════════════════════════
// CoachSummary (Phase 90) — Vault-style summary block for the top of
// the trainer dashboard: dotted alert banner + four metric cards
// (small-caps title → large metric → real context sub-line).
//
// LAYOUT ONLY from the Vault reference (its Dashboard/Coach pages) —
// all AzFIT theme tokens, no Vault colors. Every number comes from
// src/lib/coachSummary.ts (pure, unit-tested) over real rows fetched
// by useCoachSummary (one batch, no N+1).
//
// Header (Item 1) already exists verbatim at the top of
// TrainerDashboard ("Good evening, Coach {firstName}" + subtext, real
// profile name, time-aware greeting) — this block mounts directly
// beneath it; nothing existing is removed in this phase.
// ═══════════════════════════════════════════════════════════════

import { Users, Calendar, Percent, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useCoachSummary } from "@/hooks/useCoachSummary";
import {
  localWeekWindow,
  inactiveClients,
  sessionsThisWeek,
  remainingToday,
  weekCompliance,
  complianceDelta,
  needsAttentionSummary,
  onTrackSummary,
} from "@/lib/coachSummary";
import type { ClientHealthItem } from "@/components/dashboard/ClientHealthGrid";

interface CoachSummaryProps {
  /** Existing useClientHealth output — reused, never re-derived here. */
  healthClients: ClientHealthItem[];
  healthLoading: boolean;
}

const cardShell =
  "flex min-h-[44px] w-full flex-col gap-1 rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.99]";

function Shell({
  onClick,
  label,
  children,
  testId,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      className={cardShell}
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      {children}
    </button>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: "var(--light-text-muted)" }}
    >
      {children}
    </span>
  );
}

function Metric({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-2xl font-bold tabular-nums lg:text-3xl" style={{ color: "var(--page-text)" }}>
      {children}
    </span>
  );
}

function SubLine({ children, tone }: { children: React.ReactNode; tone?: "warn" | "success" | "default" }) {
  const color =
    tone === "warn" ? "var(--warning)" : tone === "success" ? "var(--success)" : "var(--light-text-muted)";
  return (
    <span className="text-xs" style={{ color }}>
      {children}
    </span>
  );
}

export default function CoachSummary({ healthClients, healthLoading }: CoachSummaryProps) {
  const navigate = useNavigate();
  const { clients, sessions, logs, loading, error } = useCoachSummary();

  const busy = loading || healthLoading;

  // ── Alert strip: same 7-day-no-completion signal as the Coach AI brief ──
  const inactive = inactiveClients(clients, logs);

  // ── Card math (pure) ──
  const thisWeekWin = localWeekWindow(0);
  const lastWeekWin = localWeekWindow(1);
  const weekCount = sessionsThisWeek(sessions, thisWeekWin);
  const remaining = remainingToday(sessions);
  const thisCompliance = weekCompliance(sessions, clients, thisWeekWin);
  const lastCompliance = weekCompliance(sessions, clients, lastWeekWin);
  const delta = complianceDelta(thisCompliance, lastCompliance);
  const attention = needsAttentionSummary(healthClients);
  const onTrack = onTrackSummary(healthClients, clients.length);

  if (busy) {
    return (
      <div className="mb-6 space-y-3" aria-label="Loading coach summary">
        <div className="h-12 animate-pulse rounded-xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="mb-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}>
        Couldn&apos;t load this week&apos;s summary — the rest of your dashboard is unaffected.
      </p>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {/* ── Alert strip (always rendered: warning OR honest positive) ── */}
      {inactive.length > 0 ? (
        <button
          onClick={() => navigate("/clients")}
          data-testid="alert-strip"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-all duration-150 active:scale-[0.99]"
          style={{
            borderColor: "color-mix(in srgb, var(--warning) 55%, var(--card-border))",
            backgroundColor: "color-mix(in srgb, var(--warning) 7%, var(--card-bg))",
          }}
        >
          <span className="flex min-w-0 items-center gap-2.5 text-[13px]" style={{ color: "var(--page-text)" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} aria-hidden />
            <span className="min-w-0">
              <span className="font-bold tabular-nums">{inactive.length}</span> client
              {inactive.length === 1 ? "" : "s"} missed workouts this week{" "}
              <span className="truncate" style={{ color: "var(--light-text-muted)" }}>
                — {inactive.map((c) => c.firstName).join(", ")}
              </span>
            </span>
          </span>
          <span
            className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--warning)" }}
          >
            Filter <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      ) : (
        <div
          data-testid="alert-strip-positive"
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-dashed px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--success) 55%, var(--card-border))",
            backgroundColor: "color-mix(in srgb, var(--success) 7%, var(--card-bg))",
          }}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} aria-hidden />
          <span className="text-[13px]" style={{ color: "var(--page-text)" }}>
            Everyone trained this week
          </span>
        </div>
      )}

      {/* ── Four summary cards: 2×2 at 390, 4-across ≥1024 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Shell onClick={() => navigate("/clients")} label="Active clients" testId="card-active-clients">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" style={{ color: "var(--azfit-primary)" }} aria-hidden />
            <CardTitle>Active clients</CardTitle>
          </span>
          <Metric>{clients.length}</Metric>
          <SubLine tone={onTrack.onTrack < onTrack.total ? "default" : "success"}>
            {onTrack.onTrack} of {onTrack.total} on track
          </SubLine>
        </Shell>

        <Shell onClick={() => navigate("/schedule")} label="Sessions this week" testId="card-sessions-week">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" style={{ color: "var(--azfit-primary)" }} aria-hidden />
            <CardTitle>Sessions this week</CardTitle>
          </span>
          <Metric>{weekCount}</Metric>
          {remaining > 0 && <SubLine>{remaining} remaining today</SubLine>}
        </Shell>

        <Shell onClick={() => navigate("/schedule")} label="Average compliance" testId="card-compliance">
          <span className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" style={{ color: "var(--azfit-primary)" }} aria-hidden />
            <CardTitle>Avg compliance</CardTitle>
          </span>
          {thisCompliance.pct === null ? (
            <>
              <Metric>—</Metric>
              <SubLine>No sessions scheduled yet this week</SubLine>
            </>
          ) : (
            <>
              <Metric>{thisCompliance.pct}%</Metric>
              {delta !== null ? (
                <SubLine tone={delta >= 0 ? "success" : "warn"}>
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta)}% vs last week
                </SubLine>
              ) : (
                <SubLine>
                  {thisCompliance.completed} of {thisCompliance.scheduled} completed
                </SubLine>
              )}
            </>
          )}
        </Shell>

        <Shell onClick={() => navigate("/clients")} label="Needs attention" testId="card-needs-attention">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--warning)" }} aria-hidden />
            <CardTitle>Needs attention</CardTitle>
          </span>
          <Metric>{attention.count}</Metric>
          {attention.topNames.length > 0 ? (
            <SubLine tone="warn">
              {attention.topNames.join(", ")}
              {attention.count > 3 ? ` +${attention.count - 3} more` : ""}
            </SubLine>
          ) : (
            <SubLine tone="success">No one flagged right now</SubLine>
          )}
        </Shell>
      </div>
    </div>
  );
}
