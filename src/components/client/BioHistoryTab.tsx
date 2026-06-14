import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Weight,
  Ruler,
  Percent,
  Calendar,
} from "lucide-react";
import type { ClientBioEntry } from "@/types/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BioHistoryTabProps {
  entries: ClientBioEntry[];
}

export default function BioHistoryTab({ entries }: BioHistoryTabProps) {
  const [activeMetric, setActiveMetric] = useState<
    "weight" | "bodyFat" | "bmi" | "waist"
  >("weight");

  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-12"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <Activity size={32} style={{ color: "var(--light-text-muted)" }} />
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--light-text-muted)" }}
        >
          No bio history recorded
        </p>
      </div>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const chartData = sorted.map((e) => ({
    date: new Date(e.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    weight: e.weight,
    bodyFat: e.bodyFatPercentage,
    bmi: e.bmi,
    waist: e.waistCm,
  }));

  const metricConfig = {
    weight: { label: "Weight", unit: "kg", color: "#0D9488", icon: Weight },
    bodyFat: { label: "Body Fat", unit: "%", color: "#8B5CF6", icon: Percent },
    bmi: { label: "BMI", unit: "", color: "#06B6D4", icon: Activity },
    waist: { label: "Waist", unit: "cm", color: "#F59E0B", icon: Ruler },
  };

  const change =
    previous && latest
      ? +(
          latest[
            activeMetric === "bodyFat"
              ? "bodyFatPercentage"
              : activeMetric === "waist"
                ? "waistCm"
                : activeMetric
          ]! -
          previous[
            activeMetric === "bodyFat"
              ? "bodyFatPercentage"
              : activeMetric === "waist"
                ? "waistCm"
                : activeMetric
          ]!
        ).toFixed(1)
      : 0;

  return (
    <div className="space-y-4">
      {/* Metric Selector */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map(
          (key) => {
            const cfg = metricConfig[key];
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className="flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all"
                style={{
                  backgroundColor:
                    activeMetric === key ? `${cfg.color}15` : "var(--card-bg)",
                  borderColor:
                    activeMetric === key ? cfg.color : "var(--card-border)",
                }}
              >
                <Icon size={16} style={{ color: cfg.color }} />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color:
                      activeMetric === key
                        ? cfg.color
                        : "var(--light-text-muted)",
                  }}
                >
                  {cfg.label}
                </span>
              </button>
            );
          },
        )}
      </div>

      {/* Latest Value */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
              Latest {metricConfig[activeMetric].label}
            </p>
            <p
              className="text-2xl font-bold"
              style={{ color: metricConfig[activeMetric].color }}
            >
              {
                latest[
                  activeMetric === "bodyFat"
                    ? "bodyFatPercentage"
                    : activeMetric === "waist"
                      ? "waistCm"
                      : activeMetric
                ]
              }
              <span
                className="text-sm font-normal ml-1"
                style={{ color: "var(--light-text-muted)" }}
              >
                {metricConfig[activeMetric].unit}
              </span>
            </p>
          </div>
          {change !== 0 && (
            <div
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: change < 0 ? "var(--success)" : "var(--danger)" }}
            >
              {change < 0 ? (
                <TrendingDown size={14} />
              ) : (
                <TrendingUp size={14} />
              )}
              {change > 0 ? "+" : ""}
              {change} {metricConfig[activeMetric].unit}
            </div>
          )}
        </div>
      </motion.div>

      {/* Chart */}
      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--page-text)" }}
        >
          {metricConfig[activeMetric].label} History
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--card-border)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--light-text-muted)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--light-text-muted)" }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "var(--page-text)" }}
              />
              <Line
                type="monotone"
                dataKey={
                  activeMetric === "bodyFat"
                    ? "bodyFat"
                    : activeMetric === "waist"
                      ? "waist"
                      : activeMetric
                }
                stroke={metricConfig[activeMetric].color}
                strokeWidth={2}
                dot={{ fill: metricConfig[activeMetric].color, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "var(--light-elevated)" }}>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Date
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Weight
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Body Fat
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  BMI
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Waist
                </th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <td
                    className="px-3 py-2"
                    style={{ color: "var(--page-text)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar
                        size={10}
                        style={{ color: "var(--light-text-muted)" }}
                      />
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: "#0D9488" }}
                  >
                    {entry.weight} kg
                  </td>
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: "#8B5CF6" }}
                  >
                    {entry.bodyFatPercentage}%
                  </td>
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: "#06B6D4" }}
                  >
                    {entry.bmi}
                  </td>
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: "#F59E0B" }}
                  >
                    {entry.waistCm} cm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
