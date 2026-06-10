import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkipForward, Plus } from 'lucide-react';

interface RestTimerOverlayProps {
  isOpen: boolean;
  initialSeconds: number;
  nextExerciseName: string;
  nextSetNumber: number;
  onComplete: () => void;
  onSkip: () => void;
}

export function RestTimerOverlay({
  isOpen,
  initialSeconds,
  nextExerciseName,
  nextSetNumber,
  onComplete,
  onSkip,
}: RestTimerOverlayProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isOpen || isPaused || seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, seconds, onComplete]);

  const addTime = useCallback((amount: number) => {
    setSeconds((prev) => prev + amount);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (seconds >= 30) return '#00AEEF'; // cyan
    if (seconds >= 15) return '#F59E0B'; // amber
    return '#EF4444'; // red
  };

  const getTimerBg = () => {
    if (seconds >= 30) return 'bg-[#00AEEF]/10';
    if (seconds >= 15) return 'bg-amber-500/10';
    return 'bg-red-500/10';
  };

  const progress = initialSeconds > 0 ? (seconds / initialSeconds) * 100 : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B1120]/95 backdrop-blur-xl"
        >
          {/* Timer Circle */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative"
          >
            {/* Progress Ring */}
            <svg className="w-72 h-72 -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="rgba(30, 41, 59, 0.8)"
                strokeWidth="8"
              />
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke={getTimerColor()}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            {/* Time Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-7xl font-black tracking-tighter"
                style={{ color: getTimerColor() }}
              >
                {formatTime(seconds)}
              </span>
              <span className="text-sm text-slate-500 mt-2 font-medium uppercase tracking-wider">
                Rest Timer
              </span>
            </div>
          </motion.div>

          {/* Next Exercise */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`mt-8 px-6 py-3 rounded-2xl border ${getTimerBg()} border-slate-700/50`}
          >
            <div className="text-xs text-slate-500 uppercase tracking-wider text-center mb-1">
              Up Next
            </div>
            <div className="text-lg font-bold text-white text-center">
              {nextExerciseName}
            </div>
            <div className="text-sm text-slate-400 text-center">
              Set {nextSetNumber}
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 mt-8"
          >
            <button
              onClick={() => addTime(15)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700
                border border-slate-700 text-sm text-slate-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              15s
            </button>
            <button
              onClick={() => addTime(30)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700
                border border-slate-700 text-sm text-slate-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              30s
            </button>
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#00AEEF]/15 hover:bg-[#00AEEF]/25
                border border-[#00AEEF]/30 text-sm font-semibold text-[#00AEEF] transition-colors"
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </button>
          </motion.div>

          {/* Tap to pause hint */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            {isPaused ? 'Tap to resume' : 'Tap timer to pause'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
