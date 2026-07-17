import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Dumbbell, TrendingUp, Target, X, CheckCircle2 } from 'lucide-react';
import type { SessionExercise } from '@/lib/workoutSession';

interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  workoutName: string;
  phaseName?: string;
  durationSeconds: number;
  totalVolume: number;
  targetVolume: number;
  completedSets: number;
  totalSets: number;
  avgRpe: number;
  exercises: SessionExercise[];
}

export function SessionSummaryModal({
  isOpen,
  onClose,
  onDone,
  workoutName,
  phaseName,
  durationSeconds,
  totalVolume,
  targetVolume,
  completedSets,
  totalSets,
  avgRpe,
  exercises,
}: SessionSummaryModalProps) {
  const stats = useMemo(() => {
    const durationMin = Math.floor(durationSeconds / 60);
    const durationSec = durationSeconds % 60;
    const progressPct = targetVolume > 0 ? Math.round((totalVolume / targetVolume) * 100) : 0;
    return { durationMin, durationSec, progressPct };
  }, [durationSeconds, totalVolume, targetVolume]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
              sm:w-full sm:max-w-lg z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden
              flex flex-col max-h-[90vh]"
          >
            <div className="relative bg-gradient-to-br from-[#00AEEF]/20 to-[#8B5CF6]/20 px-6 py-8 text-center">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-[var(--text-muted)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2, damping: 12 }}
                className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#00AEEF]/20 flex items-center justify-center"
              >
                <Trophy className="w-8 h-8 text-[#00AEEF]" />
              </motion.div>

              <h2 className="text-2xl font-black text-[var(--text-primary)]">Workout Complete!</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {workoutName} {phaseName ? `— ${phaseName}` : ''}
              </p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Clock}
                  label="Duration"
                  value={`${stats.durationMin}:${stats.durationSec.toString().padStart(2, '0')}`}
                  sub="minutes"
                  color="#00AEEF"
                />
                <StatCard
                  icon={Dumbbell}
                  label="Total Volume"
                  value={`${totalVolume.toLocaleString()}`}
                  sub={`/ ${targetVolume.toLocaleString()} kg`}
                  color="#8B5CF6"
                />
                <StatCard
                  icon={Target}
                  label="Sets Done"
                  value={`${completedSets}/${totalSets}`}
                  sub={`${Math.round((completedSets / Math.max(totalSets, 1)) * 100)}%`}
                  color="#22C55E"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg RPE"
                  value={avgRpe > 0 ? avgRpe.toFixed(1) : '—'}
                  sub="intensity"
                  color="#F59E0B"
                />
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Exercise Breakdown
                </h3>
                <div className="space-y-2">
                  {exercises.map((ex) => {
                    const done = ex.sets.filter((s) => s.done).length;
                    const vol = ex.sets
                      .filter((s) => s.done)
                      .reduce((sum, s) => sum + s.load * s.reps, 0);
                    return (
                      <div
                        key={ex.id}
                        className="flex items-center gap-3 px-3 py-2 bg-[var(--page-bg)]/50 rounded-xl border border-[var(--card-border)]/50"
                      >
                        <span className="w-7 h-7 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center text-xs font-bold text-[#00AEEF]">
                          {ex.order}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{ex.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {done}/{ex.sets.length} sets
                          </div>
                        </div>
                        {vol > 0 && (
                          <span className="text-xs text-[var(--text-muted)]">{vol.toLocaleString()} kg</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--card-border)]">
              <button
                onClick={onDone}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold
                  bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-5 h-5" />
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--page-bg)]/50 border border-[var(--card-border)]/50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-black text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}
