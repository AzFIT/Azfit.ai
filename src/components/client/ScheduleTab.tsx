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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { ClientScheduleEvent } from "@/types/client";
import type { Database } from "@/types/supabase";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

interface ScheduleTabProps {
  clientEmail: string; // sessions.client_id references profiles(id) — resolved via email
}

export default function ScheduleTab({ clientEmail }: ScheduleTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ClientScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);

  const load = useCallback(async () => {
    if (!clientEmail) return;
    setLoading(true);
    try {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", clientEmail)
        .maybeSingle();
      if (profErr) throw profErr;
      if (!prof) {
        setNoProfile(true);
        setEvents([]);
        return;
      }

      const { data: rows, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("client_id", prof.id)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const mapped: ClientScheduleEvent[] = ((rows as SessionRow[]) || []).map(
        (s) => ({
          id: s.id,
          title: s.title,
          date: s.starts_at.split("T")[0],
          startTime: s.starts_at,
          endTime: s.ends_at,
          type: "session",
          clientId: prof.id,
          clientName: (prof as { full_name?: string | null }).full_name || "",
          location: s.location ?? undefined,
          description: s.notes ?? undefined,
        }),
      );
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
  }, [clientEmail]);

  useEffect(() => {
    load();
  }, [load]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const monthEvents = events.filter((e) => {
    const d = new Date(e.startTime);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const getEventsForDay = (day: number) => {
    return monthEvents.filter((e) => new Date(e.startTime).getDate() === day);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const typeConfig: Record<
    string,
    { icon: ElementType; color: string; bg: string }
  > = {
    session: { icon: Calendar, color: "#00AEEF", bg: "rgba(0,174,239,0.1)" },
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

  if (noProfile) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-12"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <Calendar size={32} style={{ color: "var(--light-text-muted)" }} />
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--light-text-muted)" }}
        >
          No linked app account for this client yet
        </p>
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

            return (
              <div
                key={day}
                className="min-h-[80px] border-b border-r p-1 relative"
                style={{ borderColor: "var(--card-border)" }}
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
              </div>
            );
          })}
        </div>
      </div>

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
    </div>
  );
}
