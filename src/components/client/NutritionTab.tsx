import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Utensils, Pencil, TrendingUp, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getNutritionTargets,
  saveNutritionTargets,
  getDailyLog,
  getDayTotals,
  DEFAULT_TARGETS,
  type NutritionTargets,
  type LoggedFoodEntry,
} from "@/lib/foodApi";
import { activityLabel, DIET_PRESETS } from "@/lib/tdee";
import { toast } from "sonner";
import TdeeCalculator from "@/components/nutrition/TdeeCalculator";
import type { Json } from "@/types/supabase";

interface NutritionTabProps {
  clientId: string;
  clientEmail: string;
}

/** Shape of clients.intake_profile jsonb (Phase 16 wizard). The brief
 * mentioned _g-suffixed target keys — live rows use no suffix; read both. */
interface IntakeTargets {
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  protein_g?: number;
  carbs_g?: number;
  fats_g?: number;
}
interface IntakeProfile {
  activity_level?: string;
  sessions_per_week?: number;
  session_duration_minutes?: number;
  diet?: string;
  equipment?: string[];
  computed_targets?: IntakeTargets | null;
}

interface ClientBasics {
  fitness_goal: string | null;
  experience_level: string | null;
}

function normalizeTargets(t: IntakeTargets | null | undefined): NutritionTargets | null {
  if (!t) return null;
  const protein = t.protein ?? t.protein_g;
  const carbs = t.carbs ?? t.carbs_g;
  const fats = t.fats ?? t.fats_g;
  if (t.calories == null && protein == null && carbs == null && fats == null) return null;
  return {
    calories: t.calories ?? 0,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fats: fats ?? 0,
  };
}

