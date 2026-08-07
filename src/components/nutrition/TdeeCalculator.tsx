import { useEffect, useMemo, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  calculateBMR,
  calculateTDEE,
  calculateGoalCaloriesPct,
  applySafetyGuardrails,
  calculateMacroTargets,
  ACTIVITY_LEVELS,
  GOAL_ADJUSTMENTS_PCT,
  MAX_KCAL_DELTA,
  DIET_PRESETS,
  type ActivityLevelKey,
  type GoalKeyPct,
  type DietKey,
} from "@/lib/tdee";
import { saveNutritionTargets } from "@/lib/foodApi";
import { toast } from "sonner";

interface TdeeCalculatorProps {
  /** clients.id — used to pull height/gender/dob + latest weight. */
  clientId: string;
  /** profiles.id to write nutrition_targets for. Omit = current user. */
  targetProfileId?: string | null;
  /** When provided, Apply calls this INSTEAD of writing nutrition_targets
   * (used for account-less clients — targets go to intake_profile). */
  onApplyTargets?: (t: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  }) => Promise<void>;
  onApplied?: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary (office job)",
  light: "Lightly active (1–2 days/wk)",
  moderate: "Moderately active (3–5 days/wk)",
  very: "Very active (6–7 days/wk)",
  extreme: "Athlete (2×/day)",
};

const GOAL_LABELS: Record<string, string> = {
  aggressive_fat_loss: "Aggressive (−20%)",
  fat_loss: "Fat Loss (−10%)",
  maintenance: "Maintenance (TDEE)",
  lean_gain: "Lean Gain (+5%)",
  muscle_gain: "Muscle Gain (+10%)",
};

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  return age > 0 && age < 120 ? age : 30;
}

