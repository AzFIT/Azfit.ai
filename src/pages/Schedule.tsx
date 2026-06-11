import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Users, Timer, Dumbbell,
} from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { CellContextMenu } from '@/components/schedule/CellContextMenu';
import { BookSessionDialog } from '@/components/schedule/BookSessionDialog';
import { BlockTimeDialog } from '@/components/schedule/BlockTimeDialog';
import { EditSessionDialog } from '@/components/schedule/EditSessionDialog';
import { CancelConfirmDialog } from '@/components/schedule/CancelConfirmDialog';

/* ── Constants ─────────────────────────────────────────── */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 05:00 to 22:00
const SLOT_HEIGHT = 48; // pixels per 30-min slot

/* ── Helpers ───────────────────────────────────────────── */

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getEventColor(type: CalendarEvent['type']): string {
  switch (type) {
    case 'session': return 'bg-[#00AEEF]';
    case 'assessment': return 'bg-violet-500';
    case 'blocked': return 'bg-slate-600 border-dashed border-slate-500';
    case 'check-in': return 'bg-emerald-500';
    case 'reminder': return 'bg-amber-500';
    default: return 'bg-slate-500';
  }
}



/* ── Storage ───────────────────────────────────────────── */

const STORAGE_KEY = 'azfit_schedule_events';

function loadEvents(): CalendarEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/* ── Main Component ────────────────────────────────────── */

