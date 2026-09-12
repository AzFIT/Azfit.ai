/* ═══════════════════════════════════════════════════════════════
   ConsistencyCalendar (Phase 90c) — compact month calendar that
   REPLACES the embedded ConsistencyHeatmap as the default consistency
   surface on the client dashboard AND the trainer client-profile
   Overview tab (the heatmap itself is preserved — "View insights"
   opens it full-width in a modal, all Phase 86 behavior intact).

   DATA: the Phase 86 engine REUSED UNCHANGED — useConsistencyMap
   (one range query per source) + consistencyMap's countByDay /
   levelForCount / cellLabel / computeStreaks. Per-day accents use
   the exact 5-level Phase 86 weights; no new intensity math.

   MONTH GRID: Monday-start, small day numerals, accent dot
   intensity-mapped via the heatmap's LEVEL_FILL token map. Today
   gets an outline ring. Month navigation is CLAMPED to the 12-week
   data window (older months hold no counts in the reused engine —
   navigating there would render a falsely-empty month, so prev is
   disabled at the window edge). Local date keys only
   (formatDateKeyLocal pattern).

   DAY SHEET: tapping a day opens DayDetailSheet (real per-day rows
   via useDayDetail — lazy, fires on tap only). Future days show the
   honest "Nothing to show yet" without fetching.

   A11Y: role="grid" with roving tabindex — one day button is in the
   Tab order, Arrow keys move (Up/Down ±7, Home/End the row),
   Enter/Space activates natively. Every day button carries
   "Wed 3 Sep — 2 activities" / "— no activities" as its aria-label;
   month nav buttons are labeled.
   ═══════════════════════════════════════════════════════════════ */

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassCard } from "./shared/GlassCard";
import ConsistencyHeatmap from "./ConsistencyHeatmap";
import { LEVEL_FILL } from "./consistencyLevelFill";
import DayDetailSheet from "./DayDetailSheet";
import { useConsistencyMap } from "@/hooks/useConsistencyMap";
import { useDayDetail } from "@/hooks/useDayDetail";
import { computeStreaks } from "@/lib/insights";
import { countByDay } from "@/lib/consistencyMap";
import {
  buildMonthGrid,
  monthNavBounds,
  shiftMonth,
  streakCaption,
  WEEKDAY_LABELS,
} from "@/lib/dayDetail";

