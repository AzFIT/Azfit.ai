import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Footprints,
  Moon,
  Flame,
  ChevronRight,
  Check,
  Circle,
  Pencil,
  Save,
  Utensils,
  GlassWater,
  TrendingUp,
  Dumbbell,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router";
import { GlassCard } from "./shared/GlassCard";
import { ProgressRing } from "./shared/ProgressRing";
import { CollapsibleSection } from "./shared/CollapsibleSection";

/* ═══════════════════════════════════════════════════════════════════
   Client Dashboard — Phase A4
   ═══════════════════════════════════════════════════════════════════
   Habit-execution focused client view with:
   • Steps Ring (dynamic target)
   • Macros Ring (Protein/Carbs/Fats — dynamic targets)
   • Recovery Ring (Sleep/Quality — dynamic targets)
   • Today's Workout (interactive checklist)
   • Nutrition Summary (calories + hydration tracker)
   • Weekly Compliance chart
   • Editable targets shell (trainer-only future flag)
   • Deep dark-mode glassmorphic aesthetic
   ═══════════════════════════════════════════════════════════════════ */

/* ── Animation Variants ──────────────────────────────────────────── */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

/* ── Types ───────────────────────────────────────────────────────── */
interface MacroTarget {
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fats: { current: number; target: number };
  calories: { current: number; target: number };
}

interface RecoveryMetrics {
  sleep: { current: number; target: number; unit: string };
  quality: { current: number; target: number; unit: string };
  hrv: { current: number; target: number; unit: string };
}

interface WorkoutExercise {
  id: string;
  order: string;
  name: string;
  sets: number;
  reps: string;
  load: string;
  completed: boolean;
}

interface HydrationLog {
  current: number;
  target: number;
}

/* ── Mock Data ───────────────────────────────────────────────────── */
const MOCK_WORKOUT: WorkoutExercise[] = [
  { id: "e1", order: "A1", name: "Back Squat", sets: 4, reps: "6", load: "120kg", completed: true },
  { id: "e2", order: "A2", name: "Romanian Deadlift", sets: 3, reps: "8", load: "100kg", completed: true },
  { id: "e3", order: "B1", name: "Leg Press", sets: 3, reps: "10", load: "200kg", completed: false },
  { id: "e4", order: "B2", name: "Walking Lunge", sets: 3, reps: "12", load: "20kg", completed: false },
  { id: "e5", order: "C1", name: "Leg Curl", sets: 3, reps: "12", load: "45kg", completed: false },
  { id: "e6", order: "C2", name: "Calf Raise", sets: 4, reps: "15", load: "60kg", completed: false },
];

const WEEKLY_COMPLIANCE = [
  { day: "Mon", value: 100 },
  { day: "Tue", value: 85 },
  { day: "Wed", value: 0 },
  { day: "Thu", value: 95 },
  { day: "Fri", value: 70 },
  { day: "Sat", value: 100 },
  { day: "Sun", value: 60 },
];

