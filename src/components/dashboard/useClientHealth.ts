import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { ClientHealthItem, HealthStatus } from "@/components/dashboard/ClientHealthGrid";
import {
  fetchHealthData,
  computeAttentionCounts,
  daysBetween,
  type HealthRawData,
  type AttentionCounts,
} from "@/lib/clientHealthQueries";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

  const computeHealth = useCallback((data: HealthRawData): ClientHealthItem[] => {
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

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await fetchHealthData(user.id);
    if (data) {
      setClients(computeHealth(data));
      setCounts(computeAttentionCounts(data));
    }
    setLoading(false);
  }, [user, computeHealth]);

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

export type { AttentionCounts };
