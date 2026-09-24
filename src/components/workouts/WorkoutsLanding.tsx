/* PHASE FIX-3 Item 2 — /#/workouts with no ?workoutLogId was a dead end
 * ("No workout selected" + one button). This landing gives it an honest
 * body: the client's real recent sessions (workout_logs, RLS-scoped) with
 * a path back into each, a trainer-appropriate state, and honest empties.
 * Never a dead page, never fabricated sessions. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Dumbbell, Play, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

interface RecentLog {
  id: string;
  created_at: string;
  duration_minutes: number | null;
  workoutName: string | null;
}

export default function WorkoutsLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState<RecentLog[] | null>(null);
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.email) return;
      try {
        // Same client linkage as SessionLauncher (email ilike).
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .ilike("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (!client) {
          setIsClient(false);
          setLogs([]);
          return;
        }
        setIsClient(true);
        // Two-step fetch: the generated Database types don't declare the
        // workout_logs→workouts relation, so join types fail — fetch names
        // by id instead (same round-trip count as a join for ≤5 rows).
        const { data: logsData, error: logsError } = await supabase
          .from("workout_logs")
          .select("id, created_at, duration_minutes, workout_id")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (cancelled) return;
        if (logsError) throw logsError;
        const ids = [...new Set((logsData ?? []).map((l) => l.workout_id))];
        const nameById = new Map<string, string>();
        if (ids.length > 0) {
          const { data: workoutsData } = await supabase.from("workouts").select("id, name").in("id", ids);
          for (const w of workoutsData ?? []) nameById.set(w.id, w.name);
        }
        setLogs(
          (logsData ?? []).map((l) => ({
            id: l.id,
            created_at: l.created_at,
            duration_minutes: l.duration_minutes,
            workoutName: nameById.get(l.workout_id) ?? null,
          })),
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your sessions");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const open = (id: string) => navigate(`/workouts?workoutLogId=${id}`);

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Dumbbell className="mb-3 h-10 w-10" style={{ color: "var(--azfit-primary)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--page-text)" }}>
            No workout selected
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {isClient === false
              ? "You're signed in as a trainer — start a workout from a client's profile."
              : "Pick a recent session below, or start a fresh one from your dashboard."}
          </p>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border px-3 py-2 text-center text-xs" style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}>
            {error}
          </p>
        )}

        {isClient === true && logs === null && !error && (
          <div className="mt-8 flex justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--azfit-primary)" }} />
          </div>
        )}

        {isClient === true && logs !== null && logs.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Recent sessions
            </p>
            <div className="space-y-2">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => open(log.id)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition hover:opacity-80"
                  style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
                >
                  <Play size={15} style={{ color: "var(--azfit-primary)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                      {log.workoutName ?? "Workout"}
                    </span>
                    <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {formatDate(log.created_at)}
                      {log.duration_minutes != null ? ` · ${log.duration_minutes} min` : ""}
                    </span>
                  </span>
                  <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {isClient === true && logs !== null && logs.length === 0 && !error && (
          <p className="mt-6 rounded-xl border px-4 py-3 text-center text-xs" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }}>
            No sessions logged yet. When your trainer assigns your program, start a workout from your dashboard and it will show up here.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {isClient === false && (
            <button
              onClick={() => navigate("/clients")}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              <Users size={16} /> Go to Clients
            </button>
          )}
          <button
            onClick={() => navigate("/dashboard")}
            className="min-h-[44px] rounded-xl border text-sm font-semibold transition hover:opacity-70"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
