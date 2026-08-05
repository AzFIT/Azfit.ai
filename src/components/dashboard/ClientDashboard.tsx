import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Footprints,
  Moon,
  Flame,
  ChevronRight,
  Check,
  Circle,
  Utensils,
  TrendingUp,
  Dumbbell,
  Bell,
  MessageSquare,
  CalendarDays,
  CalendarPlus,
  Play,
  Plus,
  BedDouble,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { supabase } from "@/lib/supabase";
import { codeFromOrderIndex } from "@/lib/aiProgramMapper";
import { useHabits, last7Days, isDoneOnDate } from "@/components/checkins/useHabits";
import HabitRow from "@/components/checkins/HabitRow";
import { generateICS, downloadICS, icsFilename } from "@/lib/ics";
import { getDayTotals, getNutritionTargets } from "@/lib/foodApi";
import { WorkoutLauncher } from "@/components/WorkoutLauncher";
import { GlassCard } from "./shared/GlassCard";
import { ProgressRing } from "./shared/ProgressRing";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import TodaysMealsCard from "./TodaysMealsCard";

/* ═══════════════════════════════════════════════════════════════════
   Client Dashboard — Restructured (Phase 1)
   Answers: "What do I need to do today?"
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

/* ── Phase 33B: mock data removed — today's workout, weekly compliance,
      coach identity, check-in due and unread counts are all computed from
      real Supabase queries in the effects below. ── */

