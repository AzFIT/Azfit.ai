import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Users, Timer, Dumbbell, Download, Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatDateKeyUtc, formatDayMonth } from '@/lib/utils';
import { useSessions } from '@/hooks/useSessions';
import type { Session } from '@/hooks/useSessions';
import { findSessionConflicts, generateWeeklyOccurrences, formatConflictList } from '@/lib/sessionConflicts';
import { generateICSBundle, downloadICS } from '@/lib/ics';
import {
  isWithinAvailability,
  hasAvailabilityTemplate,
  type AvailabilityWindow,
} from '@/lib/creditsAvailability';
import type { CalendarEvent } from '@/types';
import { CellContextMenu } from '@/components/schedule/CellContextMenu';
import { BookSessionDialog } from '@/components/schedule/BookSessionDialog';
import { BlockTimeDialog } from '@/components/schedule/BlockTimeDialog';
import { SessionDetailDialog } from '@/components/schedule/SessionDetailDialog';
import { buildSessionUpdate } from '@/lib/sessionUpdate';

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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getEventColor(type: string): string {
  switch (type) {
    case '1-on-1': return 'bg-[#00AEEF]';
    case 'assessment': return 'bg-violet-500';
    case 'blocked': return 'bg-slate-600 border-dashed border-slate-500';
    case 'check-in': return 'bg-emerald-500';
    case 'group': return 'bg-amber-500';
    default: return 'bg-slate-500';
  }
}

/* ── Convert Session → CalendarEvent for grid display ─── */

function sessionToEvent(session: ReturnType<typeof useSessions>['sessions'][number]): CalendarEvent {
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const dateKey = formatDateKeyUtc(start);
  const startTime = start.toTimeString().slice(0, 5);
  const endTime = end.toTimeString().slice(0, 5);

  return {
    id: session.id,
    title: session.title,
    date: dateKey,
    startTime,
    endTime,
    type: session.type === 'blocked' ? 'blocked' : session.status === 'requested' ? 'reminder' : 'session',
    clientId: session.clientId ?? '',
    clientName: session.clientName,
    description: session.notes || undefined,
    location: session.location,
    status: session.status,
  };
}

/* ── Main Component ────────────────────────────────────── */

