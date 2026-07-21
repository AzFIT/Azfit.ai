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

export async function getWeeklyVolume(clientId: string): Promise<number> {
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  startOfWeek.setDate(startOfWeek.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("workout_log_entries")
    .select("sets_completed, reps_per_set, weight_per_set")
    .eq("client_id", clientId)
    .gte("created_at", startOfWeek.toISOString());

  if (error || !data) return 0;

  return data.reduce((sum, entry) => {
    let entryVol = 0;
    for (let i = 0; i < entry.sets_completed; i++) {
      const reps = entry.reps_per_set[i] || 0;
      const weight = entry.weight_per_set[i] || 0;
      entryVol += reps * weight;
    }
    return sum + entryVol;
  }, 0);
}

export async function getNextSession(userId: string, role: "trainer" | "client"): Promise<DbSession | null> {
  const now = new Date().toISOString();
  let query = supabase.from("sessions").select("*").gte("starts_at", now).order("starts_at", { ascending: true }).limit(1);

  if (role === "trainer") {
    query = query.eq("trainer_id", userId);
  } else {
    const clientId = await resolveClientId(userId, ""); // email handled below
    if (clientId) {
      query = query.eq("client_id", clientId);
    } else {
      // Fallback: try to resolve email from profiles
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
      if (profile?.email) {
        const resolved = await resolveClientId(userId, profile.email);
        if (resolved) query = query.eq("client_id", resolved);
      }
    }
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;
  return data[0];
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

export async function getCheckInsDue(clientId: string): Promise<number> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find the trainer for this client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("trainer_id")
    .eq("id", clientId)
    .single();

  if (clientError || !client) return 0;

  const [{ data: forms }, { data: submissions }] = await Promise.all([
    supabase.from("check_in_forms").select("id").eq("trainer_id", client.trainer_id).eq("active", true),
    supabase
      .from("check_in_submissions")
      .select("form_id")
      .eq("client_id", clientId)
      .gte("submitted_at", sevenDaysAgo.toISOString()),
  ]);

  if (!forms || forms.length === 0) return 0;
  const submittedFormIds = new Set((submissions || []).map((s) => s.form_id));
  return forms.filter((f) => !submittedFormIds.has(f.id)).length;
}

export async function getHabitsToday(clientId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("*").eq("client_id", clientId).eq("active", true),
    supabase.from("habit_logs").select("*").eq("client_id", clientId).eq("log_date", today),
  ]);

  return (habits || []).map((habit) => {
    const log = (logs || []).find((l) => l.habit_id === habit.id);
    return { habit, done: log?.done ?? false };
  });
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

export async function getRecentWorkouts(clientId: string, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
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
