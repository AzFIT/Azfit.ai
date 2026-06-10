import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
// framer-motion imported in child components
import { ArrowLeft, Clock, Dumbbell, Target, TrendingUp, CheckCircle2, Pause, Play } from 'lucide-react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { RestTimerOverlay } from '@/components/RestTimerOverlay';
import { WorkoutSummary } from '@/components/WorkoutSummary';
import {
  getActiveSession,
  setActiveSession,
  saveWorkoutLog,
  type WorkoutLog,
  type LoggedExercise,
} from '@/lib/storage';

export default function SheetsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [session, setSession] = useState<WorkoutLog | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Rest timer state
  const [restTimerOpen, setRestTimerOpen] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  const [restNextExercise, setRestNextExercise] = useState('');
  const [restNextSet, setRestNextSet] = useState(1);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load session
  useEffect(() => {
    const active = getActiveSession();
    if (active && active.id === sessionId) {
      const started = new Date(active.startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - started) / 1000);
      // Use timeout to avoid setState in effect body
      const t = setTimeout(() => {
        setSession(active);
        setElapsedSeconds(elapsed);
        startTimeRef.current = started;
      }, 0);
      return () => clearTimeout(t);
    } else {
      navigate('/dashboard');
    }
  }, [sessionId, navigate]);

  // Elapsed timer
  useEffect(() => {
    if (!session || isPaused) return;

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isPaused]);

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setActiveSession(session);
    }, 10000);
    return () => clearInterval(interval);
  }, [session]);

  const formatElapsed = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateExercise = useCallback(
    (index: number, updated: LoggedExercise) => {
      setSession((prev) => {
        if (!prev) return prev;
        const exercises = [...prev.exercises];
        exercises[index] = updated;

        // Recalculate totals
        const allSets = exercises.flatMap((ex) => ex.sets);
        const doneSets = allSets.filter((s) => s.done);
        const totalVolume = doneSets.reduce((sum, s) => sum + s.load * s.reps, 0);
        const avgRpe =
          doneSets.filter((s) => s.rpe > 0).length > 0
            ? doneSets.filter((s) => s.rpe > 0).reduce((sum, s) => sum + s.rpe, 0) /
              doneSets.filter((s) => s.rpe > 0).length
            : 0;

        return {
          ...prev,
          exercises,
          totalVolume,
          completedSets: doneSets.length,
          avgRpe,
        };
      });
    },
    []
  );

  const handleRestTimer = useCallback(
    (seconds: number, nextExerciseName: string, nextSetNumber: number) => {
      setRestSeconds(seconds);
      setRestNextExercise(nextExerciseName);
      setRestNextSet(nextSetNumber);
      setRestTimerOpen(true);
    },
    []
  );

  const handleFinish = useCallback(() => {
    if (!session) return;
    const completed: WorkoutLog = {
      ...session,
      endTime: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      status: 'completed',
    };
    saveWorkoutLog(completed);
    setActiveSession(null);
    setShowSummary(true);
  }, [session, elapsedSeconds]);

  const handleSummaryDone = useCallback(() => {
    setShowSummary(false);
    navigate('/dashboard');
  }, [navigate]);

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00AEEF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progressionPct =
    session.totalSets > 0 ? Math.round((session.completedSets / session.totalSets) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ═══ STICKY HEADER ═══ */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-sm font-bold text-white">{session.workoutName}</h1>
                <p className="text-[10px] text-slate-500">
                  {session.phaseName} • Week {session.weekNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Timer */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-[#00AEEF]" />
                <span className="text-sm font-mono font-bold text-white">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>

              {/* Pause/Play */}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>

              {/* Finish */}
              <button
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1]
                  text-[#0B1120] text-xs font-bold transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finish
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ STICKY STATS BAR ═══ */}
      <div className="sticky top-[57px] z-20 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
            <StatBadge icon={Dumbbell} label="Load" value={`${session.totalVolume.toLocaleString()} kg`} />
            <StatBadge
              icon={TrendingUp}
              label="Progress"
              value={`${progressionPct}%`}
              color={progressionPct >= 80 ? '#22C55E' : progressionPct >= 50 ? '#F59E0B' : '#EF4444'}
            />
            <StatBadge
              icon={Target}
              label="Sets"
              value={`${session.completedSets}/${session.totalSets}`}
            />
            {session.avgRpe > 0 && (
              <StatBadge icon={Target} label="RPE" value={session.avgRpe.toFixed(1)} />
            )}
          </div>
        </div>
      </div>

      {/* ═══ EXERCISE CARDS ═══ */}
      <main className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-3">
        {session.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.order}
            exercise={exercise}
            onUpdate={(updated) => updateExercise(index, updated)}
            onRestTimer={handleRestTimer}
            isNext={index === session.exercises.findIndex((e) => e.sets.some((s) => !s.done))}
          />
        ))}
      </main>

      {/* ═══ REST TIMER OVERLAY ═══ */}
      <RestTimerOverlay
        isOpen={restTimerOpen}
        initialSeconds={restSeconds}
        nextExerciseName={restNextExercise}
        nextSetNumber={restNextSet}
        onComplete={() => setRestTimerOpen(false)}
        onSkip={() => setRestTimerOpen(false)}
      />

      {/* ═══ WORKOUT SUMMARY ═══ */}
      <WorkoutSummary
        session={{ ...session, durationSeconds: elapsedSeconds }}
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        onDone={handleSummaryDone}
      />

      {/* ═══ MOBILE STICKY BOTTOM ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 sm:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-[#00AEEF]" />
            <span className="text-sm font-mono font-bold">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">
              {session.completedSets}/{session.totalSets} sets
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">{session.totalVolume.toLocaleString()} kg</span>
          </div>
          <button
            onClick={handleFinish}
            className="px-3 py-1.5 rounded-lg bg-[#00AEEF] text-[#0B1120] text-xs font-bold"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
  color = '#94A3B8',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-[10px] text-slate-500 uppercase">{label}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}
