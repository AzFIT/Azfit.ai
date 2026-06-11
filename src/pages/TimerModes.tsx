import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX,
  Timer, Zap, Activity, Watch,
} from 'lucide-react';

type TimerMode = 'tabata' | 'emom' | 'circuit' | 'stopwatch';

interface TimerConfig {
  tabata: { work: number; rest: number; rounds: number };
  emom: { work: number; rest: number; rounds: number };
  circuit: { work: number; rest: number; rounds: number; exercises: string[] };
  stopwatch: object;
}

const DEFAULT_CONFIG: TimerConfig = {
  tabata: { work: 20, rest: 10, rounds: 8 },
  emom: { work: 45, rest: 15, rounds: 10 },
  circuit: { work: 40, rest: 20, rounds: 4, exercises: ['Exercise 1', 'Exercise 2', 'Exercise 3', 'Exercise 4'] },
  stopwatch: {},
};

/* ── Main Component ────────────────────────────────────── */

export default function TimerModesPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TimerMode>('tabata');
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<'work' | 'rest' | 'ready'>('ready');
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentConfig = config[mode];

  /* ── Sound ───────────────────────────────────────────── */

  const playBeep = useCallback((freq = 800, duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available
    }
  }, [soundEnabled]);

  /* ── Timer Logic ─────────────────────────────────────── */

  const startTimer = useCallback(() => {
    if (mode === 'stopwatch') {
      setIsRunning(true);
      setIsPaused(false);
      return;
    }

    const cfg = config[mode];
    let workTime = 0;

    if ('work' in cfg) {
      workTime = cfg.work;
    }

    setIsRunning(true);
    setIsPaused(false);
    setPhase('work');
    setTimeLeft(workTime);
    setCurrentRound(1);
    setTotalElapsed(0);
    playBeep(600, 0.3);
  }, [mode, config, playBeep]);

  const pauseTimer = () => {
    setIsPaused(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resumeTimer = () => {
    setIsPaused(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setPhase('ready');
    setTimeLeft(0);
    setCurrentRound(1);
    setTotalElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const skipRound = () => {
    const cfg = config[mode];
    if ('rounds' in cfg && currentRound >= cfg.rounds) {
      resetTimer();
      return;
    }
    setCurrentRound((r) => r + 1);
    setPhase('work');
    if ('work' in cfg) setTimeLeft(cfg.work);
  };

  // Main timer interval
  useEffect(() => {
    if (!isRunning || isPaused) return;

    if (mode === 'stopwatch') {
      intervalRef.current = setInterval(() => {
        setTotalElapsed((t) => t + 1);
      }, 1000);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev > 1) {
          if (prev === 4) playBeep(1000, 0.1);
          return prev - 1;
        }

        // Phase transition
        const cfg = config[mode];
        if (!('work' in cfg)) return 0;

        if (phase === 'work') {
          playBeep(400, 0.3);
          setPhase('rest');
          return cfg.rest;
        } else {
          // rest -> next round or finish
          if ('rounds' in cfg && currentRound >= cfg.rounds) {
            setIsRunning(false);
            playBeep(1200, 0.5);
            return 0;
          }
          playBeep(600, 0.2);
          setCurrentRound((r) => r + 1);
          setPhase('work');
          return cfg.work;
        }
      });
      setTotalElapsed((t) => t + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused, phase, currentRound, mode, config, playBeep]);

  /* ── Formatters ──────────────────────────────────────── */

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getProgress = (): number => {
    if (mode === 'stopwatch' || phase === 'ready') return 0;
    const cfg = config[mode];
    if (!('work' in cfg)) return 0;
    const total = phase === 'work' ? cfg.work : cfg.rest;
    return ((total - timeLeft) / total) * 100;
  };

  const getTotalRounds = (): number => {
    const cfg = config[mode];
    return 'rounds' in cfg ? cfg.rounds : 1;
  };

  /* ── Render ──────────────────────────────────────────── */

  const modeConfig = [
    { id: 'tabata' as TimerMode, label: 'Tabata', icon: Zap, desc: '20s work / 10s rest' },
    { id: 'emom' as TimerMode, label: 'EMOM', icon: Timer, desc: 'Every minute on the minute' },
    { id: 'circuit' as TimerMode, label: 'Circuit', icon: Activity, desc: 'Rounds with rest' },
    { id: 'stopwatch' as TimerMode, label: 'Stopwatch', icon: Watch, desc: 'Free timing' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#00AEEF]" />
              Timer
            </h1>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {modeConfig.map((m) => (
            <button
              key={m.id}
              onClick={() => { resetTimer(); setMode(m.id); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                mode === m.id
                  ? 'bg-[#00AEEF]/15 border-[#00AEEF]/50 text-[#00AEEF]'
                  : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <m.icon className="w-5 h-5" />
              <span className="text-xs font-semibold">{m.label}</span>
              <span className="text-[10px] opacity-60 hidden md:block">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="relative bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col items-center">
          {/* Progress Ring */}
          {mode !== 'stopwatch' && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#1A2235" strokeWidth="4" />
              <motion.circle
                cx="100" cy="100" r="90" fill="none"
                stroke={phase === 'work' ? '#00AEEF' : phase === 'rest' ? '#22C55E' : '#64748B'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 90}`}
                animate={{ strokeDashoffset: `${2 * Math.PI * 90 * (1 - getProgress() / 100)}` }}
                transition={{ duration: 0.5 }}
                transform="rotate(-90 100 100)"
              />
            </svg>
          )}

          {/* Time */}
          <div className="relative z-10 text-center">
            {phase === 'ready' && !isRunning ? (
              <div className="text-6xl font-mono font-bold text-slate-600">--:--</div>
            ) : mode === 'stopwatch' ? (
              <div className="text-6xl font-mono font-bold text-[#00AEEF]">{formatTime(totalElapsed)}</div>
            ) : (
              <>
                <div className={`text-7xl font-mono font-bold ${
                  phase === 'work' ? 'text-[#00AEEF]' : phase === 'rest' ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {formatTime(timeLeft)}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    phase === 'work' ? 'bg-[#00AEEF]/20 text-[#00AEEF]' : phase === 'rest' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {phase}
                  </span>
                  <span className="text-xs text-slate-500">
                    Round {currentRound} / {getTotalRounds()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Circuit Exercise Name */}
        {mode === 'circuit' && 'exercises' in currentConfig && isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="text-sm text-slate-400">Current Exercise</p>
            <p className="text-xl font-bold text-white">
              {currentConfig.exercises[(currentRound - 1) % currentConfig.exercises.length]}
            </p>
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRunning ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startTimer}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold text-lg transition-colors"
            >
              <Play className="w-6 h-6 fill-current" />
              Start
            </motion.button>
          ) : (
            <>
              <button
                onClick={resetTimer}
                className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <RotateCcw className="w-6 h-6" />
              </button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={isPaused ? resumeTimer : pauseTimer}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold text-lg transition-colors"
              >
                {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                {isPaused ? 'Resume' : 'Pause'}
              </motion.button>

              <button
                onClick={skipRound}
                className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
        >
          {showSettings ? 'Hide' : 'Show'} Settings
        </button>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && mode !== 'stopwatch' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300">Timer Settings</h3>

                {'work' in currentConfig && (
                  <div className="grid grid-cols-3 gap-3">
                    <SettingField
                      label="Work (sec)"
                      value={currentConfig.work}
                      onChange={(v) => setConfig((c) => ({ ...c, [mode]: { ...c[mode], work: v } as typeof c[typeof mode] }))}
                    />
                    <SettingField
                      label="Rest (sec)"
                      value={currentConfig.rest}
                      onChange={(v) => setConfig((c) => ({ ...c, [mode]: { ...c[mode], rest: v } as typeof c[typeof mode] }))}
                    />
                    <SettingField
                      label="Rounds"
                      value={currentConfig.rounds}
                      onChange={(v) => setConfig((c) => ({ ...c, [mode]: { ...c[mode], rounds: v } as typeof c[typeof mode] }))}
                    />
                  </div>
                )}

                {mode === 'circuit' && 'exercises' in currentConfig && (
                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">Exercises (one per line)</label>
                    <textarea
                      value={currentConfig.exercises.join('\n')}
                      onChange={(e) => {
                        const exercises = e.target.value.split('\n').filter((s) => s.trim());
                        setConfig((c) => ({ ...c, circuit: { ...c.circuit, exercises } }));
                      }}
                      rows={4}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#00AEEF]"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Setting Field ─────────────────────────────────────── */

function SettingField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 uppercase mb-1 block">{label}</label>
      <input
        type="number"
        min={1}
        max={300}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white text-center focus:outline-none focus:border-[#00AEEF]"
      />
    </div>
  );
}
