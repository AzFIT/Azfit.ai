import { motion } from "framer-motion";
import {
  AlertTriangle,
  TrendingDown,
  Activity,
  Send,
  Eye,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "./shared/GlassCard";

/* ── Types ─────────────────────────────────────────────── */

export type InsightSeverity = "warning" | "danger" | "info";

export interface AIInsight {
  id: string;
  severity: InsightSeverity;
  clientName: string;
  clientId: string;
  title: string;
  description: string;
  suggestedAction: string;
  timestamp: string;
}

/* ── Constants ───────────────────────────────────────── */

const SEVERITY_CONFIG: Record<InsightSeverity, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  warning: { icon: TrendingDown, color: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 12%, transparent)", label: "Warning" },
  danger: { icon: AlertTriangle, color: "var(--danger)", bg: "color-mix(in srgb, var(--danger) 12%, transparent)", label: "At Risk" },
  info: { icon: Activity, color: "var(--info)", bg: "color-mix(in srgb, var(--info) 12%, transparent)", label: "Insight" },
};

/* ── Component ───────────────────────────────────────── */

interface AIInsightsPanelProps {
  insights: AIInsight[];
  onViewAll?: () => void;
  onActionClick?: (insightId: string, action: string) => void;
}

export function AIInsightsPanel({
  insights,
  onViewAll,
  onActionClick,
}: AIInsightsPanelProps) {
  return (
    <GlassCard
      title="AI Insights"
      titleIcon={<Activity className="h-4 w-4" />}
      glass
      hover
      accentColor="var(--azfit-primary)"
      headerAction={
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-[10px] font-medium"
          style={{ color: "var(--azfit-primary)" }}
        >
          View All <ChevronRight className="h-3 w-3" />
        </button>
      }
    >
      <div className="space-y-3">
        {insights.length === 0 && (
          <div className="py-4 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
            No alerts — all clients are on track!
          </div>
        )}

        {insights.map((insight, i) => {
          const cfg = SEVERITY_CONFIG[insight.severity];
          const Icon = cfg.icon;

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--card-border)", backgroundColor: cfg.bg }}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: cfg.color }}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                      {insight.clientName}
                    </span>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                    {insight.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--light-text-muted)" }}>
                    {insight.description}
                  </p>

                  {/* Action buttons */}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onActionClick?.(insight.id, insight.suggestedAction)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-white"
                      style={{ backgroundColor: "var(--azfit-primary)" }}
                    >
                      <Send className="h-3 w-3" />
                      {insight.suggestedAction}
                    </button>
                    <button
                      onClick={() => onActionClick?.(insight.id, "view")}
                      className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-medium"
                      style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export default AIInsightsPanel;