/* ── Helper: Percentage Calculator ───────────────────────────────── */
function calcPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function ClientDashboard() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  /* ═══════════════════════════════════════════════════════════════
     EDITABLE TARGETS STATE — Future-proof architecture
     All targets are dynamic state variables, not hardcoded.
     isTrainerEditOnly flag gates the edit UI for future client portal.
     ═══════════════════════════════════════════════════════════════ */
  const [isTrainerEditOnly] = useState(true); // Future: read from useAuth().isTrainer
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  // Steps
  const [stepsTarget, setStepsTarget] = useState(10000);
  const [stepsCurrent, setStepsCurrent] = useState(9245);

  // Macros
  const [macros, setMacros] = useState<MacroTarget>({
    protein: { current: 145, target: 180 },
    carbs: { current: 210, target: 250 },
    fats: { current: 55, target: 70 },
    calories: { current: 2150, target: 2600 },
  });

  // Recovery
  const [recovery, setRecovery] = useState<RecoveryMetrics>({
    sleep: { current: 7.5, target: 8, unit: "h" },
    quality: { current: 8, target: 10, unit: "/10" },
    hrv: { current: 62, target: 65, unit: "ms" },
  });

  // Hydration
  const [hydration, setHydration] = useState<HydrationLog>({ current: 1.8, target: 3.0 });

  // Workout checklist
  const [exercises, setExercises] = useState<WorkoutExercise[]>(MOCK_WORKOUT);

  // Weekly compliance (editable for demo)
  const [complianceData] = useState(WEEKLY_COMPLIANCE);

  /* ── Derived Values ────────────────────────────────────────────── */
  const stepsPct = calcPct(stepsCurrent, stepsTarget);
  const proteinPct = calcPct(macros.protein.current, macros.protein.target);
  const carbsPct = calcPct(macros.carbs.current, macros.carbs.target);
  const fatsPct = calcPct(macros.fats.current, macros.fats.target);
  const caloriesPct = calcPct(macros.calories.current, macros.calories.target);
  const sleepPct = calcPct(recovery.sleep.current, recovery.sleep.target);
  const qualityPct = calcPct(recovery.quality.current, recovery.quality.target);
  const hrvPct = calcPct(recovery.hrv.current, recovery.hrv.target);
  const hydrationPct = calcPct(hydration.current, hydration.target);

  const completedExercises = exercises.filter((e) => e.completed).length;
  const workoutProgress = calcPct(completedExercises, exercises.length);

  /* ── Handlers ──────────────────────────────────────────────────── */
  const toggleExercise = useCallback((id: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  }, []);

  const updateMacro = useCallback((
    key: keyof MacroTarget,
    field: "current" | "target",
    value: number
  ) => {
    setMacros((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }, []);

  const updateRecovery = useCallback((
    key: keyof RecoveryMetrics,
    field: "current" | "target",
    value: number
  ) => {
    setRecovery((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }, []);

  /* ── Mount Animation ───────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-20 lg:px-6 lg:pb-8">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight lg:text-3xl"
              style={{ color: "var(--page-text)" }}
            >
              My Dashboard
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--light-text-muted)" }}>
              Track your daily habits and progress
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 sm:mt-0">
            {/* Edit Targets Toggle — trainer-only shell */}
            {isTrainerEditOnly && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditingTargets((p) => !p)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all"
                style={{
                  backgroundColor: isEditingTargets
                    ? "rgba(13,148,136,0.15)"
                    : "var(--card-bg)",
                  borderColor: isEditingTargets
                    ? "var(--azfit-primary)"
                    : "var(--card-border)",
                  color: isEditingTargets
                    ? "var(--azfit-primary)"
                    : "var(--page-text)",
                }}
              >
                {isEditingTargets ? (
                  <>
                    <Save className="h-4 w-4" />
                    Done Editing
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Edit Targets
                    <Lock className="h-3 w-3 opacity-50" />
                  </>
                )}
              </motion.button>
            )}
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <Flame className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                12-day streak
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          TOP ROW: Activity Rings (Steps + Macros + Recovery)
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* Steps Ring */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Steps"
            titleIcon={<Footprints className="h-4 w-4" />}
            glass
            glow
            accentColor="#0D9488"
            hover
          >
            <div className="flex items-center justify-center py-4">
              <ProgressRing
                size={160}
                strokeWidth={12}
                percentage={stepsPct}
                color="#0D9488"
                gradientEndColor="#14B8A6"
                label="of goal"
                value={formatNumber(stepsCurrent)}
                subtitle={`Goal: ${formatNumber(stepsTarget)}`}
                glowClass="glow-teal"
                showPulse={stepsPct >= 100}
              />
            </div>

            {/* Edit Target Shell */}
            <AnimatePresence>
              {isEditingTargets && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t pt-3"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                        Current
                      </label>
                      <input
                        type="number"
                        value={stepsCurrent}
                        onChange={(e) => setStepsCurrent(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border bg-transparent px-2 py-1 text-sm font-mono outline-none focus:border-teal-500"
                        style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                        Target
                      </label>
                      <input
                        type="number"
                        value={stepsTarget}
                        onChange={(e) => setStepsTarget(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border bg-transparent px-2 py-1 text-sm font-mono outline-none focus:border-teal-500"
                        style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  4.2 km
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Distance
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  312
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Calories
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Macros Ring */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Macros"
            titleIcon={<Utensils className="h-4 w-4" />}
            glass
            glow
            accentColor="#06B6D4"
            hover
          >
            <div className="flex items-center justify-center py-4">
              <ProgressRing
                size={160}
                strokeWidth={12}
                percentage={caloriesPct}
                color="#06B6D4"
                gradientEndColor="#22D3EE"
                label="calories"
                value={`${formatNumber(macros.calories.current)}`}
                subtitle={`/ ${formatNumber(macros.calories.target)} kcal`}
                glowClass="glow-cyan"
              />
            </div>

            {/* Macro Breakdown */}
            <div className="grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              {[
                { key: "protein" as const, label: "Protein", color: "#0D9488", pct: proteinPct, current: macros.protein.current, target: macros.protein.target },
                { key: "carbs" as const, label: "Carbs", color: "#8B5CF6", pct: carbsPct, current: macros.carbs.current, target: macros.carbs.target },
                { key: "fats" as const, label: "Fats", color: "#F59E0B", pct: fatsPct, current: macros.fats.current, target: macros.fats.target },
              ].map((m) => (
                <div key={m.key} className="text-center">
                  <div className="relative mx-auto mb-1 h-10 w-10">
                    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-20" style={{ color: "var(--light-border)" }} />
                      <circle
                        cx="20" cy="20" r="16" fill="none" stroke={m.color} strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 16}
                        strokeDashoffset={2 * Math.PI * 16 - (m.pct / 100) * 2 * Math.PI * 16}
                        style={{ transition: "stroke-dashoffset 800ms ease" }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono" style={{ color: m.color }}>
                      {m.pct}%
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold" style={{ color: "var(--page-text)" }}>{m.label}</p>
                  <p className="text-[9px] font-mono" style={{ color: "var(--light-text-muted)" }}>
                    {m.current}/{m.target}g
                  </p>
                </div>
              ))}
            </div>

            {/* Edit Targets Shell */}
            <AnimatePresence>
              {isEditingTargets && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t pt-3 mt-3"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                    Edit Macro Targets
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["protein", "Protein"] as const,
                      ["carbs", "Carbs"] as const,
                      ["fats", "Fats"] as const,
                      ["calories", "Calories"] as const,
                    ]).map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[9px] font-medium uppercase" style={{ color: "var(--light-text-muted)" }}>
                          {label} Target
                        </label>
                        <input
                          type="number"
                          value={macros[key].target}
                          onChange={(e) => updateMacro(key, "target", Number(e.target.value))}
                          className="mt-0.5 w-full rounded-lg border bg-transparent px-2 py-1 text-xs font-mono outline-none focus:border-cyan-500"
                          style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </motion.div>

        {/* Recovery Ring */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Recovery"
            titleIcon={<Moon className="h-4 w-4" />}
            glass
            glow
            accentColor="#8B5CF6"
            hover
          >
            <div className="flex items-center justify-center py-4">
              <ProgressRing
                size={160}
                strokeWidth={12}
                percentage={qualityPct}
                color="#8B5CF6"
                gradientEndColor="#A78BFA"
                label="sleep quality"
                value={`${recovery.quality.current}`}
                subtitle={`/ ${recovery.quality.target} rating`}
                glowClass="glow-purple"
              />
            </div>

            {/* Recovery Breakdown */}
            <div className="grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              {[
                { label: "Sleep", value: `${recovery.sleep.current}h`, target: `${recovery.sleep.target}h`, pct: sleepPct, color: "#8B5CF6" },
                { label: "Quality", value: `${recovery.quality.current}/10`, target: `${recovery.quality.target}/10`, pct: qualityPct, color: "#A78BFA" },
                { label: "HRV", value: `${recovery.hrv.current}ms`, target: `${recovery.hrv.target}ms`, pct: hrvPct, color: "#22D3EE" },
              ].map((r) => (
                <div key={r.label} className="text-center">
                  <p className="text-sm font-semibold font-mono" style={{ color: r.color }}>{r.value}</p>
                  <p className="text-[9px]" style={{ color: "var(--light-text-muted)" }}>
                    Goal: {r.target}
                  </p>
                  <div className="mx-auto mt-1 h-1 w-12 overflow-hidden rounded-full bg-slate-700">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${r.pct}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      style={{ backgroundColor: r.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Targets Shell */}
            <AnimatePresence>
              {isEditingTargets && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t pt-3 mt-3"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                    Edit Recovery Targets
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["sleep", "Sleep (h)"] as const,
                      ["quality", "Quality (/10)"] as const,
                      ["hrv", "HRV (ms)"] as const,
                    ]).map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[9px] font-medium uppercase" style={{ color: "var(--light-text-muted)" }}>
                          {label}
                        </label>
                        <input
                          type="number"
                          step={key === "sleep" ? 0.5 : 1}
                          value={recovery[key].target}
                          onChange={(e) => updateRecovery(key, "target", Number(e.target.value))}
                          className="mt-0.5 w-full rounded-lg border bg-transparent px-2 py-1 text-xs font-mono outline-none focus:border-purple-500"
                          style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════
          MIDDLE ROW: Today's Workout + Nutrition Summary
          ═══════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Workout */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
        >
          <CollapsibleSection
            title="Today's Workout"
            icon={<Dumbbell className="h-4 w-4" />}
            defaultExpanded
            accentColor="#0D9488"
            badge={
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: workoutProgress === 100 ? "#84CC16" : "#0D9488" }}
              >
                {completedExercises}/{exercises.length}
              </span>
            }
            headerAction={
              <button
                onClick={() => navigate("/sheets")}
                className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--azfit-primary)" }}
              >
                Full Program
                <ChevronRight className="h-3 w-3" />
              </button>
            }
          >
            {/* Workout progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                  Progress
                </span>
                <span className="text-[11px] font-bold font-mono" style={{ color: "var(--azfit-primary)" }}>
                  {workoutProgress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${workoutProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    background: "linear-gradient(90deg, #0D9488, #14B8A6)",
                    boxShadow: workoutProgress > 0 ? "0 0 8px rgba(13,148,136,0.4)" : "none",
                  }}
                />
              </div>
            </div>

            {/* Exercise List */}
            <div className="space-y-2">
              {exercises.map((exercise, i) => (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`group flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                    exercise.completed ? "opacity-60" : "hover:-translate-y-0.5"
                  }`}
                  style={{
                    backgroundColor: exercise.completed
                      ? "rgba(13,148,136,0.05)"
                      : "var(--card-bg)",
                    borderColor: exercise.completed
                      ? "rgba(13,148,136,0.3)"
                      : "var(--card-border)",
                  }}
                  onClick={() => toggleExercise(exercise.id)}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      exercise.completed
                        ? "border-teal-500 bg-teal-500"
                        : "border-slate-500 hover:border-teal-400"
                    }`}
                  >
                    {exercise.completed && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>

                  {/* Exercise Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold font-mono"
                        style={{ color: "var(--azfit-primary)" }}
                      >
                        {exercise.order}
                      </span>
                      <p
                        className={`text-sm font-semibold truncate ${
                          exercise.completed ? "line-through" : ""
                        }`}
                        style={{ color: "var(--page-text)" }}
                      >
                        {exercise.name}
                      </p>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                      {exercise.sets} sets × {exercise.reps} @ {exercise.load}
                    </p>
                  </div>

                  {/* Status */}
                  {exercise.completed ? (
                    <span className="text-[10px] font-semibold" style={{ color: "#84CC16" }}>
                      Done
                    </span>
                  ) : (
                    <Circle className="h-4 w-4 opacity-30" style={{ color: "var(--light-text-muted)" }} />
                  )}
                </motion.div>
              ))}
            </div>
          </CollapsibleSection>
        </motion.div>

        {/* Nutrition Summary + Hydration */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Nutrition Summary */}
          <CollapsibleSection
            title="Nutrition Summary"
            icon={<Utensils className="h-4 w-4" />}
            defaultExpanded
            accentColor="#06B6D4"
            headerAction={
              <button
                onClick={() => navigate("/nutrition")}
                className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--azfit-secondary)" }}
              >
                Log Meal
                <ChevronRight className="h-3 w-3" />
              </button>
            }
          >
            <div className="space-y-4">
              {/* Calorie progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                    Calories
                  </span>
                  <span className="text-sm font-bold font-mono" style={{ color: "var(--azfit-secondary)" }}>
                    {formatNumber(macros.calories.current)} / {formatNumber(macros.calories.target)}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${caloriesPct}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{
                      background: "linear-gradient(90deg, #06B6D4, #22D3EE)",
                      boxShadow: "0 0 8px rgba(6,182,212,0.3)",
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {caloriesPct}% of daily target
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--light-text-muted)" }}>
                    {formatNumber(macros.calories.target - macros.calories.current)} left
                  </span>
                </div>
              </div>

              {/* Macro bars */}
              <div className="space-y-3">
                {[
                  { label: "Protein", current: macros.protein.current, target: macros.protein.target, color: "#0D9488", pct: proteinPct },
                  { label: "Carbs", current: macros.carbs.current, target: macros.carbs.target, color: "#8B5CF6", pct: carbsPct },
                  { label: "Fats", current: macros.fats.current, target: macros.fats.target, color: "#F59E0B", pct: fatsPct },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: "var(--page-text)" }}>
                        {m.label}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--light-text-muted)" }}>
                        {m.current}g / {m.target}g
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${m.pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        style={{ backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* Hydration Tracker */}
          <GlassCard
            title="Hydration"
            titleIcon={<GlassWater className="h-4 w-4" />}
            glass
            hover
            accentColor="#22D3EE"
          >
            <div className="flex items-center gap-4">
              {/* Water ring */}
              <div className="shrink-0">
                <ProgressRing
                  size={80}
                  strokeWidth={8}
                  percentage={hydrationPct}
                  color="#22D3EE"
                  label=""
                  value={`${hydration.current}L`}
                  subtitle={`/ ${hydration.target}L`}
                  animate={false}
                  glowClass="glow-cyan"
                />
              </div>

              {/* Quick add buttons */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                    Water Intake
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "var(--light-text-muted)" }}>
                    {hydrationPct}%
                  </span>
                </div>
                <div className="flex gap-2">
                  {[0.25, 0.5, 1.0].map((amount) => (
                    <button
                      key={amount}
                      onClick={() =>
                        setHydration((prev) => ({
                          ...prev,
                          current: Math.min(prev.current + amount, prev.target + 1),
                        }))
                      }
                      className="flex-1 rounded-lg border py-2 text-xs font-medium transition-all hover:-translate-y-0.5 active:scale-95"
                      style={{
                        backgroundColor: "rgba(34,211,238,0.08)",
                        borderColor: "rgba(34,211,238,0.2)",
                        color: "#22D3EE",
                      }}
                    >
                      +{amount}L
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM ROW: Weekly Compliance Chart
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-6"
      >
        <GlassCard
          title="Weekly Compliance"
          titleIcon={<TrendingUp className="h-4 w-4" />}
          glass
          hover
          accentColor="#84CC16"
        >
          <div className="py-4">
            {/* Bar chart */}
            <div className="flex items-end justify-between gap-2 h-40 px-2">
              {complianceData.map((day, i) => {
                const isToday = day.day === "Sat"; // Mock "today"
                return (
                  <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                    {/* Bar */}
                    <div className="relative w-full flex items-end justify-center" style={{ height: "120px" }}>
                      <motion.div
                        className="w-full max-w-[32px] rounded-t-lg"
                        initial={{ height: 0 }}
                        animate={{ height: `${day.value}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                        style={{
                          background: isToday
                            ? "linear-gradient(180deg, #0D9488, #14B8A6)"
                            : day.value >= 80
                              ? "linear-gradient(180deg, #84CC16, #65A30D)"
                              : day.value >= 50
                                ? "linear-gradient(180deg, #F59E0B, #D97706)"
                                : "linear-gradient(180deg, #64748B, #475569)",
                          boxShadow: isToday
                            ? "0 0 12px rgba(13,148,136,0.3)"
                            : day.value >= 80
                              ? "0 0 8px rgba(132,204,22,0.2)"
                              : "none",
                        }}
                      />
                      {/* Value label */}
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.08 }}
                        className="absolute -top-5 text-[10px] font-bold font-mono"
                        style={{
                          color: isToday ? "#0D9488" : "var(--page-text)",
                        }}
                      >
                        {day.value}%
                      </motion.span>
                    </div>
                    {/* Day label */}
                    <span
                      className={`text-[10px] font-medium ${isToday ? "font-bold" : ""}`}
                      style={{
                        color: isToday ? "var(--azfit-primary)" : "var(--light-text-muted)",
                      }}
                    >
                      {day.day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t pt-3" style={{ borderColor: "var(--card-border)" }}>
              {[
                { color: "#84CC16", label: "On Track (≥80%)" },
                { color: "#F59E0B", label: "At Risk (50-79%)" },
                { color: "#64748B", label: "Off Track (<50%)" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
