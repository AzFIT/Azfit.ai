/* ═══════════════════════════════════════════════════════════════
   Phase 67 — data layer for the client "My Plan for Today" card.
   Custom items persist in daily_plan_items (27B RLS); auto items
   (session / lifestyle target / check-in) are derived per render and
   never stored. Range views query the range once and re-run the same
   derivation per day.
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDateKeyLocal } from "@/lib/utils";
import {
  buildTodayPlan,
  habitSignalsForTargets,
  rangeDateKeys,
  summarizeRange,
  weeklyBars,
  type DayCompletion,
  type PlanItem,
  type PlanItemRow,
  type RangeSummary,
  type TargetSignal,
  type TrackingRange,
} from "@/lib/dailyPlan";

interface HabitLike {
  id: string;
  name: string;
  active?: boolean;
  is_active?: boolean;
}

interface UseDailyPlanArgs {
  /** trainer/client habits (already loaded by the dashboard) */
  habits: HabitLike[];
  /** habit_logs rows (7-day window from useHabits) */
  habitLogs: { habit_id: string; log_date: string; done: boolean }[];
  checkinDue: boolean;
}

export interface RangeData {
  days: DayCompletion[];
  summary: RangeSummary;
  bars: (number | null)[];
}

const dayStartIso = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();
const nextDayIso = (dateKey: string) =>
  new Date(new Date(`${dateKey}T00:00:00`).getTime() + 86400000).toISOString();