export default function SchedulePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, loading, saving, isTrainer, createSession, createSessions, updateSession, cancelSession, deleteSession, weekSessions } = useSessions();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(0); // 0-6 for day view
  // Clients for the booking picker: resolved to profiles.id via email —
  // sessions.client_id references profiles(id), so clients WITHOUT a linked
  // app account are omitted (they cannot have sessions).
  const [bookableClients, setBookableClients] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  // Phase 43 Fix 5: real roster size for the header stat (was the count of
  // clients WITH sessions this week — a meaningless "0 clients" on quiet weeks)
  const [rosterCount, setRosterCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id || !isTrainer) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from('clients')
        .select('full_name, email')
        .eq('trainer_id', user.id)
        .neq('status', 'archived')
        .order('full_name', { ascending: true });
      if (!rows) return;
      const out: { id: string; name: string }[] = [];
      for (const c of rows) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', c.email)
          .maybeSingle();
        if (prof) out.push({ id: prof.id, name: c.full_name });
      }
      if (!cancelled) {
        setBookableClients(out);
        setRosterCount(rows.length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isTrainer]);

  // Phase 50: availability template for the booking-dialog hint
  const [availability, setAvailability] = useState<{ windows: AvailabilityWindow[]; blockedDates: string[] } | null>(null);
  useEffect(() => {
    if (!user?.id || !isTrainer) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('trainer_availability')
        .select('weekday, start_time, end_time, blocked_date')
        .eq('trainer_id', user.id);
      if (cancelled) return;
      const windows: AvailabilityWindow[] = (data || [])
        .filter((r) => r.weekday != null)
        .map((r) => ({ weekday: r.weekday as number, start_time: r.start_time, end_time: r.end_time }));
      const blockedDates = (data || [])
        .filter((r) => r.blocked_date != null)
        .map((r) => r.blocked_date as string);
      setAvailability(hasAvailabilityTemplate(windows, blockedDates) ? { windows, blockedDates } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isTrainer]);

  const availabilityCheck = useCallback(
    (date: string, startTime: string) =>
      availability ? isWithinAvailability(availability.windows, availability.blockedDates, date, startTime) : true,
    [availability],
  );

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    open: boolean; x: number; y: number; date: string; time: string;
  }>({ open: false, x: 0, y: 0, date: '', time: '' });

  // Dialogs
  const [bookOpen, setBookOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  // Task 2: tap a session → detail modal; Edit reopens the wizard pre-filled
  const [detailOpen, setDetailOpen] = useState(false);
  const [editBookOpen, setEditBookOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Conflict warning dialog
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    allowSkip: boolean;
  }>({ open: false, title: '', message: '', allowSkip: false });

  const closeConflictDialog = () => setConflictDialog((p) => ({ ...p, open: false }));

  const showConflictDialog = (title: string, message: string, onConfirm?: () => void, allowSkip = false) => {
    setConflictDialog({ open: true, title, message, onConfirm, allowSkip });
  };

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

  // Convert sessions to events for the grid
  const events = useMemo(() => {
    const weekEvts = weekSessions(weekStart);
    return weekEvts.map(sessionToEvent);
  }, [weekSessions, weekStart]);

  const weekEvents = useMemo(() => {
    const weekDates = weekDays.map(formatDateKeyUtc);
    return events.filter((e) => weekDates.includes(e.date));
  }, [events, weekDays]);

  const dayEvents = useMemo(() => {
    const dateKey = formatDateKeyUtc(weekDays[selectedDay]);
    return events.filter((e) => e.date === dateKey);
  }, [events, weekDays, selectedDay]);

  const stats = useMemo(() => {
    const weekDates = weekDays.map(formatDateKeyUtc);
    const weekEvts = events.filter((e) => weekDates.includes(e.date) && e.type !== 'blocked');
    const totalHours = weekEvts.reduce((sum, e) => {
      const start = timeToMinutes(e.startTime);
      const end = timeToMinutes(e.endTime);
      return sum + (end - start) / 60;
    }, 0);
    return {
      sessions: weekEvts.length,
      hours: Math.round(totalHours * 10) / 10,
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
    const dateEvents = events.filter((ev) => ev.date === date);
    const timeMin = timeToMinutes(time);
    const clickedEvent = dateEvents.find((ev) => {
      const start = timeToMinutes(ev.startTime);
      const end = timeToMinutes(ev.endTime);
      return timeMin >= start && timeMin < end;
    });
    if (clickedEvent) {
      setSelectedEvent(clickedEvent);
      setDetailOpen(true);
    }
  }, [events]);

  const handleDownloadUpcoming = () => {
    const now = new Date().toISOString();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 56); // 8 weeks
    const upcoming = sessions
      .filter((s) => s.status !== 'cancelled' && s.startsAt > now && s.startsAt < cutoff.toISOString())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    if (upcoming.length === 0) {
      toast.info('No upcoming sessions in the next 8 weeks');
      return;
    }

    const ics = generateICSBundle(
      upcoming.map((s) => ({
        id: s.id,
        title: s.title,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        location: s.location,
        notes: s.notes,
      }))
    );
    downloadICS(ics, `azfit-upcoming-${new Date().toISOString().split('T')[0]}.ics`);
  };

  const handleBook = async (event: CalendarEvent, recurringCount = 1) => {
    const startDate = new Date(`${event.date}T${event.startTime}`);
    const endDate = new Date(`${event.date}T${event.endTime}`);

    const baseSession = {
      trainerId: user?.id || '',
      clientId: event.clientId || '',
      title: event.title,
      type: event.type === 'blocked' ? 'blocked' : '1-on-1',
      status: (isTrainer ? 'scheduled' : 'requested') as Session['status'],
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      location: event.location || null,
      notes: event.description || null,
    };

    // Clients just request; trainers need conflict checking.
    if (!isTrainer) {
      const success = await createSession(baseSession);
      if (success) setBookOpen(false);
      return;
    }

    if (recurringCount > 1) {
      const occurrences = generateWeeklyOccurrences(baseSession, recurringCount);
      const conflicts = occurrences.flatMap((occ) =>
        findSessionConflicts(sessions, {
          trainerId: occ.trainerId,
          clientId: occ.clientId,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
        })
      );
      const uniqueConflicts = [...new Map(conflicts.map((c) => [c.id, c])).values()];

      if (uniqueConflicts.length > 0) {
        const conflictDates = uniqueConflicts
          .map((s) => {
            const d = new Date(s.startsAt);
            return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          })
          .join(', ');
        showConflictDialog(
          'Recurring booking conflicts',
          `Conflicts on: ${conflictDates}.\n\n${formatConflictList(uniqueConflicts)}`,
          async () => {
            const nonConflicting = occurrences.filter((occ) =>
              findSessionConflicts(sessions, {
                trainerId: occ.trainerId,
                clientId: occ.clientId,
                startsAt: occ.startsAt,
                endsAt: occ.endsAt,
              }).length === 0
            );
            const { success, count } = await createSessions(nonConflicting);
            if (success) {
              const skipped = occurrences.length - count;
              toast.success(`${count} sessions booked${skipped > 0 ? ` (${skipped} skipped due to conflicts)` : ''}`);
              setBookOpen(false);
            } else {
              toast.error('Failed to book recurring sessions');
            }
            closeConflictDialog();
          },
          true
        );
        return;
      }

      const { success, count } = await createSessions(occurrences);
      if (success) {
        toast.success(`${count} sessions booked`);
        setBookOpen(false);
      }
      return;
    }

    const conflicts = findSessionConflicts(sessions, {
      trainerId: baseSession.trainerId,
      clientId: baseSession.clientId,
      startsAt: baseSession.startsAt,
      endsAt: baseSession.endsAt,
    });

    if (conflicts.length > 0) {
      showConflictDialog(
        'Booking conflict',
        `This time slot conflicts with an existing session:\n\n${formatConflictList(conflicts)}`
      );
      return;
    }

    const success = await createSession(baseSession);
    if (success) {
      setBookOpen(false);
    }
  };

  const handleBlock = async (event: CalendarEvent) => {
    const startDate = new Date(`${event.date}T${event.startTime}`);
    const endDate = new Date(`${event.date}T${event.endTime}`);

    const baseSession = {
      trainerId: user?.id || '',
      clientId: user?.id || '', // self-block
      title: event.title,
      type: 'blocked' as const,
      status: 'scheduled' as const,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      location: event.location || null,
      notes: event.description || null,
    };

    const conflicts = findSessionConflicts(sessions, {
      trainerId: baseSession.trainerId,
      clientId: baseSession.clientId,
      startsAt: baseSession.startsAt,
      endsAt: baseSession.endsAt,
    });

    if (conflicts.length > 0) {
      showConflictDialog(
        'Block time conflict',
        `This block overlaps with an existing session:\n\n${formatConflictList(conflicts)}`
      );
      return;
    }

    const success = await createSession(baseSession);
    if (success) {
      setBlockOpen(false);
    }
  };

  // Task 2: saving an edit UPDATEs the existing row (wizard edit mode)
  const handleSaveEdit = async (id: string, updates: Partial<CalendarEvent>) => {
    const original = sessions.find((s) => s.id === id);
    if (!original) return;

    const sessionUpdates = buildSessionUpdate(updates);
    // Same vocabulary mapping as handleBook: DB stores '1-on-1' / 'blocked'
    if (updates.type !== undefined) {
      sessionUpdates.type = updates.type === 'blocked' ? 'blocked' : '1-on-1';
    }

    // Only trainers scheduling/approving need conflict checks.
    if (!isTrainer) {
      await updateSession(id, sessionUpdates);
      setEditBookOpen(false);
      setEditingEvent(null);
      return;
    }

    const finalStatus = (updates.type === 'blocked' ? 'scheduled' : (sessionUpdates.status || original.status)) as Session['status'];
    const finalStartsAt = sessionUpdates.startsAt || original.startsAt;
    const finalEndsAt = sessionUpdates.endsAt || original.endsAt;

    if (finalStatus === 'scheduled' || finalStatus === 'requested') {
      const conflicts = findSessionConflicts(sessions, {
        trainerId: original.trainerId,
        clientId: original.clientId ?? '',
        startsAt: finalStartsAt,
        endsAt: finalEndsAt,
        excludeId: id,
      });

      if (conflicts.length > 0) {
        showConflictDialog(
          'Update conflict',
          `This change would overlap with an existing session:\n\n${formatConflictList(conflicts)}`
        );
        return;
      }
    }

    await updateSession(id, sessionUpdates);
    setEditBookOpen(false);
    setEditingEvent(null);
  };

  // Task 2: hard delete — optimistic in the hook; credits auto-refund
  // (Phase 50 remaining = package credits − session rows on/after package)
  const handleDeleteSession = async (id: string) => {
    const ok = await deleteSession(id);
    if (ok) setDetailOpen(false);
  };

  const handleCancelSession = async (id: string) => {
    await cancelSession(id);
    setDetailOpen(false);
  };

  const handleMarkCompleted = async (id: string) => {
    const ok = await updateSession(id, { status: 'completed' });
    if (ok) toast.success('Session marked completed');
    setDetailOpen(false);
  };

  const handleAcceptSession = async (id: string) => {
    const ok = await updateSession(id, { status: 'scheduled' });
    if (ok) toast.success('Session accepted');
    setDetailOpen(false);
  };

  const handleRepeatWeekly = () => {
    const { date, time } = contextMenu;
    for (let i = 1; i <= 4; i++) {
      const nextDate = addDays(new Date(date), i * 7);
      createSession({
        trainerId: user?.id || '',
        clientId: user?.id || '',
        title: 'Recurring Block',
        type: 'blocked',
        status: 'scheduled',
        startsAt: new Date(`${formatDateKeyUtc(nextDate)}T${time}`).toISOString(),
        endsAt: new Date(`${formatDateKeyUtc(nextDate)}T${parseInt(time.split(':')[0]) + 1}:${time.split(':')[1]}`).toISOString(),
        location: null,
        notes: 'Auto-blocked by repeat weekly',
      });
    }
  };

  /* ── Loading overlay ─────────────────────────────────── */
  const isLoading = loading || saving;

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
                {formatDayMonth(weekDays[0])} – {formatDayMonth(weekDays[6])}
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
                {isTrainer && rosterCount !== null && (
                  <span className="flex items-center gap-1" title="Active clients on your roster">
                    <Users className="w-3 h-3 text-emerald-400" />
                    {rosterCount} clients
                  </span>
                )}
              </div>

              {/* Download upcoming .ics */}
              <button
                onClick={handleDownloadUpcoming}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-slate-700/50 text-slate-300"
                title="Download all upcoming sessions (.ics)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">.ics</span>
              </button>

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
      <div className="max-w-7xl mx-auto px-4 py-4 relative">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00AEEF] border-t-transparent" />
          </div>
        )}

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
        isTrainer={isTrainer}
        clients={bookableClients}
        initialDate={contextMenu.date}
        availabilityCheck={availability ? availabilityCheck : undefined}
      />
      <BlockTimeDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        onBlock={handleBlock}
      />
      {/* Task 2: tap a session → detail modal (client/date/time/status +
          Edit/Delete for trainers, soft Cancel for clients, .ics for all).
          Edit/Delete are limited to real session/block rows — holiday and
          reminder rows are managed from the client profile Schedule tab. */
      (() => {
        const raw = sessions.find((s) => s.id === selectedEvent?.id);
        const editable = !!raw && (raw.type === '1-on-1' || raw.type === 'blocked');
        return (
          <SessionDetailDialog
            key={`${selectedEvent?.id ?? 'none'}-${detailOpen}`}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            event={selectedEvent}
            isTrainer={isTrainer}
            onEdit={
              isTrainer && editable
                ? (ev) => {
                    setDetailOpen(false);
                    setEditingEvent(ev);
                    setEditBookOpen(true);
                  }
                : undefined
            }
            onDelete={isTrainer && editable ? handleDeleteSession : undefined}
            onCancel={!isTrainer ? handleCancelSession : undefined}
            onMarkCompleted={isTrainer ? handleMarkCompleted : undefined}
            onAccept={isTrainer ? handleAcceptSession : undefined}
          />
        );
      })()}
      {/* Task 2: the Book Session wizard in edit mode (prefilled).
          key remounts per edited session so the form re-initializes. */}
      <BookSessionDialog
        key={editingEvent?.id ?? 'edit-closed'}
        open={editBookOpen}
        onOpenChange={(v) => {
          setEditBookOpen(v);
          if (!v) setEditingEvent(null);
        }}
        onBook={handleBook}
        onUpdate={handleSaveEdit}
        editingEvent={editingEvent}
        isTrainer={isTrainer}
        clients={bookableClients}
        availabilityCheck={availability ? availabilityCheck : undefined}
      />

      {/* Conflict Warning Dialog */}
      <Dialog open={conflictDialog.open} onOpenChange={closeConflictDialog}>
        <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#F0F0F0]">{conflictDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-line text-sm text-[#94A3B8] max-h-64 overflow-y-auto">
            {conflictDialog.message}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeConflictDialog}
              className="border-[#2A3447] text-[#94A3B8]"
            >
              Cancel
            </Button>
            {conflictDialog.allowSkip && conflictDialog.onConfirm && (
              <Button
                onClick={conflictDialog.onConfirm}
                className="bg-[#00AEEF] text-white hover:bg-[#00BFFF]"
              >
                Skip & Book Rest
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            const dateKey = formatDateKeyUtc(day);
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
  const dateKey = formatDateKeyUtc(day);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = isToday(day) && currentHour >= 5 && currentHour <= 22;

  return (
    <div className="space-y-1">
      {events.length === 0 && (
        /* Phase 58: supportive empty-day framing (was: silently empty grid) */
        <div
          className="mb-2 flex items-center gap-2 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
        >
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--page-text)" }}>Nothing scheduled</span>{" "}
            — a clear day. Book a session or enjoy the breathing room.
          </p>
        </div>
      )}
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
  const isCompleted = event.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-xs overflow-hidden cursor-pointer
        ${isCompleted ? 'bg-slate-700/80 border border-slate-600 opacity-70' : `${getEventColor(event.type)} ${event.type === 'blocked' ? 'border' : ''}`}`}
      style={{
        top: '2px',
        height: compact ? Math.min(height, SLOT_HEIGHT - 4) : height - 4,
        zIndex: 5,
      }}
    >
      <div className="flex items-center gap-1 font-medium text-white truncate">
        {isCompleted && <Check size={11} className="shrink-0 text-emerald-400" />}
        <span className="truncate">{event.title}</span>
      </div>
      {!compact && (
        <div className="text-[10px] text-white/70">
          {event.startTime} – {event.endTime}
          {event.clientName && ` • ${event.clientName}`}
          {isCompleted && ' • completed'}
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
