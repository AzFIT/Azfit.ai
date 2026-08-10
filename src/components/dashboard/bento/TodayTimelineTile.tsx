/* ═══════════════════════════════════════════════════════════════
   Today Timeline tile (Phase 59, Item 1) — today's sessions as a
   vertical timeline with honest status chips; holidays/reminders/
   returning clients keep their compact rows below. Empty day →
   the Phase 58 supportive framing.
   ═══════════════════════════════════════════════════════════════ */

import { Calendar, ChevronRight, Sun, Bell, PartyPopper } from "lucide-react";
import { GlassCard } from "../shared/GlassCard";
import { timelineChip, type TimelineChip } from "@/lib/dashboardBento";

export interface TimelineSession {
  id: string;
  title: string;
  clientName?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
}

export interface TimelineExtra {
  kind: "holiday" | "reminder" | "returning";
  id: string;
  title: string;
  clientName: string;
  clientId: string | null;
  timeLabel: string;
}

const CHIP_STYLE: Record<TimelineChip, { color: string; bg: string }> = {
  Confirmed: { color: "var(--success)", bg: "var(--success-bg)" },
  Pending: { color: "var(--warning)", bg: "var(--light-elevated)" },
  "Check-in due": { color: "var(--danger)", bg: "var(--danger-bg)" },
};

export default function TodayTimelineTile({
  sessions,
  extras,
  loading,
  checkinDueNames,
  onOpenSchedule,
  onClientClick,
}: {
  sessions: TimelineSession[];
  extras: TimelineExtra[];
  loading: boolean;
  checkinDueNames: Set<string>;
  onOpenSchedule: () => void;
  onClientClick?: (clientId: string) => void;
}) {
  return (
    <GlassCard
      title="Today"
      titleIcon={<Calendar className="h-4 w-4" />}
      glass
      hover
      accentColor="var(--azfit-primary)"
      headerAction={
        <span className="flex items-center gap-2">
          {sessions.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: "var(--azfit-primary)" }}
            >
              {sessions.length}
            </span>
          )}
          <button
            onClick={onOpenSchedule}
            className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--azfit-primary)" }}
          >
            View all
            <ChevronRight className="h-3 w-3" />
          </button>
        </span>
      }
    >
      {loading && sessions.length === 0 ? (
        <div className="space-y-2 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl" style={{ backgroundColor: "var(--light-elevated)" }} />
          ))}
        </div>
      ) : sessions.length === 0 && extras.length === 0 ? (
        <div className="flex flex-col items-center py-5 text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Nothing scheduled today
          </p>
          <p className="mt-1 max-w-xs text-xs" style={{ color: "var(--light-text-muted)" }}>
            A clear day — book sessions from the calendar, or enjoy the breathing room.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 py-1">
          {sessions.map((s) => {
            const start = new Date(s.startsAt);
            const end = new Date(s.endsAt);
            const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
            const chip = timelineChip(s.status, s.clientName != null && checkinDueNames.has(s.clientName));
            const cs = CHIP_STYLE[chip];
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={{ backgroundColor: "var(--light-elevated)", borderColor: "var(--card-border)" }}
              >
                <span
                  className="w-12 shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: "var(--page-text)" }}
                >
                  {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                    {s.clientName || "Unknown"}
                  </p>
                  <p className="truncate text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {s.title} · {durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60 ? `${durationMin % 60}m` : ""}`.trim() : `${durationMin}m`}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ color: cs.color, backgroundColor: cs.bg }}
                >
                  {chip}
                </span>
              </div>
            );
          })}
          {extras.map((x) => {
            const cfg =
              x.kind === "holiday"
                ? { Icon: Sun, color: "var(--warning)" }
                : x.kind === "reminder"
                  ? { Icon: Bell, color: "var(--azfit-primary)" }
                  : { Icon: PartyPopper, color: "var(--success)" };
            return (
              <div
                key={`${x.kind}-${x.id}`}
                className="flex items-center gap-3 rounded-xl border px-3 py-2"
                style={{ borderColor: "var(--card-border)", borderLeft: `3px solid ${cfg.color}` }}
              >
                <cfg.Icon size={13} style={{ color: cfg.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                    {x.title}
                  </p>
                  <p className="truncate text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {x.clientName} · {x.timeLabel}
                  </p>
                </div>
                {x.clientId && onClientClick && (
                  <button
                    onClick={() => onClientClick(x.clientId!)}
                    className="rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: cfg.color, backgroundColor: "var(--light-elevated)" }}
                  >
                    View
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
