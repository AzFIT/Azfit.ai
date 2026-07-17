import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Dumbbell, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SessionLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  workoutId: string;
  workoutName?: string;
  phaseName?: string;
  weekNumber?: number;
  dayNumber?: number;
}

export function SessionLauncher({
  isOpen,
  onClose,
  workoutId,
  workoutName = 'Workout',
  phaseName = 'Block 1: Accumulation',
  weekNumber = 1,
  dayNumber = 1,
}: SessionLauncherProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLaunching, setIsLaunching] = useState(false);

  const handleStart = async () => {
    if (!user?.email) {
      toast.error('You must be logged in to start a workout');
      return;
    }

    setIsLaunching(true);

    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (clientError || !client) {
        throw new Error('No client profile found for this user. Ask your trainer to add you as a client.');
      }

      const { data: log, error: logError } = await supabase
        .from('workout_logs')
        .insert({
          client_id: client.id,
          workout_id: workoutId,
          duration_minutes: undefined,
          completed_at: undefined,
        })
        .select('id')
        .single();

      if (logError || !log) throw logError || new Error('Failed to create workout log');

      setIsLaunching(false);
      onClose();
      navigate(`/sheets?workoutLogId=${log.id}`);
    } catch (err) {
      console.error('[SessionLauncher] start failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to start workout');
      setIsLaunching(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] border-t border-[var(--card-border)] rounded-t-3xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--text-muted)]/50" />
            </div>
            <div className="px-5 pb-8 pt-2">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-[#00AEEF]/15 text-[#00AEEF] text-[10px] font-bold uppercase tracking-wider">
                      {phaseName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--card-bg)] text-[var(--text-muted)] text-[10px] font-medium">
                      Week {weekNumber}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{workoutName}</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">Day {dayNumber}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--card-border)] text-[var(--text-muted)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-[#00AEEF]" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">Ready</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status</div>
                  </div>
                </div>
                <div className="flex-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">—</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Duration</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={isLaunching}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base
                  bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] transition-all active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLaunching ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-[#0B1120] border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Start Workout
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
