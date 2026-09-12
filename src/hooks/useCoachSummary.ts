// ═══════════════════════════════════════════════════════════════
// useCoachSummary (Phase 90) — one batched fetch (4 range queries,
// no N+1) feeding the pure math in src/lib/coachSummary.ts:
//   · clients        (trainer's non-archived roster + emails)
//   · profiles       (auth ids for those emails → session ownership)
//   · sessions       (this + last week window, trainer-scoped)
//   · workout_logs   (completed_at in window — the brief's signal)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { localWeekWindow, type SummaryClient, type SummarySession, type CompletedLog } from "@/lib/coachSummary";

export interface CoachSummaryData {
  clients: SummaryClient[];
  sessions: SummarySession[];
  logs: CompletedLog[];
  loading: boolean;
  error: boolean;
}

export function useCoachSummary(): CoachSummaryData {
  const { user } = useAuth();
  const [data, setData] = useState<CoachSummaryData>({
    clients: [],
    sessions: [],
    logs: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const lastWeek = localWeekWindow(1);
      try {
        const [clientsRes, sessionsRes, logsRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id, full_name, status, email")
            .eq("trainer_id", user.id)
            .neq("status", "archived"),
          // Trainer-scoped, window-bounded; the pure lib splits this/last week.
          supabase
            .from("sessions")
            .select("client_id, client_record_id, status, starts_at")
            .eq("trainer_id", user.id)
            .gte("starts_at", lastWeek.start.toISOString()),
          // Same completed_at signal as the Coach AI brief (coachBrief.ts).
          supabase
            .from("workout_logs")
            .select("client_id, completed_at")
            .not("completed_at", "is", null)
            .gte("completed_at", lastWeek.start.toISOString()),
        ]);

        if (cancelled) return;
        if (clientsRes.error || sessionsRes.error || logsRes.error) throw new Error("query failed");

        const clientsRows = (clientsRes.data || []) as {
          id: string;
          full_name: string;
          status: string;
          email: string;
        }[];

        // Resolve auth profile ids by email (sessions.client_id keys on it;
        // account-less clients stay null and match via client_record_id).
        const emails = clientsRows.map((c) => c.email).filter(Boolean);
        let profileByEmail = new Map<string, string>();
        if (emails.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email")
            .in("email", emails);
          if (!cancelled && profiles) {
            profileByEmail = new Map(
              (profiles as { id: string; email: string }[]).map((p) => [p.email, p.id]),
            );
          }
        }
        if (cancelled) return;

        setData({
          clients: clientsRows.map((c) => ({
            id: c.id,
            fullName: c.full_name,
            status: c.status,
            profileId: profileByEmail.get(c.email) ?? null,
          })),
          sessions: (sessionsRes.data || []) as unknown as SummarySession[],
          logs: (logsRes.data || []) as unknown as CompletedLog[],
          loading: false,
          error: false,
        });
      } catch {
        if (!cancelled) setData((d) => ({ ...d, loading: false, error: true }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return data;
}
