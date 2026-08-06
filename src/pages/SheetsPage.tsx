import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ArrowLeft, Clock, Dumbbell, Target, TrendingUp, CheckCircle2, Pause, Play, Plus, X, Vibrate, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionExerciseCard } from '@/components/session/SessionExerciseCard';
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal';
import { useActiveWorkoutSession } from '@/hooks/useActiveWorkoutSession';
import { useRestTimer } from '@/hooks/useRestTimer';
import { formatElapsed, splitProgramIntoPhases, getCurrentPhase } from '@/lib/workoutSession';
import { labelsForPairAdd, nextSeriesLetter } from '@/lib/exerciseLabels';
import { INTENSITY_HEX } from '@/lib/methodDefaults';
import { highVolumeSets, waveProgress, parseRestSeconds, ghostText } from '@/lib/workoutIntel';
import { hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SheetsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workoutLogId = searchParams.get('workoutLogId');

  const {
    snapshot,
    updateSet,
    addSet,
    removeSet,
    toggleSetDone,
    swapExercise,
    removeExercise,
    addExercise,
    finishSession,
    setPaused,
    lastLoadPerExercise,
    updateExerciseTargetLoad,
    ghostByExercise,
    method,
  } = useActiveWorkoutSession(workoutLogId);

  const { timers, startTimer, skipTimer, addTime } = useRestTimer();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Phase 49 Item 3: rest-timer haptics toggle (persisted per device)
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => hapticsEnabled());
  const toggleHaptics = useCallback(() => {
    setHapticsOn((prev) => {
      setHapticsEnabled(!prev);
      return !prev;
    });
  }, []);

  // Phase 49 Item 2: EDT block countdown (escalating-density-training only)
  const isEdt = method?.slug === 'escalating-density-training';
  const [edtRemaining, setEdtRemaining] = useState(15 * 60);
  const [edtRunning, setEdtRunning] = useState(false);
  const edtDoneRef = useRef(false);
  useEffect(() => {
    if (!edtRunning) return;
    const iv = setInterval(() => {
      setEdtRemaining((r) => {
        if (r <= 1) {
          if (!edtDoneRef.current) {
            edtDoneRef.current = true;
            toast.success('Block complete — log your rounds');
          }
          setEdtRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [edtRunning]);
  const edtFmt = `${Math.floor(edtRemaining / 60)}:${String(edtRemaining % 60).padStart(2, '0')}`;

  // Phase 49 Item 2: per-exercise method chip (GVT set counter / wave index)
  const methodChipFor = useCallback(
    (ex: { sets: { done: boolean }[] }) => {
      if (!method) return null;
      const done = ex.sets.filter((s) => s.done).length;
      const hv = highVolumeSets(method.d.setsReps);
      if (hv) return `Set ${Math.min(done + 1, hv)} of ${hv}`;
      const wave = waveProgress(method.d.setsReps, done);
      if (wave) return `Wave ${wave.wave}/${wave.maxWaves}`;
      return null;
    },
    [method],
  );
  const methodRestSeconds = method ? parseRestSeconds(method.d.rest) : null;

  // Phase 35 ITEM 1: RPE prompt + blocking finish UX
  const [showRpePrompt, setShowRpePrompt] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Phase 33C Fix 4b: smart Add Exercise dialog (pick → pair/new-series)
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<string[]>([]);
  const [addPicked, setAddPicked] = useState<string | null>(null);

  const { workoutLog, workout, program, exercises, elapsedSeconds, isPaused, totalVolume, targetVolume, completedSets, totalSets, avgRpe, loading, error } =
    snapshot;

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleToggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [setExpandedId]
  );

  // Function declaration (hoisted) so the Retry action can call it
  async function handleFinish(sessionRpe?: number) {
    if (finishing) return;
    setFinishing(true);
    const ok = await finishSession(sessionRpe);
    setFinishing(false);
    if (ok) {
      toast.success("Workout saved ✅", { duration: 2500 });
      setShowRpePrompt(false);
      setShowSummary(true);
    } else {
      toast.error("Couldn't save the workout — your data is still on this page.", {
        duration: 8000,
        action: { label: "Retry", onClick: () => handleFinish(sessionRpe) },
      });
    }
  }

  // Debounced library search for the Add Exercise dialog
  useEffect(() => {
    if (!addOpen) return;
    const t = setTimeout(async () => {
      const q = addQuery.trim();
      if (!q) { setAddResults([]); return; }
      const { data } = await supabase
        .from('exercise_library')
        .select('name')
        .eq('is_active', true)
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(8);
      setAddResults((data || []).map((r) => r.name));
    }, 250);
    return () => clearTimeout(t);
  }, [addQuery, addOpen]);

  const orderLabels = useMemo(() => exercises.map((e) => e.order), [exercises]);
  const pairPreview = useMemo(() => labelsForPairAdd(orderLabels), [orderLabels]);
  const newSeriesLetterLabel = useMemo(() => nextSeriesLetter(orderLabels), [orderLabels]);

  const handleAddConfirm = useCallback((mode: 'pair' | 'newSeries') => {
    if (!addPicked) return;
    addExercise(addPicked, mode);
    setAddOpen(false);
    setAddPicked(null);
    setAddQuery('');
    setAddResults([]);
  }, [addPicked, addExercise]);

  const progressPct = targetVolume > 0 ? Math.round((totalVolume / targetVolume) * 100) : 0;
  const phases = program ? splitProgramIntoPhases(program.duration_weeks || 1) : [];
  const currentPhase = workout?.week_number ? getCurrentPhase(phases, workout.week_number) : phases[0];

  if (!workoutLogId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--page-bg)' }}>
        <Dumbbell className="w-12 h-12 text-[#00AEEF] mb-4" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">No workout selected</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">Start a workout from your dashboard or program page.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 rounded-xl bg-[#00AEEF] text-[#0B1120] font-bold text-sm hover:bg-[#0098D1] transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className="w-8 h-8 border-2 border-[#00AEEF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workoutLog || exercises.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--page-bg)' }}>
        <Dumbbell className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Workout not found</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 rounded-xl bg-[#00AEEF] text-[#0B1120] font-bold text-sm hover:bg-[#0098D1] transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b border-[var(--card-border)]" style={{ backgroundColor: 'var(--card-bg)', opacity: 0.95 }}>
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-[var(--card-border)] text-[var(--text-muted)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-sm font-bold text-[var(--text-primary)]">{program?.name || workout?.name || 'Workout'}</h1>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {currentPhase?.label} • Week {workout?.week_number || 1} • {workout?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Phase 49: method badge (intensity dot + name) */}
              {method && (
                <span
                  className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold"
                  style={{
                    borderColor: `${INTENSITY_HEX[method.d.intensityColor]}50`,
                    color: INTENSITY_HEX[method.d.intensityColor],
                    backgroundColor: `${INTENSITY_HEX[method.d.intensityColor]}12`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: INTENSITY_HEX[method.d.intensityColor] }} />
                  {method.name}
                </span>
              )}
              {/* Phase 49: EDT block countdown chip */}
              {isEdt && (
                <button
                  onClick={() => setEdtRunning((r) => !r)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-bold"
                  style={{
                    borderColor: 'var(--card-border)',
                    color: edtRunning ? '#00AEEF' : 'var(--text-muted)',
                    backgroundColor: 'var(--card-bg)',
                  }}
                  title={edtRunning ? 'Pause EDT block' : 'Start EDT block'}
                >
                  <Timer className="w-3.5 h-3.5" />
                  {edtFmt}
                </button>
              )}
              <button
                onClick={toggleHaptics}
                className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-[var(--card-border)] transition-colors"
                style={{ color: hapticsOn ? '#00AEEF' : 'var(--text-muted)' }}
                title={hapticsOn ? 'Rest-timer vibration: on' : 'Rest-timer vibration: off'}
                aria-label="Toggle rest-timer vibration"
              >
                <Vibrate className="w-4 h-4" />
              </button>
              <span className="px-2 py-1 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] text-[10px] font-bold uppercase tracking-wider">
                Active
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
                <Clock className="w-3.5 h-3.5 text-[#00AEEF]" />
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{formatElapsed(elapsedSeconds)}</span>
              </div>
              <button
                onClick={() => setPaused(!isPaused)}
                className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-[var(--card-border)] text-[var(--text-muted)] transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowRpePrompt(true)}
                disabled={finishing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] text-xs font-bold transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {finishing ? "Saving…" : "Finish"}
              </button>
            </div>
          </div>

          {/* Phase breadcrumbs */}
          <div className="flex items-center gap-2 mt-3 pb-1 overflow-x-auto scrollbar-none">
            {phases.map((phase) => {
              const isCurrent = phase.key === currentPhase?.key;
              return (
                <div
                  key={phase.key}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border whitespace-nowrap ${
                    isCurrent ? 'bg-opacity-15 border-opacity-30' : 'bg-opacity-5 border-opacity-10 opacity-60'
                  }`}
                  style={{
                    backgroundColor: isCurrent ? `${phase.color}15` : `${phase.color}05`,
                    borderColor: isCurrent ? `${phase.color}30` : `${phase.color}10`,
                    color: phase.color,
                  }}
                >
                  <span>{phase.label}</span>
                  <span className="opacity-70">W{phase.startWeek}-{phase.endWeek}</span>
                </div>
              );
            })}
            <span className="ml-auto text-[10px] text-[var(--text-muted)] whitespace-nowrap">
              Total: {program?.duration_weeks || 1}w
            </span>
          </div>
        </div>
      </header>

      {/* Sticky Summary Bar */}
      <div className="sticky top-[88px] z-20 backdrop-blur-lg border-b border-[var(--card-border)]/50" style={{ backgroundColor: 'var(--card-bg)', opacity: 0.9 }}>
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
            <StatBadge icon={Dumbbell} label={program?.name || 'Workout'} value={`${exercises.length} exercises`} />
            <StatBadge icon={Target} label="Sets" value={`${completedSets}/${totalSets}`} />
            <StatBadge icon={TrendingUp} label="Load" value={`${totalVolume.toLocaleString()} kg`} />
            <StatBadge icon={Clock} label="Time" value={formatElapsed(elapsedSeconds)} />
            {avgRpe > 0 && <StatBadge icon={Target} label="RPE" value={avgRpe.toFixed(1)} />}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6] transition-all"
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nowrap">{progressPct}%</span>
            <span className="text-[10px] text-[var(--text-muted)] tabular-nowrap">
              {totalVolume.toLocaleString()} / {targetVolume.toLocaleString()} kg
            </span>
          </div>
        </div>
      </div>

      {/* Exercise Cards */}
      <main className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-3">
        {exercises.map((exercise) => (
          <SessionExerciseCard
            key={exercise.id}
            exercise={exercise}
            isExpanded={expandedId === exercise.id}
            onToggle={() => handleToggle(exercise.id)}
            onUpdateSet={(setIndex, updates) => updateSet(exercise.id, setIndex, updates)}
            onUpdateTargetLoad={(load) => updateExerciseTargetLoad(exercise.id, load)}
            onToggleDone={(setIndex) => toggleSetDone(exercise.id, setIndex)}
            onAddSet={() => addSet(exercise.id)}
            onRemoveSet={(setIndex) => removeSet(exercise.id, setIndex)}
            onSwapExercise={(newName) => swapExercise(exercise.id, newName)}
            onRemoveExercise={() => removeExercise(exercise.id)}
            onStartRest={startTimer}
            onSkipRest={skipTimer}
            onAddRest={addTime}
            restTimer={timers[exercise.id]}
            lastLoad={lastLoadPerExercise[exercise.name] || 0}
            workoutExerciseNames={exercises.map((e) => e.name)}
            ghost={ghostText(ghostByExercise.get(exercise.name))}
            methodChip={methodChipFor(exercise)}
            methodRestSeconds={methodRestSeconds}
            isRestPause={method?.slug === 'rest-pause'}
          />
        ))}

        <button
          onClick={() => setAddOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--card-border)] text-[var(--text-muted)] hover:text-[#00AEEF] hover:border-[#00AEEF]/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Exercise</span>
        </button>
      </main>

      {/* Smart Add Exercise dialog (Phase 33C Fix 4b) */}
      <AnimatePresence>
        {addOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => { setAddOpen(false); setAddPicked(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl md:w-full md:max-w-md overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Add Exercise</h3>
                <button onClick={() => { setAddOpen(false); setAddPicked(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                {!addPicked ? (
                  <>
                    <Input
                      type="text"
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                      placeholder="Search the exercise library..."
                      className="w-full h-10 mb-3 bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--text-primary)]"
                    />
                    <div className="space-y-1">
                      {addResults.map((name) => (
                        <button
                          key={name}
                          onClick={() => setAddPicked(name)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--card-border)]/50 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                      {addQuery.trim() && addResults.length === 0 && (
                        <p className="text-center text-xs text-[var(--text-muted)] py-3">No matches — try another search.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--text-primary)]">
                      Add <span className="font-semibold text-[#00AEEF]">{addPicked}</span> as…
                    </p>
                    <button
                      onClick={() => handleAddConfirm('pair')}
                      className="w-full text-left rounded-lg border border-[var(--card-border)] px-3 py-2.5 hover:border-[#00AEEF]/60 transition-colors"
                    >
                      <span className="text-sm font-medium text-[var(--text-primary)]">Pair with series {pairPreview.newLabel[0]} — becomes {pairPreview.newLabel}</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">superset with the last exercise</span>
                    </button>
                    <button
                      onClick={() => handleAddConfirm('newSeries')}
                      className="w-full text-left rounded-lg border border-[var(--card-border)] px-3 py-2.5 hover:border-[#00AEEF]/60 transition-colors"
                    >
                      <span className="text-sm font-medium text-[var(--text-primary)]">Start new series — {newSeriesLetterLabel}</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">standalone exercise</span>
                    </button>
                    <button
                      onClick={() => setAddPicked(null)}
                      className="w-full py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      ← back to search
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t border-[var(--card-border)] sm:hidden" style={{ backgroundColor: 'var(--card-bg)', opacity: 0.95 }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-[#00AEEF]" />
            <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>
              {completedSets}/{totalSets} sets
            </span>
            <span>|</span>
            <span>{totalVolume.toLocaleString()} kg</span>
          </div>
          <button onClick={() => setShowRpePrompt(true)} disabled={finishing} className="px-3 py-1.5 rounded-lg bg-[#00AEEF] text-[#0B1120] text-xs font-bold disabled:opacity-50">
            {finishing ? "Saving…" : "Finish"}
          </button>
        </div>
      </div>

      {/* Session RPE prompt (Phase 35 ITEM 1) — between Finish and completion, skippable */}
      <AnimatePresence>
        {showRpePrompt && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !finishing && setShowRpePrompt(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-2xl"
            >
              <h3 className="text-base font-bold text-[var(--text-primary)]">How hard was that session?</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Session RPE (1 = easy, 10 = max effort) — optional.</p>
              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    disabled={finishing}
                    onClick={() => handleFinish(n)}
                    className="h-10 rounded-lg border border-[var(--card-border)] text-sm font-bold text-[var(--text-primary)] transition-all hover:border-[#00AEEF] hover:bg-[#00AEEF]/10 hover:text-[#00AEEF] disabled:opacity-50"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleFinish()}
                disabled={finishing}
                className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {finishing ? "Saving…" : "Skip & Finish"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SessionSummaryModal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        onDone={() => {
          setShowSummary(false);
          navigate('/dashboard');
        }}
        workoutName={workout?.name || 'Workout'}
        phaseName={currentPhase?.label}
        durationSeconds={elapsedSeconds}
        totalVolume={totalVolume}
        targetVolume={targetVolume}
        completedSets={completedSets}
        totalSets={totalSets}
        avgRpe={avgRpe}
        exercises={exercises}
      />
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
  color = '#00AEEF',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-[10px] text-[var(--text-muted)] uppercase">{label}</span>
      <span className="text-xs font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
