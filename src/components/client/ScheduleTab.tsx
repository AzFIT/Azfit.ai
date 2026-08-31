import { useState, useEffect, useCallback } from "react";
import type { ElementType } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Video,
  MessageSquare,
  CalendarPlus,
  X,
  Sun,
  Bell,
  Ruler,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  remainingCredits,
  isWithinAvailability,
  hasAvailabilityTemplate,
  type AvailabilityWindow,
} from "@/lib/creditsAvailability";
import { generateWeeklyOccurrences } from "@/lib/sessionConflicts";
import { BookSessionDialog } from "@/components/schedule/BookSessionDialog";
import { SessionDetailDialog } from "@/components/schedule/SessionDetailDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientScheduleEvent } from "@/types/client";
import type { CalendarEvent } from "@/types";
import type { Database } from "@/types/supabase";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type TabEvent = Omit<ClientScheduleEvent, "type"> & { type: string; status?: string };

interface ScheduleTabProps {
  clientEmail: string; // sessions.client_id references profiles(id) — resolved via email
  clientsId?: string; // clients.id — for the holiday status update
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#00AEEF",
  completed: "#22C55E",
  requested: "#F59E0B",
  cancelled: "#94A3B8",
};

export default function ScheduleTab({ clientEmail, clientsId }: ScheduleTabProps) {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<TabEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [recordName, setRecordName] = useState(""); // clients.full_name (account-less bookings)
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [reminderPreset, setReminderPreset] = useState<string | null>(null); // null = closed
  const [reminderIsCustom, setReminderIsCustom] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  // Task 2: tap a session tile → detail modal; Edit reopens the wizard
  const [detailEvent, setDetailEvent] = useState<TabEvent | null>(null);
  const [editBookOpen, setEditBookOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // Phase 50: credits + availability state for the booking dialog hints
  const [credits, setCredits] = useState<{ remaining: number; total: number } | null>(null);
  const [availability, setAvailability] = useState<{ windows: AvailabilityWindow[]; blockedDates: string[] } | null>(null);

  // Phase 50: load packages (derivative remaining) + the trainer's template
  const loadExtras = useCallback(async () => {
    if (!user?.id || !clientsId) return;
    const { data: pkgs } = await supabase
      .from("session_packages")
      .select("id, total_credits, created_at")
      .eq("client_id", clientsId);
    if (pkgs && pkgs.length > 0) {
      const { data: sess } = await supabase
        .from("sessions")
        .select("status, created_at")
        .eq("client_record_id", clientsId)
        .in("status", ["scheduled", "completed"]);
      const total = pkgs.reduce((s, p) => s + p.total_credits, 0);
      setCredits({ remaining: remainingCredits(pkgs, sess || []), total });
    } else {
      setCredits(null);
    }

    const { data: avail } = await supabase
      .from("trainer_availability")
      .select("weekday, start_time, end_time, blocked_date")
      .eq("trainer_id", user.id);
    const windows: AvailabilityWindow[] = (avail || [])
      .filter((r) => r.weekday != null)
      .map((r) => ({ weekday: r.weekday as number, start_time: r.start_time, end_time: r.end_time }));
    const blockedDates = (avail || [])
      .filter((r) => r.blocked_date != null)
      .map((r) => r.blocked_date as string);
    setAvailability(hasAvailabilityTemplate(windows, blockedDates) ? { windows, blockedDates } : null);
  }, [user?.id, clientsId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadExtras();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadExtras]);

  const availabilityCheck = useCallback(
    (date: string, startTime: string) =>
      availability ? isWithinAvailability(availability.windows, availability.blockedDates, date, startTime) : true,
    [availability],
  );

  const load = useCallback(async () => {
    if (!clientEmail && !clientsId) return;
    setLoading(true);
    try {
      // Resolve both id spaces: profiles.id (via email) and the clients row
      const [profRes, clientRes] = await Promise.all([
        clientEmail
          ? supabase.from("profiles").select("id, full_name").eq("email", clientEmail).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        clientsId
          ? supabase.from("clients").select("full_name").eq("id", clientsId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (profRes.error) throw profRes.error;
      const prof = profRes.data;
      const cName =
        (clientRes.data as { full_name?: string } | null)?.full_name ||
        (prof as { full_name?: string | null } | null)?.full_name ||
        "Client";
      setRecordName(cName);
      setProfileId(prof?.id ?? null);
      setProfileName((prof as { full_name?: string | null } | null)?.full_name || cName);

      // Phase 35 ITEM 2: sessions live in either id space — client_id
      // (profiles) for account-holders, client_record_id (clients) otherwise
      const filters: string[] = [];
      if (prof?.id) filters.push(`client_id.eq.${prof.id}`);
      if (clientsId) filters.push(`client_record_id.eq.${clientsId}`);
      if (filters.length === 0) {
        setEvents([]);
        return;
      }
      const { data: rows, error } = await supabase
        .from("sessions")
        .select("*")
        .or(filters.join(","))
        .neq("status", "cancelled")
        .order("starts_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const mapped: TabEvent[] = ((rows as SessionRow[]) || []).map((s) => ({
        id: s.id,
        title: s.title,
        date: s.starts_at.split("T")[0],
        startTime: s.starts_at,
        endTime: s.ends_at,
        type:
          s.type === "holiday" || s.type === "reminder"
            ? s.type
            : "session",
        clientId: s.client_id ?? s.client_record_id ?? "",
        clientName: cName,
        location: s.location ?? undefined,
        description: s.notes ?? undefined,
        status: s.status,
      }));
      setEvents(mapped);
    } catch (err) {
      toast.error(
        "Failed to load schedule: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail, clientsId]);

  useEffect(() => {
    load();
  }, [load]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // A day cell shows events whose [start, end] range COVERS that day —
  // multi-day holidays appear on every covered day, not just their start.
  const getEventsForDay = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => {
      const startDay = e.startTime.split("T")[0];
      const endDay = e.endTime.split("T")[0];
      return dayStr >= startDay && dayStr <= endDay;
    });
  };

  const prevMonth = () => {
    setSelectedDay(null);
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setSelectedDay(null);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;

  // Phase 35 ITEM 2: session rows carry BOTH ids when a profile exists
  // (client_id + client_record_id — so every session is resolvable to the
  // clients row), and client_record_id only for account-less clients.
  const sessionIds = () => ({
    client_id: profileId ?? null,
    ...(clientsId ? { client_record_id: clientsId } : {}),
  });

  /* ── Booking (mirrors Schedule.tsx handleBook mapping, minus the
        conflict-check block — v1 books all occurrences) ─────────────── */
  const handleBook = async (event: CalendarEvent, recurringCount = 1) => {
    if ((!profileId && !clientsId) || !user?.id || booking) return;
    setBooking(true);
    try {
      const startDate = new Date(`${event.date}T${event.startTime}`);
      const endDate = new Date(`${event.date}T${event.endTime}`);
      const baseSession = {
        trainerId: user.id,
        title: event.title,
        type: event.type === "blocked" ? "blocked" : "1-on-1",
        status: "scheduled" as const,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        location: event.location || null,
        notes: event.description || null,
      };
      const occurrences =
        recurringCount > 1
          ? generateWeeklyOccurrences({ ...baseSession, clientId: profileId ?? "" }, recurringCount)
          : [baseSession];
      const payload = occurrences.map((occ) => ({
        trainer_id: occ.trainerId,
        ...sessionIds(),
        title: occ.title,
        type: occ.type,
        status: occ.status,
        starts_at: occ.startsAt,
        ends_at: occ.endsAt,
        location: occ.location,
        notes: occ.notes,
      }));
      const { error } = await supabase.from("sessions").insert(payload);
      if (error) throw error;
      toast.success(
        occurrences.length > 1
          ? `${occurrences.length} sessions booked`
          : "Session booked",
      );
      setBookOpen(false);
      await load();
      await loadExtras(); // Phase 50: refresh the credits hint after booking
    } catch (err) {
      toast.error(
        "Failed to book session: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setBooking(false);
    }
  };

  /* ── Task 2: edit & delete for booked sessions ─────────────────────
     TabEvents carry ISO timestamps; the wizard needs local date/HH:MM. */
  const toCalendarEvent = (e: TabEvent): CalendarEvent => {
    const s = new Date(e.startTime);
    const en = new Date(e.endTime);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      id: e.id,
      title: e.title,
      date: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
      startTime: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endTime: `${pad(en.getHours())}:${pad(en.getMinutes())}`,
      type: e.type === "session" ? "session" : "reminder",
      clientId: profileId ?? clientsId ?? "",
      clientName: e.clientName,
      description: e.description,
      location: e.location ?? null,
      status: e.status,
    };
  };

  const handleUpdateSession = async (id: string, ev: CalendarEvent) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          type: ev.type === "blocked" ? "blocked" : "1-on-1",
          starts_at: new Date(`${ev.date}T${ev.startTime}`).toISOString(),
          ends_at: new Date(`${ev.date}T${ev.endTime}`).toISOString(),
          notes: ev.description || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Session updated");
      setEditBookOpen(false);
      setEditingEvent(null);
      await load();
      await loadExtras();
    } catch (err) {
      toast.error(
        "Failed to update session: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    }
  };

  // Hard delete, optimistic with rollback. Package credits are derivative
  // of session rows (Phase 50), so deleting auto-refunds the credit.
  const handleDeleteSession = async (id: string) => {
    const previous = events;
    setEvents((cur) => cur.filter((e) => e.id !== id));
    setDetailEvent(null);
    try {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Session deleted");
      await loadExtras();
    } catch (err) {
      setEvents(previous);
      toast.error(
        "Failed to delete session: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    }
  };

  /* ── Holiday: one sessions row (type='holiday') + clients.status='on_holiday' ── */
  const handleSaveHoliday = async (start: string, end: string, note: string) => {
    if ((!profileId && !clientsId) || !user?.id || actionSaving) return;
    setActionSaving(true);
    try {
      const { error } = await supabase.from("sessions").insert({
        trainer_id: user.id,
        ...sessionIds(),
        title: "Holiday",
        type: "holiday",
        status: "scheduled",
        starts_at: new Date(`${start}T00:00:00`).toISOString(),
        ends_at: new Date(`${end}T23:59:00`).toISOString(),
        location: null,
        notes: note || null,
      });
      if (error) throw error;

      if (clientsId) {
        const { error: statusError } = await supabase
          .from("clients")
          .update({ status: "on_holiday", updated_at: new Date().toISOString() })
          .eq("id", clientsId);
        if (statusError) throw statusError;
        toast.success("Client marked On Holiday — remember to set them Active when they're back");
      } else {
        toast.success("Holiday added");
      }

      setHolidayOpen(false);
      await load();
    } catch (err) {
      toast.error(
        "Failed to add holiday: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setActionSaving(false);
    }
  };

  /* ── Reminder: one sessions row (type='reminder', 30 min at 09:00 local) ── */
  const handleSaveReminder = async (title: string, date: string, note: string) => {
    if ((!profileId && !clientsId) || !user?.id || actionSaving) return;
    setActionSaving(true);
    try {
      const startsAt = new Date(`${date}T09:00:00`);
      const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
      const { error } = await supabase.from("sessions").insert({
        trainer_id: user.id,
        ...sessionIds(),
        title,
        type: "reminder",
        status: "scheduled",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        location: null,
        notes: note || null,
      });
      if (error) throw error;
      toast.success("Reminder added");
      setReminderPreset(null);
      await load();
    } catch (err) {
      toast.error(
        "Failed to add reminder: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setActionSaving(false);
    }
  };

  const typeConfig: Record<
    string,
    { icon: ElementType; color: string; bg: string }
  > = {
    session: { icon: Calendar, color: "#00AEEF", bg: "rgba(0,174,239,0.1)" },
    holiday: { icon: Sun, color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    reminder: { icon: Bell, color: "#00AEEF", bg: "rgba(0,174,239,0.1)" },
    workout: { icon: Dumbbell, color: "#0D9488", bg: "rgba(13,148,136,0.1)" },
    checkin: { icon: User, color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
    call: { icon: Video, color: "#06B6D4", bg: "rgba(6,182,212,0.1)" },
    message: {
      icon: MessageSquare,
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.1)",
    },
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl border hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <ChevronLeft size={16} style={{ color: "var(--page-text)" }} />
        </button>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--page-text)" }}
        >
          {currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 rounded-xl border hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <ChevronRight size={16} style={{ color: "var(--page-text)" }} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        {/* Day Headers */}
        <div
          className="grid grid-cols-7 border-b"
          style={{ borderColor: "var(--card-border)" }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-medium"
              style={{ color: "var(--light-text-muted)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[80px] border-b border-r"
              style={{ borderColor: "var(--card-border)" }}
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isToday =
              new Date().toDateString() ===
              new Date(year, month, day).toDateString();
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className="min-h-[80px] border-b border-r p-1 relative text-left transition-colors hover:bg-[var(--light-elevated)]"
                style={{
                  borderColor: "var(--card-border)",
                  backgroundColor: isSelected
                    ? "rgba(0,174,239,0.08)"
                    : "transparent",
                  boxShadow: isSelected
                    ? "inset 0 0 0 1px var(--azfit-primary)"
                    : "none",
                }}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${isToday ? "text-white" : ""}`}
                  style={{
                    backgroundColor: isToday
                      ? "var(--azfit-primary)"
                      : "transparent",
                    color: isToday ? "#fff" : "var(--page-text)",
                  }}
                >
                  {day}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => {
                    const cfg = typeConfig[e.type] || typeConfig.session;
                    return (
                      <div
                        key={e.id}
                        className="text-[8px] truncate px-1 py-0.5 rounded"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {e.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div
                      className="text-[8px] px-1"
                      style={{ color: "var(--light-text-muted)" }}
                    >
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day panel */}
      {selectedDay !== null && selectedDateStr && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--page-text)" }}
            >
              {new Date(`${selectedDateStr}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 rounded-lg hover:opacity-80"
            >
              <X size={14} style={{ color: "var(--light-text-muted)" }} />
            </button>
          </div>

          {getEventsForDay(selectedDay).length === 0 ? (
            <p
              className="text-xs py-1"
              style={{ color: "var(--light-text-muted)" }}
            >
              Nothing scheduled
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              {getEventsForDay(selectedDay).map((e) => {
                const evCfg = typeConfig[e.type] || typeConfig.session;
                const EvIcon = evCfg.icon;
                return (
                <div
                  key={e.id}
                  onClick={() => setDetailEvent(e)}
                  className="flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition hover:opacity-80"
                  style={{ backgroundColor: "var(--light-elevated)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="flex items-center gap-1.5 text-xs font-medium truncate"
                      style={{ color: "var(--page-text)" }}
                    >
                      <EvIcon size={12} style={{ color: evCfg.color }} className="shrink-0" />
                      {e.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: "var(--light-text-muted)" }}
                      >
                        <Clock size={9} />
                        {new Date(e.startTime).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" – "}
                        {new Date(e.endTime).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {e.location && (
                        <span
                          className="flex items-center gap-1 text-[10px]"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          <MapPin size={9} />
                          {e.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {e.status && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                      style={{
                        backgroundColor: `${STATUS_COLORS[e.status] || "#94A3B8"}20`,
                        color: STATUS_COLORS[e.status] || "#94A3B8",
                      }}
                    >
                      {e.status}
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Phase 35 ITEM 2: the five actions work for account-less clients
              too (bookings persist via client_record_id) — no dead-end note */}
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {[
              { icon: CalendarPlus, label: "Book a session", onClick: () => setBookOpen(true), primary: true },
              { icon: Sun, label: "Add holiday", onClick: () => setHolidayOpen(true) },
              { icon: Bell, label: "Add reminder", onClick: () => { setReminderPreset(""); setReminderIsCustom(true); } },
              { icon: Ruler, label: "Request measurements", onClick: () => { setReminderPreset("Measure weight + body fat"); setReminderIsCustom(false); } },
              { icon: Camera, label: "Request photos", onClick: () => { setReminderPreset("Progress photos due"); setReminderIsCustom(false); } },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition hover:opacity-90"
                  style={
                    a.primary
                      ? { backgroundColor: "var(--azfit-primary)", color: "#fff" }
                      : { backgroundColor: "var(--light-elevated)", color: "var(--page-text)", border: "1px solid var(--card-border)" }
                  }
                >
                  <Icon size={14} style={a.primary ? undefined : { color: "var(--azfit-primary)" }} />
                  {a.label}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Upcoming Events List */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--page-text)" }}
        >
          Upcoming Events
        </h3>
        <div className="space-y-2">
          {events
            .filter((e) => new Date(e.startTime) >= new Date())
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
            )
            .slice(0, 5)
            .map((event) => {
              const cfg = typeConfig[event.type] || typeConfig.session;
              const Icon = cfg.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl"
                  style={{ backgroundColor: "var(--light-elevated)" }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <Icon size={14} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: "var(--page-text)" }}
                    >
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: "var(--light-text-muted)" }}
                      >
                        <Calendar size={9} />
                        {new Date(event.startTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: "var(--light-text-muted)" }}
                      >
                        <Clock size={9} />
                        {new Date(event.startTime).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {event.location && (
                        <span
                          className="flex items-center gap-1 text-[10px]"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          <MapPin size={9} />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          {events.filter((e) => new Date(e.startTime) >= new Date()).length ===
            0 && (
            <p
              className="text-sm text-center py-4"
              style={{ color: "var(--light-text-muted)" }}
            >
              No upcoming events
            </p>
          )}
        </div>
      </motion.div>

      {(profileId || clientsId) && (
        <BookSessionDialog
          key={selectedDateStr || "none"}
          open={bookOpen}
          onOpenChange={setBookOpen}
          onBook={handleBook}
          isTrainer
          clients={[{ id: profileId ?? clientsId!, name: profileId ? profileName : recordName }]}
          initialDate={selectedDateStr || undefined}
          initialClientId={profileId ?? clientsId!}
          credits={credits}
          availabilityCheck={availability ? availabilityCheck : undefined}
        />
      )}

      {/* Task 2: tap a session tile → detail modal. Edit/Delete are limited
          to real sessions (holidays/reminders keep their own dialogs). */}
      <SessionDetailDialog
        key={`${detailEvent?.id ?? "none"}-${!!detailEvent}`}
        open={!!detailEvent}
        onOpenChange={(v) => { if (!v) setDetailEvent(null); }}
        event={detailEvent ? toCalendarEvent(detailEvent) : null}
        isTrainer
        onEdit={
          detailEvent?.type === "session"
            ? (ev) => {
                setDetailEvent(null);
                setEditingEvent(ev);
                setEditBookOpen(true);
              }
            : undefined
        }
        onDelete={detailEvent?.type === "session" ? handleDeleteSession : undefined}
      />
      {(profileId || clientsId) && (
        <BookSessionDialog
          key={editingEvent?.id ?? "edit-closed"}
          open={editBookOpen}
          onOpenChange={(v) => {
            setEditBookOpen(v);
            if (!v) setEditingEvent(null);
          }}
          onBook={handleBook}
          onUpdate={handleUpdateSession}
          editingEvent={editingEvent}
          isTrainer
          clients={[{ id: profileId ?? clientsId!, name: profileId ? profileName : recordName }]}
          initialClientId={profileId ?? clientsId!}
          availabilityCheck={availability ? availabilityCheck : undefined}
        />
      )}

      {(profileId || clientsId) && selectedDateStr && (
        <>
          <HolidayDialog
            key={`holiday-${selectedDateStr}`}
            open={holidayOpen}
            onOpenChange={setHolidayOpen}
            initialDate={selectedDateStr}
            saving={actionSaving}
            onSave={handleSaveHoliday}
          />
          <ReminderDialog
            key={`reminder-${selectedDateStr}-${reminderPreset ?? "x"}`}
            open={reminderPreset !== null}
            onOpenChange={(v) => { if (!v) setReminderPreset(null); }}
            initialDate={selectedDateStr}
            initialTitle={reminderIsCustom ? "" : (reminderPreset ?? "")}
            saving={actionSaving}
            onSave={handleSaveReminder}
          />
        </>
      )}
    </div>
  );
}

/* ── Holiday dialog (start → end range + optional note) ──────────────── */

function HolidayDialog({
  open,
  onOpenChange,
  initialDate,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  saving: boolean;
  onSave: (start: string, end: string, note: string) => void;
}) {
  const [start, setStart] = useState(initialDate);
  const [end, setEnd] = useState(initialDate);
  const [note, setNote] = useState("");
  const valid = !!start && !!end && end >= start;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <Sun className="h-5 w-5 text-[#F59E0B]" />
            Add holiday
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-[#94A3B8]">Start</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
            <div>
              <Label className="text-sm text-[#94A3B8]">End</Label>
              <Input
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm text-[#94A3B8]">Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bali trip"
              className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
            />
          </div>
          <p className="text-[11px] text-[#64748B]">
            The client will also be marked On Holiday (set them Active again when
            they're back — from the client list).
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2A3447] text-[#94A3B8]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(start, end, note.trim())}
            disabled={!valid || saving}
            className="bg-[#F59E0B] text-white hover:bg-[#F59E0B]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Reminder dialog (preset or custom title + date + note) ──────────── */

function ReminderDialog({
  open,
  onOpenChange,
  initialDate,
  initialTitle,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  initialTitle: string;
  saving: boolean;
  onSave: (title: string, date: string, note: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState("");
  const valid = title.trim() !== "" && !!date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <Bell className="h-5 w-5 text-[#00AEEF]" />
            Add reminder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-[#94A3B8]">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Check in about sleep"
              className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              autoFocus={initialTitle === ""}
            />
          </div>
          <div>
            <Label className="text-sm text-[#94A3B8]">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
            />
          </div>
          <div>
            <Label className="text-sm text-[#94A3B8]">Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any detail…"
              className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2A3447] text-[#94A3B8]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(title.trim(), date, note.trim())}
            disabled={!valid || saving}
            className="bg-[#00AEEF] text-white hover:bg-[#00AEEF]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
