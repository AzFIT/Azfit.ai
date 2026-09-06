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
import { formatDateKeyLocal, formatDayMonth } from '@/lib/utils';
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
import MonthCalendar from '@/components/schedule/MonthCalendar';
import DayActionPopup from '@/components/schedule/DayActionPopup';
import EmojiPickerDialog from '@/components/schedule/EmojiPickerDialog';
import { DEFAULT_COMPLETION_EMOJI } from '@/lib/scheduleEmoji';
import { buildSessionUpdate } from '@/lib/sessionUpdate';
import { durationFromTimes, endTimeFromDuration } from '@/lib/sessionDuration';
import {
  snapMinutesToSlot,
  minutesToTimeString,
  movedSessionTimes,
  dropAllowed,
} from '@/lib/scheduleDnd';

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
    case 'session': return 'var(--event-tile-session-bg)';
    case 'assessment': return 'var(--event-tile-assessment-bg)';
    case 'blocked': return 'var(--event-tile-blocked-bg)';
    case 'check-in': return 'var(--event-tile-checkin-bg)';
    case 'group': return 'var(--event-tile-group-bg)';
    default: return 'var(--event-tile-bg)';
  }
}

/* ── Convert Session → CalendarEvent for grid display ─── */

// Task 4 DnD helpers (module-level — no component state)
function snapTimeInCell(hour: number, clientY: number, rect: DOMRect): string {
  const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return minutesToTimeString(snapMinutesToSlot(hour * 60 + (ratio >= 0.5 ? 30 : 0)));
}

function cellFromPoint(x: number, y: number): { date: string; time: string } | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-cell-date]');
  if (!el) return null;
  const date = el.getAttribute('data-cell-date')!;
  const hour = parseInt(el.getAttribute('data-cell-hour')!, 10);
  return { date, time: snapTimeInCell(hour, y, el.getBoundingClientRect()) };
}

