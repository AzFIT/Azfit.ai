import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, MessageSquare, User } from "lucide-react";
import { GlassCard } from "./shared/GlassCard";

/* ── Types ─────────────────────────────────────────────── */

export type HealthStatus = "on_track" | "needs_attention" | "at_risk" | "deload";

export interface ClientHealthItem {
  id: string;
  name: string;
  initials: string;
  status: HealthStatus;
  missedSessions?: number;
  lastActiveDays?: number;
  hrvChange?: number;
  weightStalledWeeks?: number;
}

/* ── Constants ───────────────────────────────────────── */

const STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string; dot: string }> = {
  on_track: { label: "On Track", color: "#22C55E", bg: "rgba(34,197,94,0.12)", dot: "#22C55E" },
  needs_attention: { label: "Needs Attention", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", dot: "#F59E0B" },
  at_risk: { label: "At Risk", color: "#EF4444", bg: "rgba(239,68,68,0.12)", dot: "#EF4444" },
  deload: { label: "Deload", color: "#3B82F6", bg: "rgba(59,130,246,0.12)", dot: "#3B82F6" },
};

/* ── Component ───────────────────────────────────────── */

interface ClientHealthGridProps {
  clients: ClientHealthItem[];
  onClientClick?: (clientId: string) => void;
  onSendMessage?: (clientId: string) => void;
}

export function ClientHealthGrid({
  clients,
  onClientClick,
  onSendMessage,
}: ClientHealthGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <GlassCard
      title="Client Health Dashboard"
      titleIcon={<AlertTriangle className="h-4 w-4" />}
      glass
      hover
      accentColor="#8B5CF6"
      className="relative"
    >
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-[10px]">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
            <span style={{ color: "var(--light-text-muted)" }}>{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10">
        {clients.map((client) => {
          const cfg = STATUS_CONFIG[client.status];
          const isHovered = hoveredId === client.id;

          return (
            <div
              key={client.id}
              className="relative"
              onMouseEnter={() => setHoveredId(client.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onClientClick?.(client.id)}
                className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all"
                style={{
                  borderColor: isHovered ? cfg.color : "transparent",
                  backgroundColor: cfg.bg,
                }}
              >
                {/* Avatar */}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: cfg.color }}
                >
                  {client.initials}
                </div>
                {/* Status dot */}
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: cfg.dot }}
                />
                {/* Alert indicator */}
                {client.status !== "on_track" && (
                  <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                    {client.status === "at_risk" && client.missedSessions
                      ? `${client.missedSessions} missed`
                      : client.status === "needs_attention" && client.weightStalledWeeks
                        ? "?"
                        : "!"}
                  </span>
                )}
              </button>

              {/* Hover Tooltip */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border p-3 shadow-xl"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {client.name}
                    </p>
                    <p className="text-[10px] font-medium uppercase" style={{ color: cfg.color }}>
                      {cfg.label}
                    </p>
                    <div className="mt-2 space-y-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {client.lastActiveDays !== undefined && (
                        <p>Last active: {client.lastActiveDays}d ago</p>
                      )}
                      {client.missedSessions !== undefined && client.missedSessions > 0 && (
                        <p>Missed: {client.missedSessions} sessions</p>
                      )}
                      {client.hrvChange !== undefined && (
                        <p>HRV: {client.hrvChange > 0 ? "+" : ""}{client.hrvChange}%</p>
                      )}
                      {client.weightStalledWeeks !== undefined && client.weightStalledWeeks > 0 && (
                        <p>Weight stalled: {client.weightStalledWeeks} wks</p>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendMessage?.(client.id);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-medium text-white"
                        style={{ backgroundColor: "#00AEEF" }}
                      >
                        <MessageSquare className="h-3 w-3" /> Message
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClientClick?.(client.id);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1 text-[10px] font-medium"
                        style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
                      >
                        <User className="h-3 w-3" /> Profile
                      </button>
                    </div>
                    {/* Arrow */}
                    <div
                      className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b"
                      style={{
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--card-border)",
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export default ClientHealthGrid;
