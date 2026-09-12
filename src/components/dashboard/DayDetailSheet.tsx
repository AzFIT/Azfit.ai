/* ═══════════════════════════════════════════════════════════════
   DayDetailSheet (Phase 90c) — bottom sheet opened by tapping a day
   on the compact ConsistencyCalendar. Read-only checklist of the
   five categories with REAL per-day values from useDayDetail:
   Training / Hydration / Food logged / Steps / Sleep. Each row
   shows the real value ("7.5 h", "1.8 L") or an honest
   "Not logged" — never a fake zero, never a disabled checkbox
   pretending to be state.

   Client view: rows tap through to the category's REAL logging
   screen (existing routes — one source of truth; this sheet never
   becomes a second logger). Trainer view: rows are read-only —
   navigating would land on the TRAINER's own surfaces, not the
   client's (documented choice).

   Layout: bottom sheet below 640px, centered modal ≥640px, z-[70]
   (above bottom-nav z-50 + chat FAB z-[60] — the DayActionPopup
   pattern).
   ═══════════════════════════════════════════════════════════════ */

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  X, Dumbbell, Droplets, UtensilsCrossed, Footprints, BedDouble, ChevronRight,
} from "lucide-react";
import IconTile from "@/components/ui/IconTile";
import type { DayDetail, DayDetailRow } from "@/hooks/useDayDetail";
import { formatCellDate } from "@/lib/consistencyMap";

const ROWS: {
  key: keyof Omit<DayDetail, "dateKey" | "future">;
  label: string;
  icon: typeof Dumbbell;
  /** client-view tap-through route (null = read-only row) */
  path: string | null;
}[] = [
  { key: "training", label: "Training", icon: Dumbbell, path: "/schedule" },
  { key: "hydration", label: "Hydration", icon: Droplets, path: "/nutrition" },
  { key: "food", label: "Food logged", icon: UtensilsCrossed, path: "/nutrition" },
  { key: "steps", label: "Steps", icon: Footprints, path: "/settings" },
  { key: "sleep", label: "Sleep", icon: BedDouble, path: "/settings" },
];

function Row({
  label, icon: Icon, row, path,
}: {
  label: string;
  icon: typeof Dumbbell;
  row: DayDetailRow;
  path: string | null;
}) {
  const navigate = useNavigate();
  const content = (
    <>
      <IconTile icon={Icon} size="sm" tone={row.logged ? "brand" : "muted"} />
      <span className="flex-1 text-xs font-semibold" style={{ color: "var(--page-text)" }}>
        {label}
      </span>
      {row.logged ? (
        <span className="text-[11px]" style={{ color: "var(--light-text-secondary)" }}>
          {row.valueText}
        </span>
      ) : (
        <span className="text-[11px] italic" style={{ color: "var(--light-text-muted)" }}>
          Not logged
        </span>
      )}
      {path && <ChevronRight size={14} className="shrink-0 text-[var(--light-text-muted)]" />}
    </>
  );
  const className =
    "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors min-h-[44px]";
  if (!path) {
    return (
      <div className={className} aria-label={`${label}: ${row.logged ? row.valueText : "Not logged"}`}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => navigate(path)}
      aria-label={`${label}: ${row.logged ? row.valueText : "Not logged"} — open ${label} logging`}
      className={`${className} hover:bg-[var(--page-bg)] active:scale-[0.98] motion-reduce:transition-none`}
    >
      {content}
    </button>
  );
}

export default function DayDetailSheet({
  detail, loading, error, readOnly, onClose,
}: {
  detail: DayDetail;
  loading: boolean;
  error: boolean;
  /** trainer view — no tap-through rows */
  readOnly: boolean;
  onClose: () => void;
}) {
  const title = formatCellDate(detail.dateKey);
  /* Portal to <body>: the sheet mounts inside the dashboard GlassCard,
     whose backdrop-filter creates a containing block that would trap
     position:fixed (the sheet would render in-flow instead of as an
     overlay — caught by the Phase 90c smoke screenshots). */
  return createPortal(
    <AnimatePresence>
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
          role="dialog"
          aria-modal="true"
          aria-label={`Day detail for ${title}`}
          className="flex max-h-[80vh] w-full flex-col rounded-t-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl sm:max-w-md sm:rounded-2xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
            <h3 className="text-sm font-bold text-[var(--page-text)]">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close day detail"
              className="rounded-lg p-1.5 text-[var(--light-text-muted)] transition-colors hover:bg-[var(--page-bg)] hover:text-[var(--page-text)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {detail.future ? (
              <p className="py-8 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
                Nothing to show yet — this day hasn&apos;t happened.
              </p>
            ) : loading ? (
              <div className="space-y-2 py-3" aria-label="Loading day detail">
                {ROWS.map((r) => (
                  <div key={r.key} className="h-[44px] animate-pulse rounded-xl bg-[var(--page-bg)]" />
                ))}
              </div>
            ) : error ? (
              <p className="py-8 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
                Couldn&apos;t load this day — please try again.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--card-border)]">
                {ROWS.map((r) => (
                  <li key={r.key}>
                    <Row
                      label={r.label}
                      icon={r.icon}
                      row={detail[r.key]}
                      path={readOnly ? null : r.path}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
