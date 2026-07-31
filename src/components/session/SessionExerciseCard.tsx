import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle, Square, Plus, Minus, Pencil, StickyNote, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import type { SessionExercise, SessionSet } from '@/lib/workoutSession';
import type { SessionUpdateResult } from '@/hooks/useActiveWorkoutSession';
import {
  SET_TYPES,
  REST_OPTIONS,
  getLiftedVolumeForExercise,
  getTargetVolumeForExercise,
  getAvgRpe,
  getBestEstimatedOneRepMax,
} from '@/lib/workoutSession';
import type { SetType } from '@/lib/storage';
import { getAllExercisesFlat } from '@/data/exerciseDatabase';
import { toast } from 'sonner';
import { findExerciseSubstitutions } from '@/lib/exerciseSwap';

const BAR_WEIGHT_KG = 20;
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const PRESET_SECONDS = [30, 60, 90, 120, 180, 300];

interface PlateBreakdown {
  plates: number[];
  exact: boolean;
  actualLoad: number;
}

function plateBreakdown(load: number, barWeight = BAR_WEIGHT_KG): PlateBreakdown {
  if (load <= barWeight) return { plates: [], exact: true, actualLoad: barWeight };
  const targetPerSide = (load - barWeight) / 2;
  let remaining = targetPerSide;
  const plates: number[] = [];
  for (const plate of PLATES_KG) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining -= plate;
    }
  }
  const actualPerSide = targetPerSide - remaining;
  const actualLoad = barWeight + actualPerSide * 2;
  return { plates, exact: remaining < 0.001, actualLoad };
}

function formatPlateBreakdown(load: number, unit: 'kg' | 'lbs'): string {
  if (!load || load <= BAR_WEIGHT_KG) return '';
  const { plates, exact, actualLoad } = plateBreakdown(unit === 'lbs' ? load * 0.453592 : load);
  if (plates.length === 0) return '';
  const plateText = plates.length === 1 ? `${plates[0]}` : plates.join(' + ');
  const loadDisplay = unit === 'lbs' ? Math.round(actualLoad / 0.453592) : actualLoad;
  const targetDisplay = unit === 'lbs' ? Math.round(load / 0.453592) : load;
  if (exact) {
    return `${targetDisplay}${unit} = ${BAR_WEIGHT_KG} bar + ${plateText} /side`;
  }
  return `${targetDisplay}${unit} → ${loadDisplay}${unit} nearest: ${BAR_WEIGHT_KG} bar + ${plateText} /side`;
}

function getRpeHint(rpe: number, reps: number, targetReps: number, load: number, unit: 'kg' | 'lbs'): string | null {
  if (!rpe || rpe < 1) return null;
  if (rpe >= 9) {
    return `That was RPE ${rpe} — keep ${load}${unit} or drop 2.5${unit} for the next set.`;
  }
  if (rpe <= 7 && reps >= targetReps) {
    return `That was RPE ${rpe} — consider +2.5${unit} next set.`;
  }
  return null;
}

