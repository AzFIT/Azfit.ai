import { useEffect, useState } from "react";
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
  Utensils,
  Plus,
} from "lucide-react";
import type { Client } from "@/types/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getDayTotals, type MacroTotals } from "@/lib/foodApi";
import { useBodyComposition } from "@/components/bodycomp/useBodyComposition";
import { AssessmentWizard } from "@/components/bodycomp/AssessmentWizard";

interface OverviewTabProps {
  client: Client;
  clientId: string;
  onNavigate: (tab: "bio" | "nutrition", hint?: "weight" | "bodyFat") => void;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

export default function OverviewTab({
  client,
  clientId,
  onNavigate,
}: OverviewTabProps) {
  const [showWizard, setShowWizard] = useState(false);
  const {
    loading,
    latestBodyComposition,
    latestAssessment,
    assessments,
  } = useBodyComposition(clientId, { skipLegacyMigration: true });

  // Live values: prefer the newest body-composition data over the static
  // clients-row snapshot so quick-add entries show up on the tiles.
  const currentWeight =
    latestBodyComposition?.weight_kg ?? latestAssessment?.weight_kg ?? client.weight;
  const currentBodyFat =
    latestAssessment?.body_fat_pct ??
    latestBodyComposition?.body_fat_percentage ??
    client.bodyFatPercentage ??
    null;

  const bmi =
    client.height && currentWeight
      ? +(currentWeight / (client.height / 100) ** 2).toFixed(1)
      : 0;

  const weightChange = client.goalWeight
    ? +(currentWeight - client.goalWeight).toFixed(1)
    : 0;

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <motion.div {...fadeUp} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Weight}
          label="Current Weight"
          value={`${currentWeight} kg`}
          sub={client.goalWeight ? `Goal: ${client.goalWeight} kg` : undefined}
          color="#0D9488"
          onClick={() => onNavigate("bio", "weight")}
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
          onClick={() => onNavigate("bio")}
        />
        <StatCard
          icon={Target}
          label="Body Fat"
          value={currentBodyFat != null ? `${currentBodyFat}%` : "—"}
          sub={
            currentBodyFat != null
              ? client.gender === "female"
                ? currentBodyFat < 25
                  ? "Athletic"
                  : "Average"
                : currentBodyFat < 15
                  ? "Athletic"
                  : "Average"
              : undefined
          }
          color="#8B5CF6"
          onClick={() => onNavigate("bio", "bodyFat")}
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
                        100 - (Math.abs(weightChange) / currentWeight) * 100,
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
        <NutritionCard clientEmail={client.email} onClick={() => onNavigate("nutrition")} />
      </div>

      {/* Body Composition */}
      <BodyCompositionCard
        loading={loading}
        latestBodyComposition={latestBodyComposition}
        latestAssessment={latestAssessment}
        assessments={assessments}
        onNewAssessment={() => setShowWizard(true)}
      />

      <AssessmentWizard
        clientId={clientId}
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSaved={() => setShowWizard(false)}
      />
    </div>
  );
}

