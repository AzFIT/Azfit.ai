import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/types/supabase";

export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];

interface UseHabitsOptions {
  role: "trainer" | "client";
  clientId?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function useHabits({ role, clientId: propClientId }: UseHabitsOptions) {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(propClientId || null);

  /* Resolve client id from email when viewing as a client */
  useEffect(() => {
    if (role !== "client" || propClientId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolvedClientId(propClientId || null);
      return;
    }
    if (!user?.email) return;

    let cancelled = false;

    const resolve = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(); // Phase 43: no clients row → null, not a 406

      if (cancelled) return;
      if (error || !data) {
        setResolvedClientId(null);
      } else {
        setResolvedClientId(data.id);
      }
      setLoading(false);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [role, propClientId, user?.email]);

  const refresh = useCallback(async () => {
    if (!resolvedClientId) {
      setHabits([]);
      setLogs([]);
      return;
    }

    setLoading(true);

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const habitsQuery = supabase
      .from("habits")
      .select("*")
      .eq("client_id", resolvedClientId)
      .order("created_at", { ascending: false });

    if (role === "client") {
      habitsQuery.eq("active", true);
    }

    const [habitsResult, logsResult] = await Promise.all([
      habitsQuery,
      supabase
        .from("habit_logs")
        .select("*")
        .eq("client_id", resolvedClientId)
        .gte("log_date", formatDate(sevenDaysAgo))
        .lte("log_date", formatDate(today))
        .order("log_date", { ascending: true }),
    ]);

    if (habitsResult.error) {
      toast.error("Failed to load habits: " + habitsResult.error.message);
    }
    if (logsResult.error) {
      toast.error("Failed to load habit logs: " + logsResult.error.message);
    }

    setHabits((habitsResult.data || []) as Habit[]);
    setLogs((logsResult.data || []) as HabitLog[]);
    setLoading(false);
  }, [resolvedClientId, role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const toggleToday = useCallback(
    async (habitId: string, done: boolean) => {
      if (!resolvedClientId) {
        toast.error("Could not determine client record");
        return;
      }

      const today = formatDate(new Date());
      const { error } = await supabase.from("habit_logs").upsert(
        {
          habit_id: habitId,
          client_id: resolvedClientId,
          log_date: today,
          done,
        },
        { onConflict: "habit_id,log_date" }
      );

      if (error) {
        toast.error("Failed to update habit: " + error.message);
        return;
      }

      await refresh();
    },
    [resolvedClientId, refresh]
  );

  return {
    habits,
    logs,
    loading,
    resolvedClientId,
    refresh,
    toggleToday,
  };
}

export function last7Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(formatDate(d));
  }
  return days;
}

export function isDoneOnDate(logs: HabitLog[], habitId: string, date: string): boolean {
  return logs.some((log) => log.habit_id === habitId && log.log_date === date && log.done);
}

export function weeklyCompletion(logs: HabitLog[], habitId: string): number {
  const days = last7Days();
  const done = days.filter((date) => isDoneOnDate(logs, habitId, date)).length;
  return Math.round((done / 7) * 100);
}

export function currentStreak(logs: HabitLog[], habitId: string): number {
  const habitLogs = logs.filter((log) => log.habit_id === habitId && log.done);
  const dates = new Set(habitLogs.map((log) => log.log_date));

  let streak = 0;
  const d = new Date();
  const today = formatDate(d);

  // Start from today if done, otherwise from yesterday
  if (!dates.has(today)) {
    d.setDate(d.getDate() - 1);
  }

  while (dates.has(formatDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}
