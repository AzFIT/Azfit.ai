import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ArrowLeft, Clock, Dumbbell, Target, TrendingUp, CheckCircle2, Pause, Play, Plus } from 'lucide-react';
import { SessionExerciseCard } from '@/components/session/SessionExerciseCard';
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal';
import { useActiveWorkoutSession } from '@/hooks/useActiveWorkoutSession';
import { useRestTimer } from '@/hooks/useRestTimer';
import { formatElapsed, splitProgramIntoPhases, getCurrentPhase } from '@/lib/workoutSession';
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
  } = useActiveWorkoutSession(workoutLogId);

  const { timers, startTimer, skipTimer, addTime } = useRestTimer();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

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

  const handleFinish = useCallback(async () => {
    const ok = await finishSession();
    if (ok) setShowSummary(true);
  }, [finishSession]);

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
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] text-xs font-bold transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finish
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
          />
        ))}

        <button
          onClick={() => addExercise('New Exercise')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--card-border)] text-[var(--text-muted)] hover:text-[#00AEEF] hover:border-[#00AEEF]/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Exercise</span>
        </button>
      </main>

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
          <button onClick={handleFinish} className="px-3 py-1.5 rounded-lg bg-[#00AEEF] text-[#0B1120] text-xs font-bold">
            Finish
          </button>
        </div>
      </div>

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