export function useDailyPlan({ habits, habitLogs, checkinDue }: UseDailyPlanArgs) {
  const { user } = useAuth();
  const todayKey = formatDateKeyLocal(new Date());

  const [clientId, setClientId] = useState<string | null>(null);
  const [targets, setTargets] = useState<{ steps?: number | null; sleep_hours?: number | null; water_ml?: number | null } | null>(null);
  const [customRows, setCustomRows] = useState<PlanItemRow[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bump, setBump] = useState(0);
  const reload = useCallback(() => setBump((b) => b + 1), []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id, lifestyle_targets")
        .eq("email", user.email)
        .maybeSingle();
      if (cancelled) return;
      const row = clientRow as { id: string; lifestyle_targets: { steps?: number | null; sleep_hours?: number | null; water_ml?: number | null } | null } | null;
      const cid = row?.id ?? null;
      if (!cid) {
        setClientId(null);
        setLoading(false);
        return;
      }
      setClientId(cid);
      setTargets(row?.lifestyle_targets ?? null);

      const [itemsRes, sessionsRes, subRes] = await Promise.all([
        supabase
          .from("daily_plan_items")
          .select("id, client_id, plan_date, label, source, done, sort_order")
          .eq("client_id", cid)
          .eq("plan_date", todayKey)
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("sessions")
          .select("id, title, status, starts_at")
          .eq("client_record_id", cid)
          .gte("starts_at", dayStartIso(todayKey))
          .lt("starts_at", nextDayIso(todayKey))
          .neq("status", "cancelled")
          .order("starts_at"),
        supabase
          .from("check_in_submissions")
          .select("id", { count: "exact", head: true })
          .eq("client_id", cid)
          .gte("submitted_at", dayStartIso(todayKey)),
      ]);
      if (cancelled) return;
      setCustomRows((itemsRes.data as PlanItemRow[] | null) ?? []);
      const todaySessions = (sessionsRes.data as { id: string; title: string; status: string }[] | null) ?? [];
      const first = todaySessions[0] ?? null;
      setSessionTitle(first?.title ?? null);
      setSessionDone(first?.status === "completed");
      setCheckinDone((subRes.count ?? 0) > 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, bump, todayKey]);

  const items: PlanItem[] = buildTodayPlan({
    customRows,
    sessionTitle,
    sessionDone,
    targets,
    targetSignals: habitSignalsForTargets(
      habits.map((h) => ({ id: h.id, name: h.name, is_active: h.active ?? h.is_active })),
      habitLogs.filter((l) => l.log_date === todayKey),
    ),
    checkinDue,
    checkinDone,
  });

  const addCustom = useCallback(
    async (label: string) => {
      if (!clientId || !label.trim()) return;
      const { error } = await supabase.from("daily_plan_items").insert({
        client_id: clientId,
        plan_date: todayKey,
        label: label.trim(),
        source: "custom",
        sort_order: customRows.length,
      });
      if (error) {
        // 23505 = unique-index hit — the label is already on today's list
        if (error.code === "23505") return;
        throw error;
      }
      reload();
    },
    [clientId, todayKey, customRows.length, reload],
  );

  const toggleCustom = useCallback(
    async (rowId: string, done: boolean) => {
      setCustomRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, done } : r)));
      const { error } = await supabase
        .from("daily_plan_items")
        .update({ done, updated_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) {
        setCustomRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, done: !done } : r)));
        throw error;
      }
    },
    [],
  );

  const deleteCustom = useCallback(async (rowId: string) => {
    let removed: PlanItemRow | undefined;
    setCustomRows((prev) => {
      removed = prev.find((r) => r.id === rowId);
      return prev.filter((r) => r.id !== rowId);
    });
    const { error } = await supabase.from("daily_plan_items").delete().eq("id", rowId);
    if (error) {
      if (removed) setCustomRows((prev) => [...prev, removed!].sort((a, b) => a.sort_order - b.sort_order));
      throw error;
    }
  }, []);

  /** Range views: query the range once, re-derive each day honestly.
   *  Past-day check-in items count only when a submission exists (past
   *  due-ness isn't knowable); current targets apply to all range days
   *  (targets have no history — documented). */
  const loadRange = useCallback(
    async (range: TrackingRange): Promise<RangeData> => {
      if (!clientId) return { days: [], summary: summarizeRange([]), bars: [] };
      const keys = rangeDateKeys(range);
      const startKey = keys[0];
      const [itemsRes, sessionsRes, subsRes, logsRes] = await Promise.all([
        supabase
          .from("daily_plan_items")
          .select("id, client_id, plan_date, label, source, done, sort_order")
          .eq("client_id", clientId)
          .gte("plan_date", startKey)
          .lte("plan_date", todayKey),
        supabase
          .from("sessions")
          .select("title, status, starts_at")
          .eq("client_record_id", clientId)
          .gte("starts_at", dayStartIso(startKey))
          .lt("starts_at", nextDayIso(todayKey))
          .neq("status", "cancelled"),
        supabase
          .from("check_in_submissions")
          .select("submitted_at")
          .eq("client_id", clientId)
          .gte("submitted_at", dayStartIso(startKey)),
        supabase
          .from("habit_logs")
          .select("habit_id, log_date, done")
          .eq("client_id", clientId)
          .gte("log_date", startKey)
          .lte("log_date", todayKey),
      ]);
      const rows = (itemsRes.data as PlanItemRow[] | null) ?? [];
      const sessions = (sessionsRes.data as { title: string; status: string; starts_at: string }[] | null) ?? [];
      const subs = new Set(
        ((subsRes.data as { submitted_at: string }[] | null) ?? []).map((s) => formatDateKeyLocal(new Date(s.submitted_at))),
      );
      const logs = (logsRes.data as { habit_id: string; log_date: string; done: boolean }[] | null) ?? [];
      const habitNorm = habits.map((h) => ({ id: h.id, name: h.name, is_active: h.active ?? h.is_active }));

      const days: DayCompletion[] = keys.map((key) => {
        const daySession = sessions.find((s) => formatDateKeyLocal(new Date(s.starts_at)) === key) ?? null;
        const isToday = key === todayKey;
        const signals: Record<"water" | "steps" | "sleep", TargetSignal> = habitSignalsForTargets(
          habitNorm,
          logs.filter((l) => l.log_date === key),
        );
        const dayItems = buildTodayPlan({
          customRows: rows.filter((r) => r.plan_date === key),
          sessionTitle: daySession?.title ?? null,
          sessionDone: daySession?.status === "completed",
          targets,
          targetSignals: signals,
          checkinDue: isToday ? checkinDue : subs.has(key),
          checkinDone: subs.has(key),
        });
        return { dateKey: key, done: dayItems.filter((i) => i.done).length, total: dayItems.length };
      });
      return { days, summary: summarizeRange(days), bars: weeklyBars(days) };
    },
    [clientId, targets, habits, checkinDue, todayKey],
  );

  return { loading, clientId, items, addCustom, toggleCustom, deleteCustom, loadRange, reload };
}
