/* ═══════════════════════════════════════════════════════════════
   Shared weight-trend chart (Phase 55 extraction from Analytics).
   Verbatim AreaChart + tooltip from the Analytics "Weight Trend"
   card — Analytics and the client dashboard both render this.
   ═══════════════════════════════════════════════════════════════ */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDayMonth } from "@/lib/utils";
import type { WeightPoint } from "@/lib/weightTrend";

function tooltipStyle() {
  return {
    backgroundColor: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    color: "var(--page-text)",
    fontSize: "12px",
    padding: "8px 12px",
  };
}

function WeightTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const w = payload.find((p) => p.dataKey === "weight");
  const ma = payload.find((p) => p.dataKey === "movingAvg");
  const dateLabel = label
    ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  return (
    <div style={tooltipStyle()}>
      <p className="text-[11px] font-medium" style={{ color: "var(--light-text-muted)" }}>{dateLabel}</p>
      {w && (
        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--azfit-primary)" }}>
          {w.value} kg
        </p>
      )}
      {ma && (
        <p className="text-xs" style={{ color: "var(--azfit-secondary)" }}>
          {ma.value} kg avg
        </p>
      )}
    </div>
  );
}

export default function WeightTrendChart({ data, height = 300 }: { data: WeightPoint[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--azfit-primary)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--azfit-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border)" opacity={0.4} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            tick={{ fill: "var(--light-text-muted)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={{ stroke: "var(--light-border)" }}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fill: "var(--light-text-muted)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<WeightTooltip />} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="var(--azfit-primary)"
            strokeWidth={2.5}
            fill="url(#weightGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--azfit-primary)", strokeWidth: 0 }}
            animationDuration={1200}
          />
          <Area
            type="monotone"
            dataKey="movingAvg"
            stroke="var(--azfit-secondary)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            fill="none"
            dot={false}
            animationDuration={1200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
