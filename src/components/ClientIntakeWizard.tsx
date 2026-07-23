import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  Target,
  Activity,
  ShieldAlert,
  ClipboardCheck,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroBreakdown,
  ACTIVITY_LEVELS,
  GOAL_ADJUSTMENTS,
  DIET_PRESETS,
  type ActivityLevelKey,
  type GoalKey,
  type DietKey,
} from "@/lib/tdee";
import { calculateBodyFat, PROTOCOL_SITES, type SkinfoldSite } from "@/lib/bodyfat";
import { saveNutritionTargets } from "@/lib/foodApi";

/* ═══════════════════════════════════════════════════════════════
   5-Step Client Intake Wizard (legacy PHASE_2 spec → Supabase)
   ═══════════════════════════════════════════════════════════════ */

export interface ClientIntakeWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, label: "Personal", icon: User },
  { id: 2, label: "Goals", icon: Target },
  { id: 3, label: "Body", icon: Activity },
  { id: 4, label: "Medical", icon: ShieldAlert },
  { id: 5, label: "Review", icon: ClipboardCheck },
];

const PRIMARY_GOALS = [
  { value: "lose_weight", label: "Lose Weight" },
  { value: "build_muscle", label: "Build Muscle" },
  { value: "strength", label: "Strength" },
  { value: "endurance", label: "Endurance" },
  { value: "athletic_performance", label: "Athletic Performance" },
  { value: "rehab_mobility", label: "Rehab & Mobility" },
  { value: "general_fitness", label: "General Fitness" },
];

const EQUIPMENT_OPTIONS = ["Full Gym", "Dumbbells Only", "Bodyweight", "Home Gym", "Commercial Gym"];

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  very: "Very active",
  extreme: "Athlete",
};

const SKINFOLD_LABELS: Record<SkinfoldSite, string> = {
  chin: "Chin",
  cheek: "Cheek",
  pec: "Pec",
  mid_axillary: "Mid-Ax",
  umbilical: "Umbilical",
  supra_iliac: "Supra",
  subscapular: "Sub-Scap",
  triceps: "Tricep",
  knee: "Knee",
  medial_calf: "Calf",
  mid_thigh: "Thigh",
  hamstring: "Hamstring",
};

interface IntakeData {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: "male" | "female" | "other";
  emergencyName: string;
  emergencyPhone: string;
  primaryGoal: string;
  secondaryGoal: string;
  experience: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  sessionsPerWeek: number;
  sessionDuration: number;
  weightKg: string;
  heightCm: string;
  activity: ActivityLevelKey;
  goalKey: GoalKey;
  diet: DietKey;
  skinfolds: Partial<Record<SkinfoldSite, string>>;
  injuries: string;
  medications: string;
  allergies: string;
  cleared: "yes" | "no" | "restricted";
  restrictions: string;
}

const INITIAL: IntakeData = {
  fullName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "male",
  emergencyName: "",
  emergencyPhone: "",
  primaryGoal: "",
  secondaryGoal: "",
  experience: "beginner",
  equipment: [],
  sessionsPerWeek: 3,
  sessionDuration: 60,
  weightKg: "",
  heightCm: "",
  activity: "moderate",
  goalKey: "maintenance",
  diet: "balanced",
  skinfolds: {},
  injuries: "",
  medications: "",
  allergies: "",
  cleared: "yes",
  restrictions: "",
};

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
}

const inputCls =
  "w-full rounded-lg border px-3 py-2 text-sm bg-[var(--light-elevated)] border-[var(--card-border)] text-[var(--page-text)] focus:outline-none focus:border-[#00AEEF]";
const labelCls = "block text-xs font-medium mb-1 text-[var(--light-text-muted)]";

