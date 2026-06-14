import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Droplets, Beef, Wheat, Droplet, Utensils } from "lucide-react";
import type { ClientNutritionPlan, ClientNutritionLog } from "@/types/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface NutritionTabProps {
  nutritionPlan: ClientNutritionPlan | null;
  nutritionLogs: ClientNutritionLog[];
}

export default function NutritionTab({
  nutritionPlan,
  nutritionLogs,
}: NutritionTabProps) {
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  if (!nutritionPlan) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-12"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <Utensils size={32} style={{ color: "var(--light-text-muted)" }} />
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--light-text-muted)" }}
        >
          No nutrition plan set
        </p>
      </div>
    );
  }

  const todayLog = nutritionLogs.find((l) => l.date === selectedDate);

  const macroData = [
    { name: "Protein", value: nutritionPlan.proteinGrams, color: "#0D9488" },
    { name: "Carbs", value: nutritionPlan.carbsGrams, color: "#06B6D4" },
    { name: "Fats", value: nutritionPlan.fatsGrams, color: "#8B5CF6" },
  ];

  const proteinPercent = Math.round(
    ((nutritionPlan.proteinGrams * 4) / nutritionPlan.calorieGoal) * 100,
  );
  const carbsPercent = Math.round(
    ((nutritionPlan.carbsGrams * 4) / nutritionPlan.calorieGoal) * 100,
  );
  const fatsPercent = Math.round(
    ((nutritionPlan.fatsGrams * 9) / nutritionPlan.calorieGoal) * 100,
  );

  return (
    <div className="space-y-4">
      {/* Calorie & Water Summary */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame size={16} style={{ color: "#F59E0B" }} />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--light-text-muted)" }}
            >
              Daily Calories
            </span>
          </div>
          <div className="text-2xl font-bold" style={{ color: "#F59E0B" }}>
            {nutritionPlan.calorieGoal}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "var(--light-text-muted)" }}
          >
            kcal / day
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Droplets size={16} style={{ color: "#06B6D4" }} />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--light-text-muted)" }}
            >
              Water Goal
            </span>
          </div>
          <div className="text-2xl font-bold" style={{ color: "#06B6D4" }}>
            {nutritionPlan.waterGoal}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "var(--light-text-muted)" }}
          >
            ml / day
          </div>
        </motion.div>
      </div>

      {/* Macro Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-2"
            style={{ color: "var(--page-text)" }}
          >
            Macro Distribution
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}g`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {macroData.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span
                  className="text-[10px]"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {m.name}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Macro Details */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border p-4 space-y-3"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--page-text)" }}
          >
            Macro Targets
          </h3>

          <MacroDetailRow
            icon={Beef}
            label="Protein"
            value={nutritionPlan.proteinGrams}
            unit="g"
            percent={proteinPercent}
            color="#0D9488"
          />
          <MacroDetailRow
            icon={Wheat}
            label="Carbohydrates"
            value={nutritionPlan.carbsGrams}
            unit="g"
            percent={carbsPercent}
            color="#06B6D4"
          />
          <MacroDetailRow
            icon={Droplet}
            label="Fats"
            value={nutritionPlan.fatsGrams}
            unit="g"
            percent={fatsPercent}
            color="#8B5CF6"
          />
        </motion.div>
      </div>

      {/* Daily Log */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--page-text)" }}
          >
            Today's Intake
          </h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs rounded-lg border px-2 py-1"
            style={{
              backgroundColor: "var(--light-elevated)",
              borderColor: "var(--card-border)",
              color: "var(--page-text)",
            }}
          />
        </div>

        {todayLog ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: "var(--light-elevated)" }}
              >
                <div
                  className="text-[10px]"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Calories
                </div>
                <div className="text-lg font-bold" style={{ color: "#F59E0B" }}>
                  {todayLog.caloriesConsumed} / {nutritionPlan.calorieGoal}
                </div>
                <div
                  className="w-full h-1.5 rounded-full mt-1 overflow-hidden"
                  style={{ backgroundColor: "rgba(245,158,11,0.2)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (todayLog.caloriesConsumed / nutritionPlan.calorieGoal) * 100)}%`,
                      backgroundColor: "#F59E0B",
                    }}
                  />
                </div>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: "var(--light-elevated)" }}
              >
                <div
                  className="text-[10px]"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Water
                </div>
                <div className="text-lg font-bold" style={{ color: "#06B6D4" }}>
                  {todayLog.waterConsumed} / {nutritionPlan.waterGoal}
                </div>
                <div
                  className="w-full h-1.5 rounded-full mt-1 overflow-hidden"
                  style={{ backgroundColor: "rgba(6,182,212,0.2)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (todayLog.waterConsumed / nutritionPlan.waterGoal) * 100)}%`,
                      backgroundColor: "#06B6D4",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MiniMacro
                label="Protein"
                consumed={todayLog.proteinConsumed}
                target={nutritionPlan.proteinGrams}
                color="#0D9488"
              />
              <MiniMacro
                label="Carbs"
                consumed={todayLog.carbsConsumed}
                target={nutritionPlan.carbsGrams}
                color="#06B6D4"
              />
              <MiniMacro
                label="Fats"
                consumed={todayLog.fatsConsumed}
                target={nutritionPlan.fatsGrams}
                color="#8B5CF6"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
            No log for{" "}
            {new Date(selectedDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
            .
          </p>
        )}
      </motion.div>
    </div>
  );
}

function MacroDetailRow({
  icon: Icon,
  label,
  value,
  unit,
  percent,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }} />
          <span
            className="text-xs"
            style={{ color: "var(--light-text-secondary)" }}
          >
            {label}
          </span>
        </div>
        <span className="text-xs font-medium" style={{ color }}>
          {value}
          {unit} ({percent}%)
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: `${color}20` }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MiniMacro({
  label,
  consumed,
  target,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
}) {
  const pct = Math.min(100, Math.round((consumed / target) * 100));
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{ backgroundColor: "var(--light-elevated)" }}
    >
      <div className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
        {label}
      </div>
      <div className="text-sm font-bold" style={{ color }}>
        {consumed}g
      </div>
      <div className="text-[9px]" style={{ color: "var(--light-text-muted)" }}>
        {pct}%
      </div>
    </div>
  );
}