function NutritionCard({ clientEmail, onClick }: { clientEmail: string; onClick?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [targets, setTargets] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null>(null);
  const [totals, setTotals] = useState<MacroTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // nutrition_targets keys on profiles.id — resolve via the client's email
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", clientEmail)
        .maybeSingle();
      if (cancelled) return;
      if (!prof) {
        setNoProfile(true);
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const [{ data: t }, dayTotals] = await Promise.all([
        supabase
          .from("nutrition_targets")
          .select("*")
          .eq("user_id", prof.id)
          .maybeSingle(),
        getDayTotals(today, prof.id),
      ]);
      if (cancelled) return;
      setTargets(
        t
          ? {
              calories: t.calories ?? 0,
              protein: t.protein_g ?? 0,
              carbs: t.carbs_g ?? 0,
              fats: t.fats_g ?? 0,
            }
          : null,
      );
      setTotals(dayTotals);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientEmail]);

  return (
    <motion.div
      {...fadeUp}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`rounded-2xl border p-4 transition-all ${onClick ? "cursor-pointer hover:border-[var(--azfit-primary)]/60 hover:shadow-md" : ""}`}
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Utensils size={14} style={{ color: "var(--azfit-primary)" }} />
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--page-text)" }}
        >
          Nutrition Targets
        </h3>
        {!loading && targets && (
          <span
            className="text-[10px]"
            style={{ color: "var(--light-text-muted)" }}
          >
            today / target
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-800" />
      ) : noProfile ? (
        <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
          No linked app account for this client yet
        </p>
      ) : targets ? (
        <div className="space-y-3">
          <MacroRow
            label="Calories"
            value={`${totals.calories} / ${targets.calories}`}
            color="#F59E0B"
            percent={
              targets.calories > 0
                ? Math.min(100, Math.round((totals.calories / targets.calories) * 100))
                : 0
            }
          />
          <MacroRow
            label="Protein"
            value={`${totals.protein} / ${targets.protein}g`}
            color="#0D9488"
            percent={
              targets.protein > 0
                ? Math.min(100, Math.round((totals.protein / targets.protein) * 100))
                : 0
            }
          />
          <MacroRow
            label="Carbs"
            value={`${totals.carbs} / ${targets.carbs}g`}
            color="#06B6D4"
            percent={
              targets.carbs > 0
                ? Math.min(100, Math.round((totals.carbs / targets.carbs) * 100))
                : 0
            }
          />
          <MacroRow
            label="Fats"
            value={`${totals.fats} / ${targets.fats}g`}
            color="#8B5CF6"
            percent={
              targets.fats > 0
                ? Math.min(100, Math.round((totals.fats / targets.fats) * 100))
                : 0
            }
          />
          {totals.calories === 0 &&
            totals.protein === 0 &&
            totals.carbs === 0 &&
            totals.fats === 0 && (
              <p
                className="text-[10px] text-center"
                style={{ color: "var(--light-text-muted)" }}
              >
                Nothing logged today
              </p>
            )}
        </div>
      ) : (
        <div>
          <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
            No nutrition targets set
          </p>
          <p
            className="text-[10px] mt-1"
            style={{ color: "var(--light-text-muted)" }}
          >
            Set them in the Nutrition tab.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function BodyCompositionCard({
  loading,
  latestBodyComposition,
  latestAssessment,
  assessments,
  onNewAssessment,
}: {
  loading: boolean;
  latestBodyComposition: import("@/components/bodycomp/useBodyComposition").BodyCompositionRow | null;
  latestAssessment: import("@/components/bodycomp/useBodyComposition").SkinfoldAssessmentRow | null;
  assessments: import("@/components/bodycomp/useBodyComposition").SkinfoldAssessmentRow[];
  onNewAssessment: () => void;
}) {
  const latestWeight = latestBodyComposition?.weight_kg ?? latestAssessment?.weight_kg ?? null;
  const latestBF = latestAssessment?.body_fat_pct ?? latestBodyComposition?.body_fat_percentage ?? null;
  const latestSum = latestAssessment?.sum_mm ?? null;
  const recentAssessments = assessments.slice(0, 5);

  return (
    <motion.div
      {...fadeUp}
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
          Body Composition
        </h3>
        <Button
          onClick={onNewAssessment}
          size="sm"
          className="gap-1"
          style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
        >
          <Plus className="h-3.5 w-3.5" /> New Assessment
        </Button>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-800" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>Weight</p>
              <p className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
                {latestWeight != null ? `${latestWeight.toFixed(1)} kg` : "—"}
              </p>
            </div>
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>Body Fat</p>
              <p className="text-lg font-bold" style={{ color: "#8B5CF6" }}>
                {latestBF != null ? `${latestBF.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>Skinfold Sum</p>
              <p className="text-lg font-bold" style={{ color: "#00AEEF" }}>
                {latestSum != null ? `${latestSum.toFixed(1)} mm` : "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--light-text-secondary)" }}>
              Recent Assessments
            </p>
            {recentAssessments.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
                No assessments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {recentAssessments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border p-2"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6" }}
                      >
                        {a.protocol.toUpperCase()}
                      </span>
                      <span className="text-xs" style={{ color: "var(--page-text)" }}>
                        {new Date(a.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--light-text-muted)" }}>
                      {a.sum_mm?.toFixed(1)} mm
                      {a.body_fat_pct != null ? ` • ${a.body_fat_pct.toFixed(1)}%` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`rounded-2xl border p-3 transition-all ${onClick ? "cursor-pointer hover:border-[var(--azfit-primary)]/60 hover:shadow-md" : ""}`}
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
