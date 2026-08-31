import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Clock, ChevronDown, ChevronUp, Calendar, Trophy, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { findCategoryForExercise } from '@/data/exerciseDatabase';
import { toast } from 'sonner';
import type { Database } from '@/types/supabase';

type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row'];
type EntryRow = Database['public']['Tables']['workout_log_entries']['Row'];

interface ExerciseSet {
  reps: number;
  weight: number;
  rpe?: number;
}

interface DisplayExercise {
  name: string;
  muscleGroup: string;
  sets: ExerciseSet[];
}

interface DisplayLog {
  id: string;
  date: string;
  workoutName: string;
  durationMinutes: number | null;
  completed: boolean;
  totalVolume: number;
  avgRpe: number | null;
  exercises: DisplayExercise[];
  notes: string | null;
}

interface WorkoutLogsTabProps {
  clientId: string; // clients.id — workout_logs.client_id references clients(id)
}

export default function WorkoutLogsTab({ clientId }: WorkoutLogsTabProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<DisplayLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data: logRows, error: logErr } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (logErr) throw logErr;
      const rows = (logRows as WorkoutLogRow[]) || [];

      const logIds = rows.map((r) => r.id);
      const workoutIds = Array.from(new Set(rows.map((r) => r.workout_id)));

      const [{ data: entryRows }, { data: workoutRows }] = await Promise.all([
        logIds.length
          ? supabase.from('workout_log_entries').select('*').in('workout_log_id', logIds)
          : Promise.resolve({ data: [] as EntryRow[] }),
        workoutIds.length
          ? supabase.from('workouts').select('id, name').in('id', workoutIds)
          : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
      ]);

      const nameByWorkoutId = new Map<string, string>();
      for (const w of (workoutRows as { id: string; name: string | null }[]) || []) {
        nameByWorkoutId.set(w.id, w.name || 'Workout');
      }

      const entriesByLog = new Map<string, EntryRow[]>();
      for (const e of (entryRows as EntryRow[]) || []) {
        const list = entriesByLog.get(e.workout_log_id) || [];
        list.push(e);
        entriesByLog.set(e.workout_log_id, list);
      }

      const mapped: DisplayLog[] = rows.map((log) => {
        const entries = entriesByLog.get(log.id) || [];
        let totalVolume = 0;
        const rpes: number[] = [];
        const exercises: DisplayExercise[] = entries.map((e) => {
          const reps = (e.reps_per_set as number[]) || [];
          const weights = (e.weight_per_set as number[]) || [];
          const rpeArr = (e.rpe_per_set as number[]) || [];
          const sets: ExerciseSet[] = reps.map((repsVal, i) => {
            const weight = Number(weights[i]) || 0;
            const r = Number(repsVal) || 0;
            totalVolume += weight * r;
            const rpe = Number(rpeArr[i]) || 0;
            if (rpe > 0) rpes.push(rpe);
            return { reps: r, weight, rpe: rpe || undefined };
          });
          return {
            name: e.exercise_name,
            muscleGroup: findCategoryForExercise(e.exercise_name) || 'Other',
            sets,
          };
        });

        return {
          id: log.id,
          date: log.completed_at || log.created_at,
          workoutName: nameByWorkoutId.get(log.workout_id) || 'Workout',
          durationMinutes: log.duration_minutes,
          completed: !!log.completed_at,
          totalVolume,
          avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
          exercises,
          notes: log.notes,
        };
      });

      setLogs(mapped);
    } catch (err) {
      toast.error('Failed to load workout logs: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <Dumbbell size={32} style={{ color: 'var(--light-text-muted)' }} />
        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--light-text-muted)' }}>No workouts logged yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <motion.div
          key={log.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          {/* Log Header */}
          <button
            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: log.completed ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--warning) 15%, transparent)' }}>
                {log.completed ? <Trophy size={20} style={{ color: 'var(--success)' }} /> : <Dumbbell size={20} style={{ color: 'var(--warning)' }} />}
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--page-text)' }}>{log.workoutName}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                    <Calendar size={10} />
                    {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {log.durationMinutes != null && (
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                      <Clock size={10} />
                      {log.durationMinutes}m
                    </span>
                  )}
                  {log.totalVolume > 0 && (
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                      <Flame size={10} />
                      {Math.round(log.totalVolume).toLocaleString()} kg vol
                    </span>
                  )}
                  {log.avgRpe != null && (
                    <span className="text-[10px] font-medium" style={{ color: '#8B5CF6' }}>
                      RPE {log.avgRpe}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: log.completed ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--warning) 10%, transparent)', color: log.completed ? 'var(--success)' : 'var(--warning)' }}>
                {log.completed ? 'Completed' : 'Partial'}
              </span>
              {expandedLog === log.id ? <ChevronUp size={16} style={{ color: 'var(--light-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--light-text-muted)' }} />}
            </div>
          </button>

          {/* Expanded Exercises */}
          <AnimatePresence>
            {expandedLog === log.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2">
                  {log.exercises.map((exercise) => (
                    <div key={exercise.name} className="rounded-xl p-3" style={{ backgroundColor: 'var(--light-elevated)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--page-text)' }}>{exercise.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--light-text-muted)' }}>{exercise.muscleGroup}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.sets.map((set, i) => (
                          <div key={i} className="text-[10px] px-2 py-1 rounded-md border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--light-text-secondary)' }}>
                            {set.reps} reps × {set.weight} kg{set.rpe ? ` @${set.rpe}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {log.notes && (
                    <p className="text-xs italic mt-2" style={{ color: 'var(--light-text-muted)' }}>"{log.notes}"</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
