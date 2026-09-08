/* ═══════════════════════════════════════════════════════════════
   Phase 78 Item 3 — data layer for the client score hero.
   Four real sources, client reads own rows only (RLS):
     · sessions (client_record_id) — trailing 28d, completed vs
       non-cancelled
     · daily_plan_items — trailing 7d, done vs total
     · habit_logs + habits + clients.lifestyle_targets — trailing 7d,
       days-all-targets-met vs days-with-logs (reuses the Phase 67
       keyword signal matching)
     · check_in_submissions — trailing 28d count
   All math lives in src/lib/clientScore.ts (pure, unit-tested).
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDateKeyLocal } from "@/lib/utils";
import { habitSignalsForTargets } from "@/lib/dailyPlan";
import { computeClientScore, type ClientScoreResult } from "@/lib/clientScore";

interface LifestyleTargets {
  steps?: number | null;
  sleep_hours?: number | null;
  water_ml?: number | null;
}

const dayStartIso = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();

export function useClientScore() {
  const { user } = useAuth();
  const [result, setResult] = useState<ClientScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id || !user.email) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("id, lifestyle_targets")
          .eq("email", user.email)
          .maybeSingle();
        if (cancelled) return;
        const cid = (clientRow as { id: string; lifestyle_targets: LifestyleTargets | null } | null)?.id ?? null;
        if (!cid) {
          // no client record → no data anywhere → honest empty state
          setResult(computeClientScore({
            sessionsCompleted28d: 0, sessionsScheduled28d: 0,
            planDone7d: 0, planTotal7d: 0,
            habitDaysAllMet7d: 0, habitDaysWithLogs7d: 0,
            hasLifestyleTargets: false, checkinsSubmitted28d: 0,
          }));
          setLoading(false);
          return;
        }

        const todayKey = formatDateKeyLocal(new Date());
        const start7 = new Date(Date.now() - 6 * 86400000);
        const start28 = new Date(Date.now() - 27 * 86400000);
        const key7 = formatDateKeyLocal(start7);
        const iso28 = dayStartIso(formatDateKeyLocal(start28));

        const [sessionsRes, itemsRes, logsRes, habitsRes, subsRes] = await Promise.all([
          supabase
            .from("sessions")
            .select("status")
            .eq("client_record_id", cid)
            .gte("starts_at", iso28)
            .neq("status", "cancelled"),
          supabase
            .from("daily_plan_items")
            .select("done")
            .eq("client_id", cid)
            .gte("plan_date", key7)
            .lte("plan_date", todayKey),
          supabase
            .from("habit_logs")
            .select("habit_id, log_date, done")
            .eq("client_id", cid)
            .gte("log_date", key7)
            .lte("log_date", todayKey),
          supabase
            .from("habits")
            .select("id, name, active")
            .eq("client_id", cid)
            .eq("active", true),
          supabase
            .from("check_in_submissions")
            .select("id", { count: "exact", head: true })
            .eq("client_id", cid)
            .gte("submitted_at", iso28),
        ]);
        if (cancelled) return;

        const sessions = (sessionsRes.data as { status: string }[] | null) ?? [];
        const items = (itemsRes.data as { done: boolean }[] | null) ?? [];
        const logs = (logsRes.data as { habit_id: string; log_date: string; done: boolean }[] | null) ?? [];
        const habits = (habitsRes.data as { id: string; name: string; active: boolean }[] | null) ?? [];

        const targets = (clientRow as { lifestyle_targets: LifestyleTargets | null })?.lifestyle_targets ?? null;
        const setTargets = (["steps", "sleep_hours", "water_ml"] as const).filter(
          (k) => targets?.[k] != null,
        );
        const targetKeyMap = { steps: "steps", sleep_hours: "sleep", water_ml: "water" } as const;

        // Per day in the 7d window: did ALL set targets get met?
        // (a set target with no matching active habit is NOT met —
        //  consistent with the Phase 67 "auto" rule)
        const dayKeys = [...new Set(logs.map((l) => l.log_date))];
        let allMetDays = 0;
        for (const dk of dayKeys) {
          if (setTargets.length === 0) break;
          const signals = habitSignalsForTargets(
            habits.map((h) => ({ id: h.id, name: h.name, is_active: h.active })),
            logs.filter((l) => l.log_date === dk),
          );
          const allMet = setTargets.every((t) => {
            const sig = signals[targetKeyMap[t]];
            return sig.available && sig.done;
          });
          if (allMet) allMetDays++;
        }

        setResult(
          computeClientScore({
            sessionsCompleted28d: sessions.filter((s) => s.status === "completed").length,
            sessionsScheduled28d: sessions.length,
            planDone7d: items.filter((i) => i.done).length,
            planTotal7d: items.length,
            habitDaysAllMet7d: allMetDays,
            habitDaysWithLogs7d: dayKeys.length,
            hasLifestyleTargets: setTargets.length > 0,
            checkinsSubmitted28d: subsRes.count ?? 0,
          }),
        );
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { result, loading, error };
}
