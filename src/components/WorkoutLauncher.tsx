import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Dumbbell, Calendar, Layers, ChevronRight, Clock } from 'lucide-react';
import { masterPrograms, type MasterProgram, type MasterPhase, type MasterWorkout } from '@/data/masterWorkouts';
import { SessionLauncher } from './SessionLauncher';

type Step = 'program' | 'phase' | 'week' | 'workout';

export function WorkoutLauncher({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>('program');
  const [selectedProgram, setSelectedProgram] = useState<MasterProgram | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<MasterPhase | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedWorkout, setSelectedWorkout] = useState<MasterWorkout | null>(null);
  const [showSessionLauncher, setShowSessionLauncher] = useState(false);

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

  const handleSelectProgram = (program: MasterProgram) => {
    setSelectedProgram(program);
    setStep('phase');
  };

  const handleSelectPhase = (phase: MasterPhase) => {
    setSelectedPhase(phase);
    setSelectedWeek(1);
    setStep('week');
  };

  const handleSelectWeek = (week: number) => {
    setSelectedWeek(week);
    setStep('workout');
  };

  const handleSelectWorkout = (workout: MasterWorkout) => {
    setSelectedWorkout(workout);
    setShowSessionLauncher(true);
  };

  const getWeeksForPhase = (phase: MasterPhase): number[] => {
    const weeks: number[] = [];
    // Parse starting week from phase id or default
    let startWeek = 1;
    if (phase.id.includes('phase-1') || phase.id.includes('p1')) startWeek = 1;
    else if (phase.id.includes('phase-2') || phase.id.includes('p2')) startWeek = 5;
    else if (phase.id.includes('phase-3') || phase.id.includes('p3')) startWeek = 9;
    for (let i = 0; i < phase.durationWeeks; i++) {
      weeks.push(startWeek + i);
    }
    return weeks;
  };

  const getDayNumber = (workoutIndex: number): number => workoutIndex + 1;

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && !showSessionLauncher && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 bg-[#0B1120] border border-slate-700/50 rounded-2xl md:w-full md:max-w-lg md:max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">Start Workout</h2>
                  <p className="text-xs text-slate-400">
                    {step === 'program' && 'Select a training program'}
                    {step === 'phase' && `${selectedProgram?.name} — Select phase`}
                    {step === 'week' && `${selectedPhase?.name} — Select week`}
                    {step === 'workout' && `Week ${selectedWeek} — Select workout`}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Breadcrumb */}
              <div className="px-5 py-2 bg-slate-900/50 border-b border-slate-800/50 flex items-center gap-1 text-[11px]">
                <span className={`${step === 'program' ? 'text-[#00AEEF] font-medium' : 'text-slate-500'}`}>Program</span>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className={`${step === 'phase' ? 'text-[#00AEEF] font-medium' : step === 'program' ? 'text-slate-600' : 'text-slate-500'}`}>Phase</span>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className={`${step === 'week' ? 'text-[#00AEEF] font-medium' : step === 'workout' ? 'text-slate-500' : 'text-slate-600'}`}>Week</span>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className={`${step === 'workout' ? 'text-[#00AEEF] font-medium' : 'text-slate-600'}`}>Workout</span>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                <AnimatePresence mode="wait">
                  {/* PROGRAM STEP */}
                  {step === 'program' && (
                    <motion.div
                      key="program"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-3"
                    >
                      {masterPrograms.map((program) => (
                        <button
                          key={program.id}
                          onClick={() => handleSelectProgram(program)}
                          className="w-full text-left p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-[#00AEEF]/50 hover:bg-slate-800 transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center shrink-0">
                              <Dumbbell className="w-5 h-5 text-[#00AEEF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white group-hover:text-[#00AEEF] transition-colors">
                                  {program.name}
                                </h3>
                                <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400">
                                  {program.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{program.description}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  {program.phases.length} phases
                                </span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {program.totalWeeks} weeks
                                </span>
                                <span className="text-[10px] text-slate-500">{program.level}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#00AEEF] transition-colors shrink-0 mt-1" />
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {/* PHASE STEP */}
                  {step === 'phase' && selectedProgram && (
                    <motion.div
                      key="phase"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-3"
                    >
                      <button
                        onClick={() => setStep('program')}
                        className="text-xs text-[#00AEEF] hover:underline mb-2"
                      >
                        ← Back to programs
                      </button>
                      {selectedProgram.phases.map((phase) => (
                        <button
                          key={phase.id}
                          onClick={() => handleSelectPhase(phase)}
                          className="w-full text-left p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-[#00AEEF]/50 hover:bg-slate-800 transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                              <Layers className="w-5 h-5 text-teal-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors">
                                {phase.name}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">{phase.goal}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-slate-500">{phase.block}</span>
                                <span className="text-[10px] text-slate-500">{phase.durationWeeks} weeks</span>
                                <span className="text-[10px] text-slate-500">{phase.workouts.length} workouts</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors shrink-0 mt-1" />
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {/* WEEK STEP */}
                  {step === 'week' && selectedPhase && (
                    <motion.div
                      key="week"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-3"
                    >
                      <button
                        onClick={() => setStep('phase')}
                        className="text-xs text-[#00AEEF] hover:underline mb-2"
                      >
                        ← Back to phases
                      </button>
                      <div className="grid grid-cols-4 gap-2">
                        {getWeeksForPhase(selectedPhase).map((week) => (
                          <button
                            key={week}
                            onClick={() => handleSelectWeek(week)}
                            className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-[#00AEEF]/50 hover:bg-slate-800 transition-all text-center group"
                          >
                            <div className="text-lg font-bold text-white group-hover:text-[#00AEEF]">W{week}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Week {week}</div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* WORKOUT STEP */}
                  {step === 'workout' && selectedPhase && (
                    <motion.div
                      key="workout"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-3"
                    >
                      <button
                        onClick={() => setStep('week')}
                        className="text-xs text-[#00AEEF] hover:underline mb-2"
                      >
                        ← Back to weeks
                      </button>
                      {selectedPhase.workouts.map((workout, idx) => {
                        const exerciseCount = workout.exercises.length;
                        const estimatedDuration = Math.round(exerciseCount * 4.5);
                        return (
                          <button
                            key={workout.id}
                            onClick={() => handleSelectWorkout(workout)}
                            className="w-full text-left p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800 transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <Play className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                  {workout.name}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Day {getDayNumber(idx)} • {exerciseCount} exercises
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    ~{estimatedDuration} min
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {workout.exercises.reduce((sum, ex) => sum + ex.sets, 0)} total sets
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Session Launcher */}
      {showSessionLauncher && selectedWorkout && selectedPhase && selectedProgram && (
        <SessionLauncher
          isOpen={showSessionLauncher}
          onClose={() => {
            setShowSessionLauncher(false);
            handleClose();
          }}
          workoutId={selectedWorkout.id}
          programId={selectedProgram.id}
          phaseName={selectedPhase.name}
          weekNumber={selectedWeek}
          dayNumber={selectedPhase.workouts.findIndex((w) => w.id === selectedWorkout.id) + 1}
        />
      )}
    </>
  );
}
