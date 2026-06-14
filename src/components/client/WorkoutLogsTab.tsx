import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Clock, Flame, ChevronDown, ChevronUp, Calendar, Trophy } from 'lucide-react';
import type { ClientWorkoutLog } from '@/types/client';

interface WorkoutLogsTabProps {
  logs: ClientWorkoutLog[];
}

export default function WorkoutLogsTab({ logs }: WorkoutLogsTabProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <Dumbbell size={32} style={{ color: 'var(--light-text-muted)' }} />
        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--light-text-muted)' }}>No workout logs yet</p>
      </div>
    );
  }

  const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-3">
      {sorted.map((log) => (
        <motion.div
          key={log.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          {/* Log Header */}
          <button
            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: log.completed ? 'rgba(13,148,136,0.15)' : 'rgba(245,158,11,0.15)' }}>
                {log.completed ? <Trophy size={20} style={{ color: '#0D9488' }} /> : <Dumbbell size={20} style={{ color: '#F59E0B' }} />}
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--page-text)' }}>{log.workoutName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                    <Calendar size={10} />
                    {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                    <Clock size={10} />
                    {log.durationMinutes}m
                  </span>
                  {log.caloriesBurned && (
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                      <Flame size={10} />
                      {log.caloriesBurned} kcal
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: log.completed ? 'rgba(13,148,136,0.1)' : 'rgba(245,158,11,0.1)', color: log.completed ? '#0D9488' : '#F59E0B' }}>
                {log.completed ? 'Completed' : 'Partial'}
              </span>
              {expandedLog === log.id ? <ChevronUp size={16} style={{ color: 'var(--light-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--light-text-muted)' }} />}
            </div>
          </button>

          {/* Expanded Exercises */}
          <AnimatePresence>
            {expandedLog === log.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2">
                  {log.exercises.map((exercise, idx) => (
                    <div key={idx} className="rounded-xl p-3" style={{ backgroundColor: 'var(--light-elevated)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--page-text)' }}>{exercise.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--light-text-muted)' }}>{exercise.muscleGroup}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.sets.map((set, sIdx) => (
                          <div key={sIdx} className="text-[10px] px-2 py-1 rounded-md border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--light-text-secondary)' }}>
                            {set.reps} reps × {set.weight} kg
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {log.notes && (
                    <p className="text-xs italic mt-2" style={{ color: 'var(--light-text-muted)' }}>"{log.notes}"</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
