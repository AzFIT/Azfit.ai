import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react';
import type { LoggedExercise, LoggedSet, SetType } from '@/lib/storage';
import { SET_TYPE_COLORS } from '@/lib/storage';

interface ExerciseCardProps {
  exercise: LoggedExercise;
  onUpdate: (updated: LoggedExercise) => void;
  onRestTimer: (seconds: number, nextExerciseName: string, nextSetNumber: number) => void;
  isNext?: boolean;
}

const SET_TYPES: SetType[] = [
  'Normal', 'Warm-up', 'Superset', 'Giant Set', 'AMRAP',
  'Drop Set', 'To Failure', 'Cluster', 'Back-off', 'Eccentric'
];

export function ExerciseCard({ exercise, onUpdate, onRestTimer, isNext }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const completedSets = exercise.sets.filter((s) => s.done).length;
  const totalVolume = exercise.sets
    .filter((s) => s.done)
    .reduce((sum, s) => sum + s.load * s.reps, 0);
  const avgRpe =
    exercise.sets.filter((s) => s.done && s.rpe > 0).length > 0
      ? exercise.sets
          .filter((s) => s.done && s.rpe > 0)
          .reduce((sum, s) => sum + s.rpe, 0) /
        exercise.sets.filter((s) => s.done && s.rpe > 0).length
      : 0;

  const progressPct = exercise.targetSets > 0 ? (completedSets / exercise.targetSets) * 100 : 0;

  const updateSet = useCallback(
    (setIndex: number, updates: Partial<LoggedSet>) => {
      const newSets = [...exercise.sets];
      newSets[setIndex] = { ...newSets[setIndex], ...updates };

      // Auto-fill from prescribed if empty when marking done
      if (updates.done === true) {
        if (newSets[setIndex].load === 0) {
          // Try to carry over from previous done set
          const prevDone = newSets.slice(0, setIndex).reverse().find((s) => s.done);
          if (prevDone) newSets[setIndex].load = prevDone.load;
        }
        if (newSets[setIndex].reps === 0) {
          const targetReps = parseInt(exercise.targetReps.split('-')[0]) || 10;
          newSets[setIndex].reps = targetReps;
        }
        if (newSets[setIndex].rpe === 0) {
          newSets[setIndex].rpe = 7;
        }
        if (newSets[setIndex].restSeconds === 0) {
          newSets[setIndex].restSeconds = 60;
        }
      }

      onUpdate({ ...exercise, sets: newSets });
    },
    [exercise, onUpdate]
  );

  const addSet = useCallback(() => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: LoggedSet = {
      setNumber: exercise.sets.length + 1,
      load: lastSet?.load || 0,
      reps: lastSet?.reps || 0,
      rpe: 0,
      done: false,
      restSeconds: lastSet?.restSeconds || 60,
      type: 'Normal',
    };
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] });
  }, [exercise, onUpdate]);

  const removeSet = useCallback(
    (index: number) => {
      const newSets = exercise.sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, setNumber: i + 1 }));
      onUpdate({ ...exercise, sets: newSets });
    },
    [exercise, onUpdate]
  );

  const handleDoneToggle = (setIndex: number, done: boolean) => {
    updateSet(setIndex, { done });
    if (done) {
      const restSec = exercise.sets[setIndex].restSeconds || 60;
      onRestTimer(restSec, exercise.name, setIndex + 2);
    }
  };

  const prescribedText = `${exercise.targetSets} × ${exercise.targetReps} @ ${exercise.tempo}`;

  return (
    <motion.div
      layout
      className={`bg-slate-900/60 border rounded-2xl overflow-hidden transition-colors
        ${expanded ? 'border-slate-600' : 'border-slate-800 hover:border-slate-700'}
        ${isNext ? 'ring-1 ring-[#00AEEF]/30' : ''}`}
    >
      {/* Collapsed Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* Order Badge */}
        <div className="w-10 h-10 rounded-xl bg-[#00AEEF]/15 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-[#00AEEF]">{exercise.order}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{exercise.name}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 uppercase">
              {exercise.category}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{prescribedText}</div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-24">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00AEEF] to-purple-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 text-right">
              {completedSets}/{exercise.targetSets}
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Set Table Header */}
              <div className="grid grid-cols-[28px_1fr_72px_56px_48px_56px_80px_36px] gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Set</span>
                <span>Prescribed</span>
                <span className="text-center">Load</span>
                <span className="text-center">Reps</span>
                <span className="text-center">RPE</span>
                <span className="text-center">Rest</span>
                <span>Type</span>
                <span></span>
              </div>

              {/* Set Rows */}
              <div className="space-y-1">
                {exercise.sets.map((set, i) => (
                  <SetRow
                    key={i}
                    set={set}
                    exercise={exercise}
                    onUpdate={(updates) => updateSet(i, updates)}
                    onDoneToggle={(done) => handleDoneToggle(i, done)}
                    onRemove={() => removeSet(i)}
                  />
                ))}
              </div>

              {/* Add Set + Summary */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                <button
                  onClick={addSet}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700
                    text-xs text-slate-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Set
                </button>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">
                    Vol: <span className="text-white font-medium">{totalVolume.toLocaleString()}</span> kg
                  </span>
                  {avgRpe > 0 && (
                    <span className="text-slate-500">
                      Avg RPE: <span className="text-white font-medium">{avgRpe.toFixed(1)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SET ROW
// ═══════════════════════════════════════════════════════════════

interface SetRowProps {
  set: LoggedSet;
  exercise: LoggedExercise;
  onUpdate: (updates: Partial<LoggedSet>) => void;
  onDoneToggle: (done: boolean) => void;
  onRemove: () => void;
}

function SetRow({ set, exercise, onUpdate, onDoneToggle, onRemove }: SetRowProps) {
  const isDone = set.done;
  const prescribedDisplay = `${exercise.targetSets}×${exercise.targetReps}`;

  return (
    <div
      className={`grid grid-cols-[28px_1fr_72px_56px_48px_56px_80px_36px] gap-1.5 px-2 py-2 rounded-xl items-center transition-colors
        ${isDone ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/40 border border-transparent'}
      `}
    >
      {/* Set Number */}
      <span className={`text-xs font-bold ${isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
        {set.setNumber}
      </span>

      {/* Prescribed */}
      <span className="text-xs text-slate-400 truncate">
        {prescribedDisplay} @ {exercise.tempo}
      </span>

      {/* Load Input */}
      <input
        type="number"
        min={0}
        step={0.5}
        value={set.load || ''}
        onChange={(e) => onUpdate({ load: parseFloat(e.target.value) || 0 })}
        placeholder="kg"
        className={`w-full px-1.5 py-1 rounded-md text-xs text-center focus:outline-none
          ${isDone
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900 border border-slate-700 text-white focus:border-[#00AEEF]'
          }`}
      />

      {/* Reps Input */}
      <input
        type="number"
        min={0}
        max={100}
        value={set.reps || ''}
        onChange={(e) => onUpdate({ reps: parseInt(e.target.value) || 0 })}
        placeholder="reps"
        className={`w-full px-1.5 py-1 rounded-md text-xs text-center focus:outline-none
          ${isDone
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900 border border-slate-700 text-white focus:border-[#00AEEF]'
          }`}
      />

      {/* RPE Input */}
      <input
        type="number"
        min={1}
        max={10}
        step={0.5}
        value={set.rpe || ''}
        onChange={(e) => onUpdate({ rpe: parseFloat(e.target.value) || 0 })}
        placeholder="RPE"
        className={`w-full px-1.5 py-1 rounded-md text-xs text-center focus:outline-none
          ${isDone
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900 border border-slate-700 text-white focus:border-[#00AEEF]'
          }`}
      />

      {/* Rest Input */}
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          min={0}
          max={300}
          step={5}
          value={set.restSeconds || ''}
          onChange={(e) => onUpdate({ restSeconds: parseInt(e.target.value) || 0 })}
          className={`w-full px-1 py-1 rounded-md text-xs text-center focus:outline-none
            ${isDone
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-slate-900 border border-slate-700 text-white focus:border-[#00AEEF]'
            }`}
        />
        <span className="text-[10px] text-slate-600">s</span>
      </div>

      {/* Type Select */}
      <select
        value={set.type}
        onChange={(e) => onUpdate({ type: e.target.value as SetType })}
        className={`w-full px-1 py-1 rounded-md text-[10px] focus:outline-none cursor-pointer
          ${isDone
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900 border border-slate-700 text-slate-300 focus:border-[#00AEEF]'
          }`}
        style={{ color: isDone ? undefined : SET_TYPE_COLORS[set.type] }}
      >
        {SET_TYPES.map((t) => (
          <option key={t} value={t} style={{ color: SET_TYPE_COLORS[t] }}>
            {t}
          </option>
        ))}
      </select>

      {/* Done + Remove */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDoneToggle(!isDone)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
            ${isDone
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-500'
            }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
