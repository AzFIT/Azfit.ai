import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Ruler,
  Weight,
  Target,
  Dumbbell,
  Flame,
  Activity,
  Droplets,
} from "lucide-react";
import type { Client, ClientNutritionPlan } from "@/types/client";
import { Progress } from "@/components/ui/progress";

interface OverviewTabProps {
  client: Client;
  nutritionPlan: ClientNutritionPlan | null;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

export default function OverviewTab({
  client,
  nutritionPlan,
}: OverviewTabProps) {
  const bmi =
    client.height && client.weight
      ? +(client.weight / (client.height / 100) ** 2).toFixed(1)
      : 0;

  const weightChange = client.goalWeight
    ? +(client.weight - client.goalWeight).toFixed(1)
    : 0;

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <motion.div {...fadeUp} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Weight}
          label="Current Weight"
          value={`${client.weight} kg`}
          sub={client.goalWeight ? `Goal: ${client.goalWeight} kg` : undefined}
          color="#0D9488"
        />
        <StatCard
          icon={Activity}
          label="BMI"
          value={bmi > 0 ? `${bmi}` : "—"}
          sub={
            bmi > 0
              ? bmi < 18.5
                ? "Underweight"
                : bmi < 25
                  ? "Healthy"
                  : bmi < 30
                    ? "Overweight"
                    : "Obese"
              : undefined
          }
          color="#06B6D4"
        />
        <StatCard
          icon={Target}
          label="Body Fat"
          value={
            client.bodyFatPercentage ? `${client.bodyFatPercentage}%` : "—"
          }
          sub={
            client.bodyFatPercentage
              ? client.gender === "female"
                ? client.bodyFatPercentage < 25
                  ? "Athletic"
                  : "Average"
                : client.bodyFatPercentage < 15
                  ? "Athletic"
                  : "Average"
              : undefined
          }
          color="#8B5CF6"
        />
        <StatCard
          icon={Flame}
          label="Streak"
          value={`${client.streak || 0} days`}
          sub="Keep it up!"
          color="#F59E0B"
        />
      </motion.div>

      {/* Progress Section */}
      <motion.div
        {...fadeUp}
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
          Progress to Goal
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--light-text-secondary)" }}>
                Weight Goal
              </span>
              <span
                style={{
                  color: weightChange <= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {weightChange > 0
                  ? `+${weightChange} kg to lose`
                  : weightChange < 0
                    ? `${Math.abs(weightChange)} kg to gain`
                    : "At goal"}
              </span>
            </div>
            <Progress
              value={
                client.goalWeight
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        100 - (Math.abs(weightChange) / client.weight) * 100,
                      ),
                    )
                  : 0
              }
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--light-text-secondary)" }}>
                Overall Progress
              </span>
              <span style={{ color: "var(--azfit-primary)" }}>
                {client.progress || 0}%
              </span>
            </div>
            <Progress value={client.progress || 0} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--light-text-secondary)" }}>
                Compliance
              </span>
              <span style={{ color: "var(--success)" }}>
                {client.compliance || 0}%
              </span>
            </div>
            <Progress value={client.compliance || 0} className="h-2" />
          </div>
        </div>
      </motion.div>

      {/* Profile Info + Nutrition Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile Details */}
        <motion.div
          {...fadeUp}
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
            Profile Details
          </h3>
          <div className="space-y-2.5">
            <InfoRow icon={User} label="Name" value={client.name} />
            <InfoRow icon={Mail} label="Email" value={client.email} />
            {client.phone && (
              <InfoRow icon={Phone} label="Phone" value={client.phone} />
            )}
            <InfoRow
              icon={Calendar}
              label="Date of Birth"
              value={
                client.dateOfBirth
                  ? new Date(client.dateOfBirth).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <InfoRow
              icon={Ruler}
              label="Height"
              value={client.height ? `${client.height} cm` : "—"}
            />
            <InfoRow
              icon={Dumbbell}
              label="Experience"
              value={
                client.trainingExperience
                  ? client.trainingExperience.charAt(0).toUpperCase() +
                    client.trainingExperience.slice(1)
                  : "—"
              }
            />
            <InfoRow
              icon={Target}
              label="Primary Goal"
              value={
                client.primaryGoal
                  ? client.primaryGoal
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "—"
              }
            />
            <InfoRow
              icon={Activity}
              label="Training Frequency"
              value={
                client.trainingFrequency
                  ? `${client.trainingFrequency} days/week`
                  : "—"
              }
            />
          </div>
        </motion.div>

        {/* Nutrition Targets */}
        <motion.div
          {...fadeUp}
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
            Nutrition Targets
          </h3>
          {nutritionPlan ? (
            <div className="space-y-3">
              <MacroRow
                label="Calories"
                value={`${nutritionPlan.calorieGoal}`}
                color="#F59E0B"
                percent={100}
              />
              <MacroRow
                label="Protein"
                value={`${nutritionPlan.proteinGrams}g`}
                color="#0D9488"
                percent={Math.round(
                  ((nutritionPlan.proteinGrams * 4) /
                    nutritionPlan.calorieGoal) *
                    100,
                )}
              />
              <MacroRow
                label="Carbs"
                value={`${nutritionPlan.carbsGrams}g`}
                color="#06B6D4"
                percent={Math.round(
                  ((nutritionPlan.carbsGrams * 4) / nutritionPlan.calorieGoal) *
                    100,
                )}
              />
              <MacroRow
                label="Fats"
                value={`${nutritionPlan.fatsGrams}g`}
                color="#8B5CF6"
                percent={Math.round(
                  ((nutritionPlan.fatsGrams * 9) / nutritionPlan.calorieGoal) *
                    100,
                )}
              />
              <div
                className="pt-2 border-t"
                style={{ borderColor: "var(--card-border)" }}
              >
                <InfoRow
                  icon={Droplets}
                  label="Water Goal"
                  value={`${nutritionPlan.waterGoal} ml`}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
              No nutrition plan set.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color }} />
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--light-text-muted)" }}
        >
          {label}
        </span>
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div
          className="text-[10px]"
          style={{ color: "var(--light-text-muted)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: "var(--light-text-muted)" }} />
        <span
          className="text-xs"
          style={{ color: "var(--light-text-secondary)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-xs font-medium"
        style={{ color: "var(--page-text)" }}
      >
        {value}
      </span>
    </div>
  );
}

function MacroRow({
  label,
  value,
  color,
  percent,
}: {
  label: string;
  value: string;
  color: string;
  percent: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "var(--light-text-secondary)" }}>{label}</span>
        <span className="font-medium" style={{ color }}>
          {value}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
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
