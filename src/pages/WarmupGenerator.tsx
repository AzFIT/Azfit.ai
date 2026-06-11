import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Flame, Play, CheckCircle2, Clock, Dumbbell,
  RotateCcw, SkipForward,
} from 'lucide-react';

/* ── Warm-up Database ──────────────────────────────────── */

interface WarmupExercise {
  name: string;
  duration: number; // seconds
  category: 'general' | 'activation' | 'mobility' | 'specific';
  targetMuscles: string[];
  description: string;
}

const WARMUP_EXERCISES: WarmupExercise[] = [
  { name: 'Jumping Jacks', duration: 60, category: 'general', targetMuscles: ['full body'], description: 'Light cardio to raise heart rate' },
  { name: 'Arm Circles', duration: 30, category: 'general', targetMuscles: ['shoulders'], description: 'Forward and backward arm circles' },
  { name: 'Leg Swings', duration: 45, category: 'mobility', targetMuscles: ['hips', 'hamstrings'], description: 'Front-to-back and side-to-side swings' },
  { name: 'Hip Circles', duration: 30, category: 'mobility', targetMuscles: ['hips'], description: 'Large circles with each leg' },
  { name: 'World\'s Greatest Stretch', duration: 60, category: 'mobility', targetMuscles: ['hips', 'thoracic'], description: 'Lunge with rotation and hamstring stretch' },
  { name: 'Band Pull-Aparts', duration: 45, category: 'activation', targetMuscles: ['rear delts', 'upper back'], description: 'Activate scapular retractors' },
  { name: 'Glute Bridges', duration: 45, category: 'activation', targetMuscles: ['glutes', 'hamstrings'], description: 'Squeeze glutes at top for 2 seconds' },
  { name: 'Dead Bugs', duration: 45, category: 'activation', targetMuscles: ['core'], description: 'Opposite arm/leg extension with core braced' },
  { name: 'Cat-Cow', duration: 30, category: 'mobility', targetMuscles: ['spine'], description: 'Spinal flexion and extension' },
  { name: 'Shoulder Dislocates', duration: 45, category: 'mobility', targetMuscles: ['shoulders'], description: 'With band or broomstick' },
  { name: 'Ankle Rocks', duration: 30, category: 'mobility', targetMuscles: ['ankles'], description: 'Knee-to-wall ankle mobility drill' },
  { name: 'Thoracic Rotations', duration: 45, category: 'mobility', targetMuscles: ['thoracic'], description: 'Open book rotations on side' },
  { name: 'Scapular Push-ups', duration: 45, category: 'activation', targetMuscles: ['serratus', 'chest'], description: 'Protract and retract shoulder blades' },
  { name: 'Bodyweight Squats', duration: 45, category: 'activation', targetMuscles: ['quads', 'glutes'], description: 'Slow controlled squats, focus on depth' },
  { name: 'Inchworms', duration: 45, category: 'general', targetMuscles: ['hamstrings', 'core'], description: 'Walk hands out to plank and back' },
];

/* ── Target Muscle Mapping ─────────────────────────────── */

function getWarmupForWorkout(exerciseNames: string[]): WarmupExercise[] {
  const muscles = new Set<string>();
  exerciseNames.forEach((name) => {
    const lower = name.toLowerCase();
    if (/press|bench|push|dip|chest|shoulder|military/.test(lower)) muscles.add('shoulders');
    if (/press|bench|push|dip|chest/.test(lower)) muscles.add('chest');
    if (/row|pull|chin|lat|pulldown|curl/.test(lower)) muscles.add('back');
    if (/curl/.test(lower)) muscles.add('biceps');
    if (/squat|leg|lunge|split|step|press/.test(lower)) muscles.add('quads');
    if (/deadlift|rdl|hamstring|leg curl|posterior/.test(lower)) muscles.add('hamstrings');
    if (/deadlift|rdl|hip|glute|bridge/.test(lower)) muscles.add('glutes');
    if (/core|plank|bracing/.test(lower)) muscles.add('core');
  });

  // Always include general warm-up
  const selected: WarmupExercise[] = WARMUP_EXERCISES.filter((e) => e.category === 'general').slice(0, 2);

  // Add mobility for targeted muscles
  const mobility = WARMUP_EXERCISES.filter((e) =>
    e.category === 'mobility' && e.targetMuscles.some((m) => muscles.has(m))
  ).slice(0, 3);

  // Add activation for targeted muscles
  const activation = WARMUP_EXERCISES.filter((e) =>
    e.category === 'activation' && e.targetMuscles.some((m) => muscles.has(m))
  ).slice(0, 3);

  // Fill with general if not enough
  const result = [...selected, ...mobility, ...activation];
  if (result.length < 5) {
    const remaining = WARMUP_EXERCISES.filter((e) => !result.includes(e));
    result.push(...remaining.slice(0, 5 - result.length));
  }

  return result.slice(0, 6);
}

