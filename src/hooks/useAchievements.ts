/* ═══════════════════════════════════════════════════════════════
   useAchievements (Phase 87) — data for the client achievements
   grid. Reuses the Phase 86 useConsistencyMap 12-week fetch for
   the four activity sources (raw date arrays — no parallel query
   layer) and adds ONLY the two achievement-specific queries:
   · an all-time completed-session COUNT (First Steps is "first
     ever", not "first in 12 weeks")
   · 12-week habit_logs with values + the client's habits, for the
     numeric water habit (Hydration Hero — reuses the Phase 85
     numericHabits shapes)
   RLS-safe: client reads own rows only.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveClientIdentity } from "@/hooks/useViewAs";
import { formatDateKeyLocal } from "@/lib/utils";
import { useConsistencyMap } from "@/hooks/useConsistencyMap";
import { findNumericHabit, weekValues, type NumericLogLike } from "@/lib/numericHabits";
import { computeAchievements, type Achievement } from "@/lib/achievements";
import { newUnlocks, notifyNewAchievements } from "@/lib/achievementNotify";
import { clientScopeOr } from "@/lib/clientScope";

export function useAchievements() {
  const { user } = useAuth();
  // Phase 90e: shared resolver — the wrapped useConsistencyMap() also
  // resolves through it; here it feeds the achievement-only queries.
  const eff = useEffectiveClientIdentity();
  const { raw, loading: windowLoading, error: windowError } = useConsistencyMap();
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  // Phase 95: previously-unlocked id set (null = first observation).
  // Used to fire "Achievement Unlocked" pushes ONLY for genuinely new
  // unlocks — pre-existing unlocks never re-notify.
  const prevUnlockedRef = useRef<Set<string> | null>(null);

  // Derived (avoids set-state-in-effect): error if the shared window fetch
  // failed or our achievement queries failed; loading until both settle.
  const error = windowError || fetchError;
  const loading = windowLoading || (achievements === null && !error);

  useEffect(() => {
    if (windowLoading || windowError || !raw) return;
    if (!user?.id || !user.email) return;
    if (!eff.resolved) return;
    let cancelled = false;

    (async () => {
      setFetchError(false);
      try {
        const { startKey, todayKey } = raw;
        const cid = eff.clientId;
        // Account-less override target (no profiles row): clients.id
        // half only — never the signed-in trainer's profile id.
        const profileId =
          eff.isOverride && !eff.profileId ? null : (eff.profileId ?? user.id);
        // Fix Pack 2: defensive scope — a null cid used to interpolate
        // `client_record_id.eq.null` (400/22P02). Null scope = zero sessions.
        const sessionsOr = clientScopeOr(profileId, cid);
        const sessionsCount =
          sessionsOr === null
            ? Promise.resolve({ count: 0, data: null, error: null })
            : supabase
                .from("sessions")
                .select("id", { count: "exact", head: true })
                .or(sessionsOr)
                .eq("status", "completed");

        const [countRes, habitsRes, logsRes] = await Promise.all([
          sessionsCount,
          cid
            ? supabase.from("habits").select("id, name, active, target_value, unit").eq("client_id", cid).eq("active", true)
            : Promise.resolve({ data: [] }),
          cid
            ? supabase
                .from("habit_logs")
                .select("habit_id, log_date, done, value")
                .eq("client_id", cid)
                .gte("log_date", startKey)
                .lte("log_date", todayKey)
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;

        // Hydration Hero: numeric water habit, per Mon-start week values
        const habits = (habitsRes.data as { id: string; name: string; active: boolean; target_value: number | null; unit: string | null }[] | null) ?? [];
        const logs = (logsRes.data as { habit_id: string; log_date: string; done: boolean; value: number | null }[] | null) ?? [];
        const waterHabit = findNumericHabit(habits, "water");
        let waterWeeks: { weekStartKey: string; values: (number | null)[] }[] | null = null;
        let waterTarget: number | null = null;
        if (waterHabit && waterHabit.target_value != null) {
          waterTarget = waterHabit.target_value;
          const start = new Date(`${startKey}T00:00:00`);
          const today = new Date(`${todayKey}T00:00:00`);
          waterWeeks = [];
          for (let w = 0; w < 12; w++) {
            const monday = new Date(start);
            monday.setDate(start.getDate() + w * 7);
            if (monday > today) break;
            const weekEnd = new Date(monday);
            weekEnd.setDate(monday.getDate() + 6);
            const end = weekEnd > today ? today : weekEnd;
            const mk = (d: Date) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            waterWeeks.push({
              weekStartKey: mk(monday),
              values: weekValues(logs as NumericLogLike[], waterHabit.id, mk(monday), mk(end)),
            });
          }
        }

        if (!cancelled) setAchievements(
          computeAchievements({
            todayKey: formatDateKeyLocal(new Date()),
            completedSessionsAllTime: countRes.count ?? 0,
            sessionDates: raw.sessionDates,
            planItems: raw.planItems,
            habitDates: raw.habitDates,
            checkinDates: raw.checkinDates,
            waterWeeks,
            waterTarget,
          }),
        );
      } catch {
        if (!cancelled) setFetchError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, eff.resolved, eff.isOverride, eff.clientId, eff.profileId, windowLoading, windowError, raw]);

  // Phase 95 — app-fired achievement pushes. NOT under a 90e view-as
  // override (the trainer viewing a client must never fire the CLIENT's
  // push), and only for unlocks that are new since the last observation.
  useEffect(() => {
    if (!achievements) return;
    const unlockedIds = new Set(
      achievements.filter((a) => a.unlocked).map((a) => a.id),
    );
    if (eff.isOverride || !user?.id) {
      // Never notify from a 90e override; reset the baseline so the
      // first own-data observation after leaving it is silent (adopting
      // the target's set here would false-fire "new unlocks").
      prevUnlockedRef.current = null;
      return;
    }
    const fresh = newUnlocks(prevUnlockedRef.current, achievements);
    prevUnlockedRef.current = unlockedIds;
    if (fresh.length > 0) void notifyNewAchievements(user.id, fresh);
  }, [achievements, user?.id, eff.isOverride]);

  return { achievements, loading, error };
}
