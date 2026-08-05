import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Database } from "@/types/supabase";

type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export interface ClientProgram extends ProgramRow {
  workouts: (WorkoutRow & { exercises: ExerciseRow[] })[];
}

function useResolvedClientId() {
  const { user, loading: authLoading } = useAuth();
  const email = user?.email;
  const [clientId, setClientId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!email) return;

    let cancelled = false;

    const resolve = async () => {
      setResolving(true);
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(); // Phase 43: no clients row → null, not a 406

      if (cancelled) return;
      if (error || !data) {
        setClientId(null);
      } else {
        setClientId(data.id);
      }
      setResolving(false);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return { clientId, resolving: resolving || authLoading };
}

export function useClientPrograms() {
  const { clientId, resolving } = useResolvedClientId();
  const [programs, setPrograms] = useState<ClientProgram[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrograms = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    try {
      const { data: programsData, error: programsError } = await supabase
        .from("programs")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (programsError) throw programsError;
      const programs = (programsData as ProgramRow[]) || [];

      const programIds = programs.map((p) => p.id);
      let workouts: WorkoutRow[] = [];
      if (programIds.length > 0) {
        const { data: workoutsData, error: workoutsError } = await supabase
          .from("workouts")
          .select("*")
          .in("program_id", programIds)
          .order("week_number", { ascending: true })
          .order("day_of_week", { ascending: true });

        if (workoutsError) throw workoutsError;
        workouts = (workoutsData as WorkoutRow[]) || [];
      }

      const workoutIds = workouts.map((w) => w.id);
      let exercises: ExerciseRow[] = [];
      if (workoutIds.length > 0) {
        const { data: exercisesData, error: exercisesError } = await supabase
          .from("exercises")
          .select("*")
          .in("workout_id", workoutIds)
          .order("order_index", { ascending: true });

        if (exercisesError) throw exercisesError;
        exercises = (exercisesData as ExerciseRow[]) || [];
      }

      const workoutsByProgram = new Map<string, (WorkoutRow & { exercises: ExerciseRow[] })[]>();
      const exercisesByWorkout = new Map<string, ExerciseRow[]>();

      for (const ex of exercises) {
        const list = exercisesByWorkout.get(ex.workout_id) || [];
        list.push(ex);
        exercisesByWorkout.set(ex.workout_id, list);
      }

      for (const w of workouts) {
        const list = workoutsByProgram.get(w.program_id) || [];
        list.push({ ...w, exercises: exercisesByWorkout.get(w.id) || [] });
        workoutsByProgram.set(w.program_id, list);
      }

      const enriched: ClientProgram[] = programs.map((p) => ({
        ...p,
        workouts: workoutsByProgram.get(p.id) || [],
      }));

      setPrograms(enriched);
    } catch (err) {
      console.error("[useClientPrograms] fetch failed:", err);
      toast.error("Failed to load programs");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    fetchPrograms();
  }, [clientId, fetchPrograms]);

  return { programs, loading: loading || resolving, clientId, refetch: fetchPrograms };
}