function sessionToEvent(session: ReturnType<typeof useSessions>['sessions'][number]): CalendarEvent {
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const dateKey = formatDateKeyLocal(start);
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
  const { sessions, loading, saving, isTrainer, createSession, createSessions, updateSession, cancelSession, deleteSession, rescheduleSession, weekSessions } = useSessions();

  const [currentDate, setCurrentDate] = useState(new Date());
  // Phase 68: the month grid is the new default view everywhere
  // (mobile-first redesign); week/day stay available via the toggle.
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  // Phase 68 Item 3: per-user completion emoji (profiles.calendar_emoji —
  // NULL = never customized → default; '' = user chose None)
  const [calendarEmoji, setCalendarEmoji] = useState<string>(DEFAULT_COMPLETION_EMOJI);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [daySheetKey, setDaySheetKey] = useState<string | null>(null);
  // Phase 73 Item 2a: the date the booking wizard opens with — set by the
  // day-action popup or the right-click context menu; keys the dialog so a
  // new date remounts and re-prefills (useState initializers run once).
  const [bookDate, setBookDate] = useState<string>(() => formatDateKeyLocal(new Date()));
  // Clients for the booking picker: resolved to profiles.id via email —
  // sessions.client_id references profiles(id), so clients WITHOUT a linked
  // app account are omitted (they cannot have sessions).
  // Phase 73 Item 2b: email + status feed the searchable combobox.
  const [bookableClients, setBookableClients] = useState<{ id: string; name: string; avatar?: string; email?: string; status?: string }[]>([]);
  // Phase 43 Fix 5: real roster size for the header stat (was the count of
  // clients WITH sessions this week — a meaningless "0 clients" on quiet weeks)
  const [rosterCount, setRosterCount] = useState<number | null>(null);

  // Phase 68 Item 3c: load the per-user completion emoji (profiles row)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('calendar_emoji')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const v = (data as { calendar_emoji: string | null } | null)?.calendar_emoji;
      if (v != null) setCalendarEmoji(v);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleSaveEmoji = useCallback(async (emoji: string) => {
    setCalendarEmoji(emoji);
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ calendar_emoji: emoji })
      .eq('id', user.id);
    if (error) toast.error('Could not save the emoji preference');
  }, [user]);

  useEffect(() => {
    if (!user?.id || !isTrainer) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from('clients')
        .select('full_name, email, status')
        .eq('trainer_id', user.id)
        .neq('status', 'archived')
        .order('full_name', { ascending: true });
      if (!rows) return;
      const out: { id: string; name: string; email: string; status: string }[] = [];
      for (const c of rows) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', c.email)
          .maybeSingle();
        if (prof) out.push({ id: prof.id, name: c.full_name, email: c.email, status: c.status ?? 'active' });
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

  // Phase 68: the month grid reads ALL fetched sessions — `events` is
  // week-scoped for the week/day grids (unchanged).
  const monthEvents = useMemo(() => sessions.map(sessionToEvent), [sessions]);

  const weekEvents = useMemo(() => {
    const weekDates = weekDays.map(formatDateKeyLocal);
    return events.filter((e) => weekDates.includes(e.date));
  }, [events, weekDays]);

  const dayEvents = useMemo(() => {
    const dateKey = formatDateKeyLocal(weekDays[selectedDay]);
    return events.filter((e) => e.date === dateKey);
  }, [events, weekDays, selectedDay]);

  const stats = useMemo(() => {
    const weekDates = weekDays.map(formatDateKeyLocal);
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
    // Task 4: a press-hold drag ends with a synthetic click — swallow it once
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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

  const handleEventClick = useCallback((event: CalendarEvent) => {
    // Phase 64: swallow the synthetic click that follows a mobile press-hold drag.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  /* ── Task 4: drag-and-drop rescheduling ──────────────────────────
     Desktop/tablet: native HTML5 drag of a session tile onto a cell.
     Mobile: press-and-hold (~300ms) to pick up, drag a ghost, release to
     snap to the nearest 30-minute slot. The hovered target cell is
     highlighted in both modes; the drop persists (duration preserved)
     optimistically with rollback, guarded by availability + conflicts. */
  const [drag, setDrag] = useState<{
    eventId: string;
    title: string;
    overDate: string;
    overTime: string;
    ghostX: number;
    ghostY: number;
    touch: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const doDrop = useCallback(
    (eventId: string, date: string, startTime: string) => {
      setDrag(null);
      const event = events.find((e) => e.id === eventId);
      if (!event) return;
      if (event.date === date && event.startTime === startTime) return; // no-op drop

      const duration = durationFromTimes(event.startTime, event.endTime);
      const endTime = endTimeFromDuration(startTime, duration);
      if (!dropAllowed(availability ? availabilityCheck : undefined, date, startTime, endTime)) {
        toast.error('Outside your availability template');
        return;
      }

      const { startsAt, endsAt } = movedSessionTimes(event, date, startTime);
      const conflicts = findSessionConflicts(sessions, {
        trainerId: user?.id || '',
        clientId: event.clientId || '',
        startsAt,
        endsAt,
        excludeId: eventId,
      });
      if (conflicts.length > 0) {
        showConflictDialog(
          'Move conflict',
          `That slot overlaps with an existing session:\n\n${formatConflictList(conflicts)}`
        );
        return;
      }

      rescheduleSession(eventId, startsAt, endsAt);
    },
    [events, availability, availabilityCheck, sessions, user?.id, rescheduleSession]
  );

  // Resolve the grid cell under a viewport point (mobile ghost drag) —
  // module-level cellFromPoint.
  const updateDragPosition = useCallback((x: number, y: number) => {
    const cell = cellFromPoint(x, y);
    setDrag((prev) =>
      prev
        ? {
            ...prev,
            ghostX: x,
            ghostY: y,
            ...(cell ? { overDate: cell.date, overTime: cell.time } : {}),
          }
        : prev
    );
  }, []);

  // Desktop: HTML5 drag start on a session tile
  const handleEventDragStart = useCallback(
    (event: CalendarEvent) => (e: React.DragEvent<HTMLDivElement>) => {
      if (!isTrainer) return;
      e.dataTransfer.setData('text/azfit-session', event.id);
      e.dataTransfer.effectAllowed = 'move';
      setDrag({
        eventId: event.id,
        title: event.title,
        overDate: event.date,
        overTime: event.startTime,
        ghostX: 0,
        ghostY: 0,
        touch: false,
      });
    },
    [isTrainer]
  );

  // Mobile: press-and-hold (~300ms) to pick the tile up. A non-passive
  // native touchmove listener takes over once the hold activates — React's
  // root listeners are passive, so they can't block scrolling mid-drag.
  const handleEventTouchStart = useCallback(
    (event: CalendarEvent) => (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isTrainer) return;
      const startX = e.touches[0].clientX;
      const startY = e.touches[0].clientY;
      let active = false;

      const clear = () => {
        window.clearTimeout(timer);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
      };
      const onMove = (ev: TouchEvent) => {
        const t = ev.touches[0];
        if (!active) {
          // moved before the hold fired → it's a scroll, cancel the pickup
          if (Math.hypot(t.clientX - startX, t.clientY - startY) > 10) clear();
          return;
        }
        ev.preventDefault();
        updateDragPosition(t.clientX, t.clientY);
      };
      const onEnd = (ev: TouchEvent) => {
        const wasActive = active;
        clear();
        if (wasActive) {
          const t = ev.changedTouches[0];
          const cell = cellFromPoint(t.clientX, t.clientY);
          setDrag((prev) => {
            if (prev) doDrop(prev.eventId, cell?.date ?? prev.overDate, cell?.time ?? prev.overTime);
            return null;
          });
          // swallow the synthetic click that follows touchend
          window.setTimeout(() => { suppressClickRef.current = false; }, 350);
        }
      };
      const timer = window.setTimeout(() => {
        active = true;
        suppressClickRef.current = true;
        setDrag({
          eventId: event.id,
          title: event.title,
          overDate: event.date,
          overTime: event.startTime,
          ghostX: startX,
          ghostY: startY,
          touch: true,
        });
      }, 300);

      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
    },
    [isTrainer, updateDragPosition, doDrop]
  );

  // Cell-level drag over/drop (desktop DnD). Cells also carry
  // data-cell-date/hour for the mobile elementFromPoint lookup.
  const handleCellDragOver = useCallback(
    (date: string, hour: number) => (e: React.DragEvent<HTMLDivElement>) => {
      if (!drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const time = snapTimeInCell(hour, e.clientY, e.currentTarget.getBoundingClientRect());
      setDrag((prev) => (prev ? { ...prev, overDate: date, overTime: time } : prev));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag?.eventId]
  );

  const handleCellDrop = useCallback(
    (date: string, hour: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/azfit-session') || drag?.eventId;
      if (!id) return;
      const time = drag?.overTime ?? snapTimeInCell(hour, e.clientY, e.currentTarget.getBoundingClientRect());
      doDrop(id, drag?.overDate ?? date, time);
    },
    [drag?.eventId, drag?.overDate, drag?.overTime, doDrop]
  );

  // Dropped outside a cell (or Esc) — clear the drag without moving
  const handleEventDragEnd = useCallback(() => setDrag(null), []);

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
        startsAt: new Date(`${formatDateKeyLocal(nextDate)}T${time}`).toISOString(),
        endsAt: new Date(`${formatDateKeyLocal(nextDate)}T${parseInt(time.split(':')[0]) + 1}:${time.split(':')[1]}`).toISOString(),
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
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--page-text)]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--card-bg)] backdrop-blur-xl border-b border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[var(--page-text)] flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#00AEEF]" />
                Schedule
              </h1>
              {/* Week Nav (hidden in month mode — the month grid has its
                  own ‹ › + Today header row per the 68 mockup) */}
              {viewMode !== 'month' && (
                <>
                  <div className="flex items-center gap-1 bg-[var(--page-bg)] rounded-lg p-0.5">
                    <button onClick={goToPrevWeek} className="p-1.5 rounded hover:bg-[var(--page-bg)] text-[var(--light-text-muted)]">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={goToToday} className="px-2 py-1 text-xs font-medium text-[var(--page-text)] hover:text-[var(--page-text)]">
                      Today
                    </button>
                    <button onClick={goToNextWeek} className="p-1.5 rounded hover:bg-[var(--page-bg)] text-[var(--light-text-muted)]">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-sm text-[var(--light-text-muted)]">
                    {formatDayMonth(weekDays[0])} – {formatDayMonth(weekDays[6])}
                  </span>
                </>
              )}
            </div>

            {/* View Toggle + Stats */}
            <div className="flex items-center gap-3">
              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-3 text-xs text-[var(--light-text-muted)]">
                <span className="flex items-center gap-1">
                  <Dumbbell className="w-3 h-3 text-[#00AEEF]" />
                  {stats.sessions} sessions
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3 text-[#F59E0B]" />
                  {stats.hours}h
                </span>
                {isTrainer && rosterCount !== null && (
                  <span className="flex items-center gap-1" title="Active clients on your roster">
                    <Users className="w-3 h-3 text-[#22C55E]" />
                    {rosterCount} clients
                  </span>
                )}
              </div>

              {/* Download upcoming .ics */}
              <button
                onClick={handleDownloadUpcoming}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--page-bg)] text-[var(--page-text)]"
                title="Download all upcoming sessions (.ics)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">.ics</span>
              </button>

              {/* View Toggle */}
              <div className="flex items-center bg-[var(--page-bg)] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'month' ? 'bg-[#00AEEF] text-[#0B1120]' : 'text-[var(--light-text-muted)] hover:text-[var(--page-text)]'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'week' ? 'bg-[#00AEEF] text-[#0B1120]' : 'text-[var(--light-text-muted)] hover:text-[var(--page-text)]'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'day' ? 'bg-[#00AEEF] text-[#0B1120]' : 'text-[var(--light-text-muted)] hover:text-[var(--page-text)]'
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
                      : 'bg-[var(--page-bg)] text-[var(--light-text-muted)] border border-transparent hover:border-[var(--card-border)]'
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
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00AEEF] border-t-transparent" />
          </div>
        )}

        {/* Phase 68 Item 2: the mobile-first month grid (default view) lives
            OUTSIDE the internal time-grid scroller — it scrolls with the page. */}
        {viewMode === 'month' && (
          <MonthCalendar
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            onMonthChange={(y, m) => setCurrentDate(new Date(y, m, 1))}
            events={monthEvents}
            completionEmoji={calendarEmoji}
            onPickDay={(cell) => setDaySheetKey(cell.dateKey)}
            onEditEmoji={() => setEmojiPickerOpen(true)}
          />
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
                    : 'bg-[var(--page-bg)] text-[var(--light-text-muted)]'
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
          className={viewMode === 'month' ? 'hidden' : 'overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin'}
        >
          {viewMode === 'month' ? null : viewMode === 'week' ? (
            <WeekGrid
              weekDays={weekDays}
              events={weekEvents}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
              currentTimeRef={currentTimeRef}
              drag={drag}
              onCellDragOver={handleCellDragOver}
              onCellDrop={handleCellDrop}
              onEventDragStart={handleEventDragStart}
              onEventDragEnd={handleEventDragEnd}
              onEventTouchStart={handleEventTouchStart}
              onEventClick={handleEventClick}
              dndEnabled={isTrainer}
            />
          ) : (
            <DayGrid
              day={weekDays[selectedDay]}
              events={dayEvents}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
              currentTimeRef={currentTimeRef}
              drag={drag}
              onCellDragOver={handleCellDragOver}
              onCellDrop={handleCellDrop}
              onEventDragStart={handleEventDragStart}
              onEventDragEnd={handleEventDragEnd}
              onEventTouchStart={handleEventTouchStart}
              onEventClick={handleEventClick}
              dndEnabled={isTrainer}
            />
          )}
        </div>
      </div>

      {/* Task 4: mobile press-hold drag ghost (snaps to the target slot) */}
      {drag?.touch && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-[#00AEEF] px-2 py-1 text-xs font-medium text-white opacity-90 shadow-xl"
          style={{ left: drag.ghostX + 10, top: drag.ghostY - 24, transition: 'left 80ms ease-out, top 80ms ease-out' }}
        >
          {drag.title} · {drag.overTime}
        </div>
      )}

      {/* Context Menu */}
      <CellContextMenu
        isOpen={contextMenu.open}
        onClose={() => setContextMenu((p) => ({ ...p, open: false }))}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        date={contextMenu.date}
        time={contextMenu.time}
        onBookClient={() => { setBookDate(contextMenu.date || formatDateKeyLocal(new Date())); setBookOpen(true); }}
        onNewClient={() => navigate('/onboarding')}
        onBlockTime={() => setBlockOpen(true)}
        onQuickNote={() => {}}
        onRepeatWeekly={handleRepeatWeekly}
      />

      {/* Dialogs */}
      <BookSessionDialog
        key={bookOpen ? bookDate : 'book-closed'}
        open={bookOpen}
        onOpenChange={setBookOpen}
        onBook={handleBook}
        isTrainer={isTrainer}
        clients={bookableClients}
        initialDate={bookDate}
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
        <DialogContent className="max-w-md border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--page-text)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[var(--page-text)]">{conflictDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-line text-sm text-[var(--light-text-muted)] max-h-64 overflow-y-auto">
            {conflictDialog.message}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeConflictDialog}
              className="border-[var(--card-border)] text-[var(--light-text-muted)]"
            >
              Cancel
            </Button>
            {conflictDialog.allowSkip && conflictDialog.onConfirm && (
              <Button
                onClick={conflictDialog.onConfirm}
                className="bg-[#00AEEF] text-white hover:opacity-90"
              >
                Skip & Book Rest
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 73 Item 1: day-action popup (month grid day tap) — session
          rows route into the existing detail modal; "Book a session" opens
          the wizard prefilled with the tapped date; the other four actions
          are honest disabled "Soon" placeholders (trainer only). */}
      <DayActionPopup
        open={daySheetKey != null}
        dateKey={daySheetKey ?? ''}
        events={daySheetKey ? monthEvents.filter((e) => e.date === daySheetKey) : []}
        onClose={() => setDaySheetKey(null)}
        onPickEvent={(ev) => {
          setDaySheetKey(null);
          handleEventClick(ev);
        }}
        onBook={
          isTrainer
            ? () => {
                setBookDate(daySheetKey ?? formatDateKeyLocal(new Date()));
                setDaySheetKey(null);
                setBookOpen(true);
              }
            : undefined
        }
      />

      {/* Phase 68 Item 3b: completion-emoji editor (per-user, profiles row) */}
      <EmojiPickerDialog
        open={emojiPickerOpen}
        current={calendarEmoji}
        onSave={handleSaveEmoji}
        onClose={() => setEmojiPickerOpen(false)}
      />
    </div>
  );
}

/* ── Week Grid ─────────────────────────────────────────── */

interface GridDndProps {
  drag: { overDate: string; overTime: string } | null;
  onCellDragOver: (date: string, hour: number) => (e: React.DragEvent<HTMLDivElement>) => void;
  onCellDrop: (date: string, hour: number) => (e: React.DragEvent<HTMLDivElement>) => void;
  onEventDragStart: (event: CalendarEvent) => (e: React.DragEvent<HTMLDivElement>) => void;
  onEventDragEnd: () => void;
  onEventTouchStart: (event: CalendarEvent) => (e: React.TouchEvent<HTMLDivElement>) => void;
  onEventClick: (event: CalendarEvent) => void;
  dndEnabled: boolean;
}

function WeekGrid({
  weekDays,
  events,
  onCellClick,
  onCellRightClick,
  currentTimeRef,
  drag,
  onCellDragOver,
  onCellDrop,
  onEventDragStart,
  onEventDragEnd,
  onEventTouchStart,
  onEventClick,
  dndEnabled,
}: {
  weekDays: Date[];
  events: CalendarEvent[];
  onCellClick: (date: string, time: string) => void;
  onCellRightClick: (e: React.MouseEvent, date: string, time: string) => void;
  currentTimeRef: React.RefObject<HTMLDivElement | null>;
} & GridDndProps) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = currentHour >= 5 && currentHour <= 22;

  return (
    <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
      {HOURS.map((hour) => (
        <div key={hour} className="contents">
          {/* Time Label */}
          <div className="text-right pr-2 text-[10px] text-[var(--light-text-muted)] font-mono pt-1"
            style={{ height: SLOT_HEIGHT }}
          >
            {hour.toString().padStart(2, '0')}:00
          </div>

          {/* Hour slots for each day */}
          {weekDays.map((day, dayIndex) => {
            const dateKey = formatDateKeyLocal(day);
            const hourEvents = events.filter((e) => {
              if (e.date !== dateKey) return false;
              const startH = parseInt(e.startTime.split(':')[0]);
              return startH === hour;
            });

            return (
              <div
                key={`${dayIndex}-${hour}`}
                data-cell-date={dateKey}
                data-cell-hour={hour}
                className={`relative border rounded-lg transition-colors ${
                  drag && drag.overDate === dateKey && parseInt(drag.overTime, 10) === hour
                    ? 'border-[#00AEEF] bg-[#00AEEF]/10 ring-1 ring-[#00AEEF]'
                    : 'border-[var(--card-border)] bg-[var(--page-bg)] hover:bg-[var(--card-bg)]'
                }`}
                style={{ height: SLOT_HEIGHT }}
                onClick={() => onCellClick(dateKey, `${hour.toString().padStart(2, '0')}:00`)}
                onContextMenu={(e) => onCellRightClick(e, dateKey, `${hour.toString().padStart(2, '0')}:00`)}
                onDragOver={onCellDragOver(dateKey, hour)}
                onDrop={onCellDrop(dateKey, hour)}
              >
                {/* Events */}
                {hourEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    compact
                    dndEnabled={dndEnabled}
                    onDragStart={onEventDragStart(event)}
                    onDragEnd={onEventDragEnd}
                    onTouchStart={onEventTouchStart(event)}
                    onClick={() => onEventClick(event)}
                  />
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
  drag,
  onCellDragOver,
  onCellDrop,
  onEventDragStart,
  onEventDragEnd,
  onEventTouchStart,
  onEventClick,
  dndEnabled,
}: {
  day: Date;
  events: CalendarEvent[];
  onCellClick: (date: string, time: string) => void;
  onCellRightClick: (e: React.MouseEvent, date: string, time: string) => void;
  currentTimeRef: React.RefObject<HTMLDivElement | null>;
} & GridDndProps) {
  const dateKey = formatDateKeyLocal(day);
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
            <div className="w-14 text-right pr-2 text-[10px] text-[var(--light-text-muted)] font-mono pt-2 shrink-0">
              {hour.toString().padStart(2, '0')}:00
            </div>
            <div
              data-cell-date={dateKey}
              data-cell-hour={hour}
              className={`flex-1 relative border rounded-lg transition-colors min-h-[48px] ${
                drag && drag.overDate === dateKey && parseInt(drag.overTime, 10) === hour
                  ? 'border-[#00AEEF] bg-[#00AEEF]/10 ring-1 ring-[#00AEEF]'
                  : 'border-[var(--card-border)] bg-[var(--page-bg)] hover:bg-[var(--card-bg)]'
              }`}
              onClick={() => onCellClick(dateKey, `${hour.toString().padStart(2, '0')}:00`)}
              onContextMenu={(e) => onCellRightClick(e, dateKey, `${hour.toString().padStart(2, '0')}:00`)}
              onDragOver={onCellDragOver(dateKey, hour)}
              onDrop={onCellDrop(dateKey, hour)}
            >
              {hourEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  dndEnabled={dndEnabled}
                  onDragStart={onEventDragStart(event)}
                  onDragEnd={onEventDragEnd}
                  onTouchStart={onEventTouchStart(event)}
                  onClick={() => onEventClick(event)}
                />
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

function EventCard({
  event,
  compact,
  dndEnabled = false,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  dndEnabled?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}) {
  const start = timeToMinutes(event.startTime);
  const end = timeToMinutes(event.endTime);
  const duration = end - start;
  const height = Math.max((duration / 60) * SLOT_HEIGHT, 24);
  const isCompleted = event.status === 'completed';

  const bgColor = isCompleted ? 'var(--event-tile-completed-bg)' : getEventColor(event.type);
  const textColor = isCompleted ? 'var(--event-tile-completed-text)' : 'var(--event-tile-text)';

  return (
    <div
      draggable={dndEnabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-xs overflow-hidden cursor-pointer
        ${dndEnabled ? 'cursor-grab active:cursor-grabbing' : ''}
        ${event.type === 'blocked' && !isCompleted ? 'border border-dashed' : ''}
        ${isCompleted ? 'opacity-70' : ''}`}
      style={{
        top: '2px',
        height: compact ? Math.min(height, SLOT_HEIGHT - 4) : height - 4,
        zIndex: 5,
        backgroundColor: bgColor,
        borderColor: event.type === 'blocked' && !isCompleted ? 'var(--card-border)' : undefined,
      }}
    >
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full">
        <div className="flex items-center gap-1 font-medium truncate" style={{ color: textColor }}>
          {isCompleted && <Check size={11} className="shrink-0 text-[#22C55E]" />}
          <span className="truncate">{event.title}</span>
        </div>
        {/* Task 4: week tiles show the start time when there's room (short
            "{Name} PT" titles + time beat the old truncated "PT with B…") */}
        {compact && height >= 40 && (
          <div className="text-[9px]" style={{ color: textColor, opacity: 0.8 }}>{event.startTime}</div>
        )}
        {!compact && (
          <div className="text-[10px]" style={{ color: textColor, opacity: 0.8 }}>
            {event.startTime} – {event.endTime}
            {event.clientName && ` • ${event.clientName}`}
            {isCompleted && ' • completed'}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function isToday(date: Date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}