/* ── Main Component ────────────────────────────────────── */

export default function WarmupGeneratorPage() {
  const navigate = useNavigate();
  const [workoutInput, setWorkoutInput] = useState('');
  const [generated, setGenerated] = useState<WarmupExercise[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const currentExercise = generated?.[activeIndex];
  const totalDuration = generated?.reduce((s, e) => s + e.duration, 0) || 0;
  const completedDuration = generated?.slice(0, activeIndex).reduce((s, e) => s + e.duration, 0) || 0;

  const handleGenerate = () => {
    const exercises = workoutInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (exercises.length === 0) {
      // Default full-body warm-up
      setGenerated(WARMUP_EXERCISES.slice(0, 5));
    } else {
      setGenerated(getWarmupForWorkout(exercises));
    }
    setActiveIndex(0);
    setCompleted(new Set());
    setIsRunning(false);
  };

  const handleStart = () => {
    if (!currentExercise) return;
    setIsRunning(true);
    setTimeLeft(currentExercise.duration);
  };

  const handleNext = () => {
    if (!generated) return;
    setCompleted((prev) => new Set(prev).add(activeIndex));
    if (activeIndex < generated.length - 1) {
      setActiveIndex((i) => i + 1);
      setTimeLeft(generated[activeIndex + 1]?.duration || 0);
    } else {
      setIsRunning(false);
    }
  };

  const handleSkip = () => {
    if (!generated) return;
    if (activeIndex < generated.length - 1) {
      setActiveIndex((i) => i + 1);
      setTimeLeft(generated[activeIndex + 1]?.duration || 0);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#00AEEF]" />
            Warm-up Generator
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Input */}
        {!generated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5"
          >
            <h2 className="text-sm font-semibold text-slate-300 mb-3">What are you training today?</h2>
            <textarea
              value={workoutInput}
              onChange={(e) => setWorkoutInput(e.target.value)}
              placeholder="e.g. Bench Press, Squat, Row, Shoulder Press..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00AEEF] mb-3"
            />
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold text-sm transition-colors"
            >
              <Dumbbell className="w-4 h-4" />
              Generate Warm-up
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">Or leave empty for a general full-body warm-up</p>
          </motion.div>
        )}

        {/* Generated Sequence */}
        {generated && (
          <>
            {/* Progress */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Progress</span>
                <span className="text-xs text-slate-400">{completed.size} / {generated.length} exercises</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#00AEEF] rounded-full"
                  animate={{ width: `${(completed.size / generated.length) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span><Clock className="w-3 h-3 inline mr-1" />{formatTime(totalDuration)} total</span>
                <span>{formatTime(completedDuration)} completed</span>
              </div>
            </div>

            {/* Active Exercise */}
            {currentExercise && (
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center"
              >
                <span className="px-2 py-0.5 rounded-md bg-[#00AEEF]/15 text-[#00AEEF] text-[10px] font-bold uppercase">
                  Exercise {activeIndex + 1} of {generated.length}
                </span>
                <h2 className="text-2xl font-bold text-white mt-3">{currentExercise.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{currentExercise.description}</p>

                {/* Timer Display */}
                <div className="my-6">
                  <div className="text-5xl font-mono font-bold text-[#00AEEF]">
                    {isRunning ? formatTime(timeLeft) : formatTime(currentExercise.duration)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Target: {currentExercise.targetMuscles.join(', ')}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3">
                  {!isRunning ? (
                    <button
                      onClick={handleStart}
                      className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold transition-colors"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Start
                    </button>
                  ) : (
                    <>
                      <button onClick={handleSkip} className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                        <SkipForward className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleNext}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B1120] font-bold transition-colors"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Done
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* All Complete */}
            {completed.size === generated.length && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Warm-up Complete!</h3>
                <p className="text-sm text-slate-400 mt-1">You&apos;re ready to crush your workout</p>
                <button
                  onClick={() => { setGenerated(null); setWorkoutInput(''); }}
                  className="mt-4 flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B1120] font-bold text-sm mx-auto transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Generate Another
                </button>
              </motion.div>
            )}

            {/* Exercise List */}
            <div className="space-y-2">
              {generated.map((ex, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    i === activeIndex ? 'bg-[#00AEEF]/10 border-[#00AEEF]/30' :
                    completed.has(i) ? 'bg-emerald-500/5 border-emerald-500/20' :
                    'bg-slate-900/30 border-slate-800'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    completed.has(i) ? 'bg-emerald-500/20 text-emerald-400' :
                    i === activeIndex ? 'bg-[#00AEEF]/20 text-[#00AEEF]' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {completed.has(i) ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${completed.has(i) ? 'text-emerald-400 line-through' : 'text-white'}`}>
                      {ex.name}
                    </p>
                    <p className="text-[10px] text-slate-500">{ex.targetMuscles.join(', ')}</p>
                  </div>
                  <span className="text-xs text-slate-400">{formatTime(ex.duration)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
