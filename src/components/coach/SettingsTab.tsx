import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Bell, Users, CalendarDays, CalendarX, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeSlots = ['6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'];
// slot label → start hour (each slot covers 2h: 6am → 06:00–08:00)
const SLOT_HOURS: Record<string, number> = {
  '6am': 6, '8am': 8, '10am': 10, '12pm': 12, '2pm': 14, '4pm': 16, '6pm': 18, '8pm': 20,
};
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Phase 50: empty default — real template loads from trainer_availability
const emptyAvailability: Record<string, string[]> = Object.fromEntries(daysOfWeek.map((d) => [d, []]));

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
  const { user } = useAuth();
  const [availability, setAvailability] = useState(emptyAvailability);
  const [blockedDates, setBlockedDates] = useState<{ id: string; date: string }[]>([]);
  const [blockDateInput, setBlockDateInput] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);
  const [autoReminders, setAutoReminders] = useState(true);
  const [clientLimit, setClientLimit] = useState(30);
  const [savingAvail, setSavingAvail] = useState(false);

  // Phase 50: load the trainer's template + blocked dates (real rows)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trainer_availability")
        .select("id, weekday, start_time, end_time, blocked_date")
        .eq("trainer_id", user.id);
      if (cancelled || !data) return;
      const grid: Record<string, string[]> = Object.fromEntries(daysOfWeek.map((d) => [d, [] as string[]]));
      const blocked: { id: string; date: string }[] = [];
      for (const r of data) {
        if (r.blocked_date) {
          blocked.push({ id: r.id, date: r.blocked_date });
          continue;
        }
        if (r.weekday == null) continue;
        const day = daysOfWeek[r.weekday - 1];
        const startH = parseInt(r.start_time.split(":")[0], 10);
        const endH = parseInt(r.end_time.split(":")[0], 10);
        for (const slot of timeSlots) {
          const h = SLOT_HOURS[slot];
          if (h >= startH && h < endH) grid[day].push(slot);
        }
      }
      setAvailability(grid);
      setBlockedDates(blocked);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Save: replace-all for weekday template rows (the grid is the editor)
  const saveAvailability = useCallback(async () => {
    if (!user?.id || savingAvail) return;
    setSavingAvail(true);
    try {
      const { error: delErr } = await supabase
        .from("trainer_availability")
        .delete()
        .eq("trainer_id", user.id)
        .not("weekday", "is", null);
      if (delErr) throw delErr;
      const rows = daysOfWeek.flatMap((day, di) =>
        (availability[day] || []).map((slot) => ({
          trainer_id: user.id,
          weekday: di + 1,
          start_time: hh(SLOT_HOURS[slot]),
          end_time: hh(SLOT_HOURS[slot] + 2),
        })),
      );
      if (rows.length > 0) {
        const { error } = await supabase.from("trainer_availability").insert(rows);
        if (error) throw error;
      }
      toast.success("Availability saved");
    } catch (err) {
      toast.error("Couldn't save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSavingAvail(false);
    }
  }, [user?.id, availability, savingAvail]);

  const addBlockedDate = useCallback(async () => {
    if (!user?.id || !blockDateInput) return;
    const { error } = await supabase.from("trainer_availability").insert({
      trainer_id: user.id,
      weekday: null,
      start_time: "00:00",
      end_time: "00:00",
      blocked_date: blockDateInput,
    });
    if (error) {
      toast.error("Couldn't block the date: " + error.message);
      return;
    }
    setBlockedDates((prev) => [...prev, { id: `tmp-${Date.now()}`, date: blockDateInput }]);
    setBlockDateInput("");
    toast.success("Date blocked");
  }, [user?.id, blockDateInput]);

  const removeBlockedDate = useCallback(
    async (row: { id: string; date: string }) => {
      if (!row.id.startsWith("tmp-")) {
        const { error } = await supabase.from("trainer_availability").delete().eq("id", row.id);
        if (error) {
          toast.error("Couldn't remove: " + error.message);
          return;
        }
      }
      setBlockedDates((prev) => prev.filter((b) => b.id !== row.id));
    },
    [],
  );

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} style={{ color: '#0D9488' }} />
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--page-text)' }}
            >
              Weekly Availability
            </h3>
          </div>
          <button
            onClick={saveAvailability}
            disabled={savingAvail}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
          >
            <Save size={12} />
            {savingAvail ? 'Saving…' : 'Save template'}
          </button>
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

        {/* Phase 50: blocked dates (vacation/blackout) */}
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
          <div className="mb-2 flex items-center gap-2">
            <CalendarX size={14} style={{ color: '#F59E0B' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--page-text)' }}>
              Blocked dates
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={blockDateInput}
              onChange={(e) => setBlockDateInput(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--light-elevated)',
                borderColor: 'var(--card-border)',
                color: 'var(--page-text)',
              }}
            />
            <button
              onClick={addBlockedDate}
              disabled={!blockDateInput}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
            >
              Block date
            </button>
          </div>
          {blockedDates.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blockedDates.map((b) => (
                <span
                  key={b.id}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
                >
                  {b.date}
                  <button onClick={() => removeBlockedDate(b)} className="transition hover:opacity-70" title="Remove block">
                    <Trash2 size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
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
