// ═══════════════════════════════════════════════════════════════
// ExerciseChangeDialog (Phase 65A) — the wizard Step 6 "Change
// exercise" UX. Three paths:
//   Similar      — rule-based suggestions ranked from the 52B muscle
//                  taxonomy (same muscle/pattern/equipment), excluding
//                  names already used in the program week.
//   Swap from day— exchange this row with a row on another active day.
//   Custom       — hands off to the full Phase 31B library picker.
// Replacements change the NAME only; the row's prescription (sets/reps/
// %1RM/tempo/rest) always stays — same semantics as the old swap.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Layers, ArrowLeftRight, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExerciseTaxonomy } from "@/hooks/useExerciseTaxonomy";
import {
  buildTaxonomyIndex,
  findTaxonomyMatch,
  patternForExercise,
  similarExercises,
  PATTERN_LABEL,
} from "@/lib/exerciseTaxonomy";

export interface ChangeDayOption {
  dayKey: number;
  label: string;
  names: string[];
}

interface ExerciseChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  /** Current day's workout label — pattern context for Similar. */
  dayLabel: string;
  /** Every exercise name in the program week (excluded from Similar). */
  weekNames: string[];
  /** Other active days (Swap-from-day sources). */
  otherDays: ChangeDayOption[];
  onReplace: (name: string) => void;
  onSwapWithDay: (dayKey: number, idx: number) => void;
  /** Custom: close this dialog and open the full library picker. */
  onBrowseLibrary: () => void;
}

type Tab = "similar" | "day" | "custom";

export default function ExerciseChangeDialog({
  open,
  onOpenChange,
  currentName,
  dayLabel,
  weekNames,
  otherDays,
  onReplace,
  onSwapWithDay,
  onBrowseLibrary,
}: ExerciseChangeDialogProps) {
  const [tab, setTab] = useState<Tab>("similar");
  const [swapDayKey, setSwapDayKey] = useState<number | null>(otherDays[0]?.dayKey ?? null);
  const { rows, loading, error } = useExerciseTaxonomy();

  const suggestions = useMemo(
    () => (tab === "similar" ? similarExercises(currentName, rows, { excludedNames: weekNames, fallbackDayLabel: dayLabel }) : []),
    [tab, currentName, rows, weekNames, dayLabel],
  );
  const unmatched = suggestions.length > 0 && !suggestions[0].matched;
  // Two honest unmatched cases: the name isn't in the library, or it IS but
  // its pattern doesn't fit this day (the flagged-chip case) — the note must
  // say which one the trainer is looking at.
  const flaggedMatch = useMemo(() => {
    if (!unmatched) return null;
    const m = findTaxonomyMatch(currentName, buildTaxonomyIndex(rows));
    return m ? patternForExercise(m.primary_muscle, m.secondary_muscle) : null;
  }, [unmatched, currentName, rows]);
  const swapDay = otherDays.find((d) => d.dayKey === swapDayKey) ?? otherDays[0];
  const dayShort = dayLabel.split("—")[0].trim() || "this day";

  const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
    { id: "similar", label: "Similar", icon: Layers },
    { id: "day", label: "Swap from day", icon: ArrowLeftRight },
    { id: "custom", label: "Custom", icon: Library },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
              <div className="min-w-0">
                <h3 className="text-[var(--page-text)] text-base font-bold">Change exercise</h3>
                <p className="text-[10px] text-[var(--page-text)]/50 truncate">
                  {currentName} · {dayShort} — sets/reps/tempo stay as they are
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 px-4 py-2.5 border-b border-[var(--card-border)]">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all",
                    tab === id
                      ? "border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10"
                      : "border-[var(--card-border)] text-[var(--page-text)]/60 hover:border-[#00AEEF]/50",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {tab === "similar" &&
                (loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-[#00AEEF]" />
                  </div>
                ) : error ? (
                  <p className="py-10 text-center text-xs text-[#EF4444]">Couldn't load the exercise taxonomy ({error}).</p>
                ) : suggestions.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[var(--page-text)]/50">
                    No similar exercises found — every library match is already in this week's plan.
                  </p>
                ) : (
                  <>
                    {unmatched && (
                      <p className="py-2 text-[10px] text-[var(--page-text)]/50">
                        {flaggedMatch
                          ? `"${currentName}" is a ${PATTERN_LABEL[flaggedMatch]} movement — these fit ${dayShort} better:`
                          : `"${currentName}" isn't in the exercise library — showing exercises that fit ${dayShort} instead.`}
                      </p>
                    )}
                    <ul className="divide-y divide-[var(--card-border)]">
                      {suggestions.map((c) => (
                        <li key={c.row.id}>
                          <button
                            onClick={() => {
                              onReplace(c.row.name);
                              onOpenChange(false);
                            }}
                            className="w-full text-left py-2.5 px-1 hover:bg-[var(--page-bg)] rounded-lg transition-colors"
                          >
                            <span className="text-sm font-medium text-[var(--page-text)] block truncate">{c.row.name}</span>
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-[var(--page-text)]/50">
                              <span>{c.row.primary_muscle ?? "—"}</span>
                              <span>{c.row.equipment ?? "—"}</span>
                              <span className="text-[#00AEEF]/80">{c.reason}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ))}

              {tab === "day" &&
                (otherDays.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[var(--page-text)]/50">No other active training days this week.</p>
                ) : (
                  <div className="py-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {otherDays.map((d) => (
                        <button
                          key={d.dayKey}
                          onClick={() => setSwapDayKey(d.dayKey)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all",
                            swapDay?.dayKey === d.dayKey
                              ? "border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10"
                              : "border-[var(--card-border)] text-[var(--page-text)]/60 hover:border-[#00AEEF]/50",
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    {swapDay && (
                      <ul className="divide-y divide-[var(--card-border)]">
                        {swapDay.names.map((name, idx) => (
                          <li key={`${swapDay.dayKey}-${idx}`}>
                            <button
                              onClick={() => {
                                onSwapWithDay(swapDay.dayKey, idx);
                                onOpenChange(false);
                              }}
                              className="w-full text-left py-2.5 px-1 hover:bg-[var(--page-bg)] rounded-lg transition-colors flex items-center justify-between gap-2"
                            >
                              <span className="text-sm font-medium text-[var(--page-text)] truncate">{name}</span>
                              <span className="text-[10px] text-[var(--page-text)]/50 shrink-0">swap ↔ this row</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

              {tab === "custom" && (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-[var(--page-text)]/60">
                    Search the full exercise library with muscle / equipment / level filters.
                  </p>
                  <button
                    onClick={onBrowseLibrary}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00AEEF]/50 text-[#00AEEF] hover:bg-[#00AEEF]/10 text-xs font-medium transition-colors"
                  >
                    <Library className="w-3.5 h-3.5" />
                    Browse full library…
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
