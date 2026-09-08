/* ═══════════════════════════════════════════════════════════════
   useMetricTiles (Phase 82) — data for the 2×2 metric tile grid.
   Documented choice: a SEPARATE small hook rather than extending
   useClientScore — the windows differ (Mon-start week vs 28d/7d
   trailing) and the tiles need per-day done flags the score hook
   never fetches; sharing would add queries rather than save them.
   RLS-safe: client reads own rows only.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDateKeyLocal } from "@/lib/utils";
import { habitSignalsForTargets } from "@/lib/dailyPlan";
import {
  computeMetricTiles,
  elapsedDaysThisWeek,
  weekStartMonday,
  type MetricTile,
} from "@/lib/metricTiles";

interface LifestyleTargets {
  steps?: number | null;
  sleep_hours?: number | null;
  water_ml?: number | null;
}

export function useMetricTiles() {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<MetricTile[] | null>(null);
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

        const monday = weekStartMonday();
        const mondayKey = formatDateKeyLocal(monday);
        const todayKey = formatDateKeyLocal(new Date());
        const mondayIso = new Date(`${mondayKey}T00:00:00`).toISOString();
        const tomorrowIso = new Date(new Date(`${todayKey}T00:00:00`).getTime() + 86400000).toISOString();

        const [sessionsRes, logsRes, habitsRes, subsRes] = await Promise.all([
          cid
            ? supabase
                .from("sessions")
                .select("status")
                .or(`client_id.eq.${user.id},client_record_id.eq.${cid}`)
                .gte("starts_at", mondayIso)
                .lt("starts_at", tomorrowIso)
                .neq("status", "cancelled")
            : Promise.resolve({ data: [] }),
          cid
            ? supabase
                .from("habit_logs")
                .select("habit_id, log_date, done")
                .eq("client_id", cid)
                .gte("log_date", mondayKey)
                .lte("log_date", todayKey)
            : Promise.resolve({ data: [] }),
          cid
            ? supabase.from("habits").select("id, name, active").eq("client_id", cid).eq("active", true)
            : Promise.resolve({ data: [] }),
          cid
            ? supabase
                .from("check_in_submissions")
                .select("id", { count: "exact", head: true })
                .eq("client_id", cid)
                .gte("submitted_at", mondayIso)
            : Promise.resolve({ count: 0 }),
        ]);
        if (cancelled) return;

        const sessions = (sessionsRes.data as { status: string }[] | null) ?? [];
        const logs = (logsRes.data as { habit_id: string; log_date: string; done: boolean }[] | null) ?? [];
        const habits = (habitsRes.data as { id: string; name: string; active: boolean }[] | null) ?? [];
        const targets = (clientRow as { lifestyle_targets: LifestyleTargets | null })?.lifestyle_targets ?? null;

        const dayKeys = [...new Set(logs.map((l) => l.log_date))];
        let sleepDoneDays = 0;
        let waterDoneDays = 0;
        for (const dk of dayKeys) {
          const sig = habitSignalsForTargets(
            habits.map((h) => ({ id: h.id, name: h.name, is_active: h.active })),
            logs.filter((l) => l.log_date === dk),
          );
          if (sig.sleep.available && sig.sleep.done) sleepDoneDays++;
          if (sig.water.available && sig.water.done) waterDoneDays++;
        }

        setTiles(
          computeMetricTiles({
            sessionsScheduled: sessions.length,
            sessionsCompleted: sessions.filter((s) => s.status === "completed").length,
            elapsedDays: elapsedDaysThisWeek(),
            sleepTargetSet: targets?.sleep_hours != null,
            waterTargetSet: targets?.water_ml != null,
            sleepDoneDays,
            waterDoneDays,
            checkinSubmitted: (subsRes.count ?? 0) > 0,
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

  return { tiles, loading, error };
}
