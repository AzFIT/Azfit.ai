// ═══════════════════════════════════════════════════════════════
// DayActionPopup (Phase 73 Item 1) — day-tap action popup for the
// trainer month grid. Header = full date; the day's sessions list at
// the top (tap routes to the existing Phase 64 detail modal); then
// the primary "Book a session" action + four honest placeholders
// (disabled, "Soon" tag — no fake functionality this phase).
// Layout: bottom sheet below 640px, centered modal ≥640px. z-[70]
// (above bottom-nav z-50 + chat FAB z-[60], per the Phase 67 lesson).
// Replaces the Phase 68 DaySheet (which was sheet-only, list-only).
// ═══════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarPlus, Sun, Bell, Ruler, Camera } from "lucide-react";
import type { CalendarEvent } from "@/types";

interface DayActionPopupProps {
  open: boolean;
  dateKey: string;
  events: CalendarEvent[];
  onClose: () => void;
  onPickEvent: (event: CalendarEvent) => void;
  /** Trainer only — opens the booking wizard prefilled with this date. */
  onBook?: () => void;
}

const STATUS_CHIP: Record<string, string> = {
  completed: "var(--event-tile-checkin-bg)",
  scheduled: "var(--event-tile-session-bg)",
  cancelled: "var(--light-text-muted)",
};

const chipColor = (status: string | undefined, fallback: string) =>
  (status ? STATUS_CHIP[status] : undefined) ?? fallback;

const SOON_ACTIONS = [
  { icon: Sun, label: "Add holiday" },
  { icon: Bell, label: "Add reminder" },
  { icon: Ruler, label: "Request measurements" },
  { icon: Camera, label: "Request photos" },
];

export default function DayActionPopup({ open, dateKey, events, onClose, onPickEvent, onBook }: DayActionPopupProps) {
  const title = new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full flex-col rounded-t-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl sm:max-w-md sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
              <h3 className="text-sm font-bold text-[var(--page-text)]">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close day view"
                className="rounded-lg p-1.5 text-[var(--light-text-muted)] hover:text-[var(--page-text)] hover:bg-[var(--page-bg)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {events.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--light-text-muted)]">
                  Nothing scheduled
                </p>
              ) : (
                <ul className="divide-y divide-[var(--card-border)]">
                  {events.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => onPickEvent(e)}
                        className="w-full flex items-center gap-3 py-2.5 text-left rounded-lg hover:bg-[var(--page-bg)] transition-colors"
                      >
                        <span
                          className="w-1.5 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: chipColor(e.status, "var(--event-tile-bg)") }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-[var(--page-text)] truncate">{e.title}</span>
                          <span className="text-[10px] text-[var(--light-text-muted)]">
                            {e.startTime}–{e.endTime}
                            {e.clientName ? ` · ${e.clientName}` : ""}
                          </span>
                        </span>
                        <span
                          className="shrink-0 rounded-full border border-[var(--card-border)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{ color: chipColor(e.status, "var(--light-text-muted)") }}
                        >
                          {e.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Actions — only "Book a session" is live (Phase 73); the rest
                are honest disabled placeholders with a "Soon" tag. */}
            {onBook && (
              <div className="border-t border-[var(--card-border)] px-4 py-3 space-y-1.5">
                <button
                  onClick={onBook}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))" }}
                >
                  <CalendarPlus size={14} />
                  Book a session
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  {SOON_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.label}
                        disabled
                        title="Coming soon"
                        className="flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--light-elevated)] px-3 py-2 text-left text-xs font-semibold text-[var(--page-text)] opacity-50 cursor-not-allowed"
                      >
                        <Icon size={14} style={{ color: "var(--azfit-primary)" }} />
                        <span className="flex-1 truncate">{a.label}</span>
                        <span className="rounded-full border border-[var(--card-border)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[var(--light-text-muted)]">
                          Soon
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
