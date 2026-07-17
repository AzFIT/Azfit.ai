import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Dumbbell, Calendar, Layers, ChevronRight, Clock } from 'lucide-react';
import { useClientPrograms, type ClientProgram } from '@/hooks/useClientPrograms';
import { SessionLauncher } from './SessionLauncher';
import { splitProgramIntoPhases, type ProgramPhase } from '@/lib/workoutSession';

type Step = 'program' | 'phase' | 'week' | 'workout';

interface SelectedWorkout {
  workout: ClientProgram['workouts'][number];
  phaseName: string;
  weekNumber: number;
  dayNumber: number;
}

export function WorkoutLauncher({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { programs, loading } = useClientPrograms();
  const [step, setStep] = useState<Step>('program');
  const [selectedProgram, setSelectedProgram] = useState<ClientProgram | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<ProgramPhase | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedWorkout, setSelectedWorkout] = useState<SelectedWorkout | null>(null);
  const [showSessionLauncher, setShowSessionLauncher] = useState(false);

  const phases = useMemo(() => {
    if (!selectedProgram) return [];
    return splitProgramIntoPhases(selectedProgram.duration_weeks || 1);
  }, [selectedProgram]);

  const weeks = useMemo(() => {
    if (!selectedPhase) return [];
    const list: number[] = [];
    for (let w = selectedPhase.startWeek; w <= selectedPhase.endWeek; w++) {
      list.push(w);
    }
    return list;
  }, [selectedPhase]);

  const reset = () => {
    setStep('program');
    setSelectedProgram(null);
    setSelectedPhase(null);
    setSelectedWeek(1);
    setSelectedWorkout(null);
    setShowSessionLauncher(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectProgram = (program: ClientProgram) => {
    setSelectedProgram(program);
    setStep('phase');
  };

  const handleSelectPhase = (phase: ProgramPhase) => {
    setSelectedPhase(phase);
    setSelectedWeek(phase.startWeek);
    setStep('week');
  };

  const handleSelectWeek = (week: number) => {
    setSelectedWeek(week);
    setStep('workout');
  };

  const handleSelectWorkout = (workout: ClientProgram['workouts'][number], index: number) => {
    setSelectedWorkout({
      workout,
      phaseName: selectedPhase?.label || 'Phase',
      weekNumber: selectedWeek,
      dayNumber: index + 1,
    });
    setShowSessionLauncher(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && !showSessionLauncher && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl md:w-full md:max-w-lg md:max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Start Workout</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {step === 'program' && 'Select a training program'}
                    {step === 'phase' && `${selectedProgram?.name} — Select phase`}
                    {step === 'week' && `${selectedPhase?.label} — Select week`}
                    {step === 'workout' && `Week ${selectedWeek} — Select workout`}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--card-border)] text-[var(--text-muted)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-2 bg-[var(--card-bg)]/50 border-b border-[var(--card-border)]/50 flex items-center gap-1 text-[11px]">
                <span className={`${step === 'program' ? 'text-[#00AEEF] font-medium' : 'text-[var(--text-muted)]'}`}>Program</span>
                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                <span className={`${step === 'phase' ? 'text-[#00AEEF] font-medium' : step === 'program' ? 'text-[var(--text-muted)]/60' : 'text-[var(--text-muted)]'}`}>Phase</span>
                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                <span className={`${step === 'week' ? 'text-[#00AEEF] font-medium' : step === 'workout' ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]/60'}`}>Week</span>
                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                <span className={`${step === 'workout' ? 'text-[#00AEEF] font-medium' : 'text-[var(--text-muted)]/60'}`}>Workout</span>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-[var(--card-border)]/30 animate-pulse" />
                    ))}
                  </div>
                )}

                {!loading && step === 'program' && (
                  <div className="space-y-3">
                    {programs.length === 0 ? (
                      <div className="text-center py-8">
                        <Dumbbell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-muted)]">No active programs assigned.</p>
                      </div>
                    ) : (
                      programs.map((program) => (
                        <button
                          key={program.id}
                          onClick={() => handleSelectProgram(program)}
                          className="w-full text-left p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-[#00AEEF]/50 hover:bg-[var(--card-border)]/50 transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center shrink-0">
                              <Dumbbell className="w-5 h-5 text-[#00AEEF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[#00AEEF] transition-colors">
                                  {program.name}
                                </h3>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{program.description}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {program.duration_weeks} weeks
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  {program.frequency_per_week}x/week
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#00AEEF] transition-colors shrink-0 mt-1" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {!loading && step === 'phase' && selectedProgram && (
                  <div className="space-y-3">
                    <button onClick={() => setStep('program')} className="text-xs text-[#00AEEF] hover:underline mb-2">
                      ← Back to programs
                    </button>
                    {phases.map((phase) => (
                      <button
                        key={phase.key}
                        onClick={() => handleSelectPhase(phase)}
                        className="w-full text-left p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-[#00AEEF]/50 hover:bg-[var(--card-border)]/50 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${phase.color}15` }}
                          >
                            <Layers className="w-5 h-5" style={{ color: phase.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[#00AEEF] transition-colors">
                              {phase.label}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              Weeks {phase.startWeek}–{phase.endWeek}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#00AEEF] transition-colors shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && step === 'week' && selectedPhase && (
                  <div className="space-y-3">
                    <button onClick={() => setStep('phase')} className="text-xs text-[#00AEEF] hover:underline mb-2">
                      ← Back to phases
                    </button>
                    <div className="grid grid-cols-4 gap-2">
                      {weeks.map((week) => (
                        <button
                          key={week}
                          onClick={() => handleSelectWeek(week)}
                          className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-[#00AEEF]/50 hover:bg-[var(--card-border)]/50 transition-all text-center group"
                        >
                          <div className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[#00AEEF]">W{week}</div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Week {week}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && step === 'workout' && selectedProgram && (
                  <div className="space-y-3">
                    <button onClick={() => setStep('week')} className="text-xs text-[#00AEEF] hover:underline mb-2">
                      ← Back to weeks
                    </button>
                    {selectedProgram.workouts
                      .filter((w) => w.week_number === selectedWeek || (!w.week_number && selectedWeek === 1))
                      .map((workout, idx) => {
                        const exerciseCount = workout.exercises.length;
                        const estimatedDuration = Math.round(exerciseCount * 4.5);
                        return (
                          <button
                            key={workout.id}
                            onClick={() => handleSelectWorkout(workout, idx)}
                            className="w-full text-left p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-emerald-500/50 hover:bg-[var(--card-border)]/50 transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <Play className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-emerald-400 transition-colors">
                                  {workout.name}
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                  Day {workout.day_of_week || idx + 1} • {exerciseCount} exercises
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    ~{estimatedDuration} min
                                  </span>
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {workout.exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0)} total sets
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showSessionLauncher && selectedWorkout && selectedProgram && (
        <SessionLauncher
          isOpen={showSessionLauncher}
          onClose={() => {
            setShowSessionLauncher(false);
            handleClose();
          }}
          workoutId={selectedWorkout.workout.id}
          workoutName={selectedWorkout.workout.name}
          phaseName={selectedWorkout.phaseName}
          weekNumber={selectedWorkout.weekNumber}
          dayNumber={selectedWorkout.dayNumber}
        />
      )}
    </>
  );
}
