import { supabase } from "@/lib/supabase";
import { fetchHealthData, getAtRiskClients, daysBetween } from "@/lib/clientHealthQueries";
import type { Database } from "@/types/supabase";

export type DbWorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
export type DbSession = Database["public"]["Tables"]["sessions"]["Row"];
export type DbBodyComposition = Database["public"]["Tables"]["body_composition"]["Row"];

export async function resolveClientId(_userId: string, email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function getTrainerClients(trainerId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .eq("trainer_id", trainerId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTrainerClients error:", error.message);
    return [];
  }
  return data || [];
}

export async function getLastWorkout(clientId: string): Promise<DbWorkoutLog | null> {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getUnreadMessages(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .is("read_at", null);

  if (error) return 0;
  return count || 0;
}

export async function getLatestBodyComp(clientId: string): Promise<DbBodyComposition | null> {
  const { data, error } = await supabase
    .from("body_composition")
    .select("*")
    .eq("client_id", clientId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

export interface TrainerAttentionSummary {
  atRiskClients: { id: string; name: string; daysSinceWorkout: number; lastWorkoutDate: string | null }[];
  checkinsPending: number;
  unreadMessages: number;
}

export async function getTrainerAttention(trainerId: string): Promise<TrainerAttentionSummary> {
  const data = await fetchHealthData(trainerId);
  if (!data) {
    return { atRiskClients: [], checkinsPending: 0, unreadMessages: 0 };
  }

  const counts = {
    missedWorkouts: 0,
    checkinsPending: 0,
    unreadMessages: 0,
  };

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  counts.missedWorkouts = new Set(
    data.sessions
      .filter((s) => {
        const start = new Date(s.starts_at);
        return start >= sevenDaysAgo && start < now && !["completed", "cancelled"].includes(s.status);
      })
      .map((s) => s.client_id)
  ).size;

  counts.checkinsPending = data.submissions.filter((s) => s.reviewed_at === null).length;
  counts.unreadMessages = data.unreadMessages;

  return {
    atRiskClients: getAtRiskClients(data),
    checkinsPending: counts.checkinsPending,
    unreadMessages: counts.unreadMessages,
  };
}

export interface OneRepMaxEntry {
  exerciseName: string;
  weight: number;
  reps: number;
  estOneRepMax: number;
  date: string;
}

export async function getLatestOneRepMaxPRs(clientId: string): Promise<OneRepMaxEntry[]> {
  const { data, error } = await supabase
    .from("workout_log_entries")
    .select("exercise_name, reps_per_set, weight_per_set, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  const prs = new Map<string, OneRepMaxEntry>();

  for (const entry of data) {
    for (let i = 0; i < entry.reps_per_set.length; i++) {
      const reps = entry.reps_per_set[i];
      const weight = entry.weight_per_set[i];
      if (!reps || !weight || reps <= 0 || weight <= 0) continue;
      const est = weight * (1 + reps / 30);
      const existing = prs.get(entry.exercise_name);
      if (!existing || est > existing.estOneRepMax) {
        prs.set(entry.exercise_name, {
          exerciseName: entry.exercise_name,
          weight,
          reps,
          estOneRepMax: est,
          date: entry.created_at,
        });
      }
    }
  }

  return Array.from(prs.values()).sort((a, b) => b.estOneRepMax - a.estOneRepMax);
}

export interface SessionCompliance {
  completed: number;
  scheduled: number;
  rate: number;
}

export async function getSessionCompliance(clientId: string, weeks = 4): Promise<SessionCompliance> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from("sessions")
    .select("status")
    .eq("client_id", clientId)
    .gte("starts_at", since.toISOString());

  if (error || !data) return { completed: 0, scheduled: 0, rate: 0 };

  const scheduled = data.length;
  const completed = data.filter((s) => s.status === "completed").length;
  return {
    completed,
    scheduled,
    rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
  };
}

export async function getActiveHabits(clientId: string) {
  const { data, error } = await supabase
    .from("habits")
    .select("id, name, target_frequency")
    .eq("client_id", clientId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getActiveHabits error:", error.message);
    return [];
  }
  return data || [];
}

export async function upsertHabitLog(habitId: string, clientId: string, done: boolean) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("habit_logs")
    .upsert(
      { habit_id: habitId, client_id: clientId, log_date: today, done },
      { onConflict: "habit_id,log_date" }
    );
  if (error) throw error;
}

export async function getHabitStreak(habitId: string, clientId: string): Promise<number> {
  const today = new Date();
  const logs: { log_date: string; done: boolean }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("habit_logs")
      .select("log_date, done")
      .eq("habit_id", habitId)
      .eq("client_id", clientId)
      .eq("log_date", dateStr)
      .single();
    if (error || !data) break;
    if (!data.done) break;
    logs.push(data);
  }
  return logs.length;
}

export async function insertBodyComposition(
  clientId: string,
  values: { weight_kg?: number; body_fat_percentage?: number }
) {
  const { error } = await supabase.from("body_composition").insert({
    client_id: clientId,
    weight_kg: values.weight_kg ?? null,
    body_fat_percentage: values.body_fat_percentage ?? null,
  });
  if (error) throw error;
}

export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export async function getLastWorkoutVolumeTrend(clientId: string): Promise<{ current: number; previous: number } | null> {
  const now = new Date();
  const thisWeekStart = new Date(now);
  const day = thisWeekStart.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  thisWeekStart.setDate(thisWeekStart.getDate() + diff);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);

  const [currentRes, previousRes] = await Promise.all([
    supabase
      .from("workout_log_entries")
      .select("sets_completed, reps_per_set, weight_per_set")
      .eq("client_id", clientId)
      .gte("created_at", thisWeekStart.toISOString()),
    supabase
      .from("workout_log_entries")
      .select("sets_completed, reps_per_set, weight_per_set")
      .eq("client_id", clientId)
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", lastWeekEnd.toISOString()),
  ]);

  const sumVolume = (entries: typeof currentRes.data) =>
    (entries || []).reduce((sum, entry) => {
      let vol = 0;
      for (let i = 0; i < entry.sets_completed; i++) {
        vol += (entry.reps_per_set[i] || 0) * (entry.weight_per_set[i] || 0);
      }
      return sum + vol;
    }, 0);

  const current = sumVolume(currentRes.data);
  const previous = sumVolume(previousRes.data);

  if (current === 0 && previous === 0) return null;
  return { current, previous };
}

export { daysBetween };
