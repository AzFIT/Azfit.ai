import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sparkles, Dumbbell, Clock, Layers, ChevronDown, ChevronUp,
  Save, CheckCircle2, Play, RotateCcw, Zap, Target, Crown,
} from 'lucide-react';
import {
  generateProgram,
  saveGeneratedProgram,

  type GeneratedProgram,
  type GeneratedWorkout,
  type ClientProfile,
} from '@/lib/aiProgramGenerator';
import { ExerciseReplacer } from '@/components/ExerciseReplacer';
import { setActiveSession, type WorkoutLog, type LoggedExercise, type LoggedSet } from '@/lib/storage';

type Step = 'profile' | 'generating' | 'preview';

/* ── Load profile from localStorage ────────────────────── */

function loadClientProfile(): ClientProfile | null {
  try {
    const raw = localStorage.getItem('azfit_client_profile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return {
      trainingFrequency: profile.trainingFrequency || 3,
      trainingExperience: profile.trainingExperience || 'intermediate',
      primaryGoal: profile.primaryGoal || 'build_muscle',
      availableEquipment: profile.availableEquipment || ['Full Gym'],
      preferredStyle: profile.preferredStyle || ['Free Weights'],
      injuries: profile.injuries || '',
    };
  } catch {
    return null;
  }
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

function workoutToSession(workout: GeneratedWorkout, programId: string): WorkoutLog {
  const exercises: LoggedExercise[] = workout.exercises.map((ex) => ({
    order: ex.order,
    name: ex.name,
    category: ex.category,
    targetSets: ex.sets,
    targetReps: ex.reps,
    targetLoad: 0,
    tempo: ex.tempo,
    sets: Array.from({ length: ex.sets }, (_, i) => createEmptySet(i + 1, ex.restSeconds)),
    notes: '',
  }));

  const totalSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);

  return {
    id: crypto.randomUUID(),
    programId,
    clientId: 'self',
    clientName: 'You',
    workoutName: workout.name,
    phaseName: 'Phase 1: Adaptation',
    weekNumber: 1,
    dayNumber: workout.dayNumber,
    exercises,
    startTime: new Date().toISOString(),
    durationSeconds: 0,
    totalVolume: totalSets * 10 * 20,
    totalSets,
    completedSets: 0,
    avgRpe: 0,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

/* ── Main Component ────────────────────────────────────── */

export default function AIProgramBuilderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('profile');
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [saved, setSaved] = useState(false);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  // Exercise replacement state
  const [replaceTarget, setReplaceTarget] = useState<{ workoutId: string; exerciseIndex: number } | null>(null);

  const profile = useMemo(() => loadClientProfile(), []);

  const handleGenerate = useCallback(() => {
    const p = profile || {
      trainingFrequency: 3,
      trainingExperience: 'intermediate',
      primaryGoal: 'build_muscle',
      availableEquipment: ['Full Gym'],
      preferredStyle: ['Free Weights'],
    };
    setStep('generating');
    // Simulate AI thinking time
    setTimeout(() => {
      const generated = generateProgram(p);
      setProgram(generated);
      setStep('preview');
    }, 1500);
  }, [profile]);

  const handleSave = () => {
    if (!program) return;
    saveGeneratedProgram(program);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleStartWorkout = (workout: GeneratedWorkout) => {
    if (!program) return;
    const session = workoutToSession(workout, program.id);
    setActiveSession(session);
    navigate(`/sheets?session=${session.id}`);
  };

  const handleReplaceExercise = (workoutId: string, exerciseIndex: number, newName: string) => {
    if (!program) return;
    setProgram((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next.phases = next.phases.map((phase) => ({
        ...phase,
        workouts: phase.workouts.map((w) => {
          if (w.id !== workoutId) return w;
          const exercises = [...w.exercises];
          exercises[exerciseIndex] = { ...exercises[exerciseIndex], name: newName };
          return { ...w, exercises };
        }),
      }));
      return next;
    });
  };

  const getAllUsedExercises = (): string[] => {
    if (!program) return [];
    const used = new Set<string>();
    program.phases.forEach((phase) => {
      phase.workouts.forEach((w) => {
        w.exercises.forEach((ex) => used.add(ex.name));
      });
    });
    return Array.from(used);
  };

  const getReplaceContext = () => {
    if (!replaceTarget || !program) return null;
    for (const phase of program.phases) {
      for (const workout of phase.workouts) {
        if (workout.id === replaceTarget.workoutId) {
          const ex = workout.exercises[replaceTarget.exerciseIndex];
          if (ex) return { name: ex.name, category: ex.category };
        }
      }
    }
    return null;
  };

  const replaceContext = getReplaceContext();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00AEEF]" />
                AI Program Builder
              </h1>
              <p className="text-xs text-slate-400">
                {step === 'profile' && 'Generate a personalized training program'}
                {step === 'generating' && 'AzFIT AI is designing your program...'}
                {step === 'preview' && program?.name}
              </p>
            </div>
          </div>
          {step === 'preview' && program && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${saved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120]'
                  }`}
              >
                {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: Profile Summary + Generate */}
          {step === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#00AEEF]" />
                  Your Profile
                </h2>
                {profile ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <ProfileBadge
                      icon={Dumbbell}
                      label="Frequency"
                      value={`${profile.trainingFrequency} days/week`}
                    />
                    <ProfileBadge
                      icon={Zap}
                      label="Experience"
                      value={profile.trainingExperience}
                    />
                    <ProfileBadge
                      icon={Target}
                      label="Goal"
                      value={profile.primaryGoal.replace('_', ' ')}
                    />
                    <ProfileBadge
                      icon={Layers}
                      label="Equipment"
                      value={profile.availableEquipment.join(', ')}
                    />
                    <ProfileBadge
                      icon={Sparkles}
                      label="Style"
                      value={profile.preferredStyle.join(', ')}
                    />
                    {profile.injuries && (
                      <ProfileBadge
                        icon={Crown}
                        label="Injuries"
                        value={profile.injuries}
                        color="text-amber-400"
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-slate-400 text-sm mb-3">
                      No profile found. Complete onboarding first for the best results.
                    </p>
                    <button
                      onClick={() => navigate('/onboarding')}
                      className="px-4 py-2 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] text-sm font-bold transition-colors"
                    >
                      Complete Onboarding
                    </button>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                className="w-full py-5 rounded-2xl font-bold text-lg relative overflow-hidden
                  bg-gradient-to-r from-[#00AEEF] via-violet-500 to-[#00AEEF]
                  text-white shadow-lg shadow-[#00AEEF]/20
                  hover:shadow-xl hover:shadow-[#00AEEF]/30 transition-shadow"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  🤖 AI GENERATE PROGRAM
                </span>
                {/* Animated glow */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                />
              </motion.button>

              <p className="text-center text-xs text-slate-500">
                AzFIT AI will analyze your profile and generate a personalized program with exercise selection,
                sets, reps, tempo, and rest periods optimized for your goals.
              </p>
            </motion.div>
          )}

          {/* STEP 2: Generating */}
          {step === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="w-16 h-16 rounded-full border-4 border-[#00AEEF]/20 border-t-[#00AEEF]"
              />
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-2">AzFIT AI is designing your program...</h2>
                <p className="text-sm text-slate-400">Analyzing your profile • Selecting exercises • Optimizing parameters</p>
              </div>
              {/* Skeleton cards */}
              <div className="w-full max-w-md space-y-3">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="h-16 rounded-xl bg-slate-800/50 border border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && program && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Program Summary Card */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{program.name}</h2>
                    <p className="text-sm text-slate-400 mt-1">{program.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00AEEF]/10 border border-[#00AEEF]/20">
                    <Sparkles className="w-4 h-4 text-[#00AEEF]" />
                    <span className="text-xs font-bold text-[#00AEEF]">AI Generated</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatBox icon={Layers} label="Split" value={program.phases[0]?.workouts.length + ' days'} />
                  <StatBox icon={Clock} label="Duration" value={program.totalWeeks + ' weeks'} />
                  <StatBox icon={Target} label="Goal" value={program.goal.replace('_', ' ')} />
                  <StatBox icon={Zap} label="Level" value={program.level} />
                </div>
              </div>

              {/* Workout Days */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Workouts</h3>
                {program.phases[0]?.workouts.map((workout) => (
                  <motion.div
                    key={workout.id}
                    layout
                    className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden"
                  >
                    {/* Workout Header */}
                    <button
                      onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-[#00AEEF]">{workout.dayNumber}</span>
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-semibold text-white">{workout.name}</h4>
                          <p className="text-xs text-slate-400">{workout.focus}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Dumbbell className="w-3 h-3" />
                            {workout.exercises.length} exercises
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{workout.estimatedMinutes} min
                          </span>
                        </div>
                        {expandedWorkout === workout.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Exercises */}
                    <AnimatePresence>
                      {expandedWorkout === workout.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2">
                            {workout.exercises.map((ex, idx) => (
                              <div
                                key={ex.order}
                                className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30"
                              >
                                <span className="w-8 h-8 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center text-xs font-bold text-[#00AEEF] shrink-0">
                                  {ex.order}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{ex.name}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {ex.category} • {ex.sets} sets × {ex.reps} @ {ex.tempo} • {ex.restSeconds}s rest
                                  </div>
                                </div>
                                {/* Replace button */}
                                <button
                                  onClick={() => setReplaceTarget({ workoutId: workout.id, exerciseIndex: idx })}
                                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-[#00AEEF] transition-colors"
                                  title="Replace exercise"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {/* Start Workout Button */}
                            <button
                              onClick={() => handleStartWorkout(workout)}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                                bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold text-sm
                                transition-colors mt-2"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              Start This Workout
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>

              {/* Regenerate */}
              <button
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                  bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium
                  transition-colors border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate Program
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Exercise Replacer Modal */}
      <ExerciseReplacer
        isOpen={!!replaceTarget}
        onClose={() => setReplaceTarget(null)}
        targetExercise={replaceContext?.name || ''}
        targetCategory={replaceContext?.category || ''}
        usedExercises={getAllUsedExercises()}
        onReplace={(newName) => {
          if (replaceTarget) {
            handleReplaceExercise(replaceTarget.workoutId, replaceTarget.exerciseIndex, newName);
          }
        }}
      />
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function ProfileBadge({
  icon: Icon,
  label,
  value,
  color = 'text-[#00AEEF]',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <Icon className={`w-4 h-4 ${color} shrink-0`} />
      <div className="min-w-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-white truncate capitalize">{value}</div>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div>
        <div className="text-[10px] text-slate-500 uppercase">{label}</div>
        <div className="text-sm font-bold text-white capitalize">{value}</div>
      </div>
    </div>
  );
}
