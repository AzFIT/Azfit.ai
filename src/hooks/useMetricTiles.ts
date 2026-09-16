/* ═══════════════════════════════════════════════════════════════
   useMetricTiles (Phase 82, numeric path + live refresh Phase 85) —
   data for the 2×2 metric tile grid. Documented choice: a SEPARATE
   small hook rather than extending useClientScore — the windows
   differ (Mon-start week vs 28d/7d trailing) and the tiles need
   per-day done flags the score hook never fetches; sharing would
   add queries rather than save them. RLS-safe: client reads own
   rows only.

   Phase 85: re-fetches when useHabits logs a habit value/flag
   ("azfit:habit-logs-changed" window event) so the tiles above the
   habits row update in the same session instead of on next mount.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveClientIdentity } from "@/hooks/useViewAs";
import { formatDateKeyLocal } from "@/lib/utils";
import { habitSignalsForTargets } from "@/lib/dailyPlan";
import {
  aggregateNumericWeek,
  findNumericHabit,
} from "@/lib/numericHabits";
import {
  computeMetricTiles,
  elapsedDaysThisWeek,
  weekStartMonday,
  type MetricTile,
} from "@/lib/metricTiles";

/** Dispatched by useHabits after a successful habit log/refresh. */
export const HABIT_LOGS_CHANGED_EVENT = "azfit:habit-logs-changed";

interface LifestyleTargets {
  steps?: number | null;
  sleep_hours?: number | null;
  water_ml?: number | null;
}

export function useMetricTiles() {
  const { user } = useAuth();
  // Phase 90e: identity comes from the shared resolver — the view-as
  // target's clients.id + profiles.id when overriding, otherwise the
  // caller's own (byte-identical filters to the old inline email copy).
  const eff = useEffectiveClientIdentity();
  const [tiles, setTiles] = useState<MetricTile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTiles = useCallback(async () => {
    if (!user?.id || !user.email) return;
    // Wait until the effective identity (own or override) has settled —
    // never fetch against a half-resolved identity.
    if (!eff.resolved) return;
    const cid = eff.clientId;
    // Account-less override target (no profiles row): never fall back
    // to the signed-in trainer's id — the clients.id half only.
    const profileId = eff.isOverride && !eff.profileId ? null : (eff.profileId ?? user.id);
    const sessionsOr = profileId
      ? `client_id.eq.${profileId},client_record_id.eq.${cid}`
      : `client_record_id.eq.${cid}`;
    try {
      // Same clients row the resolver found — re-read here only for
      // lifestyle_targets (the resolver exposes ids, not the row).
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id, lifestyle_targets")
        .ilike("email", eff.clientEmail ?? user.email)
        .maybeSingle();

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
              .or(sessionsOr)
              .gte("starts_at", mondayIso)
              .lt("starts_at", tomorrowIso)
              .neq("status", "cancelled")
          : Promise.resolve({ data: [] }),
        cid
          ? supabase
              .from("habit_logs")
              .select("habit_id, log_date, done, value")
              .eq("client_id", cid)
              .gte("log_date", mondayKey)
              .lte("log_date", todayKey)
          : Promise.resolve({ data: [] }),
        cid
          ? supabase.from("habits").select("id, name, active, target_value, unit").eq("client_id", cid).eq("active", true)
          : Promise.resolve({ data: [] }),
        cid
          ? supabase
              .from("check_in_submissions")
              .select("id", { count: "exact", head: true })
              .eq("client_id", cid)
              .gte("submitted_at", mondayIso)
          : Promise.resolve({ count: 0 }),
      ]);

      const sessions = (sessionsRes.data as { status: string }[] | null) ?? [];
      const logs = (logsRes.data as { habit_id: string; log_date: string; done: boolean; value: number | null }[] | null) ?? [];
      const habits = (habitsRes.data as { id: string; name: string; active: boolean; target_value: number | null; unit: string | null }[] | null) ?? [];
      const targets = (clientRow as { lifestyle_targets: LifestyleTargets | null })?.lifestyle_targets ?? null;

      // Phase 85: numeric-habit aggregates (real "7.5 of 8 h" lines).
      // These replace the done-days fallback ONLY for numeric habits;
      // flag-only habits keep the Phase 82 derivation below.
      const sleepNumericHabit = findNumericHabit(habits, "sleep");
      const waterNumericHabit = findNumericHabit(habits, "water");
      const sleepNumeric = sleepNumericHabit
        ? aggregateNumericWeek(sleepNumericHabit, logs, mondayKey, todayKey)
        : null;
      const waterNumeric = waterNumericHabit
        ? aggregateNumericWeek(waterNumericHabit, logs, mondayKey, todayKey)
        : null;

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
          sleepNumeric,
          waterNumeric,
          checkinSubmitted: (subsRes.count ?? 0) > 0,
        }),
      );
      setLoading(false);
      setError(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [user, eff.resolved, eff.isOverride, eff.clientId, eff.clientEmail, eff.profileId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchTiles();
  }, [fetchTiles]);

  /* Phase 85: same-session refresh when the habits row writes logs */
  useEffect(() => {
    const onChanged = () => {
      fetchTiles();
    };
    window.addEventListener(HABIT_LOGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HABIT_LOGS_CHANGED_EVENT, onChanged);
  }, [fetchTiles]);

  return { tiles, loading, error };
}
