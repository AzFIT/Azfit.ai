// ═══════════════════════════════════════════════════════════════
// MonthCalendar (Phase 68 Item 2) — the Schedule page's mobile-first
// month grid. Structure follows the owner-approved mockup with the
// existing Pulse tokens: month header + weekday row (MON-start) +
// 42 breathable cells (date + ≤3 status dots; titles only ≥768px) +
// gradient TODAY cell + footer strip with today's real session.
// Swipe left/right changes month (touch); ‹ › + Today everywhere.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { monthCells, monthTitle, addMonths, type MonthCell } from "@/lib/monthCalendar";
import { completionEmojiFor } from "@/lib/scheduleEmoji";
import { formatDateKeyLocal } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Status dot colors reuse the Phase 64 event-tile token pairs. */
function dotColor(e: CalendarEvent): string {
  if (e.status === "completed") return "var(--event-tile-completed-bg)";
  switch (e.type) {
    case "session": return "var(--event-tile-session-bg)";
    case "assessment": return "var(--event-tile-assessment-bg)";
    case "check-in": return "var(--event-tile-checkin-bg)";
    case "blocked": return "var(--event-tile-blocked-bg)";
    default: return "var(--event-tile-bg)";
  }
}

interface MonthCalendarProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  events: CalendarEvent[];
  /** '' = user chose None; default handled by the caller */
  completionEmoji: string;
  onPickDay: (cell: MonthCell) => void;
  onEditEmoji: () => void;
}

export default function MonthCalendar({
  year,
  month,
  onMonthChange,
  events,
  completionEmoji,
  onPickDay,
  onEditEmoji,
}: MonthCalendarProps) {
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKeyLocal(today);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [events]);

  const todayEvents = eventsByDay.get(todayKey) ?? [];
  const featured = todayEvents.find((e) => e.type !== "blocked") ?? todayEvents[0] ?? null;

  // Swipe left/right on the grid → prev/next month (touch only)
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 48) return;
    const next = addMonths(year, month, dx < 0 ? 1 : -1);
    onMonthChange(next.year, next.month);
  };

  return (
    <div>
      {/* Header row: month title left, arrows + Today + emoji edit right */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-base font-bold text-[var(--page-text)]">{monthTitle(year, month)}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onEditEmoji}
            title="Edit completion emoji"
            aria-label="Edit completion emoji"
            className="p-1.5 rounded-lg text-[var(--light-text-muted)] hover:text-[var(--page-text)] hover:bg-[var(--page-bg)] transition-colors"
          >
            <span className="text-sm leading-none">{completionEmoji || "—"}</span>
            <Pencil className="w-3 h-3 inline-block ml-0.5 -mt-0.5" />
          </button>
          <div className="flex items-center gap-1 bg-[var(--page-bg)] border border-[var(--card-border)] rounded-lg p-0.5">
            <button
              onClick={() => { const n = addMonths(year, month, -1); onMonthChange(n.year, n.month); }}
              aria-label="Previous month"
              className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--light-text-muted)] hover:text-[var(--page-text)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMonthChange(today.getFullYear(), today.getMonth())}
              className="px-2 py-1 text-xs font-medium text-[var(--page-text)] hover:text-[#00AEEF] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => { const n = addMonths(year, month, 1); onMonthChange(n.year, n.month); }}
              aria-label="Next month"
              className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--light-text-muted)] hover:text-[var(--page-text)] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday header — single letters <768px, short names ≥768px */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LETTERS.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-[var(--light-text-muted)] py-1">
            <span className="md:hidden">{l}</span>
            <span className="hidden md:inline">{WEEKDAY_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* 6×7 grid — swipeable on touch */}
      <div className="grid grid-cols-7 gap-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {cells.map((cell) => {
          const dayEvents = eventsByDay.get(cell.dateKey) ?? [];
          const dots = dayEvents.slice(0, 3);
          const emoji = completionEmojiFor(dayEvents.map((e) => e.status).filter((s): s is string => !!s), completionEmoji);
          return (
            <button
              key={cell.dateKey}
              onClick={() => onPickDay(cell)}
              aria-label={`${cell.dateKey}${dayEvents.length > 0 ? `, ${dayEvents.length} session${dayEvents.length > 1 ? "s" : ""}` : ""}${cell.isToday ? ", today" : ""}`}
              className={cn(
                "relative min-h-[44px] md:min-h-[72px] rounded-lg p-1 md:p-1.5 text-left transition-colors border",
                cell.isToday
                  ? "border-transparent shadow-md"
                  : cell.inMonth
                    ? "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[#00AEEF]/40"
                    : "border-transparent bg-transparent opacity-40 hover:opacity-70",
              )}
              style={
                cell.isToday
                  ? { background: "linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))" }
                  : undefined
              }
            >
              <span className={cn("text-xs font-bold", cell.isToday ? "text-white" : "text-[var(--page-text)]")}>
                {cell.date.getDate()}
              </span>
              {emoji && (
                <span className="absolute top-0.5 right-1 text-[11px] leading-none" aria-hidden>
                  {emoji}
                </span>
              )}
              {/* ≤3 status dots (all sizes) */}
              {dots.length > 0 && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dots.map((e, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor(e) }} />
                  ))}
                </span>
              )}
              {/* full titles only ≥768px */}
              {dayEvents.length > 0 && (
                <span className={cn("hidden md:block mt-1 space-y-0.5")}>
                  {dayEvents.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className={cn("block text-[9px] font-medium truncate", cell.isToday ? "text-white/90" : "text-[var(--light-text-muted)]")}
                    >
                      {e.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className={cn("block text-[9px]", cell.isToday ? "text-white/70" : "text-[var(--light-text-muted)]")}>
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer strip — today's real session summary or the honest empty state */}
      <div data-testid="today-strip" className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#00AEEF] shrink-0">
          TODAY · {today.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
        </span>
        {featured ? (
          <span className="text-xs text-[var(--page-text)] truncate">
            {featured.title}
            <span className="text-[var(--light-text-muted)]">
              {" "}· {featured.startTime}–{featured.endTime}
            </span>
          </span>
        ) : (
          <span className="text-xs text-[var(--light-text-muted)]">No session today — rest day</span>
        )}
      </div>
    </div>
  );
}
