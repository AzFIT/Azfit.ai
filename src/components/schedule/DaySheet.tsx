// ═══════════════════════════════════════════════════════════════
// DaySheet (Phase 68 Item 2) — mobile bottom-sheet day view for the
// month grid. z-[70] (above bottom-nav z-50 + chat FAB z-[60], per
// the Phase 67 lesson). Tapping a session row routes to the existing
// SessionDetailDialog (Phase 64 behavior preserved).
// ═══════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { CalendarEvent } from "@/types";

interface DaySheetProps {
  open: boolean;
  dateKey: string;
  events: CalendarEvent[];
  onClose: () => void;
  onPickEvent: (event: CalendarEvent) => void;
}

const STATUS_CHIP: Record<string, string> = {
  completed: "var(--event-tile-checkin-bg)",
  scheduled: "var(--event-tile-session-bg)",
  cancelled: "var(--light-text-muted)",
};

const chipColor = (status: string | undefined, fallback: string) =>
  (status ? STATUS_CHIP[status] : undefined) ?? fallback;

export default function DaySheet({ open, dateKey, events, onClose, onPickEvent }: DaySheetProps) {
  const title = new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full flex-col rounded-t-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl"
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
                <p className="py-8 text-center text-xs text-[var(--light-text-muted)]">
                  Nothing scheduled — rest day.
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
