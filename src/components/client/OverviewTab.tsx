import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
  Pencil,
  Check,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  LayoutGrid,
} from "lucide-react";
import type { Client } from "@/types/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getDayTotals, type MacroTotals } from "@/lib/foodApi";
import { formatDate, formatDateKeyLocal } from "@/lib/utils";
import {
  parseLifestyleTargets,
  lifestyleChips,
  hasLifestyleTargets,
  type LifestyleTargets,
} from "@/lib/lifestyleTargets";
import {
  goalLabel,
  nearestToDate,
  progressPercent,
  type ClientGoalRow,
} from "@/lib/clientGoals";
import ClientGoalsDialog from "@/components/client/ClientGoalsDialog";
import SessionPackageCard from "@/components/client/SessionPackageCard";
import ConsistencyCalendar from "@/components/dashboard/ConsistencyCalendar";
import { useBodyComposition } from "@/components/bodycomp/useBodyComposition";
import { AssessmentWizard } from "@/components/bodycomp/AssessmentWizard";
// Phase 91: per-coach section hide/reorder (same JSONB as dashboard cards).
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import { useViewAs } from "@/hooks/useViewAs";
import { useAuth } from "@/hooks/useAuth";
import { moveId, toggleHiddenId, visibleOrder, type DashboardPreferences } from "@/lib/dashboardPrefs";
import { PROFILE_SECTIONS, PROFILE_SECTION_IDS, registryLabel } from "@/lib/dashboardRegistry";

