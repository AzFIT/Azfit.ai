import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Database } from "@/types/supabase";
import {
  type SessionExercise,
  type SessionSet,
  buildSessionExercise,
  createEmptySet,
  getSessionVolume,
  getSessionTargetVolume,
  getSessionCompletedSets,
  getSessionTotalSets,
  getSessionAvgRpe,
  getBestEstimatedOneRepMax,
  getBestSingleSetVolume,
  parseTargetReps,
  DEFAULT_TEMPO,
} from "@/lib/workoutSession";
import { findCategoryForExercise } from "@/data/exerciseDatabase";

type WorkoutLogRow = Database["public"]["Tables"]["workout_logs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];

export interface SessionSnapshot {
  workoutLog: WorkoutLogRow | null;
  workout: WorkoutRow | null;
  program: ProgramRow | null;
  exercises: SessionExercise[];
  elapsedSeconds: number;
  isPaused: boolean;
  totalVolume: number;
  targetVolume: number;
  completedSets: number;
  totalSets: number;
  avgRpe: number;
  loading: boolean;
  error: string | null;
}

export interface SessionUpdateResult {
  newPb: boolean;
  pbType?: "volume" | "oneRepMax";
  previousBest: number;
  current: number;
}

export function useActiveWorkoutSession(workoutLogId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workoutLog, setWorkoutLog] = useState<WorkoutLogRow | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [historyPbs, setHistoryPbs] = useState<Record<string, { volume: number; oneRepMax: number }>>({});
  const [lastLoadPerExercise, setLastLoadPerExercise] = useState<Record<string, number>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const clientId = workoutLog?.client_id || null;

  const fetchHistory = useCallback(async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from("workout_log_entries")
      .select("exercise_name, weight_per_set, reps_per_set, rpe_per_set")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const pbs: Record<string, { volume: number; oneRepMax: number }> = {};
    const lastLoad: Record<string, number> = {};

    for (const entry of data) {
      const name = entry.exercise_name;
      const weights = entry.weight_per_set || [];
      const reps = entry.reps_per_set || [];
      const rpe = entry.rpe_per_set || [];

      if (!lastLoad[name] && weights.length > 0) {
        lastLoad[name] = Number(weights[weights.length - 1]) || 0;
      }

      if (!pbs[name]) pbs[name] = { volume: 0, oneRepMax: 0 };

      for (let i = 0; i < weights.length; i++) {
        const w = Number(weights[i]) || 0;
        const r = Number(reps[i]) || 0;
        const rp = Number(rpe[i]) || 0;
        if (w > 0 && r > 0) {
          const vol = w * r;
          pbs[name].volume = Math.max(pbs[name].volume, vol);
          if (rp > 0) {
            const est = w * (1 + r / 30);
            pbs[name].oneRepMax = Math.max(pbs[name].oneRepMax, est);
          }
        }
      }
    }

    setHistoryPbs(pbs);
  }, [clientId]);

  const loadSession = useCallback(async () => {
    if (!workoutLogId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: log, error: logError } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("id", workoutLogId)
        .single();

      if (logError || !log) throw logError || new Error("Workout log not found");
      setWorkoutLog(log);

      const { data: workoutData, error: workoutError } = await supabase
        .from("workouts")
        .select("*")
        .eq("id", log.workout_id)
        .single();

      if (workoutError || !workoutData) throw workoutError || new Error("Workout not found");
      setWorkout(workoutData);

      const { data: programData } = await supabase
        .from("programs")
        .select("*")
        .eq("id", workoutData.program_id)
        .single();

      setProgram(programData || null);

      const { data: exercisesData, error: exercisesError } = await supabase
        .from("exercises")
        .select("*")
        .eq("workout_id", log.workout_id)
        .order("order_index", { ascending: true });

      if (exercisesError) throw exercisesError;

      const exerciseRows = (exercisesData as ExerciseRow[]) || [];
      const lastLoad: Record<string, number> = {};

      if (log.client_id) {
        const { data: history } = await supabase
          .from("workout_log_entries")
          .select("exercise_name, weight_per_set")
          .eq("client_id", log.client_id)
          .order("created_at", { ascending: false });

        if (history) {
          for (const entry of history) {
            const name = entry.exercise_name;
            if (!lastLoad[name]) {
              const weights = entry.weight_per_set || [];
              lastLoad[name] = Number(weights[weights.length - 1]) || 0;
            }
          }
        }
      }

      setLastLoadPerExercise(lastLoad);

      const sessionExercises = exerciseRows.map((ex) =>
        buildSessionExercise(ex as ExerciseRow, findCategoryForExercise(ex.name) || "Other", lastLoad)
      );

      setExercises(sessionExercises);
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error("[useActiveWorkoutSession] load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load session");
      toast.error("Failed to load workout session");
    } finally {
      setLoading(false);
    }
  }, [workoutLogId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (clientId) fetchHistory();
  }, [clientId, fetchHistory]);

  // Elapsed timer
  useEffect(() => {
    if (!workoutLog || isPaused) return;

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [workoutLog, isPaused]);

  const updateExercise = useCallback((exerciseId: string, updater: Partial<SessionExercise> | ((ex: SessionExercise) => SessionExercise)) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (typeof updater === 'function') return updater(ex);
        return { ...ex, ...updater };
      })
    );
  }, []);

  const updateSet = useCallback(
    (exerciseId: string, setIndex: number, updates: Partial<SessionSet>) => {
      updateExercise(exerciseId, (ex) => {
        const newSets = [...ex.sets];
        const current = newSets[setIndex];
        if (!current) return ex;

        const merged = { ...current, ...updates };
        if (updates.clientLoad !== undefined && updates.load === undefined) {
          merged.load = updates.clientLoad;
        }
        newSets[setIndex] = merged;
        return { ...ex, sets: newSets };
      });
    },
    [updateExercise]
  );

  const addSet = useCallback(
    (exerciseId: string) => {
      updateExercise(exerciseId, (ex) => {
        const lastSet = ex.sets[ex.sets.length - 1];
        const targetReps = parseTargetReps(ex.targetReps) || 10;
        const newSet = createEmptySet(ex.sets.length + 1, {
          clientLoad: lastSet?.load || ex.targetLoad,
          load: lastSet?.load || ex.targetLoad,
          reps: lastSet?.reps || targetReps,
          restSeconds: lastSet?.restSeconds || ex.restSeconds,
          rpe: lastSet?.rpe || ex.prescribedRpe || 0,
          type: lastSet?.type || "Normal",
          tempo: lastSet?.tempo || ex.tempo || DEFAULT_TEMPO,
        });
        return { ...ex, sets: [...ex.sets, newSet] };
      });
    },
    [updateExercise]
  );

  const removeSet = useCallback(
    (exerciseId: string, setIndex: number) => {
      updateExercise(exerciseId, (ex) => {
        const newSets = ex.sets
          .filter((_, i) => i !== setIndex)
          .map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...ex, sets: newSets };
      });
    },
    [updateExercise]
  );

  const updateExerciseNotes = useCallback(
    (exerciseId: string, notes: string) => {
      updateExercise(exerciseId, (ex) => ({ ...ex, notes }));
    },
    [updateExercise]
  );

  const swapExercise = useCallback((exerciseId: string, newName: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              name: newName,
              category: findCategoryForExercise(newName) || ex.category,
            }
          : ex
      )
    );
  }, []);

  const removeExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  }, []);

  const addExercise = useCallback((name: string) => {
    setExercises((prev) => {
      const orderIndex = prev.length * 2;
      const category = findCategoryForExercise(name) || "Other";
      const newEx: SessionExercise = {
        id: crypto.randomUUID(),
        order: String.fromCharCode(65 + Math.floor(orderIndex / 2)) + ((orderIndex % 2) + 1),
        name,
        category,
        targetSets: 3,
        targetReps: "10",
        targetLoad: 0,
        tempo: DEFAULT_TEMPO,
        restSeconds: 60,
        sets: [createEmptySet(1, { reps: 10, restSeconds: 60, tempo: DEFAULT_TEMPO })],
        notes: "",
      };
      return [...prev, newEx];
    });
  }, []);

  const writeExerciseToDb = useCallback(
    async (exercise: SessionExercise) => {
      if (!workoutLog || !clientId) return false;

      const doneSets = exercise.sets.filter((s) => s.done);
      const payload: Database["public"]["Tables"]["workout_log_entries"]["Insert"] = {
        workout_log_id: workoutLog.id,
        client_id: clientId,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        sets_completed: doneSets.length,
        total_sets: exercise.sets.length,
        reps_per_set: exercise.sets.map((s) => (s.done ? s.reps : 0)),
        weight_per_set: exercise.sets.map((s) => (s.done ? s.load : 0)),
        rpe_per_set: exercise.sets.map((s) => (s.done ? s.rpe : 0)),
        notes: exercise.notes || null,
      };

      try {
        // Upsert by workout_log_id + exercise_id
        const { data: existing } = await supabase
          .from("workout_log_entries")
          .select("id")
          .eq("workout_log_id", workoutLog.id)
          .eq("exercise_id", exercise.id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("workout_log_entries")
            .update({
              exercise_name: payload.exercise_name,
              sets_completed: payload.sets_completed,
              total_sets: payload.total_sets,
              reps_per_set: payload.reps_per_set,
              weight_per_set: payload.weight_per_set,
              rpe_per_set: payload.rpe_per_set,
              notes: payload.notes,
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("workout_log_entries").insert(payload);
          if (error) throw error;
        }
        return true;
      } catch (err) {
        console.error("[useActiveWorkoutSession] write failed:", err);
        toast.error(`Failed to save ${exercise.name}`);
        return false;
      }
    },
    [workoutLog, clientId]
  );

  const toggleSetDone = useCallback(
    async (exerciseId: string, setIndex: number) => {
      let exerciseAfterUpdate: SessionExercise | null = null;

      setExercises((prev) => {
        const exIndex = prev.findIndex((ex) => ex.id === exerciseId);
        if (exIndex === -1) return prev;

        const ex = prev[exIndex];
        const set = ex.sets[setIndex];
        if (!set) return prev;

        const newDone = !set.done;
        const newSets = [...ex.sets];
        const newSet = { ...set, done: newDone };

        if (newDone) {
          if (newSet.load <= 0) newSet.load = newSet.clientLoad || ex.targetLoad;
          if (newSet.reps <= 0) newSet.reps = parseTargetReps(ex.targetReps) || 10;
          if (newSet.rpe <= 0) newSet.rpe = ex.prescribedRpe || 7;
          if (newSet.restSeconds <= 0) newSet.restSeconds = ex.restSeconds || 60;
          newSet.clientLoad = newSet.load;

          const nextIdx = setIndex + 1;
          if (nextIdx < newSets.length) {
            const next = newSets[nextIdx];
            if (!next.done && next.load <= 0) {
              newSets[nextIdx] = {
                ...next,
                clientLoad: newSet.load,
                load: newSet.load,
                reps: next.reps || newSet.reps,
              };
            }
          }
        }

        newSets[setIndex] = newSet;
        const updatedEx = { ...ex, sets: newSets };
        exerciseAfterUpdate = updatedEx;

        const next = [...prev];
        next[exIndex] = updatedEx;
        return next;
      });

      if (exerciseAfterUpdate) {
        await writeExerciseToDb(exerciseAfterUpdate);
      }

      // Compute PB result from the local updated exercise (not relying on React state closure)
      let pbResult: SessionUpdateResult | null = null;
      if (exerciseAfterUpdate) {
        const ex: SessionExercise = exerciseAfterUpdate;
        const updatedSet = ex.sets[setIndex];
        if (updatedSet?.done) {
          const currentVol = getBestSingleSetVolume(ex);
          const current1RM = getBestEstimatedOneRepMax(ex);
          const historyPb = historyPbs[ex.name] || { volume: 0, oneRepMax: 0 };

          if (currentVol > historyPb.volume) {
            pbResult = { newPb: true, pbType: "volume", previousBest: historyPb.volume, current: currentVol };
          } else if (current1RM > historyPb.oneRepMax) {
            pbResult = { newPb: true, pbType: "oneRepMax", previousBest: historyPb.oneRepMax, current: current1RM };
          } else {
            pbResult = { newPb: false, previousBest: 0, current: 0 };
          }
        }
      }

      return pbResult;
    },
    [historyPbs, writeExerciseToDb]
  );

  const finishSession = useCallback(async () => {
    if (!workoutLog) return false;

    try {
      const durationMinutes = Math.floor(elapsedSeconds / 60);
      const { error } = await supabase
        .from("workout_logs")
        .update({ completed_at: new Date().toISOString(), duration_minutes: durationMinutes })
        .eq("id", workoutLog.id);

      if (error) throw error;

      // Ensure all exercises are written
      await Promise.all(exercises.map((ex) => writeExerciseToDb(ex)));

      toast.success("Workout finished!");
      return true;
    } catch (err) {
      console.error("[useActiveWorkoutSession] finish failed:", err);
      toast.error("Failed to finish workout");
      return false;
    }
  }, [workoutLog, elapsedSeconds, exercises, writeExerciseToDb]);

  const setPaused = useCallback((paused: boolean) => setIsPaused(paused), []);

  const snapshot: SessionSnapshot = {
    workoutLog,
    workout,
    program,
    exercises,
    elapsedSeconds,
    isPaused,
    totalVolume: getSessionVolume(exercises),
    targetVolume: getSessionTargetVolume(exercises),
    completedSets: getSessionCompletedSets(exercises),
    totalSets: getSessionTotalSets(exercises),
    avgRpe: getSessionAvgRpe(exercises),
    loading,
    error,
  };

  return {
    snapshot,
    updateSet,
    addSet,
    removeSet,
    updateExerciseNotes,
    toggleSetDone,
    swapExercise,
    removeExercise,
    addExercise,
    finishSession,
    setPaused,
    historyPbs,
    lastLoadPerExercise,
  };
}
