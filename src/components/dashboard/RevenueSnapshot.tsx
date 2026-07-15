import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import { GlassCard } from "./shared/GlassCard";

/* ── Types ─────────────────────────────────────────────── */

export interface RevenueSnapshotData {
  thisMonth: number;
  lastMonth: number;
  currency: string;
  activeClients: number;
  clientLimit: number;
  avgPerClient: number;
}

/* ── Component ───────────────────────────────────────── */

interface RevenueSnapshotProps {
  data: RevenueSnapshotData;
  onViewDetails?: () => void;
}

export function RevenueSnapshot({ data, onViewDetails }: RevenueSnapshotProps) {
  const change = data.thisMonth - data.lastMonth;
  const changePercent = data.lastMonth > 0 ? (change / data.lastMonth) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <GlassCard
      title="Revenue Snapshot"
      titleIcon={<DollarSign className="h-4 w-4" />}
      glass
      hover
      accentColor="#22C55E"
      headerAction={
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1 text-[10px] font-medium"
          style={{ color: "#22C55E" }}
        >
          View Details <ChevronRight className="h-3 w-3" />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Main revenue figure */}
        <div>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
            This Month
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: "var(--page-text)" }}>
              {data.currency}{data.thisMonth.toLocaleString()}
            </span>
            <span
              className="flex items-center gap-0.5 text-xs font-medium"
              style={{ color: isPositive ? "#22C55E" : "#EF4444" }}
            >
              {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(changePercent).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            vs {data.currency}{data.lastMonth.toLocaleString()} last month
          </p>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "var(--card-border)" }} />

        {/* Sub-metrics */}
        <div className="grid grid-cols-2 gap-3">
          {/* Active clients */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              <Users className="h-4 w-4" style={{ color: "#22C55E" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--page-text)" }}>
                {data.activeClients}
                <span className="text-[10px] font-normal" style={{ color: "var(--light-text-muted)" }}>
                  {" "}/ {data.clientLimit}
                </span>
              </p>
              <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Active Clients
              </p>
            </div>
          </div>

          {/* Avg per client */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(139,92,246,0.12)" }}
            >
              <TrendingUp className="h-4 w-4" style={{ color: "#8B5CF6" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--page-text)" }}>
                {data.currency}{data.avgPerClient.toLocaleString()}
              </p>
              <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Avg / Client / Mo
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar for client limit */}
        <div>
          <div className="mb-1 flex justify-between text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            <span>Client capacity</span>
            <span>{Math.round((data.activeClients / data.clientLimit) * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--card-border)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(data.activeClients / data.clientLimit) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  data.activeClients / data.clientLimit > 0.9
                    ? "#F59E0B"
                    : data.activeClients / data.clientLimit > 0.75
                      ? "#22C55E"
                      : "#00AEEF",
              }}
            />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default RevenueSnapshot;