export default function ConsistencyCalendar({
  clientId,
  clientEmail,
}: {
  /** trainer view (client profile Overview tab) */
  clientId?: string;
  clientEmail?: string;
}) {
  const { grid, raw, loading, error } = useConsistencyMap({ clientId, clientEmail });
  const { detail, loading: dayLoading, error: dayError, openDay, closeDay } = useDayDetail({
    clientId,
    clientEmail,
  });
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  if (loading) {
    return (
      <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-[var(--page-bg)]" />
        <div className="h-[150px] animate-pulse rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)]" />
      </GlassCard>
    );
  }

  /* Consistent with the existing dashboard cards: render nothing
     rather than filler on error. */
  if (error || !grid || !raw) return null;

  const today = new Date(`${raw.todayKey}T00:00:00`);
  const current = view ?? { year: today.getFullYear(), month: today.getMonth() };
  const counts = countByDay({
    sessionDates: raw.sessionDates,
    planDates: raw.planItems.filter((p) => p.done).map((p) => p.date),
    habitDates: raw.habitDates,
    checkinDates: raw.checkinDates,
  });
  const monthGrid = buildMonthGrid(current.year, current.month, {
    todayKey: raw.todayKey,
    counts,
    windowStartKey: raw.startKey,
  });
  const bounds = monthNavBounds(current.year, current.month, raw.startKey, raw.todayKey);

  // Streak from the same merged real activity dates the engine uses.
  const merged = [
    ...new Set([
      ...raw.sessionDates,
      ...raw.planItems.filter((p) => p.done).map((p) => p.date),
      ...raw.habitDates,
      ...raw.checkinDates,
    ]),
  ];
  const streak = streakCaption(computeStreaks(merged, raw.todayKey).currentStreak);
  const sparse = grid.totalActiveDays < 7;

  const dayButtons = () =>
    Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-day]") ?? []);

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const btns = dayButtons();
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = Math.min(idx + 1, btns.length - 1);
    else if (e.key === "ArrowLeft") next = Math.max(idx - 1, 0);
    else if (e.key === "ArrowDown") next = Math.min(idx + 7, btns.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(idx - 7, 0);
    else if (e.key === "Home") next = idx - (idx % 7);
    else if (e.key === "End") next = Math.min(idx - (idx % 7) + 6, btns.length - 1);
    if (next >= 0) {
      e.preventDefault();
      setFocusIdx(next);
      btns[next]?.focus();
    }
  };

  return (
    <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} style={{ color: "var(--azfit-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Consistency
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setInsightsOpen(true)}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--azfit-primary)] transition-colors hover:bg-[var(--page-bg)] active:scale-[0.98] motion-reduce:transition-none"
        >
          View insights
        </button>
      </div>

      {/* Month navigation — clamped to the 12-week data window */}
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(shiftMonth(current.year, current.month, -1))}
          disabled={!bounds.canPrev}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-[var(--light-text-muted)] transition-colors hover:bg-[var(--page-bg)] hover:text-[var(--page-text)] disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold" style={{ color: "var(--page-text)" }} aria-live="polite">
          {monthGrid.title}
        </span>
        <button
          type="button"
          onClick={() => setView(shiftMonth(current.year, current.month, 1))}
          disabled={!bounds.canNext}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-[var(--light-text-muted)] transition-colors hover:bg-[var(--page-bg)] hover:text-[var(--page-text)] disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
            {d.slice(0, 2)}
          </div>
        ))}
      </div>

      {/* Month grid — role=grid, roving tabindex, arrow-key navigable.
          Out-of-month cells are structural pads (aria-hidden, no data). */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Consistency calendar, ${monthGrid.title}`}
        onKeyDown={onGridKeyDown}
      >
        {monthGrid.weeks.map((week, wi) => (
          <div key={wi} role="row" className="mt-1 grid grid-cols-7 gap-1">
            {week.map((cell, di) => {
              const flat = wi * 7 + di;
              if (cell.dateKey === null) {
                return <div key={di} role="gridcell" aria-hidden="true" className="min-h-[40px]" />;
              }
              const dayNum = Number(cell.dateKey.slice(8));
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  role="gridcell"
                  data-day={cell.dateKey}
                  tabIndex={flat === focusIdx ? 0 : -1}
                  onFocus={() => setFocusIdx(flat)}
                  onClick={() => void openDay(cell.dateKey!)}
                  aria-label={cell.label}
                  className="flex min-h-[40px] flex-col items-center justify-center rounded-xl transition-colors hover:bg-[var(--page-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--azfit-primary)] active:scale-[0.95] motion-reduce:transition-none"
                  style={{
                    boxShadow: cell.isToday ? "0 0 0 1.5px var(--azfit-accent)" : undefined,
                    opacity: cell.future ? 0.45 : 1,
                  }}
                >
                  <span className="text-[11px] leading-none" style={{ color: "var(--page-text)" }}>
                    {dayNum}
                  </span>
                  {cell.count > 0 && (
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: LEVEL_FILL[cell.level] }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Real streak caption + honest sparse-data caption */}
      <div className="mt-2 space-y-0.5">
        {streak && (
          <p className="text-[10px] font-semibold" style={{ color: "var(--azfit-primary)" }} aria-live="polite">
            {streak}
          </p>
        )}
        {sparse && (
          <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            Your consistency map builds as you log — every dot here is a real session, plan item, habit or check-in.
          </p>
        )}
      </div>

      {/* Day detail sheet (real per-day rows, lazy fetch on tap) */}
      {detail && (
        <DayDetailSheet
          detail={detail}
          loading={dayLoading}
          error={dayError}
          readOnly={!!clientId}
          onClose={closeDay}
        />
      )}

      {/* Expanded view — the Phase 86 heatmap, all behavior preserved.
          Portaled to <body> (the card's backdrop-filter would trap
          position:fixed — same fix as DayDetailSheet). */}
      {createPortal(
        <AnimatePresence>
          {insightsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setInsightsOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "tween", duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Consistency insights — 12 week map"
                className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl sm:max-w-2xl sm:rounded-2xl"
              >
                <ConsistencyHeatmap clientId={clientId} clientEmail={clientEmail} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </GlassCard>
  );
}
