/* ═══════════════════════════════════════════════════════════════
   useInsights (Phase 83 Item 2) — data for the insights strip.
   Real queries only: sessions (2 weeks), habit logs + targets
   (2 weeks), daily plan items (last week), this week's check-in,
   and a 90-day activity window for the streak. RLS-safe — the
   client reads own rows only. All card math in src/lib/insights.ts.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDateKeyLocal } from "@/lib/utils";
import { habitSignalsForTargets } from "@/lib/dailyPlan";
import { computeInsights, computeStreaks, type InsightCard } from "@/lib/insights";
import { elapsedDaysThisWeek, weekStartMonday } from "@/lib/metricTiles";

interface LifestyleTargets {
  steps?: number | null;
  sleep_hours?: number | null;
  water_ml?: number | null;
}

const iso = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();

export function useInsights() {
  const { user } = useAuth();
  const [cards, setCards] = useState<InsightCard[] | null>(null);
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

        const today = new Date();
        const monday = weekStartMonday(today);
        const lastMonday = new Date(monday);
        lastMonday.setDate(lastMonday.getDate() - 7);
        const mondayKey = formatDateKeyLocal(monday);
        const lastMondayKey = formatDateKeyLocal(lastMonday);
        const ninetyAgoKey = formatDateKeyLocal(new Date(today.getTime() - 89 * 86400000));

        const orFilter = cid ? `client_id.eq.${user.id},client_record_id.eq.${cid}` : `client_id.eq.${user.id}`;

        const [sessRes, logsRes, habitsRes, targets, planRes, checkinRes, sess90Res, plan90Res, checkin90Res] = await Promise.all([
          // sessions: last 2 weeks
          supabase.from("sessions").select("status, starts_at").or(orFilter).gte("starts_at", iso(lastMondayKey)).neq("status", "cancelled"),
          // habit_logs: last 2 weeks
          cid ? supabase.from("habit_logs").select("habit_id, log_date, done").eq("client_id", cid).gte("log_date", lastMondayKey) : Promise.resolve({ data: [] }),
          cid ? supabase.from("habits").select("id, name, active").eq("client_id", cid).eq("active", true) : Promise.resolve({ data: [] }),
          Promise.resolve((clientRow as { lifestyle_targets: LifestyleTargets | null })?.lifestyle_targets ?? null),
          // daily_plan_items: LAST week only
          cid ? supabase.from("daily_plan_items").select("done").eq("client_id", cid).gte("plan_date", lastMondayKey).lt("plan_date", mondayKey) : Promise.resolve({ data: [] }),
          // check-in: this week
          cid ? supabase.from("check_in_submissions").select("id", { count: "exact", head: true }).eq("client_id", cid).gte("submitted_at", iso(mondayKey)) : Promise.resolve({ count: 0 }),
          // 90-day activity window for the streak
          supabase.from("sessions").select("starts_at").or(orFilter).eq("status", "completed").gte("starts_at", iso(ninetyAgoKey)),
          cid ? supabase.from("daily_plan_items").select("plan_date").eq("client_id", cid).eq("done", true).gte("plan_date", ninetyAgoKey) : Promise.resolve({ data: [] }),
          cid ? supabase.from("check_in_submissions").select("submitted_at").eq("client_id", cid).gte("submitted_at", iso(ninetyAgoKey)) : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;

        const sessions = (sessRes.data as { status: string; starts_at: string }[] | null) ?? [];
        const thisWeek = sessions.filter((s) => formatDateKeyLocal(new Date(s.starts_at)) >= mondayKey);
        const lastWeek = sessions.filter((s) => formatDateKeyLocal(new Date(s.starts_at)) < mondayKey);

        const logs = (logsRes.data as { habit_id: string; log_date: string; done: boolean }[] | null) ?? [];
        const habits = (habitsRes.data as { id: string; name: string; active: boolean }[] | null) ?? [];
        const habitNorm = habits.map((h) => ({ id: h.id, name: h.name, is_active: h.active }));
        const habitDaysFor = (from: string, to: string | null) => {
          const keys = [...new Set(logs.filter((l) => l.log_date >= from && (to === null || l.log_date < to)).map((l) => l.log_date))];
          let n = 0;
          for (const dk of keys) {
            const sig = habitSignalsForTargets(habitNorm, logs.filter((l) => l.log_date === dk));
            const t = targets as LifestyleTargets | null;
            const anySet = (t?.steps != null && sig.steps.available && sig.steps.done) ||
              (t?.sleep_hours != null && sig.sleep.available && sig.sleep.done) ||
              (t?.water_ml != null && sig.water.available && sig.water.done);
            if (anySet) n++;
          }
          return n;
        };

        const planRows = (planRes.data as { done: boolean }[] | null) ?? [];
        const activityDates = [
          ...logs.filter((l) => l.done).map((l) => l.log_date),
          ...((sess90Res.data as { starts_at: string }[] | null) ?? []).map((s) => formatDateKeyLocal(new Date(s.starts_at))),
          ...((plan90Res.data as { plan_date: string }[] | null) ?? []).map((p) => p.plan_date),
          ...((checkin90Res.data as { submitted_at: string }[] | null) ?? []).map((c) => formatDateKeyLocal(new Date(c.submitted_at))),
        ];
        const streaks = computeStreaks(activityDates, formatDateKeyLocal(today));

        setCards(
          computeInsights({
            sessionsCompletedThisWeek: thisWeek.filter((s) => s.status === "completed").length,
            sessionsCompletedLastWeek: lastWeek.filter((s) => s.status === "completed").length,
            sessionsScheduledThisWeek: thisWeek.length,
            sessionsScheduledLastWeek: lastWeek.length,
            currentStreak: streaks.currentStreak,
            longestStreak: streaks.longestStreak,
            planDoneLastWeek: planRows.filter((p) => p.done).length,
            planTotalLastWeek: planRows.length,
            checkinSubmittedThisWeek: (checkinRes.count ?? 0) > 0,
            dayOfWeek: elapsedDaysThisWeek(today),
            habitDaysThisWeek: habitDaysFor(mondayKey, null),
            habitDaysLastWeek: habitDaysFor(lastMondayKey, mondayKey),
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

  return { cards, loading, error };
}