function humanize(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snacks"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export default function NutritionTab({ clientId, clientEmail }: NutritionTabProps) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [draft, setDraft] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<LoggedFoodEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [adherence, setAdherence] = useState({ daysLogged: 0, daysHit: 0 });
  const [clientBasics, setClientBasics] = useState<ClientBasics | null>(null);
  const [intake, setIntake] = useState<IntakeProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // clients row (intake summary + no-profile targets source)
      const { data: crow } = await supabase
        .from("clients")
        .select("fitness_goal, experience_level, intake_profile")
        .eq("id", clientId)
        .maybeSingle();
      if (cancelled) return;
      if (crow) {
        setClientBasics({
          fitness_goal: crow.fitness_goal,
          experience_level: crow.experience_level,
        });
        setIntake((crow.intake_profile as IntakeProfile | null) ?? null);
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", clientEmail)
        .maybeSingle();
      if (cancelled) return;

      if (!prof) {
        // No-profile mode: targets come from intake_profile.computed_targets
        const ct = normalizeTargets(
          (crow?.intake_profile as IntakeProfile | null)?.computed_targets,
        );
        if (ct) {
          setTargets(ct);
          setDraft(ct);
        }
        setLoading(false);
        return;
      }
      setProfileId(prof.id);

      const t = await getNutritionTargets(prof.id);
      if (cancelled) return;
      setTargets(t);
      setDraft(t);

      const today = new Date().toISOString().split("T")[0];
      const [log, dayTotals] = await Promise.all([
        getDailyLog(today, prof.id),
        getDayTotals(today, prof.id),
      ]);
      if (cancelled) return;
      setEntries(log.entries);
      setTotals(dayTotals);

      let daysLogged = 0;
      let daysHit = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        const dt = await getDayTotals(ds, prof.id);
        if (dt.calories > 0) {
          daysLogged++;
          if (dt.calories >= t.calories * 0.8) daysHit++;
        }
      }
      if (!cancelled) {
        setAdherence({ daysLogged, daysHit });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientEmail, clientId]);

  // Merge edited/calculated targets into clients.intake_profile.computed_targets
  // (never overwrite unrelated jsonb keys). Storage style matches the Phase 16
  // wizard: { calories, protein, carbs, fats } (no _g suffixes).
  const saveTargetsToIntake = async (t: NutritionTargets) => {
    const merged: IntakeProfile = {
      ...(intake || {}),
      computed_targets: {
        calories: t.calories,
        protein: t.protein,
        carbs: t.carbs,
        fats: t.fats,
      },
    };
    const { error } = await supabase
      .from("clients")
      .update({ intake_profile: merged as unknown as Json })
      .eq("id", clientId);
    if (error) throw error;
    setIntake(merged);
    setTargets(t);
    setDraft(t);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (profileId) {
        await saveNutritionTargets(draft, profileId);
        setTargets(draft);
      } else {
        await saveTargetsToIntake(draft);
      }
      setEditing(false);
      toast.success("Targets updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update targets");
    } finally {
      setSaving(false);
    }
  };

  // TdeeCalculator apply in no-profile mode → intake_profile.computed_targets
  const handleApplyTdee = async (t: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  }) => {
    await saveTargetsToIntake({
      calories: t.calories,
      protein: t.protein_g,
      carbs: t.carbs_g,
      fats: t.fats_g,
    });
  };

  const reloadTargets = async () => {
    if (!profileId) return;
    const t = await getNutritionTargets(profileId);
    setTargets(t);
    setDraft(t);
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border py-12"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--azfit-primary)" }}
        />
      </div>
    );
  }

  const macros: Array<{ label: string; current: number; target: number; color: string }> = [
    { label: "Calories", current: totals.calories, target: targets.calories, color: "#F59E0B" },
    { label: "Protein", current: totals.protein, target: targets.protein, color: "#0D9488" },
    { label: "Carbs", current: totals.carbs, target: targets.carbs, color: "#06B6D4" },
    { label: "Fats", current: totals.fats, target: targets.fats, color: "#8B5CF6" },
  ];

  const hasTargets = profileId != null || normalizeTargets(intake?.computed_targets) != null;

  return (
    <div className="space-y-4">
      {/* Intake summary (all clients — clients row + intake_profile jsonb) */}
      <IntakeProfileCard basics={clientBasics} intake={intake} />

      {/* Targets (trainer-editable) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={16} style={{ color: "#F59E0B" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
              Daily Targets
            </span>
            {!profileId && (
              <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                stored on intake profile
              </span>
            )}
          </div>
          {!editing && hasTargets && (
            <button
              onClick={() => {
                setDraft(targets);
                setEditing(true);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-80"
              style={{ color: "var(--azfit-primary)" }}
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {!hasTargets && !editing ? (
          <p className="py-2 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
            No targets yet — run the calculator below.
          </p>
        ) : !editing ? (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "kcal", value: targets.calories, color: "#F59E0B" },
              { label: "protein", value: `${targets.protein}g`, color: "#0D9488" },
              { label: "carbs", value: `${targets.carbs}g`, color: "#06B6D4" },
              { label: "fats", value: `${targets.fats}g`, color: "#8B5CF6" },
            ].map((t) => (
              <div key={t.label} className="text-center">
                <div className="text-lg font-bold" style={{ color: t.color }}>
                  {t.value}
                </div>
                <div className="text-[10px] uppercase" style={{ color: "var(--light-text-muted)" }}>
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["calories", "Calories (kcal)"],
                  ["protein", "Protein (g)"],
                  ["carbs", "Carbs (g)"],
                  ["fats", "Fats (g)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {label}
                  </label>
                  <input
                    type="number"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border px-2 py-1.5 text-sm"
                    style={{
                      backgroundColor: "var(--light-elevated)",
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-lg border py-1.5 text-xs font-medium"
                style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
        {profileId ? (
          <TdeeCalculator
            clientId={clientId}
            targetProfileId={profileId}
            onApplied={reloadTargets}
          />
        ) : (
          <TdeeCalculator
            clientId={clientId}
            onApplyTargets={handleApplyTdee}
          />
        )}
      </motion.div>

      {!profileId && (
        <p
          className="text-center text-xs"
          style={{ color: "var(--light-text-muted)" }}
        >
          Food logging activates when this client creates an app account.
        </p>
      )}

      {profileId && (
        <>
          {/* Today's totals */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Utensils size={16} style={{ color: "var(--azfit-primary)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                Today's Log
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {macros.map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-sm font-bold" style={{ color: m.color }}>
                    {m.current}
                    <span className="text-[10px] font-normal" style={{ color: "var(--light-text-muted)" }}>
                      /{m.target}
                    </span>
                  </div>
                  <div className="text-[10px] uppercase" style={{ color: "var(--light-text-muted)" }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            {entries.length === 0 ? (
              <p className="py-2 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
                Nothing logged today
              </p>
            ) : (
              <div className="space-y-2">
                {MEAL_ORDER.map((mealType) => {
                  const mealEntries = entries.filter((e) => e.mealType === mealType);
                  if (mealEntries.length === 0) return null;
                  return (
                    <div key={mealType}>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--light-text-muted)" }}
                      >
                        {MEAL_LABELS[mealType]}
                      </p>
                      {mealEntries.map((e) => {
                        const ratio = e.quantity / e.food.servingSize;
                        return (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg px-2 py-1.5"
                            style={{ backgroundColor: "var(--light-elevated)" }}
                          >
                            <span className="text-xs" style={{ color: "var(--page-text)" }}>
                              {e.food.name}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                              {Math.round(e.quantity)}g • {Math.round(e.food.calories * ratio)} kcal
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* 7-day adherence */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp size={16} style={{ color: "#84CC16" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                7-Day Adherence
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
                  {adherence.daysLogged}/7
                </span>
                <span className="ml-1 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  days logged
                </span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "#84CC16" }}>
                  {adherence.daysHit}/7
                </span>
                <span className="ml-1 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  days ≥80% of calorie target
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

/* ── Intake summary (clients row + intake_profile jsonb) ─────────────── */

function IntakeProfileCard({
  basics,
  intake,
}: {
  basics: ClientBasics | null;
  intake: IntakeProfile | null;
}) {
  const rows: Array<{ label: string; value: string }> = [];
  if (intake?.activity_level) {
    rows.push({ label: "Activity", value: activityLabel(intake.activity_level) });
  }
  if (basics?.fitness_goal) {
    rows.push({ label: "Goal", value: humanize(basics.fitness_goal) });
  }
  if (basics?.experience_level) {
    rows.push({ label: "Experience", value: humanize(basics.experience_level) });
  }
  if (intake?.sessions_per_week) {
    rows.push({ label: "Sessions", value: `${intake.sessions_per_week}/week` });
  }
  const dietLabel = intake?.diet
    ? (DIET_PRESETS[intake.diet as keyof typeof DIET_PRESETS]?.label ?? humanize(intake.diet))
    : "";
  if (dietLabel) rows.push({ label: "Diet", value: dietLabel });

  const equipment = intake?.equipment?.filter(Boolean) ?? [];
  if (rows.length === 0 && equipment.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList size={16} style={{ color: "var(--azfit-primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
          Intake Profile
        </span>
      </div>
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {rows.map((r) => (
            <span key={r.label} className="text-xs" style={{ color: "var(--light-text-muted)" }}>
              {r.label}:{" "}
              <span className="font-medium" style={{ color: "var(--page-text)" }}>
                {r.value}
              </span>
            </span>
          ))}
        </div>
      )}
      {equipment.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {equipment.map((e) => (
            <span
              key={e}
              className="rounded-full border px-2 py-0.5 text-[10px]"
              style={{ borderColor: "var(--card-border)", color: "var(--light-text-secondary)" }}
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