export default function ClientIntakeWizard({ open, onClose, onSuccess }: ClientIntakeWizardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<IntakeData>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof IntakeData>(key: K, value: IntakeData[K]) => {
    setData((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const age = useMemo(() => ageFromDob(data.dob), [data.dob]);
  const weightNum = parseFloat(data.weightKg) || 0;
  const heightNum = parseFloat(data.heightCm) || 0;
  const bmi = weightNum && heightNum ? weightNum / (heightNum / 100) ** 2 : 0;

  const bmr = weightNum && heightNum && age ? calculateBMR(weightNum, heightNum, age, data.gender === "female" ? "female" : "male") : 0;
  const tdee = bmr ? calculateTDEE(bmr, data.activity) : 0;
  const goalCalories = tdee ? calculateGoalCalories(tdee, data.goalKey) : 0;
  const macros = goalCalories ? calculateMacroBreakdown(goalCalories, data.diet, weightNum) : null;

  const jp7Sites = PROTOCOL_SITES.jp7;
  const enteredSkinfolds = jp7Sites.filter((s) => (parseFloat(data.skinfolds[s] || "") || 0) > 0);
  const sum7 = jp7Sites.reduce((sum, s) => sum + (parseFloat(data.skinfolds[s] || "") || 0), 0);
  const bfResult =
    enteredSkinfolds.length === jp7Sites.length && age
      ? calculateBodyFat("jp7", sum7, age, data.gender === "female" ? "female" : "male")
      : null;
  const bodyFatPct = bfResult?.bodyFatPct ?? null;
  const leanMass = bodyFatPct != null && weightNum ? weightNum * (1 - bodyFatPct / 100) : null;

  /* ── Validation per step ── */
  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!data.fullName.trim()) e.fullName = "Full name is required";
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = "Invalid email";
      if (!data.dob) e.dob = "Date of birth is required";
    }
    if (s === 2) {
      if (!data.primaryGoal) e.primaryGoal = "Select a primary goal";
      if (data.equipment.length === 0) e.equipment = "Select at least one";
    }
    if (s === 3) {
      if (!weightNum) e.weightKg = "Weight is required";
      if (!heightNum) e.heightCm = "Height is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(5, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleClose = () => {
    setData(INITIAL);
    setStep(1);
    setErrors({});
    onClose();
  };

  /* ── Atomic-ish create ── */
  const handleSave = async () => {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    setSaving(true);
    try {
      const computedTargets = macros
        ? { calories: goalCalories, protein: macros.protein, carbs: macros.carbs, fats: macros.fats }
        : null;

      const intakeProfile = {
        secondary_goal: data.secondaryGoal || null,
        equipment: data.equipment,
        sessions_per_week: data.sessionsPerWeek,
        session_duration_minutes: data.sessionDuration,
        emergency_contact: { name: data.emergencyName || null, phone: data.emergencyPhone || null },
        injuries: data.injuries || null,
        medications: data.medications || null,
        allergies: data.allergies || null,
        cleared_to_exercise: data.cleared,
        restrictions: data.cleared === "restricted" ? data.restrictions || null : null,
        activity_level: data.activity,
        goal_key: data.goalKey,
        diet: data.diet,
        computed_targets: computedTargets,
      };

      // 1) clients row
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          trainer_id: user.id,
          full_name: data.fullName.trim(),
          email: data.email.trim() || `${Date.now()}@noemail.azfit`,
          phone: data.phone.trim() || null,
          date_of_birth: data.dob || null,
          gender: data.gender,
          height_cm: heightNum || null,
          weight_kg: weightNum || null,
          body_fat_percentage: bodyFatPct != null ? Math.round(bodyFatPct * 10) / 10 : null,
          fitness_goal: data.primaryGoal || null,
          experience_level: data.experience,
          status: "active",
          intake_profile: intakeProfile,
        })
        .select()
        .single();
      if (clientErr || !client) throw clientErr || new Error("Failed to create client");

      // 2) body_composition row (weight/height/bf)
      if (weightNum) {
        await supabase.from("body_composition").insert({
          client_id: client.id,
          weight_kg: weightNum,
          body_fat_percentage: bodyFatPct != null ? Math.round(bodyFatPct * 10) / 10 : null,
          muscle_mass_kg: leanMass != null ? Math.round(leanMass * 10) / 10 : null,
          bmi: bmi ? Math.round(bmi * 10) / 10 : null,
          recorded_at: new Date().toISOString(),
        });
      }

      // 3) skinfold_assessments row (if all 7 sites entered)
      if (bfResult && bodyFatPct != null) {
        const sites: Record<string, number> = {};
        for (const s of jp7Sites) sites[s] = parseFloat(data.skinfolds[s] || "0") || 0;
        await supabase.from("skinfold_assessments").insert({
          client_id: client.id,
          assessed_by: user.id,
          protocol: "jp7",
          sites,
          sum_mm: sum7,
          body_fat_pct: Math.round(bodyFatPct * 10) / 10,
          weight_kg: weightNum || null,
          age_years: age || null,
        });
      }

      // 4) nutrition_targets — only possible if a profiles row exists for
      //    this email (brand-new clients have no auth account yet)
      if (computedTargets && data.email) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", data.email.trim())
          .maybeSingle();
        if (prof) {
          await saveNutritionTargets(computedTargets, prof.id).catch(() => {});
        }
      }

      toast.success(`${data.fullName.trim()} added successfully!`);
      onSuccess?.();
      handleClose();
      navigate(`/client/${client.id}`);
    } catch (err) {
      toast.error("Failed to create client: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const bmiCategory =
    bmi <= 0 ? null : bmi < 18.5 ? { label: "Underweight", color: "#F59E0B" } : bmi < 25 ? { label: "Normal", color: "#22C55E" } : bmi < 30 ? { label: "Overweight", color: "#F97316" } : { label: "Obese", color: "#EF4444" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="relative z-10 mx-4 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        {/* Header + progress */}
        <div className="border-b px-5 pb-3 pt-4" style={{ borderColor: "var(--card-border)" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
              Add New Client
            </h2>
            <button onClick={handleClose} className="rounded-full p-1.5 hover:bg-[var(--light-elevated)]">
              <X size={18} style={{ color: "var(--light-text-muted)" }} />
            </button>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--light-elevated)" }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${(step / 5) * 100}%` }}
              transition={{ duration: 0.3 }}
              style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
            />
          </div>
          <div className="mt-2 flex justify-between">
            {STEPS.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-0.5">
                <s.icon size={14} style={{ color: step >= s.id ? "#00AEEF" : "var(--light-text-muted)" }} />
                <span
                  className="text-[9px] font-medium"
                  style={{ color: step >= s.id ? "#00AEEF" : "var(--light-text-muted)" }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── STEP 1: PERSONAL ── */}
              {step === 1 && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Full Name *</label>
                    <input className={inputCls} value={data.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="John Doe" />
                    {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" className={inputCls} value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="john@email.com" />
                      {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input type="tel" className={inputCls} value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 123 4567" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>
                        Date of Birth * {age > 0 && <span className="text-[#00AEEF]">({age} yrs)</span>}
                      </label>
                      <input type="date" className={inputCls} value={data.dob} onChange={(e) => set("dob", e.target.value)} />
                      {errors.dob && <p className="mt-1 text-xs text-red-500">{errors.dob}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Gender *</label>
                      <div className="flex gap-2">
                        {(["male", "female", "other"] as const).map((g) => (
                          <button
                            key={g}
                            onClick={() => set("gender", g)}
                            className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition ${data.gender === g ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)]"}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Emergency Contact Name</label>
                      <input className={inputCls} value={data.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Emergency Contact Phone</label>
                      <input type="tel" className={inputCls} value={data.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: GOALS ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Primary Goal *</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PRIMARY_GOALS.map((g) => (
                        <button
                          key={g.value}
                          onClick={() => set("primaryGoal", g.value)}
                          className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition ${data.primaryGoal === g.value ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--page-text)]"}`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                    {errors.primaryGoal && <p className="mt-1 text-xs text-red-500">{errors.primaryGoal}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Experience Level *</label>
                    <div className="flex gap-2">
                      {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => set("experience", lvl)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition ${data.experience === lvl ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)]"}`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Available Equipment *</label>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map((eq) => {
                        const active = data.equipment.includes(eq);
                        return (
                          <button
                            key={eq}
                            onClick={() =>
                              set("equipment", active ? data.equipment.filter((x) => x !== eq) : [...data.equipment, eq])
                            }
                            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${active ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)]"}`}
                          >
                            {eq}
                          </button>
                        );
                      })}
                    </div>
                    {errors.equipment && <p className="mt-1 text-xs text-red-500">{errors.equipment}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Sessions / Week *</label>
                      <select className={inputCls} value={data.sessionsPerWeek} onChange={(e) => set("sessionsPerWeek", Number(e.target.value))}>
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Session Duration *</label>
                      <select className={inputCls} value={data.sessionDuration} onChange={(e) => set("sessionDuration", Number(e.target.value))}>
                        {[30, 45, 60, 90].map((n) => (
                          <option key={n} value={n}>{n} min</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: BODY ASSESSMENT ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Weight (kg) *</label>
                      <input type="number" step="0.1" className={inputCls} value={data.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
                      {errors.weightKg && <p className="mt-1 text-xs text-red-500">{errors.weightKg}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Height (cm) *</label>
                      <input type="number" step="0.1" className={inputCls} value={data.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
                      {errors.heightCm && <p className="mt-1 text-xs text-red-500">{errors.heightCm}</p>}
                    </div>
                  </div>

                  {bmiCategory && (
                    <p className="text-xs" style={{ color: bmiCategory.color }}>
                      BMI {bmi.toFixed(1)} — {bmiCategory.label}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelCls}>Activity Level *</label>
                      <select className={inputCls} value={data.activity} onChange={(e) => set("activity", e.target.value as ActivityLevelKey)}>
                        {Object.keys(ACTIVITY_LEVELS).map((k) => (
                          <option key={k} value={k}>{ACTIVITY_LABELS[k] ?? k}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Goal *</label>
                      <select className={inputCls} value={data.goalKey} onChange={(e) => set("goalKey", e.target.value as GoalKey)}>
                        {Object.keys(GOAL_ADJUSTMENTS).map((k) => (
                          <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Diet *</label>
                      <select className={inputCls} value={data.diet} onChange={(e) => set("diet", e.target.value as DietKey)}>
                        {Object.entries(DIET_PRESETS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {tdee > 0 && macros && (
                    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
                      BMR <strong>{bmr.toLocaleString()}</strong> • TDEE <strong>{tdee.toLocaleString()}</strong> • Target{" "}
                      <strong style={{ color: "#00AEEF" }}>{goalCalories.toLocaleString()}</strong> kcal — P {macros.protein}g / C {macros.carbs}g / F {macros.fats}g
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>7-Site Skinfold (mm) — optional</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {jp7Sites.map((site) => (
                        <div key={site}>
                          <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                            {SKINFOLD_LABELS[site]}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            className={inputCls}
                            value={data.skinfolds[site] || ""}
                            onChange={(e) => set("skinfolds", { ...data.skinfolds, [site]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    {bodyFatPct != null && (
                      <p className="mt-2 text-xs" style={{ color: "#22C55E" }}>
                        Body Fat {bodyFatPct.toFixed(1)}% • Lean {leanMass?.toFixed(1)} kg • Sum {sum7} mm
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 4: MEDICAL ── */}
              {step === 4 && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Injuries or Conditions</label>
                    <textarea rows={2} className={inputCls} value={data.injuries} onChange={(e) => set("injuries", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Medications</label>
                    <textarea rows={2} className={inputCls} value={data.medications} onChange={(e) => set("medications", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Allergies</label>
                    <textarea rows={2} className={inputCls} value={data.allergies} onChange={(e) => set("allergies", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Cleared to Exercise *</label>
                    <div className="flex gap-2">
                      {(["yes", "no", "restricted"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => set("cleared", c)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition ${data.cleared === c ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)]"}`}
                        >
                          {c === "restricted" ? "With Restrictions" : c}
                        </button>
                      ))}
                    </div>
                  </div>
                  {data.cleared === "restricted" && (
                    <div>
                      <label className={labelCls}>Restrictions</label>
                      <textarea rows={2} className={inputCls} value={data.restrictions} onChange={(e) => set("restrictions", e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 5: REVIEW ── */}
              {step === 5 && (
                <div className="space-y-3 text-xs" style={{ color: "var(--page-text)" }}>
                  <ReviewSection title="Personal Info" onEdit={() => setStep(1)}>
                    <p>{data.fullName} {age > 0 && `(${age} yrs)`} • {data.gender}</p>
                    {data.email && <p>{data.email}</p>}
                    {data.phone && <p>{data.phone}</p>}
                  </ReviewSection>
                  <ReviewSection title="Goals" onEdit={() => setStep(2)}>
                    <p>{PRIMARY_GOALS.find((g) => g.value === data.primaryGoal)?.label} • {data.experience}</p>
                    <p>{data.sessionsPerWeek}×/week • {data.sessionDuration} min • {data.equipment.join(", ")}</p>
                  </ReviewSection>
                  <ReviewSection title="Body Assessment" onEdit={() => setStep(3)}>
                    <p>
                      {weightNum} kg • {heightNum} cm {bmi > 0 && `• BMI ${bmi.toFixed(1)}`}
                    </p>
                    {tdee > 0 && (
                      <p>
                        TDEE {tdee.toLocaleString()} • Target {goalCalories.toLocaleString()} kcal — P {macros?.protein}g / C {macros?.carbs}g / F {macros?.fats}g
                      </p>
                    )}
                    {bodyFatPct != null && <p>Body Fat {bodyFatPct.toFixed(1)}% • Sum {sum7} mm</p>}
                  </ReviewSection>
                  <ReviewSection title="Medical" onEdit={() => setStep(4)}>
                    <p>Cleared: {data.cleared === "restricted" ? `With Restrictions (${data.restrictions || "—"})` : data.cleared}</p>
                    {data.injuries && <p>Injuries: {data.injuries}</p>}
                  </ReviewSection>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: "var(--card-border)" }}>
          <button onClick={handleClose} className="text-xs font-medium" style={{ color: "var(--light-text-muted)" }}>
            Cancel
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={back} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}>
                <ChevronLeft size={14} /> Back
              </button>
            )}
            {step < 5 ? (
              <button onClick={next} className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}>
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                <Check size={14} /> {saving ? "Saving…" : "Confirm & Save Client"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
          {title}
        </span>
        <button onClick={onEdit} className="text-[10px] font-medium" style={{ color: "#00AEEF" }}>
          Edit
        </button>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