export default function TdeeCalculator({
  clientId,
  targetProfileId,
  onApplyTargets,
  onApplied,
}: TdeeCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weight, setWeight] = useState(80);
  const [height, setHeight] = useState(175);
  const [age, setAge] = useState(30);
  const [dobMissing, setDobMissing] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<ActivityLevelKey>("moderate");
  const [goal, setGoal] = useState<GoalKeyPct>("maintenance");
  const [diet, setDiet] = useState<DietKey>("balanced");

  // Pull client stats + latest weight when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: client }, { data: bc }] = await Promise.all([
        supabase
          .from("clients")
          .select("height_cm, gender, date_of_birth")
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("body_composition")
          .select("weight_kg")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (client?.height_cm) setHeight(client.height_cm);
      if (client?.gender === "female" || client?.gender === "male") setGender(client.gender);
      if (client?.date_of_birth) setAge(ageFromDob(client.date_of_birth));
      // Phase 53: DOB is optional now — surface the age fallback honestly
      setDobMissing(!!client && !client.date_of_birth);
      if (bc?.weight_kg) setWeight(bc.weight_kg);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  const result = useMemo(() => {
    if (!weight || !height || !age) return null;
    const bmr = calculateBMR(weight, height, age, gender);
    const tdee = calculateTDEE(bmr, activity);
    // Phase 28E pipeline: pct goal adjustment → safety guardrails (never silent)
    const goalCalories = calculateGoalCaloriesPct(tdee, goal);
    const guard = applySafetyGuardrails(goalCalories, bmr, tdee);
    const calories = guard.calories;
    const macros = calculateMacroTargets({ calories, weightKg: weight, gender, goal, diet });
    const rawDelta = Math.round(tdee * (GOAL_ADJUSTMENTS_PCT[goal] ?? 0));
    return { bmr, tdee, calories, macros, guard, rawDelta };
  }, [weight, height, age, gender, activity, goal, diet]);

  const apply = async () => {
    if (!result) return;
    setSaving(true);
    try {
      if (onApplyTargets) {
        await onApplyTargets({
          calories: result.calories,
          protein_g: result.macros.protein,
          carbs_g: result.macros.carbs,
          fats_g: result.macros.fats,
        });
      } else {
        await saveNutritionTargets(
          {
            calories: result.calories,
            protein: result.macros.protein,
            carbs: result.macros.carbs,
            fats: result.macros.fats,
          },
          targetProfileId ?? undefined
        );
      }
      toast.success("Targets updated from TDEE");
      onApplied?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save targets");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 text-xs font-medium transition hover:opacity-80"
        style={{ color: "#00AEEF" }}
      >
        <Calculator size={13} />
        Calculate from stats
      </button>
    );
  }

  const selectStyle = {
    backgroundColor: "var(--light-elevated)",
    borderColor: "var(--card-border)",
    color: "var(--page-text)",
  } as const;
  const inputCls =
    "w-full rounded-lg border px-2 py-1.5 text-sm";

  return (
    <div
      className="mt-3 space-y-3 rounded-xl border p-3"
      style={{ borderColor: "var(--card-border)" }}
    >
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 size={16} className="animate-spin" style={{ color: "#00AEEF" }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Weight (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value) || 0)}
                className={inputCls}
                style={selectStyle}
              />
            </div>
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Height (cm)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || 0)}
                className={inputCls}
                style={selectStyle}
              />
            </div>
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value) || 0)}
                className={inputCls}
                style={selectStyle}
              />
            </div>
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Sex
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female")}
                className={inputCls}
                style={selectStyle}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {dobMissing && (
            <p
              className="rounded-lg border px-3 py-2 text-[11px] font-medium"
              style={{ borderColor: "rgba(245, 158, 11, 0.4)", backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" }}
            >
              No date of birth on file — age is estimated. Set date of birth for accurate targets.
            </p>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Activity
              </label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value as ActivityLevelKey)}
                className={inputCls}
                style={selectStyle}
              >
                {Object.keys(ACTIVITY_LEVELS).map((k) => (
                  <option key={k} value={k}>
                    {ACTIVITY_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Goal
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as GoalKeyPct)}
                className={inputCls}
                style={selectStyle}
              >
                {Object.keys(GOAL_ADJUSTMENTS_PCT).map((k) => (
                  <option key={k} value={k}>
                    {GOAL_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
              {result && (
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  {result.calories - result.tdee >= 0 ? "+" : "−"}
                  {Math.abs(result.calories - result.tdee).toLocaleString()} kcal/day
                  {Math.abs(result.rawDelta) > MAX_KCAL_DELTA && " · capped at ±1,000"}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Diet
              </label>
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value as DietKey)}
                className={inputCls}
                style={selectStyle}
              >
                {Object.entries(DIET_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {result && result.guard.clamped && (
            <div
              className="rounded-lg border px-3 py-2 text-[11px] font-medium"
              style={{
                borderColor: "rgba(245, 158, 11, 0.4)",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                color: "#F59E0B",
              }}
            >
              {result.guard.warnings.map((w) => (
                <p key={w}>⚠ {w}</p>
              ))}
            </div>
          )}

          {result && (
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: "var(--light-elevated)" }}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--page-text)" }}>
                <span>
                  BMR <strong>{result.bmr.toLocaleString()}</strong> kcal
                </span>
                <span>
                  TDEE <strong>{result.tdee.toLocaleString()}</strong> kcal
                </span>
                <span>
                  Target <strong style={{ color: "#00AEEF" }}>{result.calories.toLocaleString()}</strong> kcal
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                <span>P {result.macros.protein}g</span>
                <span>C {result.macros.carbs}g</span>
                <span>F {result.macros.fats}g</span>
                <span>Fiber: {result.macros.fiber} g</span>
                <span>Water: {result.macros.waterMl.toLocaleString()} ml</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border py-1.5 text-xs font-medium"
              style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
            >
              Close
            </button>
            <button
              onClick={apply}
              disabled={saving || !result}
              className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              {saving ? "Saving…" : "Apply to targets"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
