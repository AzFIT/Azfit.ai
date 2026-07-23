import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Utensils, Pencil, TrendingUp } from "lucide-react";
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
import { toast } from "sonner";

interface NutritionTabProps {
  clientId: string;
  clientEmail: string;
}

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snacks"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export default function NutritionTab({ clientEmail }: NutritionTabProps) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [draft, setDraft] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<LoggedFoodEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [adherence, setAdherence] = useState({ daysLogged: 0, daysHit: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", clientEmail)
        .maybeSingle();
      if (cancelled || !prof) {
        if (!cancelled) setLoading(false);
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
  }, [clientEmail]);

  const handleSave = async () => {
    if (!profileId) return;
    setSaving(true);
    try {
      await saveNutritionTargets(draft, profileId);
      setTargets(draft);
      setEditing(false);
      toast.success("Targets updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update targets");
    } finally {
      setSaving(false);
    }
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

  if (!profileId) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-12"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <Utensils size={32} style={{ color: "var(--light-text-muted)" }} />
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
          No linked app account for this client yet
        </p>
      </div>
    );
  }

  const macros: Array<{ label: string; current: number; target: number; color: string }> = [
    { label: "Calories", current: totals.calories, target: targets.calories, color: "#F59E0B" },
    { label: "Protein", current: totals.protein, target: targets.protein, color: "#0D9488" },
    { label: "Carbs", current: totals.carbs, target: targets.carbs, color: "#06B6D4" },
    { label: "Fats", current: totals.fats, target: targets.fats, color: "#8B5CF6" },
  ];

  return (
    <div className="space-y-4">
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
          </div>
          {!editing && (
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

        {!editing ? (
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
      </motion.div>

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
    </div>
  );
}
