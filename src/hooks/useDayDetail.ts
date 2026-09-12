/* ═══════════════════════════════════════════════════════════════
   useDayDetail (Phase 90c) — LAZY per-tap fetch backing the day
   detail sheet. Fires only when a day is tapped (never on render —
   no N+1), and because every query is keyed to the single tapped
   day it works for ANY past day, not just the 12-week heatmap
   window (the calendar accent only covers the window; the sheet
   is honest about any day).

   Sources (same real rows the dashboard already trusts):
   · sessions      — that local day, trainer-scoped OR ownership
   · workout_logs  — completed_at in that local day (clients.id key)
   · habits + habit_logs — that day's rows; water/sleep/steps rows
     matched by the Phase 82 TARGET_HABIT_KEYWORDS regexes (same
     classification as the metric tiles / numeric habits)
   · nutrition_logs — logged_date = that day (profile-id key; RLS
     lets a trainer read own clients' rows)

   RLS-safe: client view resolves own clients row via profiles-email
   join (27B); trainer view passes the client's ids explicitly.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { TARGET_HABIT_KEYWORDS } from "@/lib/dailyPlan";
import { formatHabitValue } from "@/lib/dayDetail";

export interface DayDetailRow {
  /** logged rows exist for this category on this day */
  logged: boolean;
  /** real value text ("7.5 h", "1.8 L", "Done", "2 meals") or "" */
  valueText: string;
}

export interface DayDetail {
  dateKey: string;
  /** true = the day is in the future → the sheet shows the honest
   *  "Nothing to show yet" state without fetching */
  future: boolean;
  training: DayDetailRow;
  hydration: DayDetailRow;
  food: DayDetailRow;
  steps: DayDetailRow;
  sleep: DayDetailRow;
}

const NOT_LOGGED: DayDetailRow = { logged: false, valueText: "" };

function futureDetail(dateKey: string): DayDetail {
  return {
    dateKey,
    future: true,
    training: NOT_LOGGED,
    hydration: NOT_LOGGED,
    food: NOT_LOGGED,
    steps: NOT_LOGGED,
    sleep: NOT_LOGGED,
  };
}

interface HabitRow {
  id: string;
  name: string;
  target_value: number | null;
  unit: string | null;
}

interface HabitLogRow {
  habit_id: string;
  done: boolean;
  value: number | null;
}

const isoDayStart = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();
const isoDayEnd = (dateKey: string) =>
  new Date(new Date(`${dateKey}T00:00:00`).getTime() + 86400000).toISOString();

export function useDayDetail(opts: { clientId?: string; clientEmail?: string }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  /** Fetch the tapped day's real rows. Future days short-circuit to
   *  the honest empty state without touching the network. */
  async function openDay(dateKey: string): Promise<void> {
    setError(false);
    if (dateKey > localTodayKey()) {
      setDetail(futureDetail(dateKey));
      return;
    }
    // Trainer view needs the client's ids; client view needs own email.
    if (opts.clientId ? !opts.clientEmail : !user?.email) return;

    setLoading(true);
    try {
      let cid: string | null = opts.clientId ?? null;
      let profileId: string | null = null;

      if (opts.clientId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", opts.clientEmail!)
          .maybeSingle();
        profileId = (prof as { id: string } | null)?.id ?? null;
        cid = opts.clientId;
      } else {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("id")
          .eq("email", user!.email!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        cid = (clientRow as { id: string } | null)?.id ?? null;
        profileId = user!.id;
      }

      const startIso = isoDayStart(dateKey);
      const endIso = isoDayEnd(dateKey);

      const sessionsQuery = profileId
        ? supabase
            .from("sessions")
            .select("status")
            .or(`client_id.eq.${profileId},client_record_id.eq.${cid}`)
            .gte("starts_at", startIso)
            .lt("starts_at", endIso)
        : Promise.resolve({ data: [] });

      const [sessRes, workoutRes, habitsRes, logsRes, foodRes] = await Promise.all([
        sessionsQuery,
        cid
          ? supabase
              .from("workout_logs")
              .select("id", { count: "exact", head: true })
              .eq("client_id", cid)
              .gte("completed_at", startIso)
              .lt("completed_at", endIso)
          : Promise.resolve({ count: 0 }),
        cid
          ? supabase.from("habits").select("id, name, target_value, unit").eq("client_id", cid)
          : Promise.resolve({ data: [] }),
        cid
          ? supabase
              .from("habit_logs")
              .select("habit_id, done, value")
              .eq("client_id", cid)
              .eq("log_date", dateKey)
          : Promise.resolve({ data: [] }),
        profileId
          ? supabase
              .from("nutrition_logs")
              .select("meal_type")
              .eq("user_id", profileId)
              .eq("logged_date", dateKey)
          : Promise.resolve({ data: [] }),
      ]);

      const sessions = (sessRes.data as { status: string }[] | null) ?? [];
      const workoutCount = workoutRes.count ?? 0;
      const habits = (habitsRes.data as HabitRow[] | null) ?? [];
      const logs = (logsRes.data as HabitLogRow[] | null) ?? [];
      const meals = ((foodRes.data as { meal_type: string }[] | null) ?? []).map((m) => m.meal_type);

      const rowFor = (re: RegExp): DayDetailRow => {
        const habit = habits.find((h) => re.test(h.name));
        if (!habit) return NOT_LOGGED;
        const log = logs.find((l) => l.habit_id === habit.id);
        if (!log || !log.done) return NOT_LOGGED;
        return { logged: true, valueText: formatHabitValue(log.value, habit.unit) };
      };

      const parts: string[] = [];
      if (sessions.length > 0) {
        const completed = sessions.filter((s) => s.status === "completed").length;
        parts.push(
          `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}` +
            (completed > 0 ? ` (${completed} completed)` : ""),
        );
      }
      if (workoutCount > 0) parts.push(`${workoutCount} ${workoutCount === 1 ? "workout" : "workouts"}`);

      setDetail({
        dateKey,
        future: false,
        training: parts.length > 0 ? { logged: true, valueText: parts.join(" · ") } : NOT_LOGGED,
        hydration: rowFor(TARGET_HABIT_KEYWORDS.water),
        food:
          meals.length > 0
            ? { logged: true, valueText: `${meals.length} ${meals.length === 1 ? "meal" : "meals"} logged` }
            : NOT_LOGGED,
        steps: rowFor(TARGET_HABIT_KEYWORDS.steps),
        sleep: rowFor(TARGET_HABIT_KEYWORDS.sleep),
      });
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  function closeDay(): void {
    setDetail(null);
  }

  return { detail, loading, error, openDay, closeDay };
}

function localTodayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
