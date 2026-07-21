import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { ClientHealthItem, HealthStatus } from "./ClientHealthGrid";
import type { Database } from "@/types/supabase";

type DbClient = Database["public"]["Tables"]["clients"]["Row"];

export interface AttentionCounts {
  missedWorkouts: number;
  checkinsPending: number;
  unreadMessages: number;
}

interface RawData {
  clients: DbClient[];
  sessions: Database["public"]["Tables"]["sessions"]["Row"][];
  workoutLogs: Database["public"]["Tables"]["workout_logs"]["Row"][];
  activeForms: Database["public"]["Tables"]["check_in_forms"]["Row"][];
  submissions: Database["public"]["Tables"]["check_in_submissions"]["Row"][];
  unreadMessages: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function useClientHealth() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientHealthItem[]>([]);
  const [counts, setCounts] = useState<AttentionCounts>({
    missedWorkouts: 0,
    checkinsPending: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (): Promise<RawData | null> => {
    if (!user) return null;

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
          .eq("trainer_id", user.id)
          .neq("status", "archived")
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select("*")
          .eq("trainer_id", user.id)
          .gte("starts_at", isoSevenDaysAgo)
          .lte("starts_at", isoNow),
        supabase
          .from("workout_logs")
          .select("*")
          .gte("created_at", isoSevenDaysAgo),
        supabase.from("check_in_forms").select("*").eq("trainer_id", user.id).eq("active", true),
        supabase
          .from("check_in_submissions")
          .select("*")
          .gte("submitted_at", isoSevenDaysAgo),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", user.id).is("read_at", null),
      ]);

    if (clientsResult.error) {
      toast.error("Failed to load clients: " + clientsResult.error.message);
      return null;
    }
    if (sessionsResult.error) toast.error("Failed to load sessions: " + sessionsResult.error.message);
    if (workoutLogsResult.error) toast.error("Failed to load workout logs: " + workoutLogsResult.error.message);
    if (formsResult.error) toast.error("Failed to load check-in forms: " + formsResult.error.message);
    if (submissionsResult.error) toast.error("Failed to load submissions: " + submissionsResult.error.message);
    if (messagesResult.error) toast.error("Failed to load messages: " + messagesResult.error.message);

    const activeForms = formsResult.data || [];
    const activeFormIds = activeForms.map((f) => f.id);

    // Filter submissions to those for this trainer's active forms so the trainer hover
    // counts and attention counts are accurate and RLS-friendly.
    const trainerSubmissions = (submissionsResult.data || []).filter((s) => activeFormIds.includes(s.form_id));

    return {
      clients: clientsResult.data || [],
      sessions: sessionsResult.data || [],
      workoutLogs: workoutLogsResult.data || [],
      activeForms,
      submissions: trainerSubmissions,
      unreadMessages: messagesResult.count || 0,
    };
  }, [user]);

  const computeHealth = useCallback((data: RawData): ClientHealthItem[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourDaysAgo = new Date(now);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    return data.clients.map((client) => {
      const missedSessions = data.sessions.filter((s) => {
        if (s.client_id !== client.id) return false;
        const start = new Date(s.starts_at);
        return start >= sevenDaysAgo && start < now && !["completed", "cancelled"].includes(s.status);
      });

      const recentWorkouts = data.workoutLogs.filter((w) => {
        if (w.client_id !== client.id) return false;
        const created = new Date(w.created_at);
        return created >= sevenDaysAgo;
      });

      const recentSubmissions = data.submissions.filter((s) => s.client_id === client.id);

      const hasMissedSession = missedSessions.length > 0;
      const noWorkout7Days = recentWorkouts.length === 0;

      let status: HealthStatus = "on_track";
      let reason = "";

      if (hasMissedSession || noWorkout7Days) {
        status = "at_risk";
        if (hasMissedSession) {
          reason = `${missedSessions.length} missed`;
        } else {
          reason = "no workout 7d";
        }
      } else {
        const hasCheckInDue = data.activeForms.length > 0 && recentSubmissions.length === 0;
        const noWorkout4Days = !recentWorkouts.some((w) => new Date(w.created_at) >= fourDaysAgo);

        if (hasCheckInDue || noWorkout4Days) {
          status = "needs_attention";
          if (hasCheckInDue) {
            reason = "check-in due";
          } else {
            reason = "no workout 4d";
          }
        }
      }

      const lastWorkout = recentWorkouts
        .concat(data.workoutLogs.filter((w) => w.client_id === client.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const lastActiveDays = lastWorkout ? daysBetween(new Date(lastWorkout.created_at), now) : undefined;
      const checkInsDue = data.activeForms.length - recentSubmissions.length;

      return {
        id: client.id,
        name: client.full_name,
        initials: getInitials(client.full_name),
        status,
        missedSessions: missedSessions.length > 0 ? missedSessions.length : undefined,
        lastActiveDays,
        checkInsDue: checkInsDue > 0 ? checkInsDue : undefined,
        reason,
      };
    });
  }, []);

  const computeCounts = useCallback((data: RawData): AttentionCounts => {
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
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchData();
    if (data) {
      setClients(computeHealth(data));
      setCounts(computeCounts(data));
    }
    setLoading(false);
  }, [fetchData, computeHealth, computeCounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const hasAttention = useMemo(
    () => counts.missedWorkouts > 0 || counts.checkinsPending > 0 || counts.unreadMessages > 0,
    [counts]
  );

  return { clients, counts, loading, hasAttention, refresh };
}
