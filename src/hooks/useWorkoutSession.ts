import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { supabase } from '@/lib/supabase';
import { isOnline } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * ═══════════════════════════════════════════════════════════════
 * useWorkoutSession — High-level hook for a full workout session
 * Phase 2: The "Gym Wi-Fi" Fix
 * ═══════════════════════════════════════════════════════════════
 *
 * Composes useResilientForm + useOfflineQueue to manage an entire
 * workout: multiple exercises, each with multiple sets.
 * Auto-saves every keystroke. Queues for sync if offline.
 */

export interface ExerciseFormData {
  sets: { reps: string; weight: string; rpe: string; done: boolean }[];
  notes: string;
}

export interface WorkoutSessionState {
  /* Per-exercise form state (managed by useResilientForm) */
  getExerciseData: (exerciseId: string) => ExerciseFormData;
  updateSet: (exerciseId: string, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: string) => void;
  toggleSetDone: (exerciseId: string, setIndex: number) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setIndex: number) => void;
  updateNotes: (exerciseId: string, notes: string) => void;

  /* Session-level actions */
  submitExercise: (exerciseId: string, exerciseName: string) => Promise<boolean>;
  submitAll: () => Promise<void>;
  isSubmitting: boolean;
  isOffline: boolean;
  pendingCount: number;
  failedCount: number;
  lastSaved: Date | null;
  retryAll: () => Promise<void>;
  clearQueue: () => void;
}

export interface UseWorkoutSessionOptions {
  workoutLogId: string;
  clientId: string;
  exercises: { id: string; name: string; targetSets: number; targetReps: string }[];
}

/* ─── Helper: build storage key for an exercise ─── */

function buildExerciseKey(userId: string, workoutLogId: string, exerciseId: string): string {
  return `azfit:workout:${userId}:${workoutLogId}:ex_${exerciseId}`;
}

/* ─── Untyped Supabase helper ─── */

function getTableRef(supabase: typeof import('@/lib/supabase').supabase, table: string) {
  return (supabase as unknown as { from: (t: string) => { insert: (p: unknown) => Promise<{ error: { message: string } | null }> } }).from(table);
}

/* ─── Hook ─── */