interface OverviewTabProps {
  client: Client;
  clientId: string;
  onNavigate: (tab: "bio" | "nutrition", hint?: "weight" | "bodyFat") => void;
  onEditClient?: () => void;
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
  onEditClient,
}: OverviewTabProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [goals, setGoals] = useState<ClientGoalRow[]>([]);
  const [goalsOpen, setGoalsOpen] = useState(false);
  // Phase 55: client's self-set lifestyle targets (read-only for trainers)
  const [lifestyle, setLifestyle] = useState<LifestyleTargets>({});
  const {
    loading,
    latestBodyComposition,
    latestAssessment,
    assessments,
    bodyComposition,
  } = useBodyComposition(clientId, { skipLegacyMigration: true });

  const fetchGoals = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_goals")
      .select("*")
      .eq("client_id", clientId)
      .order("is_achieved", { ascending: true })
      .order("created_at", { ascending: false });
    if (!error && data) setGoals(data as ClientGoalRow[]);
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchGoals();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchGoals]);

  // Phase 55: lifestyle targets are client-owned; the trainer reads them here
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("lifestyle_targets")
        .eq("id", clientId)
        .maybeSingle();
      if (!cancelled) setLifestyle(parseLifestyleTargets(data?.lifestyle_targets));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

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

  // ── Phase 91: per-coach section hide/reorder ─────────────────────
  // One preference set per COACH (their view of ANY client), stored in the
  // same profiles.dashboard_preferences JSONB as the dashboard cards.
  // Hidden while View-As-Client is active (prefs belong to the coach).
  const { user } = useAuth();
  const viewAs = useViewAs();
  const { prefs: savedPrefs, save: savePrefs } = useDashboardPrefs(user?.id);
  const [sectionsDraft, setSectionsDraft] = useState<DashboardPreferences | null>(null);
  const [editingSections, setEditingSections] = useState(false);
  const effPrefs = sectionsDraft ?? savedPrefs;
  const canCustomize = viewAs.viewAs === null;
  const sectionsCustomized =
    effPrefs.profileSections.hidden.length > 0 ||
    effPrefs.profileSections.order.join(" ") !== PROFILE_SECTION_IDS.join(" ");
  const orderedVisibleSections = visibleOrder(effPrefs.profileSections);

  const startEditing = () => {
    setSectionsDraft(savedPrefs);
    setEditingSections(true);
  };
  const stopEditing = () => {
    setSectionsDraft(null);
    setEditingSections(false);
  };
  const saveEditing = async () => {
    if (!sectionsDraft) return stopEditing();
    const ok = await savePrefs(sectionsDraft);
    if (!ok) {
      toast.error("Could not save layout — keeping your previous settings");
      onPreviewRestore();
      return;
    }
    toast.success("Profile layout saved");
    stopEditing();
  };
  // Cancel restores the last saved layout behind the page.
  const onPreviewRestore = () => setSectionsDraft(savedPrefs);

  const moveSection = (id: string, delta: -1 | 1) =>
    sectionsDraft &&
    setSectionsDraft({
      ...sectionsDraft,
      profileSections: moveId(sectionsDraft.profileSections, id, delta),
    });
  const toggleSection = (id: string) =>
    sectionsDraft &&
    setSectionsDraft({
      ...sectionsDraft,
      profileSections: toggleHiddenId(sectionsDraft.profileSections, id),
    });

  // Phase 91: the eight overview sections keyed by registry id, so the
  // default layout, the customized flat layout, and edit mode share them.
  const nodes: Record<string, React.ReactNode> = {
    "session-packages": <SessionPackageCard clientId={clientId} />,

    consistency: (
      <motion.div {...fadeUp}>
        <ConsistencyCalendar clientId={clientId} clientEmail={client.email} />
      </motion.div>
    ),

    stats: (
      <motion.div {...fadeUp} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Weight}
          label="Current Weight"
          value={`${currentWeight} kg`}
          sub={client.goalWeight ? `Goal: ${client.goalWeight} kg` : undefined}
          color="var(--azfit-primary)"
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
    ),

    progress: (
      <motion.div
        {...fadeUp}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--page-text)" }}
          >
            Progress to Goal
          </h3>
          <button
            onClick={() => setGoalsOpen(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ color: "var(--azfit-primary)" }}
          >
            <Pencil size={12} />
            Edit goals
          </button>
        </div>
        <div className="space-y-3">
          {goals.length > 0 ? (
            <>
              {goals.map((goal) => {
                const targetBits = [
                  goal.target_weight_kg != null && `Target: ${goal.target_weight_kg} kg`,
                  goal.target_body_fat_pct != null && `Target: ${goal.target_body_fat_pct}%`,
                  goal.target_date && `by ${formatDate(goal.target_date)}`,
                ].filter(Boolean);

                let pct: number | null = null;
                if (goal.goal_type === "lose_weight" && goal.target_weight_kg != null) {
                  pct = progressPercent(
                    nearestToDate(bodyComposition, goal.start_date, (r) => r.weight_kg),
                    currentWeight,
                    goal.target_weight_kg,
                  );
                } else if (goal.goal_type === "reduce_body_fat" && goal.target_body_fat_pct != null) {
                  pct = progressPercent(
                    nearestToDate(bodyComposition, goal.start_date, (r) => r.body_fat_percentage),
                    currentBodyFat,
                    goal.target_body_fat_pct,
                  );
                }

                return (
                  <div key={goal.id} style={{ opacity: goal.is_achieved ? 0.6 : 1 }}>
                    <div className="flex justify-between text-xs mb-1">
                      <span
                        className="flex items-center gap-1.5"
                        style={{ color: "var(--light-text-secondary)" }}
                      >
                        {goalLabel(goal)}
                        {goal.is_achieved && (
                          <span
                            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                            style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                          >
                            <Check size={9} />
                            Achieved
                          </span>
                        )}
                      </span>
                      <span style={{ color: "var(--light-text-muted)" }}>
                        {targetBits.length > 0 ? targetBits.join(" • ") : "No target set"}
                      </span>
                    </div>
                    {pct != null && (
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span
                          className="text-[10px] font-medium shrink-0"
                          style={{ color: "var(--azfit-primary)" }}
                        >
                          {pct}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {/* Fallback: clients-row snapshot goal (pre-goals-system clients) */}
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
                <button
                  onClick={() => setGoalsOpen(true)}
                  className="mt-1.5 text-[10px] font-medium transition hover:opacity-80"
                  style={{ color: "var(--azfit-primary)" }}
                >
                  + Set goals to track progress
                </button>
              </div>
            </>
          )}
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
    ),

    lifestyle: (
      <motion.div
        {...fadeUp}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <Target size={14} style={{ color: "var(--azfit-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Lifestyle Targets
          </h3>
          <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            set by the client
          </span>
        </div>
        {hasLifestyleTargets(lifestyle) ? (
          <div className="flex flex-wrap gap-2">
            {lifestyleChips(lifestyle).map((c) => (
              <span
                key={c}
                className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            No lifestyle targets set — the client can add steps, sleep and water goals from their dashboard.
          </p>
        )}
      </motion.div>
    ),

    details: (
      <motion.div
        {...fadeUp}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--page-text)" }}
          >
            Profile Details
          </h3>
          {onEditClient && (
            <button
              onClick={onEditClient}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-80"
              style={{ color: "var(--azfit-primary)" }}
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>
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
    ),

    nutrition: (
      <NutritionCard clientEmail={client.email} onClick={() => onNavigate("nutrition")} />
    ),

    "body-composition": (
      <BodyCompositionCard
        loading={loading}
        latestBodyComposition={latestBodyComposition}
        latestAssessment={latestAssessment}
        assessments={assessments}
        onNewAssessment={() => setShowWizard(true)}
      />
    ),
  };

  return (
    <div className="space-y-4">
      {/* Phase 91: "Customize layout" affordance (coach view only, never
          while View-As-Client is active — the prefs belong to the coach). */}
      {canCustomize && !editingSections && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={startEditing}
            data-testid="customize-layout-btn"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
            style={{
              borderColor: "var(--card-border)",
              backgroundColor: "var(--card-bg)",
              color: "var(--page-text)",
            }}
          >
            <LayoutGrid size={13} aria-hidden />
            Customize layout
          </button>
        </div>
      )}

      {/* Edit-mode bar: draft previews live; Save persists, Cancel restores. */}
      {editingSections && (
        <div
          className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
          style={{
            borderColor: "color-mix(in srgb, var(--azfit-primary) 45%, var(--card-border))",
            backgroundColor: "color-mix(in srgb, var(--azfit-primary) 8%, var(--card-bg))",
          }}
          data-testid="sections-edit-bar"
        >
          <span className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>
            Customizing layout
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPreviewRestore}
              className="h-10 rounded-lg border px-3 text-xs font-medium"
              style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEditing}
              data-testid="sections-save"
              className="h-10 rounded-lg px-3 text-xs font-medium text-white"
              style={{ backgroundColor: "var(--azfit-primary)" }}
            >
              Save layout
            </button>
          </div>
        </div>
      )}

      {/* EDIT MODE: flat preview of ALL sections — hidden ones stay visible
          dimmed so the eye restores them. Details/Nutrition render stacked
          here because the flat customized layout has no side-by-side grid. */}
      {editingSections ? (
        <div className="space-y-3">
          {effPrefs.profileSections.order.map((id, idx) => {
            const hidden = effPrefs.profileSections.hidden.includes(id);
            const label = registryLabel(PROFILE_SECTIONS, id);
            return (
              <div
                key={id}
                data-testid={`section-${id}`}
                className="rounded-xl border p-2"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--page-bg)" }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                    {label}
                    {hidden && (
                      <span className="ml-2 text-[10px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                        — hidden
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${label} up`}
                    disabled={idx === 0}
                    onClick={() => moveSection(id, -1)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                  >
                    <ArrowUp size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${label} down`}
                    disabled={idx === effPrefs.profileSections.order.length - 1}
                    onClick={() => moveSection(id, 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                  >
                    <ArrowDown size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hidden}
                    aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
                    onClick={() => toggleSection(id)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: "var(--card-border)",
                      color: hidden ? "var(--light-text-muted)" : "var(--azfit-primary)",
                    }}
                  >
                    {hidden ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                  </button>
                </div>
                <div style={{ opacity: hidden ? 0.45 : 1 }}>{nodes[id]}</div>
              </div>
            );
          })}
        </div>
      ) : sectionsCustomized ? (
        /* CUSTOMIZED: flat ordered visible sections (per-coach, every client). */
        <div className="space-y-4" data-testid="sections-custom-layout">
          {orderedVisibleSections.map((id) => (
            <div key={id}>{nodes[id]}</div>
          ))}
        </div>
      ) : (
        /* DEFAULT (NULL prefs): the exact pre-91 layout — zero visual change. */
        <>
          {nodes["session-packages"]}
          {nodes.consistency}
          {nodes.stats}
          {nodes.progress}
          {nodes.lifestyle}
          {/* Profile Details + Nutrition side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nodes.details}
            {nodes.nutrition}
          </div>
          {nodes["body-composition"]}
        </>
      )}
      <AssessmentWizard
        clientId={clientId}
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSaved={() => setShowWizard(false)}
      />

      <ClientGoalsDialog
        open={goalsOpen}
        onOpenChange={setGoalsOpen}
        clientId={clientId}
        goals={goals}
        onChanged={fetchGoals}
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
        .ilike("email", clientEmail)
        .maybeSingle();
      if (cancelled) return;
      if (!prof) {
        setNoProfile(true);
        setLoading(false);
        return;
      }

      const today = formatDateKeyLocal(new Date());
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
            color="var(--azfit-primary)"
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
