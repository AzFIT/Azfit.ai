import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

export type DbClient = Database["public"]["Tables"]["clients"]["Row"];

export interface HealthRawData {
  clients: DbClient[];
  sessions: Database["public"]["Tables"]["sessions"]["Row"][];
  workoutLogs: Database["public"]["Tables"]["workout_logs"]["Row"][];
  activeForms: Database["public"]["Tables"]["check_in_forms"]["Row"][];
  submissions: Database["public"]["Tables"]["check_in_submissions"]["Row"][];
  unreadMessages: number;
}

export interface AttentionCounts {
  missedWorkouts: number;
  checkinsPending: number;
  unreadMessages: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function fetchHealthData(trainerId: string): Promise<HealthRawData | null> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const isoSevenDaysAgo = sevenDaysAgo.toISOString();
  const isoNow = now.toISOString();

  const [clientsResult, sessionsResult, workoutLogsResult, formsResult, submissionsResult, messagesResult] =
    await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("trainer_id", trainerId)
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      supabase
        .from("sessions")
        .select("*")
        .eq("trainer_id", trainerId)
        .gte("starts_at", isoSevenDaysAgo)
        .lte("starts_at", isoNow),
      supabase.from("workout_logs").select("*").gte("created_at", isoSevenDaysAgo),
      supabase.from("check_in_forms").select("*").eq("trainer_id", trainerId).eq("active", true),
      supabase.from("check_in_submissions").select("*").gte("submitted_at", isoSevenDaysAgo),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", trainerId)
        .is("read_at", null),
    ]);

  if (clientsResult.error) {
    console.error("Failed to load clients:", clientsResult.error.message);
    return null;
  }

  if (sessionsResult.error) console.error("Failed to load sessions:", sessionsResult.error.message);
  if (workoutLogsResult.error) console.error("Failed to load workout logs:", workoutLogsResult.error.message);
  if (formsResult.error) console.error("Failed to load check-in forms:", formsResult.error.message);
  if (submissionsResult.error) console.error("Failed to load submissions:", submissionsResult.error.message);
  if (messagesResult.error) console.error("Failed to load messages:", messagesResult.error.message);

  const activeForms = formsResult.data || [];
  const activeFormIds = activeForms.map((f) => f.id);
  const trainerSubmissions = (submissionsResult.data || []).filter((s) => activeFormIds.includes(s.form_id));

  return {
    clients: clientsResult.data || [],
    sessions: sessionsResult.data || [],
    workoutLogs: workoutLogsResult.data || [],
    activeForms,
    submissions: trainerSubmissions,
    unreadMessages: messagesResult.count || 0,
  };
}

export function computeAttentionCounts(data: HealthRawData): AttentionCounts {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const clientsWithMissedSessions = new Set(
    data.sessions
      .filter((s) => {
        const start = new Date(s.starts_at);
        return start >= sevenDaysAgo && start < now && !["completed", "cancelled"].includes(s.status);
      })
      .map((s) => s.client_id)
  );

  const pendingReview = data.submissions.filter((s) => s.reviewed_at === null).length;

  return {
    missedWorkouts: clientsWithMissedSessions.size,
    checkinsPending: pendingReview,
    unreadMessages: data.unreadMessages,
  };
}

export interface AtRiskClient {
  id: string;
  name: string;
  daysSinceWorkout: number;
  lastWorkoutDate: string | null;
}

export function getAtRiskClients(data: HealthRawData): AtRiskClient[] {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return data.clients
    .map((client) => {
      const clientWorkouts = data.workoutLogs
        .filter((w) => w.client_id === client.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const lastWorkout = clientWorkouts[0];
      const daysSince = lastWorkout ? daysBetween(new Date(lastWorkout.created_at), now) : Infinity;

      return {
        id: client.id,
        name: client.full_name,
        daysSinceWorkout: daysSince,
        lastWorkoutDate: lastWorkout ? lastWorkout.created_at : null,
      };
    })
    .filter((c) => c.daysSinceWorkout >= 7)
    .sort((a, b) => b.daysSinceWorkout - a.daysSinceWorkout);
}