export function useWorkoutSession(options: UseWorkoutSessionOptions): WorkoutSessionState {
  const { workoutLogId, clientId, exercises } = options;
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  /* ── Offline queue for the session ── */
  const {
    pendingCount,
    failedCount,
    enqueue,
    retryAll,
    clearQueue,
  } = useOfflineQueue(userId, supabase);

  /* ── In-memory state for all exercises ── */
  const [exerciseData, setExerciseData] = useState<Record<string, ExerciseFormData>>(() => {
    // Hydrate from localStorage on mount
    const initial: Record<string, ExerciseFormData> = {};
    for (const ex of exercises) {
      const key = buildExerciseKey(userId, workoutLogId, ex.id);
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.data) initial[ex.id] = parsed.data;
        } catch {
          // ignore parse errors
        }
      }
      if (!initial[ex.id]) {
        // Seed with target sets
        initial[ex.id] = {
          sets: Array.from({ length: ex.targetSets }, () => ({
            reps: ex.targetReps.split('-')[0] || '',
            weight: '',
            rpe: '',
            done: false,
          })),
          notes: '',
        };
      }
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  /* ── Watch online status ── */
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /* ── Persist to localStorage on every change ── */
  useEffect(() => {
    for (const [exId, data] of Object.entries(exerciseData)) {
      const key = buildExerciseKey(userId, workoutLogId, exId);
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), synced: false }));
    }
  }, [exerciseData, userId, workoutLogId]);

  /* ── getExerciseData ── */
  const getExerciseData = useCallback(
    (exerciseId: string): ExerciseFormData => {
      return exerciseData[exerciseId] || { sets: [], notes: '' };
    },
    [exerciseData]
  );

  /* ── updateSet ── */
  const updateSet = useCallback(
    (exerciseId: string, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: string) => {
      setExerciseData((prev) => {
        const ex = prev[exerciseId];
        if (!ex) return prev;
        const sets = [...ex.sets];
        if (sets[setIndex]) {
          sets[setIndex] = { ...sets[setIndex], [field]: value };
        }
        return { ...prev, [exerciseId]: { ...ex, sets } };
      });
    },
    []
  );

  /* ── toggleSetDone ── */
  const toggleSetDone = useCallback((exerciseId: string, setIndex: number) => {
    setExerciseData((prev) => {
      const ex = prev[exerciseId];
      if (!ex) return prev;
      const sets = [...ex.sets];
      if (sets[setIndex]) {
        sets[setIndex] = { ...sets[setIndex], done: !sets[setIndex].done };
      }
      return { ...prev, [exerciseId]: { ...ex, sets } };
    });
  }, []);

  /* ── addSet ── */
  const addSet = useCallback((exerciseId: string) => {
    setExerciseData((prev) => {
      const ex = prev[exerciseId];
      if (!ex) return prev;
      return {
        ...prev,
        [exerciseId]: {
          ...ex,
          sets: [...ex.sets, { reps: '', weight: '', rpe: '', done: false }],
        },
      };
    });
  }, []);

  /* ── removeSet ── */
  const removeSet = useCallback((exerciseId: string, setIndex: number) => {
    setExerciseData((prev) => {
      const ex = prev[exerciseId];
      if (!ex) return prev;
      return {
        ...prev,
        [exerciseId]: {
          ...ex,
          sets: ex.sets.filter((_, i) => i !== setIndex),
        },
      };
    });
  }, []);

  /* ── updateNotes ── */
  const updateNotes = useCallback((exerciseId: string, notes: string) => {
    setExerciseData((prev) => {
      const ex = prev[exerciseId];
      if (!ex) return prev;
      return { ...prev, [exerciseId]: { ...ex, notes } };
    });
  }, []);

  /* ── submitExercise: write one exercise to Supabase ── */
  const submitExercise = useCallback(
    async (exerciseId: string, exerciseName: string): Promise<boolean> => {
      const data = exerciseData[exerciseId];
      if (!data) return false;

      setIsSubmitting(true);

      const payload: Record<string, unknown> = {
        workout_log_id: workoutLogId,
        client_id: clientId,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        sets_completed: data.sets.filter((s) => s.done).length,
        total_sets: data.sets.length,
        reps_per_set: data.sets.map((s) => parseInt(s.reps) || 0),
        weight_per_set: data.sets.map((s) => parseFloat(s.weight) || 0),
        rpe_per_set: data.sets.map((s) => parseFloat(s.rpe) || 0),
        notes: data.notes,
        created_at: new Date().toISOString(),
      };

      try {
        const tableRef = getTableRef(supabase, 'workout_log_entries');
        const { error } = await tableRef.insert(payload);
        if (error) throw new Error(error.message);

        // Success: clear localStorage for this exercise
        const key = buildExerciseKey(userId, workoutLogId, exerciseId);
        localStorage.removeItem(key);
        setLastSaved(new Date());
        toast.success(`${exerciseName} saved`);
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[useWorkoutSession] Submit failed:', error.message);

        // Queue for retry
        enqueue({
          table: 'workout_log_entries',
          operation: 'insert',
          payload,
        });
        toast.error(`${exerciseName} queued — will sync when online`);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [exerciseData, workoutLogId, clientId, userId, enqueue]
  );

  /* ── submitAll: write all exercises ── */
  const submitAll = useCallback(async () => {
    for (const ex of exercises) {
      await submitExercise(ex.id, ex.name);
    }
  }, [exercises, submitExercise]);

  return {
    getExerciseData,
    updateSet,
    toggleSetDone,
    addSet,
    removeSet,
    updateNotes,
    submitExercise,
    submitAll,
    isSubmitting,
    isOffline,
    pendingCount,
    failedCount,
    lastSaved,
    retryAll,
    clearQueue,
  };
}
