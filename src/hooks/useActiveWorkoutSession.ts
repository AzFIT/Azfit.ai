import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Database } from "@/types/supabase";
import {
  type SessionExercise,
  type SessionSet,
  buildSessionExercise,
  createEmptySet,
  cascadeTargetLoad,
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
import { inferEquipment } from "@/lib/previewMetrics";
import {
  normalizeOrderLabels,
  labelsForPairAdd,
  nextSeriesLetter,
  labelsAfterRemove,
} from "@/lib/exerciseLabels";
import { latestGhostByExercise, type GhostSet } from "@/lib/workoutIntel";
import {
  parseRepRange,
  progressionSuggestion,
  sessionsByExercise,
  type GhostEntryRow,
  type ProgressionSuggestion,
} from "@/lib/autoProgression";
import { parseMethodDefaults, type MethodDefaults } from "@/lib/methodDefaults";

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
  // Phase 49: ghost data (latest previous set per exercise) + the program's
  // method defaults (drives player chrome + rest defaults)
  const [ghostByExercise, setGhostByExercise] = useState<Map<string, GhostSet>>(new Map());
  // Phase 62: rule-based progression suggestion per exercise (null = render nothing)
  const [progressionByExercise, setProgressionByExercise] = useState<Map<string, ProgressionSuggestion>>(new Map());
  const [method, setMethod] = useState<{ slug: string; name: string; d: MethodDefaults } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  // Mirror of exercises for handlers that need the current value outside
  // setState updaters (React 19 doesn't run updaters eagerly).
  const exercisesRef = useRef<SessionExercise[]>([]);
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

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

      // Phase 49: resolve the program's method (48 phases-jsonb channel)
      // to its prescription defaults — drives player chrome + rest defaults
      {
        const slug =
          programData && Array.isArray(programData.phases) && programData.phases.length > 0
            ? (programData.phases[0] as { method?: unknown })?.method
            : undefined;
        if (typeof slug === "string" && slug) {
          const { data: m } = await supabase
            .from("methods")
            .select("slug, name, defaults")
            .eq("slug", slug)
            .maybeSingle();
          const d = parseMethodDefaults(m?.defaults);
          if (m && d) setMethod({ slug: m.slug, name: m.name, d });
          else setMethod(null);
        } else {
          setMethod(null);
        }
      }

      // Phase 49 Item 1: ghost data — latest PREVIOUS set per exercise from
      // completed logs before today (one pair of queries per session load).
      // Phase 62: the SAME rows (plus workout_log_id + log recency order) also
      // feed the progression engine — no extra round-trips.
      let progressionGhostRows: GhostEntryRow[] = [];
      let progressionLogOrder: string[] = [];
      if (log.client_id) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: completedLogs } = await supabase
          .from("workout_logs")
          .select("id, completed_at")
          .eq("client_id", log.client_id)
          .not("completed_at", "is", null)
          .neq("id", workoutLogId)
          .order("completed_at", { ascending: false });
        const logIds = (completedLogs || []).map((l) => l.id);
        progressionLogOrder = logIds;
        if (logIds.length > 0) {
          const { data: ghostRows } = await supabase
            .from("workout_log_entries")
            .select("exercise_name, workout_log_id, weight_per_set, reps_per_set, rpe_per_set")
            .in("workout_log_id", logIds)
            .lt("created_at", todayStart.toISOString())
            .order("created_at", { ascending: false })
            .limit(1000);
          progressionGhostRows = (ghostRows as GhostEntryRow[] | null) ?? [];
          setGhostByExercise(latestGhostByExercise(ghostRows || []));
        } else {
          setGhostByExercise(new Map());
        }
      }

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

      // Phase 62: rule-based progression suggestions from the SAME ghost rows
      // (pure computation — no extra queries)
      {
        const sessionsMap = sessionsByExercise(progressionGhostRows, progressionLogOrder);
        const progMap = new Map<string, ProgressionSuggestion>();
        for (const ex of sessionExercises) {
          const history = sessionsMap.get(ex.name);
          if (!history || history.length === 0) continue;
          const { min, max } = parseRepRange(ex.targetReps);
          const suggestion = progressionSuggestion({
            prescribedSets: ex.targetSets,
            repRangeMin: min,
            repRangeMax: max,
            history,
          });
          if (suggestion.action) progMap.set(ex.name, suggestion);
        }
        setProgressionByExercise(progMap);
      }

      // Phase 33C Fix 1d: restore per-session targetLoad saved in entry notes
      const { data: entryRows } = await supabase
        .from("workout_log_entries")
        .select("exercise_id, notes")
        .eq("workout_log_id", workoutLogId);
      for (const entry of entryRows || []) {
        if (!entry.notes) continue;
        try {
          const parsed = JSON.parse(entry.notes) as { targetLoad?: number };
          if (typeof parsed.targetLoad === "number" && parsed.targetLoad > 0) {
            const ex = sessionExercises.find((e) => e.id === entry.exercise_id);
            if (ex) {
              ex.targetLoad = parsed.targetLoad;
              ex.sets = ex.sets.map((s) =>
                !s.done && s.clientLoad <= 0 ? { ...s, clientLoad: parsed.targetLoad as number, load: parsed.targetLoad as number } : s
              );
            }
          }
        } catch {
          // pre-33C free-text notes — ignore
        }
      }

      // Phase 33C Fix 4a: repair legacy duplicate order labels on load
      // (e.g. ...D1 D1 → ...D1 D2; singleton series collapse to plain letters)
      const normalizedOrders = normalizeOrderLabels(sessionExercises.map((e) => e.order));
      sessionExercises.forEach((e, i) => { e.order = normalizedOrders[i]; });

      // Phase 33C Fix 5: equipment per exercise for the barbell-only plate hint.
      // Legacy session names ('Back Squat') predate the library's names
      // ('BB Back Squat') — match exact, then substring (prefer the shortest
      // library name = closest), then the documented name regexes.
      const names = sessionExercises.map((e) => e.name);
      if (names.length > 0) {
        const { data: libRows } = await supabase
          .from("exercise_library")
          .select("name, equipment");
        const libList = (libRows || []) as { name: string; equipment: string }[];
        const exactByName = new Map(libList.map((r) => [r.name, r.equipment]));
        const equipmentFor = (name: string): string => {
          const exact = exactByName.get(name);
          if (exact) return exact;
          const lower = name.toLowerCase();
          const contains = libList
            .filter((r) => r.name.toLowerCase().includes(lower))
            .sort((a, b) => a.name.length - b.name.length)[0];
          if (contains) return contains.equipment;
          return inferEquipment(name);
        };
        sessionExercises.forEach((e) => { e.equipment = equipmentFor(e.name); });
      }

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
    setExercises((prev) => {
      const idx = prev.findIndex((ex) => ex.id === exerciseId);
      if (idx === -1) return prev;
      const relabeled = labelsAfterRemove(prev.map((e) => e.order), idx);
      return prev.filter((ex) => ex.id !== exerciseId).map((ex, i) => ({ ...ex, order: relabeled[i] }));
    });
  }, []);

  // Phase 33C Fix 4b: smart Add Exercise — after the exercise is picked the
  // trainer chooses "pair with last series" (E → E1/E2 auto-rename) or
  // "start new series" (next letter).
  const addExercise = useCallback((name: string, mode: "pair" | "newSeries" = "newSeries") => {
    setExercises((prev) => {
      const category = findCategoryForExercise(name) || "Other";
      let order: string;
      let updatedPrev = prev;
      if (mode === "pair") {
        const { updated, newLabel } = labelsForPairAdd(prev.map((e) => e.order));
        updatedPrev = prev.map((e, i) => ({ ...e, order: updated[i] }));
        order = newLabel;
      } else {
        order = nextSeriesLetter(prev.map((e) => e.order));
      }
      const newEx: SessionExercise = {
        id: crypto.randomUUID(),
        order,
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
      return [...updatedPrev, newEx];
    });
  }, []);

  const writeExerciseToDb = useCallback(
    async (exercise: SessionExercise) => {
      if (!workoutLog || !clientId) return false;

      const doneSets = exercise.sets.filter((s) => s.done);
      // Phase 33C: notes is an additive JSON channel — { note, targetLoad }
      // (targetLoad persists per session; nothing else reads notes today).
      const notesJson = JSON.stringify({
        note: exercise.notes || "",
        ...(exercise.targetLoad > 0 ? { targetLoad: exercise.targetLoad } : {}),
      });
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
        notes: notesJson,
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

  // Phase 33C Fix 1 + 33E: the header target-load input updates
  // exercise.targetLoad AND cascades to the sets that follow the target —
  // sets whose clientLoad is 0 or still equals the PREVIOUS target (33E:
  // multi-digit edits used to cascade only the first keystroke because the
  // check was clientLoad <= 0). Manual divergences and done sets are never
  // touched. Persisted PER SESSION via workout_log_entries.notes jsonb
  // (client-writable; the shared program exercise row is not).
  const updateExerciseTargetLoad = useCallback(
    (exerciseId: string, load: number) => {
      const current = exercisesRef.current.find((e) => e.id === exerciseId);
      if (!current) return;
      const updated: SessionExercise = {
        ...current,
        targetLoad: load,
        sets: cascadeTargetLoad(current.sets, current.targetLoad, load),
      };
      setExercises((prev) => prev.map((e) => (e.id === exerciseId ? updated : e)));
      void writeExerciseToDb(updated);
    },
    [writeExerciseToDb]
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

  // Phase 35 ITEM 1: airtight Finish — flush ALL exercises FIRST, only mark
  // the log completed after every write lands. Session RPE rides in the log's
  // notes jsonb (additive { sessionRpe } — no schema change).
  const finishSession = useCallback(async (sessionRpe?: number) => {
    if (!workoutLog) return false;

    try {
      const results = await Promise.all(exercises.map((ex) => writeExerciseToDb(ex)));
      if (results.some((r) => !r)) throw new Error("Some exercises failed to save");

      let notesPayload: string | null = null;
      if (sessionRpe != null) {
        let existing: Record<string, unknown> = {};
        try {
          existing = workoutLog.notes ? (JSON.parse(workoutLog.notes) as Record<string, unknown>) : {};
        } catch {
          existing = { note: workoutLog.notes };
        }
        notesPayload = JSON.stringify({ ...existing, sessionRpe });
      }

      const durationMinutes = Math.floor(elapsedSeconds / 60);
      const { error } = await supabase
        .from("workout_logs")
        .update({
          completed_at: new Date().toISOString(),
          duration_minutes: durationMinutes,
          ...(notesPayload ? { notes: notesPayload } : {}),
        })
        .eq("id", workoutLog.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[useActiveWorkoutSession] finish failed:", err);
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
    updateExerciseTargetLoad,
    toggleSetDone,
    swapExercise,
    removeExercise,
    addExercise,
    finishSession,
    setPaused,
    historyPbs,
    lastLoadPerExercise,
    ghostByExercise,
    progressionByExercise,
    method,
  };
}
