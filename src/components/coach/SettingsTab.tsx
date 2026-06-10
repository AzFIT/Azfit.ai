import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Bell, Users, CalendarDays } from 'lucide-react';

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeSlots = ['6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'];

// Mock availability grid
const defaultAvailability: Record<string, string[]> = {
  Mon: ['6am', '8am', '10am', '4pm', '6pm'],
  Tue: ['8am', '10am', '12pm', '2pm', '6pm'],
  Wed: ['6am', '8am', '4pm', '6pm', '8pm'],
  Thu: ['8am', '10am', '12pm', '2pm', '4pm'],
  Fri: ['6am', '8am', '10am', '6pm', '8pm'],
  Sat: ['8am', '10am', '12pm'],
  Sun: [],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export default function SettingsTab() {
  const [availability, setAvailability] = useState(defaultAvailability);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [autoReminders, setAutoReminders] = useState(true);
  const [clientLimit, setClientLimit] = useState(30);

  const toggleSlot = (day: string, slot: string) => {
    setAvailability((prev) => {
      const slots = prev[day] || [];
      const newSlots = slots.includes(slot)
        ? slots.filter((s) => s !== slot)
        : [...slots, slot];
      return { ...prev, [day]: newSlots };
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-3xl space-y-4"
    >
      {/* Availability Calendar */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border p-4 lg:p-5"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <CalendarDays size={18} style={{ color: '#0D9488' }} />
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--page-text)' }}
          >
            Weekly Availability
          </h3>
        </div>
        <p
          className="mt-0.5 text-xs"
          style={{ color: 'var(--light-text-muted)' }}
        >
          Click time slots to toggle your availability
        </p>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header row with days */}
            <div className="grid grid-cols-8 gap-1">
              <div className="text-[10px] font-medium" style={{ color: 'var(--light-text-muted)' }} />
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="py-1 text-center text-[11px] font-semibold"
                  style={{ color: 'var(--page-text)' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Time slots */}
            {timeSlots.map((slot) => (
              <div key={slot} className="grid grid-cols-8 gap-1">
                <div
                  className="flex items-center text-[10px] font-medium"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  {slot}
                </div>
                {daysOfWeek.map((day) => {
                  const isActive = (availability[day] || []).includes(slot);
                  return (
                    <button
                      key={`${day}-${slot}`}
                      onClick={() => toggleSlot(day, slot)}
                      className="h-8 rounded-md text-[10px] font-medium transition-all duration-150 active:scale-[0.92]"
                      style={{
                        backgroundColor: isActive
                          ? 'rgba(13, 148, 136, 0.2)'
                          : 'var(--light-elevated)',
                        color: isActive ? '#0D9488' : 'var(--light-text-muted)',
                        border: isActive
                          ? '1px solid rgba(13, 148, 136, 0.4)'
                          : '1px solid transparent',
                      }}
                    >
                      {isActive ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Session Duration */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border p-4 lg:p-5"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <Clock size={18} style={{ color: '#06B6D4' }} />
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--page-text)' }}
          >
            Session Duration
          </h3>
        </div>
        <div className="mt-4 flex gap-3">
          {[30, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => setSessionDuration(mins)}
              className="flex-1 rounded-xl border-2 py-3 text-center text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
              style={{
                borderColor:
                  sessionDuration === mins
                    ? '#0D9488'
                    : 'var(--card-border)',
                backgroundColor:
                  sessionDuration === mins
                    ? 'rgba(13, 148, 136, 0.08)'
                    : 'transparent',
                color:
                  sessionDuration === mins
                    ? '#0D9488'
                    : 'var(--page-text)',
              }}
            >
              {mins} min
            </button>
          ))}
        </div>
      </motion.div>

      {/* Auto-Reminders */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border p-4 lg:p-5"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} style={{ color: '#F59E0B' }} />
            <div>
              <h3
                className="text-base font-bold"
                style={{ color: 'var(--page-text)' }}
              >
                Auto-Reminders
              </h3>
              <p
                className="text-xs"
                style={{ color: 'var(--light-text-muted)' }}
              >
                Send session reminders automatically
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutoReminders(!autoReminders)}
            className="relative h-7 w-12 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: autoReminders
                ? '#0D9488'
                : 'var(--light-border)',
            }}
          >
            <motion.div
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm"
              animate={{ left: autoReminders ? 22 : 2 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
          </button>
        </div>
      </motion.div>

      {/* Client Limit */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border p-4 lg:p-5"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: '#8B5CF6' }} />
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--page-text)' }}
            >
              Client Limit
            </h3>
            <p
              className="text-xs"
              style={{ color: 'var(--light-text-muted)' }}
            >
              Maximum number of active clients
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span
              className="text-2xl font-extrabold"
              style={{
                color: '#8B5CF6',
                textShadow: 'var(--text-shadow-glow)',
              }}
            >
              {clientLimit}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--light-text-muted)' }}
            >
              {Math.round((24 / clientLimit) * 100)}% used (24/{clientLimit})
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--light-elevated)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#8B5CF6' }}
              initial={{ width: 0 }}
              animate={{ width: `${(24 / clientLimit) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {/* Slider */}
          <input
            type="range"
            min={10}
            max={100}
            value={clientLimit}
            onChange={(e) => setClientLimit(Number(e.target.value))}
            className="mt-4 w-full cursor-pointer accent-[#8B5CF6]"
            style={{ accentColor: '#8B5CF6' } as React.CSSProperties}
          />
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
            <span>10</span>
            <span>100</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