/* ── Helper: Percentage Calculator ───────────────────────────────── */
function calcPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function ClientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nextUpcomingSession, loading: sessionsLoading } = useSessions();
  const [mounted, setMounted] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);

  const firstName = user?.full_name?.split(" ")[0] || "Alex";

  // Real next session
  const nextSession = nextUpcomingSession();

  // Steps
  const [stepsTarget] = useState(10000);
  const [stepsCurrent] = useState(9245);

  // Macros — live from nutrition_logs + nutrition_targets
  const [macros, setMacros] = useState<MacroTarget>({
    protein: { current: 0, target: 150 },
    carbs: { current: 0, target: 200 },
    fats: { current: 0, target: 70 },
    calories: { current: 0, target: 2000 },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const [totals, targets] = await Promise.all([
        getDayTotals(todayStr),
        getNutritionTargets(),
      ]);
      if (cancelled) return;
      setMacros({
        protein: { current: totals.protein, target: targets.protein },
        carbs: { current: totals.carbs, target: targets.carbs },
        fats: { current: totals.fats, target: targets.fats },
        calories: { current: totals.calories, target: targets.calories },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recovery
  const [recovery] = useState<RecoveryMetrics>({
    sleep: { current: 7.5, target: 8, unit: "h" },
    quality: { current: 8, target: 10, unit: "/10" },
    hrv: { current: 62, target: 65, unit: "ms" },
  });

  // Hydration
  const [hydration, setHydration] = useState<HydrationLog>({ current: 1.8, target: 3.0 });

  // Workout checklist (Phase 33B — real program day for today)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [clientsId, setClientsId] = useState<string | null>(null); // Phase 43: Today's Meals card
  const [workoutName, setWorkoutName] = useState<string | null>(null);
  const [workoutLoading, setWorkoutLoading] = useState(true);

  // Weekly compliance (Phase 33B — computed from real sessions:
  // a day scores 100 when at least one session was completed that day)
  const [complianceData, setComplianceData] = useState<{ day: string; value: number }[]>([]);

  // Phase 33B — real coach identity / check-in due / unread count
  const [coachName, setCoachName] = useState<string | null>(null);
  const [checkinDue, setCheckinDue] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Habits
  const { habits, logs, loading: habitsLoading, toggleToday } = useHabits({ role: "client" });
  const today = last7Days()[6];

  // Phase 33B data effect: today's workout, coach, check-in due, unread count
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id, trainer_id")
        .eq("email", user.email)
        .maybeSingle();

      // Unread notifications (real count)
      const { count: unread } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      let todays: WorkoutExercise[] = [];
      let wName: string | null = null;
      let coach: string | null = null;
      let due = false;

      if (clientRow) {
        // Today's program workout (active program, today's weekday, Mon=1..Sun=7)
        const todayIdx = ((new Date().getDay() + 6) % 7) + 1;
        const { data: prog } = await supabase
          .from("programs")
          .select("id")
          .eq("client_id", clientRow.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prog) {
          const { data: w } = await supabase
            .from("workouts")
            .select("id, name")
            .eq("program_id", prog.id)
            .eq("day_of_week", todayIdx)
            .maybeSingle();
          if (w) {
            wName = w.name;
            const { data: exs } = await supabase
              .from("exercises")
              .select("id, name, sets, reps, weight_kg, order_index")
              .eq("workout_id", w.id)
              .order("order_index");
            todays = (exs || []).map((e) => ({
              id: e.id,
              order: codeFromOrderIndex(e.order_index),
              name: e.name,
              sets: e.sets ?? 0,
              reps: e.reps ?? "",
              load: e.weight_kg != null ? `${e.weight_kg}kg` : "",
              completed: false,
            }));
          }
        }

        // Real coach name via the SECURITY DEFINER helper (Phase 28A)
        if (clientRow.trainer_id) {
          const { data: name } = await supabase.rpc("get_trainer_display_name", { p_trainer_id: clientRow.trainer_id });
          coach = typeof name === "string" && name ? name : null;
        }

        // Check-in due: trainer has an active form AND I haven't submitted in 7 days.
        // Phase 44: submissions.client_id is the CLIENTS id — the 33B query
        // compared it to user.id (profile id), so the badge could never clear.
        const { count: activeForms } = await supabase
          .from("check_in_forms")
          .select("id", { count: "exact", head: true })
          .eq("trainer_id", clientRow.trainer_id)
          .eq("active", true);
        if ((activeForms ?? 0) > 0) {
          const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
          const { count: recentSubs } = await supabase
            .from("check_in_submissions")
            .select("id", { count: "exact", head: true })
            .eq("client_id", clientRow.id)
            .gte("submitted_at", weekAgo);
          due = (recentSubs ?? 0) === 0;
        }
      }

      if (!cancelled) {
        setExercises(todays);
        setWorkoutName(wName);
        setCoachName(coach);
        setCheckinDue(due);
        setUnreadNotifications(unread ?? 0);
        setClientsId(clientRow?.id ?? null);
        setWorkoutLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Phase 33B — weekly compliance from the client's real sessions this week
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const dayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const weekEnd = new Date(monday);
      weekEnd.setDate(monday.getDate() + 7);
      const { data } = await supabase
        .from("sessions")
        .select("starts_at, status")
        .eq("client_id", user.id)
        .gte("starts_at", dayKey(monday) + "T00:00:00")
        .lt("starts_at", dayKey(weekEnd) + "T00:00:00");
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const out = days.map((day, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = dayKey(d);
        const daySessions = (data || []).filter((s) => (s.starts_at || "").slice(0, 10) === key);
        return { day, value: daySessions.some((s) => s.status === "completed") ? 100 : 0 };
      });
      if (!cancelled) setComplianceData(out);
    })();
    return () => { cancelled = true; };
  }, [user]);

  /* ── Derived Values ────────────────────────────────────────────── */
  const stepsPct = calcPct(stepsCurrent, stepsTarget);
  const proteinPct = calcPct(macros.protein.current, macros.protein.target);
  const carbsPct = calcPct(macros.carbs.current, macros.carbs.target);
  const fatsPct = calcPct(macros.fats.current, macros.fats.target);
  const caloriesPct = calcPct(macros.calories.current, macros.calories.target);
  const sleepPct = calcPct(recovery.sleep.current, recovery.sleep.target);
  const qualityPct = calcPct(recovery.quality.current, recovery.quality.target);
  const hrvPct = calcPct(recovery.hrv.current, recovery.hrv.target);

  const completedExercises = exercises.filter((e) => e.completed).length;
  const workoutProgress = calcPct(completedExercises, exercises.length);

  /* ── Handlers ──────────────────────────────────────────────────── */
  const toggleExercise = useCallback((id: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  }, []);

  const addWater = useCallback((amount: number) => {
    setHydration((prev) => ({
      ...prev,
      current: Math.min(prev.current + amount, prev.target + 1),
    }));
  }, []);

  const handleAddSessionToCalendar = () => {
    if (!nextSession) return;
    const ics = generateICS({
      id: nextSession.id,
      title: nextSession.title,
      startsAt: nextSession.startsAt,
      endsAt: nextSession.endsAt,
      location: nextSession.location,
      notes: nextSession.notes,
    });
    downloadICS(ics, icsFilename(nextSession.startsAt));
  };

  /* ── Mount Animation ───────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-20 lg:px-6 lg:pb-8">
      {/* ═══════════════════════════════════════════════════════════
          HEADER: Greeting + Streak + Notification Bell
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
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--light-text-muted)" }}>
              Here&apos;s what you need to do today
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 sm:mt-0">
            {/* Notification Bell */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/notifications")}
              className="relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--page-text)",
              }}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: "#F87171" }}
                >
                  {unreadNotifications}
                </span>
              )}
            </motion.button>
            {/* Streak */}
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
          YOUR COACH CARD
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <GlassCard
          glass
          hover
          accentColor="#0D9488"
          className="!p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Coach Info (real trainer, Phase 33B) */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ border: "2px solid var(--card-border)", background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
                >
                  {(coachName || "?")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0].toUpperCase())
                    .join("")}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
                  Your Coach
                </p>
                <p className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
                  {coachName ?? "No coach assigned yet"}
                </p>
              </div>
            </div>

            {/* Next Session */}
            {sessionsLoading ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 animate-pulse"
                style={{
                  backgroundColor: "rgba(13,148,136,0.06)",
                  borderColor: "rgba(13,148,136,0.2)",
                }}
              >
                <div className="h-4 w-4 rounded-full bg-slate-700" />
                <div className="space-y-1">
                  <div className="h-3 w-16 rounded bg-slate-700" />
                  <div className="h-4 w-40 rounded bg-slate-700" />
                </div>
              </div>
            ) : nextSession ? (
              <button
                onClick={() => navigate("/schedule")}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: "rgba(13,148,136,0.06)",
                  borderColor: "rgba(13,148,136,0.2)",
                }}
              >
                <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--azfit-primary)" }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                    Next session
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--azfit-primary)" }}>
                    {new Date(nextSession.startsAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} {" "}
                    {new Date(nextSession.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {nextSession.title}
                  </p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => navigate("/schedule")}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: "rgba(13,148,136,0.06)",
                  borderColor: "rgba(13,148,136,0.2)",
                }}
              >
                <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--azfit-primary)" }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                    Next session
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--azfit-primary)" }}>
                    No upcoming session — book one
                  </p>
                </div>
              </button>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/messages")}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--azfit-primary)" }}
              >
                <MessageSquare className="h-4 w-4" />
                Message
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/schedule")}
                className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--page-text)",
                }}
              >
                <CalendarDays className="h-4 w-4" />
                Book Session
              </motion.button>
              {nextSession && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddSessionToCalendar}
                  className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    color: "var(--page-text)",
                  }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Add to Calendar
                </motion.button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          TODAY'S WORKOUT CARD
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <CollapsibleSection
          title={workoutName ? `Today's Workout — ${workoutName}` : "Today's Workout"}
          icon={<Dumbbell className="h-4 w-4" />}
          defaultExpanded
          accentColor="#0D9488"
          badge={
            exercises.length > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: workoutProgress === 100 ? "#84CC16" : "#0D9488" }}
              >
                {completedExercises}/{exercises.length}
              </span>
            ) : undefined
          }
          headerAction={
            <button
              onClick={() => setLauncherOpen(true)}
              className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--azfit-primary)" }}
            >
              Full Program
              <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          {/* Start Workout Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setLauncherOpen(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: "var(--azfit-primary)" }}
          >
            <Play className="h-4 w-4" />
            Start Workout
          </motion.button>

          {/* Honest states (Phase 33B): loading / nothing scheduled / real list */}
          {workoutLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0D9488] border-t-transparent" />
            </div>
          ) : exercises.length === 0 ? (
            <p className="py-3 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
              Nothing scheduled today — enjoy the calm.
            </p>
          ) : (
            <>
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
            </>
          )}
        </CollapsibleSection>
      </motion.div>

      {/* TODAY'S MEALS (Phase 43, Item 6) — saved plan day for today's weekday */}
      {clientsId && <TodaysMealsCard clientId={clientsId} />}

      {/* ═══════════════════════════════════════════════════════════
          CHECK-IN DUE CARD (conditional)
          ═══════════════════════════════════════════════════════════ */}
      {checkinDue && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          className="mb-6"
        >
          <GlassCard
            glass
            hover
            accentColor="#F87171"
            className="!p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "#F87171" }}>
                  Check-in Due
                </p>
                <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
                  Your weekly progress check-in is ready. Keep your coach in the loop!
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/check-ins")}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white shrink-0"
                style={{ backgroundColor: "#F87171" }}
              >
                Complete Now
              </motion.button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ACTIVITY RINGS ROW (Steps + Macros + Recovery)
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6"
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
            onClick={() => navigate("/analytics")}
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
            onClick={() => navigate("/nutrition")}
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
            onClick={() => navigate("/deload")}
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
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════
          QUICK LOG ROW
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <GlassCard glass hover accentColor="#84CC16" className="!p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Water */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-center" style={{ color: "var(--light-text-muted)" }}>
                Water
              </p>
              <div className="flex gap-1">
                {[0.25, 0.5, 1.0].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => addWater(amount)}
                    className="flex-1 rounded-lg border py-2 text-[10px] font-medium transition-all hover:-translate-y-0.5 active:scale-95"
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
              <p className="text-center text-[10px] font-mono" style={{ color: "var(--light-text-muted)" }}>
                {hydration.current.toFixed(1)} / {hydration.target}L
              </p>
            </div>

            {/* Meal */}
            <button
              onClick={() => navigate("/nutrition")}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border py-3 transition-all hover:-translate-y-0.5 active:scale-95"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <Plus className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--page-text)" }}>Meal</span>
            </button>

            {/* Sleep */}
            <button
              onClick={() => navigate("/workouts")}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border py-3 transition-all hover:-translate-y-0.5 active:scale-95"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <BedDouble className="h-4 w-4" style={{ color: "#8B5CF6" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--page-text)" }}>Sleep</span>
            </button>

            {/* Weight */}
            <button
              onClick={() => navigate("/workouts")}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border py-3 transition-all hover:-translate-y-0.5 active:scale-95"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <Scale className="h-4 w-4" style={{ color: "#F59E0B" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--page-text)" }}>Weight</span>
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          TODAY'S HABITS CARD
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <GlassCard
          title="Today's Habits"
          titleIcon={<Footprints className="h-4 w-4" />}
          glass
          hover
          accentColor="#0D9488"
          className="!p-4"
        >
          {habitsLoading ? (
            <div className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--card-bg)" }} />
          ) : habits.length === 0 ? (
            <p className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>
              No habits assigned yet.
            </p>
          ) : (
            <div className="space-y-3">
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  logs={logs}
                  isTodayDone={isDoneOnDate(logs, habit.id, today)}
                  onToggle={(done) => toggleToday(habit.id, done)}
                />
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          WEEKLY COMPLIANCE CHART
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.3, duration: 0.5 }}
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
                const isToday = day.day === ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
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

      <WorkoutLauncher isOpen={launcherOpen} onClose={() => setLauncherOpen(false)} />
    </div>
  );
}