export default function SchedulePage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(0); // 0-6 for day view

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    open: boolean; x: number; y: number; date: string; time: string;
  }>({ open: false, x: 0, y: 0, date: '', time: '' });

  // Dialogs
  const [bookOpen, setBookOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const weekStart = getWeekStart(currentDate);
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
  [weekStart]);

  const currentTimeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to current time on mount
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 5 && hour <= 22 && currentTimeRef.current && gridRef.current) {
      const scrollY = (hour - 5) * SLOT_HEIGHT * 2 + (now.getMinutes() / 30) * SLOT_HEIGHT - 200;
      gridRef.current.scrollTop = Math.max(0, scrollY);
    }
  }, []);

  // Save events when changed
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  const weekEvents = useMemo(() => {
    const weekDates = weekDays.map(formatDateKey);
    return events.filter((e) => weekDates.includes(e.date));
  }, [events, weekDays]);

  const dayEvents = useMemo(() => {
    const dateKey = formatDateKey(weekDays[selectedDay]);
    return events.filter((e) => e.date === dateKey);
  }, [events, weekDays, selectedDay]);

  const stats = useMemo(() => {
    const weekDates = weekDays.map(formatDateKey);
    const weekEvts = events.filter((e) => weekDates.includes(e.date) && e.type !== 'blocked');
    const totalHours = weekEvts.reduce((sum, e) => {
      const start = timeToMinutes(e.startTime);
      const end = timeToMinutes(e.endTime);
      return sum + (end - start) / 60;
    }, 0);
    const uniqueClients = new Set(weekEvts.map((e) => e.clientId).filter(Boolean)).size;
    return {
      sessions: weekEvts.length,
      hours: Math.round(totalHours * 10) / 10,
      clients: uniqueClients,
    };
  }, [events, weekDays]);

  /* ── Navigation ──────────────────────────────────────── */

  const goToPrevWeek = () => setCurrentDate((d) => addDays(d, -7));
  const goToNextWeek = () => setCurrentDate((d) => addDays(d, 7));
  const goToToday = () => setCurrentDate(new Date());

  /* ── Event Handlers ──────────────────────────────────── */

  const handleCellRightClick = useCallback((e: React.MouseEvent, date: string, time: string) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, date, time });
  }, []);

  const handleCellClick = useCallback((date: string, time: string) => {
    // Check if there's an event at this time
    const dateEvents = events.filter((ev) => ev.date === date);
    const timeMin = timeToMinutes(time);
    const clickedEvent = dateEvents.find((ev) => {
      const start = timeToMinutes(ev.startTime);
      const end = timeToMinutes(ev.endTime);
      return timeMin >= start && timeMin < end;
    });
    if (clickedEvent) {
      setSelectedEvent(clickedEvent);
      setEditOpen(true);
    }
  }, [events]);

  const handleBook = (event: CalendarEvent) => {
    setEvents((prev) => [...prev, event]);
    setBookOpen(false);
  };

  const handleBlock = (event: CalendarEvent) => {
    setEvents((prev) => [...prev, event]);
    setBlockOpen(false);
  };

  const handleSaveEdit = (id: string, updates: Partial<CalendarEvent>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    setEditOpen(false);
  };

  const handleCancelSession = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEditOpen(false);
    setCancelOpen(false);
  };

  const handleRepeatWeekly = () => {
    const { date, time } = contextMenu;
    // Create a blocked recurring slot for the same time every week
    for (let i = 1; i <= 4; i++) {
      const nextDate = addDays(new Date(date), i * 7);
      const event: CalendarEvent = {
        id: `evt-repeat-${Date.now()}-${i}`,
        title: 'Recurring Block',
        date: formatDateKey(nextDate),
        startTime: time,
        endTime: `${parseInt(time.split(':')[0]) + 1}:${time.split(':')[1]}`,
        type: 'blocked',
        description: 'Auto-blocked by repeat weekly',
      };
      setEvents((prev) => [...prev, event]);
    }
  };

  /* ── Render ──────────────────────────────────────────── */

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#00AEEF]" />
                Schedule
              </h1>
              {/* Week Nav */}
              <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
                <button onClick={goToPrevWeek} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={goToToday} className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white">
                  Today
                </button>
                <button onClick={goToNextWeek} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <span className="text-sm text-slate-400">
                {formatDisplayDate(weekDays[0])} – {formatDisplayDate(weekDays[6])}
              </span>
            </div>

            {/* View Toggle + Stats */}
            <div className="flex items-center gap-3">
              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Dumbbell className="w-3 h-3 text-[#00AEEF]" />
                  {stats.sessions} sessions
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3 text-violet-400" />
                  {stats.hours}h
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  {stats.clients} clients
                </span>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-slate-800/50 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'week' ? 'bg-[#00AEEF] text-[#0B1120]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'day' ? 'bg-[#00AEEF] text-[#0B1120]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Day
                </button>
              </div>
            </div>
          </div>

          {/* Day Selector (mobile/day view) */}
          {viewMode === 'day' && (
            <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-none">
              {weekDays.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs transition-all min-w-[60px] ${
                    selectedDay === i
                      ? 'bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/30'
                      : 'bg-slate-800/30 text-slate-400 border border-transparent hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold">{DAYS[i]}</span>
                  <span className="text-[10px]">{day.getDate()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Time Grid */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Day Headers (week view) */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
            <div /> {/* Time column spacer */}
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={`text-center py-2 rounded-xl text-xs font-medium ${
                  isToday(day)
                    ? 'bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/30'
                    : 'bg-slate-800/30 text-slate-400'
                }`}
              >
                <div className="font-bold">{DAYS[i]}</div>
                <div className="text-[10px]">{day.getDate()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        <div
          ref={gridRef}
          className="overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin scrollbar-thumb-slate-700"
        >
          {viewMode === 'week' ? (
            <WeekGrid
              weekDays={weekDays}
              events={weekEvents}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
              currentTimeRef={currentTimeRef}
            />
          ) : (
            <DayGrid
              day={weekDays[selectedDay]}
              events={dayEvents}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
              currentTimeRef={currentTimeRef}
            />
          )}
        </div>
      </div>

      {/* Context Menu */}
      <CellContextMenu
        isOpen={contextMenu.open}
        onClose={() => setContextMenu((p) => ({ ...p, open: false }))}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        date={contextMenu.date}
        time={contextMenu.time}
        onBookClient={() => setBookOpen(true)}
        onNewClient={() => navigate('/onboarding')}
        onBlockTime={() => setBlockOpen(true)}
        onQuickNote={() => {}}
        onRepeatWeekly={handleRepeatWeekly}
      />

      {/* Dialogs */}
      <BookSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        onBook={handleBook}
        clients={[]}
        initialDate={contextMenu.date}
      />
      <BlockTimeDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        onBlock={handleBlock}
      />
      <EditSessionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={selectedEvent}
        onSave={handleSaveEdit}
        onCancelSession={(id) => { setSelectedEvent(events.find((e) => e.id === id) || null); setCancelOpen(true); }}
      />
      <CancelConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        clientName={selectedEvent?.clientName || 'Unknown'}
        date={selectedEvent?.date || ''}
        onConfirm={() => selectedEvent && handleCancelSession(selectedEvent.id)}
      />
    </div>
  );
}

/* ── Week Grid ─────────────────────────────────────────── */

function WeekGrid({
  weekDays,
  events,
  onCellClick,
  onCellRightClick,
  currentTimeRef,
}: {
  weekDays: Date[];
  events: CalendarEvent[];
  onCellClick: (date: string, time: string) => void;
  onCellRightClick: (e: React.MouseEvent, date: string, time: string) => void;
  currentTimeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = currentHour >= 5 && currentHour <= 22;

  return (
    <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
      {HOURS.map((hour) => (
        <div key={hour} className="contents">
          {/* Time Label */}
          <div className="text-right pr-2 text-[10px] text-slate-500 font-mono pt-1"
            style={{ height: SLOT_HEIGHT }}
          >
            {hour.toString().padStart(2, '0')}:00
          </div>

          {/* Hour slots for each day */}
          {weekDays.map((day, dayIndex) => {
            const dateKey = formatDateKey(day);
            const hourEvents = events.filter((e) => {
              if (e.date !== dateKey) return false;
              const startH = parseInt(e.startTime.split(':')[0]);
              return startH === hour;
            });

            return (
              <div
                key={`${dayIndex}-${hour}`}
                className="relative border border-slate-800/50 rounded-lg bg-slate-900/20 hover:bg-slate-800/20 transition-colors"
                style={{ height: SLOT_HEIGHT }}
                onClick={() => onCellClick(dateKey, `${hour.toString().padStart(2, '0')}:00`)}
                onContextMenu={(e) => onCellRightClick(e, dateKey, `${hour.toString().padStart(2, '0')}:00`)}
              >
                {/* Events */}
                {hourEvents.map((event) => (
                  <EventCard key={event.id} event={event} compact />
                ))}

                {/* Current time indicator */}
                {showCurrentTime && isToday(day) && currentHour === hour && (
                  <div
                    ref={currentHour === currentHour ? currentTimeRef : null}
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                    style={{ top: `${(currentMinute / 60) * 100}%` }}
                  >
                    <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Day Grid ──────────────────────────────────────────── */

function DayGrid({
  day,
  events,
  onCellClick,
  onCellRightClick,
  currentTimeRef,
}: {
  day: Date;
  events: CalendarEvent[];
  onCellClick: (date: string, time: string) => void;
  onCellRightClick: (e: React.MouseEvent, date: string, time: string) => void;
  currentTimeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const dateKey = formatDateKey(day);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = isToday(day) && currentHour >= 5 && currentHour <= 22;

  return (
    <div className="space-y-1">
      {HOURS.map((hour) => {
        const hourEvents = events.filter((e) => {
          if (e.date !== dateKey) return false;
          const startH = parseInt(e.startTime.split(':')[0]);
          return startH === hour;
        });

        return (
          <div key={hour} className="flex gap-2">
            <div className="w-14 text-right pr-2 text-[10px] text-slate-500 font-mono pt-2 shrink-0">
              {hour.toString().padStart(2, '0')}:00
            </div>
            <div
              className="flex-1 relative border border-slate-800/50 rounded-lg bg-slate-900/20 hover:bg-slate-800/20 transition-colors min-h-[48px]"
              onClick={() => onCellClick(dateKey, `${hour.toString().padStart(2, '0')}:00`)}
              onContextMenu={(e) => onCellRightClick(e, dateKey, `${hour.toString().padStart(2, '0')}:00`)}
            >
              {hourEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}

              {showCurrentTime && currentHour === hour && (
                <div
                  ref={currentTimeRef}
                  className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                  style={{ top: `${(currentMinute / 60) * 100}%` }}
                >
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Event Card ────────────────────────────────────────── */

function EventCard({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const start = timeToMinutes(event.startTime);
  const end = timeToMinutes(event.endTime);
  const duration = end - start;
  const height = Math.max((duration / 60) * SLOT_HEIGHT, 24);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-xs overflow-hidden cursor-pointer
        ${getEventColor(event.type)} ${event.type === 'blocked' ? 'border' : ''}`}
      style={{
        top: '2px',
        height: compact ? Math.min(height, SLOT_HEIGHT - 4) : height - 4,
        zIndex: 5,
      }}
    >
      <div className="font-medium text-white truncate">{event.title}</div>
      {!compact && (
        <div className="text-[10px] text-white/70">
          {event.startTime} – {event.endTime}
          {event.clientName && ` • ${event.clientName}`}
        </div>
      )}
    </motion.div>
  );
}

function isToday(date: Date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}