function parseTargetReps(reps: string): number {
  const match = reps.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function formatPreset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}:00` : `${m}:${s.toString().padStart(2, '0')}`;
}

interface SessionExerciseCardProps {
  exercise: SessionExercise;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateSet: (setIndex: number, updates: Partial<SessionSet>) => void;
  onUpdateTargetLoad: (load: number) => void;
  onToggleDone: (setIndex: number) => Promise<SessionUpdateResult | null>;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onSwapExercise: (newName: string) => void;
  onRemoveExercise: () => void;
  onStartRest: (exerciseId: string, setIndex: number, seconds: number) => void;
  onSkipRest: (exerciseId: string) => void;
  onAddRest: (exerciseId: string, seconds: number) => void;
  restTimer: { active: boolean; remaining: number; setIndex: number } | undefined;
  lastLoad: number;
  unit?: 'kg' | 'lbs';
  workoutExerciseNames?: string[];
}

export function SessionExerciseCard({
  exercise,
  isExpanded,
  onToggle,
  onUpdateSet,
  onUpdateTargetLoad,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onSwapExercise,
  onRemoveExercise,
  onStartRest,
  onSkipRest,
  onAddRest,
  restTimer,
  lastLoad,
  unit = 'kg',
  workoutExerciseNames,
}: SessionExerciseCardProps) {
  const [focusedSet, setFocusedSet] = useState<number | null>(null);
  const [noteSet, setNoteSet] = useState<number | null>(null);
  const [showPr, setShowPr] = useState<number | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [swapQuery, setSwapQuery] = useState('');
  const [lastPresetSeconds, setLastPresetSeconds] = useState<Record<string, number>>({});
  const [rpeHint, setRpeHint] = useState<{ setIndex: number; text: string } | null>(null);

  const allDone = useMemo(() => exercise.sets.length > 0 && exercise.sets.every((s) => s.done), [exercise.sets]);
  const completedCount = useMemo(() => exercise.sets.filter((s) => s.done).length, [exercise.sets]);
  const progressPct = useMemo(
    () => (exercise.sets.length > 0 ? Math.round((completedCount / exercise.sets.length) * 100) : 0),
    [completedCount, exercise.sets.length]
  );

  const liftedVol = useMemo(() => getLiftedVolumeForExercise(exercise), [exercise]);
  const targetVol = useMemo(() => getTargetVolumeForExercise(exercise), [exercise]);
  const avgRpe = useMemo(() => getAvgRpe(exercise), [exercise]);
  const est1RM = useMemo(() => getBestEstimatedOneRepMax(exercise), [exercise]);

  const handlePillClick = useCallback(
    (delta: number) => {
      if (focusedSet === null || focusedSet >= exercise.sets.length) return;
      const targetSet = exercise.sets[focusedSet];
      const current = targetSet.clientLoad || targetSet.load || exercise.targetLoad || 0;
      if (current <= 0) return;
      const newVal = Math.round((current + delta) * 10) / 10;
      onUpdateSet(focusedSet, { clientLoad: newVal, load: newVal });
    },
    [exercise.sets, exercise.targetLoad, focusedSet, onUpdateSet]
  );

  const handleAllAdjust = useCallback(
    (value: number) => {
      exercise.sets.forEach((s, i) => {
        if (!s.done) onUpdateSet(i, { clientLoad: value, load: value });
      });
    },
    [exercise.sets, onUpdateSet]
  );

  const handleToggleDone = useCallback(
    async (setIdx: number) => {
      const s = exercise.sets[setIdx];
      if (!s) return;

      const result = await onToggleDone(setIdx);

      if (s.done) {
        // Was done; now undone
        if (restTimer?.active && restTimer?.setIndex === setIdx) {
          onSkipRest(exercise.id);
        }
        if (rpeHint?.setIndex === setIdx) {
          setRpeHint(null);
        }
        return;
      }

      // Was not done; now done
      if (result?.newPb) {
        setShowPr(setIdx);
        setTimeout(() => setShowPr(null), 2500);
        const pbLabel =
          result.pbType === 'volume'
            ? `${Math.round(result.current)} ${unit} volume`
            : `${result.current.toFixed(1)} ${unit} est. 1RM`;
        toast.success(`New PB: ${exercise.name} ${pbLabel}`);
      }

      const targetReps = parseTargetReps(exercise.targetReps);
      const hint = getRpeHint(s.rpe, s.reps, targetReps, s.load || s.clientLoad || exercise.targetLoad || 0, unit);
      setRpeHint(hint ? { setIndex: setIdx, text: hint } : null);

      const restSeconds = lastPresetSeconds[exercise.id] ?? s.restSeconds ?? 60;
      onStartRest(exercise.id, setIdx, restSeconds);
    },
    [exercise, onToggleDone, onStartRest, onSkipRest, restTimer, unit, lastPresetSeconds, rpeHint]
  );

  const handleSwap = useCallback(
    (name: string) => {
      onSwapExercise(name);
      setShowSwap(false);
    },
    [onSwapExercise]
  );

  // Phase 33C Fix 6: create a custom exercise from the Swap dialog.
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customEquipment, setCustomEquipment] = useState('');
  const [customDifficulty, setCustomDifficulty] = useState('Intermediate');
  const [customType, setCustomType] = useState('Compound');
  const [muscleOptions, setMuscleOptions] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [customSaving, setCustomSaving] = useState(false);

  // Live option sets for the custom form (distinct values in the library)
  useEffect(() => {
    if (!showCustomForm) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('exercise_library').select('primary_muscle, equipment').eq('is_active', true).limit(500);
      if (cancelled || !data) return;
      setMuscleOptions([...new Set(data.map((r) => r.primary_muscle))].sort());
      setEquipmentOptions([...new Set(data.map((r) => r.equipment))].sort());
    })();
    return () => { cancelled = true; };
  }, [showCustomForm]);

  const slugifyCustom = (name: string) =>
    name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleCreateCustom = useCallback(async () => {
    const name = customName.trim();
    if (!name || !customMuscle || !customEquipment) {
      toast.error('Name, primary muscle and equipment are required');
      return;
    }
    setCustomSaving(true);
    try {
      // Next code in the EX#### series + a unique slug
      const { data: maxRows } = await supabase.from('exercise_library').select('code').order('code', { ascending: false }).limit(1);
      const maxNum = maxRows?.[0]?.code ? parseInt(maxRows[0].code.replace(/\D/g, ''), 10) || 0 : 0;
      const code = `EX${String(maxNum + 1).padStart(4, '0')}`;
      let slug = slugifyCustom(name);
      const { data: slugClash } = await supabase.from('exercise_library').select('slug').eq('slug', slug).maybeSingle();
      if (slugClash) slug = `${slug}-2`;

      const { error } = await supabase.from('exercise_library').insert({
        code,
        exercise_code: code,
        slug,
        name,
        equipment: customEquipment,
        primary_muscle: customMuscle,
        difficulty: customDifficulty,
        exercise_type: customType,
        is_active: true,
      });
      if (error) {
        // RLS fallback: library insert blocked — keep it session-local
        handleSwap(name);
        setShowCustomForm(false);
        toast.info(`"${name}" added to this session only — the library blocked the save`);
        return;
      }
      toast.success(`"${name}" added to the exercise library`);
      setShowCustomForm(false);
      setCustomName('');
      handleSwap(name);
    } finally {
      setCustomSaving(false);
    }
  }, [customName, customMuscle, customEquipment, customDifficulty, customType, handleSwap]);

  const formatRest = (s: SessionSet) => {
    if (!restTimer || !restTimer.active) return `${s.restSeconds}s`;
    const rt = restTimer;
    if (rt.remaining <= 0) return 'Done';
    const m = Math.floor(rt.remaining / 60);
    const sec = rt.remaining % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const prescribedText = (s: SessionSet) =>
    `${exercise.targetSets}×${exercise.targetReps} @ ${exercise.targetLoad || '-'}${unit} (tempo ${s.tempo})`;

  const rankedSuggestions = useMemo(() => {
    const excluded = (workoutExerciseNames || []).filter((n) => n !== exercise.name);
    return findExerciseSubstitutions(exercise.name, { excluded });
  }, [exercise.name, workoutExerciseNames]);

  const browseOptions = useMemo(() => {
    const all = getAllExercisesFlat().filter((n) => n !== exercise.name);
    if (!swapQuery) return [];
    return all.filter((n) => n.toLowerCase().includes(swapQuery.toLowerCase())).slice(0, 20);
  }, [swapQuery, exercise.name]);

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        isExpanded
          ? 'border-[#00AEEF]/25 shadow-[0_0_20px_rgba(0,174,239,0.06)]'
          : 'border-[var(--card-border)] hover:border-[var(--text-muted)]/50'
      } ${allDone && isExpanded ? 'border-emerald-500/20' : ''}`}
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none min-h-[52px]"
        onClick={onToggle}
      >
        <span className="text-[13px] px-1.5 py-0.5 rounded bg-[#00AEEF]/10 text-[#00AEEF] font-mono shrink-0">
          {exercise.order}
        </span>

        <span className="text-[var(--text-primary)] font-semibold text-[15px] truncate">{exercise.name}</span>

        <span className="text-[#00AEEF] font-semibold text-sm tabular-nums ml-auto">
          {exercise.sets.length}×{exercise.targetReps}
        </span>

        <div className="flex items-center gap-1 text-sm">
          <Input
            type="number"
            step={0.5}
            value={exercise.targetLoad || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onUpdateTargetLoad(val);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-14 h-7 px-1.5 text-center text-[13px] font-semibold bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--text-primary)] focus:border-[#00AEEF] py-0"
          />
          <span className="text-[var(--text-muted)] text-[12px] font-medium">{unit}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[#00AEEF] transition-all duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <ChevronDown size={18} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSwap(true);
          }}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[#00AEEF] transition-colors"
          title="Edit exercise"
        >
          <Pencil size={15} />
        </button>
      </div>

      {/* Expanded Body */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-[13px]">
            <thead>
              <tr className="text-left">
                {['Set', 'Prescribed', 'Client Load', 'Load', 'Reps', 'RPE', 'Rest', 'Type', 'Done'].map((h) => (
                  <th
                    key={h}
                    className="pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-2"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exercise.sets.map((s, si) => (
                <tr
                  key={si}
                  className={`transition-colors duration-300 border-b border-[var(--card-border)]/20 last:border-0 ${
                    s.done ? 'bg-emerald-500/[0.12] border-l-[3px] border-l-emerald-500' : 'border-l-[3px] border-l-transparent'
                  } ${focusedSet === si ? 'ring-1 ring-inset ring-[#00AEEF]/40' : ''}`}
                >
                  <td className="py-2 px-2 text-[var(--text-muted)] tabular-nums">{s.setNumber}</td>
                  <td className="py-2 px-2 text-[var(--text-muted)] text-[12px] whitespace-nowrap">{prescribedText(s)}</td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      step={0.5}
                      value={s.clientLoad || ''}
                      placeholder="—"
                      onFocus={() => setFocusedSet(si)}
                      onBlur={() => setTimeout(() => setFocusedSet(null), 300)}
                      onChange={(e) => onUpdateSet(si, { clientLoad: parseFloat(e.target.value) || 0, load: parseFloat(e.target.value) || 0 })}
                      className="w-16 h-8 px-1.5 text-center text-[13px] font-medium bg-[var(--page-bg)] border-[var(--card-border)] focus:border-[#00AEEF] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] tabular-nums"
                    />
                    {lastLoad > 0 && (
                      <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">last: {lastLoad}{unit}</span>
                    )}
                    {s.clientLoad > 20 && exercise.equipment === 'Barbell' && (
                      <span className="block text-[10px] text-[#00AEEF] mt-0.5">{formatPlateBreakdown(s.clientLoad, unit)}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-semibold text-[var(--text-primary)] tabular-nums">{s.load || '—'}</td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={s.reps || ''}
                      onChange={(e) => onUpdateSet(si, { reps: parseInt(e.target.value) || 0 })}
                      className="w-12 h-8 px-1 text-center text-[13px] bg-[var(--page-bg)] border-[var(--card-border)] focus:border-[#00AEEF] text-[var(--text-primary)] tabular-nums"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={s.rpe || ''}
                      placeholder="—"
                      onChange={(e) => onUpdateSet(si, { rpe: parseFloat(e.target.value) || 0 })}
                      className="w-10 h-8 px-1 text-center text-[13px] bg-[var(--page-bg)] border-[var(--card-border)] focus:border-[#00AEEF] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] tabular-nums"
                    />
                  </td>
                  <td className="py-2 px-2 tabular-nowrap align-top">
                    {restTimer?.active && restTimer?.setIndex === si ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[13px] tabular-nums ${
                              restTimer.remaining < 15 ? 'text-red-500 font-semibold' : restTimer.remaining < 30 ? 'text-amber-400' : 'text-[#00AEEF]'
                            }`}
                          >
                            {formatRest(s)}
                          </span>
                          <button onClick={() => onSkipRest(exercise.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] ml-1">
                            Skip
                          </button>
                          <button onClick={() => onAddRest(exercise.id, -15)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            -15
                          </button>
                          <button onClick={() => onAddRest(exercise.id, 15)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            +15
                          </button>
                          <button onClick={() => onAddRest(exercise.id, 30)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            +30
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_SECONDS.map((sec) => (
                            <button
                              key={sec}
                              onClick={() => {
                                setLastPresetSeconds((prev) => ({ ...prev, [exercise.id]: sec }));
                                onStartRest(exercise.id, si, sec);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                                lastPresetSeconds[exercise.id] === sec
                                  ? 'bg-[#00AEEF] text-[#0B1120] border-[#00AEEF]'
                                  : 'bg-[var(--page-bg)] text-[var(--text-muted)] border-[var(--card-border)] hover:border-[#00AEEF] hover:text-[#00AEEF]'
                              }`}
                            >
                              {formatPreset(sec)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <select
                        value={s.restSeconds}
                        onChange={(e) => onUpdateSet(si, { restSeconds: parseInt(e.target.value) || 60 })}
                        className="w-[72px] h-7 text-[11px] bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded px-1"
                      >
                        {REST_OPTIONS.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}s
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={s.type}
                      onChange={(e) => onUpdateSet(si, { type: e.target.value as SetType })}
                      className="w-[100px] h-8 text-[12px] bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded px-1"
                    >
                      {SET_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleDone(si);
                      }}
                      className="relative p-1 rounded-md hover:bg-emerald-500/10 transition-all active:scale-90"
                    >
                      {s.done ? <CheckCircle size={20} className="text-emerald-500" /> : <Square size={20} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" />}
                      {showPr === si && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-400 text-[#0A0A0A] text-[10px] font-bold rounded animate-bounce whitespace-nowrap">
                          NEW PB! 🏆
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSet(si);
                      }}
                      className="ml-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* RPE auto-adjust hint */}
          {rpeHint && (
            <div className="mt-2 text-[11px] font-medium" style={{ color: '#00AEEF' }}>
              {rpeHint.text}
            </div>
          )}

          {/* Quick Adjust Pills */}
          <div className="flex items-center gap-2 mt-2 mb-1">
            <span className="text-[12px] font-semibold text-[#00AEEF] min-w-[50px]">
              {focusedSet !== null ? `Set ${exercise.sets[focusedSet]?.setNumber}:` : 'All sets:'}
            </span>
            <button
              onClick={() => handlePillClick(-2.5)}
              disabled={focusedSet === null}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--card-border)] text-[var(--text-muted)] hover:bg-[#00AEEF] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus size={12} className="inline mr-0.5" />2.5{unit}
            </button>
            <button
              onClick={() => handlePillClick(2.5)}
              disabled={focusedSet === null}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--card-border)] text-[var(--text-muted)] hover:bg-[#00AEEF] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={12} className="inline mr-0.5" />2.5{unit}
            </button>
            <Input
              type="number"
              step={0.5}
              placeholder="type any value"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) handleAllAdjust(val);
              }}
              className="w-28 h-7 text-[11px] bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--text-primary)]"
            />
            <button
              onClick={() => setNoteSet(noteSet === null ? 0 : null)}
              className="ml-auto w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[#00AEEF] transition-colors"
              title="Toggle notes"
            >
              <StickyNote size={14} />
            </button>
          </div>

          {/* Per-set notes */}
          {noteSet !== null && (
            <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              {exercise.sets.map((s, si) => (
                <div key={si} className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-muted)] w-8 text-right">Set {s.setNumber}</span>
                  <Input
                    type="text"
                    value={s.tempo}
                    placeholder="tempo e.g. 3-0-1-0"
                    onChange={(e) => onUpdateSet(si, { tempo: e.target.value })}
                    className="w-28 h-7 text-[12px] bg-[var(--page-bg)] border-[var(--card-border)] focus:border-[#00AEEF]/50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <Input
                    type="text"
                    value={s.note}
                    placeholder="Add note..."
                    onChange={(e) => onUpdateSet(si, { note: e.target.value })}
                    className="flex-1 h-7 text-[12px] bg-[var(--page-bg)]/30 border-[var(--card-border)]/50 focus:border-[#00AEEF]/50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Summary Bar */}
          <div className="mt-3 pt-3 border-t border-[var(--card-border)]/30 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="flex-1 h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    allDone ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6]'
                  }`}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <span className={`text-[12px] font-semibold tabular-nowrap ${allDone ? 'text-emerald-500' : 'text-[#00AEEF]'}`}>
                {progressPct}%
              </span>
            </div>
            <span className="text-[12px] text-[var(--text-muted)] tabular-nowrap">
              Vol: <span className="text-[var(--text-primary)] font-medium">{liftedVol.toLocaleString()}</span> / {targetVol.toLocaleString()} {unit}
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">
              Avg RPE: <span className="text-[#00AEEF] font-semibold">{avgRpe > 0 ? avgRpe.toFixed(1) : '—'}</span>
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">
              Est 1RM: <span className="text-[#8B5CF6] font-semibold">{est1RM > 0 ? `~${Math.round(est1RM)}` : '—'}</span> {unit}
            </span>
            {allDone && (
              <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                <CheckCircle size={12} />
                All Sets Complete
              </span>
            )}
            <button
              onClick={onAddSet}
              className="ml-auto px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6] text-white hover:opacity-90 transition-opacity"
            >
              + Add Set
            </button>
          </div>
        </div>
      </div>

      {/* Swap Exercise Modal */}
      <AnimatePresence>
        {showSwap && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSwap(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl md:w-full md:max-w-md md:max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Swap Exercise</h3>
                <button onClick={() => setShowSwap(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                {showCustomForm ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">New custom exercise</p>
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)]">Name *</label>
                      <Input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Landmine Press"
                        className="w-full h-9 bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)]">Primary muscle *</label>
                        <select
                          value={customMuscle}
                          onChange={(e) => setCustomMuscle(e.target.value)}
                          className="w-full h-9 text-sm bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-lg px-2"
                        >
                          <option value="">— Select —</option>
                          {muscleOptions.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)]">Equipment *</label>
                        <select
                          value={customEquipment}
                          onChange={(e) => setCustomEquipment(e.target.value)}
                          className="w-full h-9 text-sm bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-lg px-2"
                        >
                          <option value="">— Select —</option>
                          {equipmentOptions.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)]">Difficulty</label>
                        <select
                          value={customDifficulty}
                          onChange={(e) => setCustomDifficulty(e.target.value)}
                          className="w-full h-9 text-sm bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-lg px-2"
                        >
                          {['Beginner', 'Intermediate', 'Advanced'].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)]">Type</label>
                        <select
                          value={customType}
                          onChange={(e) => setCustomType(e.target.value)}
                          className="w-full h-9 text-sm bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-lg px-2"
                        >
                          {['Compound', 'Isolation', 'Core'].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setShowCustomForm(false)}
                        className="flex-1 py-2 rounded-lg border border-[var(--card-border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleCreateCustom}
                        disabled={customSaving}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {customSaving ? 'Saving…' : 'Save & Select'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                <Input
                  type="text"
                  value={swapQuery}
                  onChange={(e) => setSwapQuery(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full h-10 mb-3 bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--text-primary)]"
                />

                <button
                  onClick={() => setShowCustomForm(true)}
                  className="w-full mb-3 py-2 rounded-lg border border-dashed border-[#00AEEF]/50 text-sm font-medium text-[#00AEEF] hover:bg-[#00AEEF]/10 transition-colors"
                >
                  + Add new exercise
                </button>

                {!swapQuery && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                      Top suggestions
                    </p>
                    <div className="space-y-2">
                      {rankedSuggestions.map((s) => (
                        <button
                          key={s.name}
                          onClick={() => handleSwap(s.name)}
                          className="w-full text-left rounded-lg border border-[var(--card-border)] px-3 py-2 transition-colors hover:bg-[var(--card-border)]/30"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {s.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {s.equipment.length > 0 ? s.equipment.join(", ") : "—"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)]">{s.reason}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {browseOptions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                      Browse all
                    </p>
                    <div className="space-y-1">
                      {browseOptions.map((name) => (
                        <button
                          key={name}
                          onClick={() => handleSwap(name)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--card-border)]/50 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
              <div className="p-4 border-t border-[var(--card-border)]">
                <button
                  onClick={onRemoveExercise}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Remove Exercise
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
