import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Dumbbell, Clock, ChevronRight, Flame } from 'lucide-react';
import { findWorkoutById, type MasterWorkout } from '@/data/masterWorkouts';
import { setActiveSession, type WorkoutLog, type LoggedExercise, type LoggedSet } from '@/lib/storage';
import { useNavigate } from 'react-router';

interface SessionLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  workoutId: string;
  programId?: string;
  phaseName?: string;
  weekNumber?: number;
  dayNumber?: number;
}

function createEmptySet(setNumber: number, restSeconds: number): LoggedSet {
  return {
    setNumber,
    load: 0,
    reps: 0,
    rpe: 0,
    done: false,
    restSeconds,
    type: 'Normal',
  };
}

function workoutToSession(
  workout: MasterWorkout,
  programId: string,
  phaseName: string,
  weekNumber: number,
  dayNumber: number
): WorkoutLog {
  const exercises: LoggedExercise[] = workout.exercises.map((ex) => ({
    order: ex.order,
    name: ex.name,
    category: ex.category,
    targetSets: ex.sets,
    targetReps: ex.reps,
    targetLoad: 0,
    tempo: ex.tempo,
    sets: Array.from({ length: ex.sets }, (_, i) =>
      createEmptySet(i + 1, ex.rest)
    ),
    notes: '',
  }));

  const totalSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const estimatedVolume = totalSets * 10 * 20; // rough estimate: sets × avg reps × avg load

  return {
    id: crypto.randomUUID(),
    programId,
    clientId: 'self',
    clientName: 'You',
    workoutName: workout.name,
    phaseName,
    weekNumber,
    dayNumber,
    exercises,
    startTime: new Date().toISOString(),
    durationSeconds: 0,
    totalVolume: estimatedVolume,
    totalSets,
    completedSets: 0,
    avgRpe: 0,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

export function SessionLauncher({
  isOpen,
  onClose,
  workoutId,
  programId = 'gbc-phase-1',
  phaseName = 'Block 1: Accumulation',
  weekNumber = 1,
  dayNumber = 1,
}: SessionLauncherProps) {
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);

  const workout = findWorkoutById(workoutId);

  const handleStart = () => {
    if (!workout) return;
    setIsLaunching(true);
    const session = workoutToSession(workout, programId, phaseName, weekNumber, dayNumber);
    setActiveSession(session);
    setTimeout(() => {
      navigate(`/sheets?session=${session.id}`);
    }, 400);
  };

  const previewExercises = workout?.exercises.slice(0, 4) || [];
  const remainingCount = (workout?.exercises.length || 0) - previewExercises.length;
  const exerciseCount = workout?.exercises.length || 0;
  const estimatedDuration = 45; // minutes

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B1120] border-t border-slate-700/50 rounded-t-3xl max-h-[85vh] overflow-y-auto"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-600" />
            </div>

            <div className="px-5 pb-8 pt-2">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-[#00AEEF]/15 text-[#00AEEF] text-[10px] font-bold uppercase tracking-wider">
                      {phaseName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-medium">
                      Week {weekNumber}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{workout?.name || 'Workout'}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">AzFIT GBC Program</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Row */}
              <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-[#00AEEF]" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{exerciseCount}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Exercises</div>
                  </div>
                </div>
                <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">~{estimatedDuration}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Minutes</div>
                  </div>
                </div>
                <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">GBC</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Method</div>
                  </div>
                </div>
              </div>

              {/* Exercise Preview */}
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Exercise Preview
                </h3>
                <div className="space-y-2">
                  {previewExercises.map((ex) => (
                    <div
                      key={ex.order}
                      className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 border border-slate-700/30 rounded-xl"
                    >
                      <span className="w-8 h-8 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center text-xs font-bold text-[#00AEEF]">
                        {ex.order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{ex.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {ex.sets} sets × {ex.reps} @ {ex.tempo}
                        </div>
                      </div>
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                      <ChevronRight className="w-4 h-4" />
                      +{remainingCount} more exercises
                    </div>
                  )}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={isLaunching || !workout}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base
                  bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] transition-all active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLaunching ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-[#0B1120] border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Start Workout
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
