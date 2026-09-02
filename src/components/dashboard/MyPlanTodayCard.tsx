// ═══════════════════════════════════════════════════════════════
// MyPlanTodayCard (Phase 67) — the client dashboard's "My Plan for
// Today" checklist: PulseRing completion, View-Plans bottom sheet,
// Daily/Weekly/Monthly/Yearly tracking, >5-item 100% celebration.
// Auto items (session/target/check-in) are derived — they tick
// themselves or honestly stay unticked with an 'auto' tag.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Trash2, X, Loader2, PartyPopper } from "lucide-react";
import { GlassCard } from "@/components/dashboard/shared/GlassCard";
import PulseRing from "@/components/ui/PulseRing";
import { Input } from "@/components/ui/input";
import { useDailyPlan, type RangeData } from "@/hooks/useDailyPlan";
import {
  planCompletion,
  shouldCelebrate,
  celebrationDismissed,
  dismissCelebration,
  rangeLabel,
  type PlanItem,
  type TrackingRange,
} from "@/lib/dailyPlan";
import { formatDateKeyLocal } from "@/lib/utils";

interface HabitLike {
  id: string;
  name: string;
  active?: boolean;
  is_active?: boolean;
}

interface Props {
  habits: HabitLike[];
  habitLogs: { habit_id: string; log_date: string; done: boolean }[];
  checkinDue: boolean;
}

const RANGES: { id: TrackingRange; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export default function MyPlanTodayCard({ habits, habitLogs, checkinDue }: Props) {
  const todayKey = formatDateKeyLocal(new Date());
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const { loading, items, addCustom, toggleCustom, deleteCustom, loadRange } = useDailyPlan({ habits, habitLogs, checkinDue });
  const { done, total, pct } = planCompletion(items);

  const [modalOpen, setModalOpen] = useState(false);
  const [range, setRange] = useState<TrackingRange>("daily");
  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  // Celebration fires whenever the plan REACHES 100% (last custom tick OR a
  // derived auto item completing, e.g. the session marked done elsewhere) —
  // deferred via setTimeout to stay lint-clean (no sync setState-in-effect).
  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(() => {
      if (shouldCelebrate(items, celebrationDismissed(todayKey))) {
        dismissCelebration(todayKey);
        setCelebrating(true);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [loading, items, todayKey]);

  const openRange = async (r: TrackingRange) => {
    setRange(r);
    if (r === "daily") return;
    setRangeLoading(true);
    setRangeData(await loadRange(r));
    setRangeLoading(false);
  };

  const handleToggle = async (item: PlanItem) => {
    if (item.auto || !item.rowId) return; // derived items tick themselves
    await toggleCustom(item.rowId, !item.done);
    // the celebration effect above fires when this tick completes the plan
  };

  const handleAdd = async () => {
    if (!newLabel.trim() || adding) return;
    setAdding(true);
    await addCustom(newLabel);
    setNewLabel("");
    setAdding(false);
  };

  return (
    <>
      <GlassCard glass accentColor="var(--azfit-primary)" className="!p-5" dataTestId="plan-today-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "var(--page-text)" }}>
              My Plan for Today
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--light-text-muted)" }}>
              {todayLabel}
            </p>
          </div>
          <PulseRing
            percent={pct}
            size={92}
            strokeWidth={8}
            centerLabel={`${pct}%`}
            subLabel={total > 0 ? `${done}/${total} done` : undefined}
            ariaLabel={`Today's plan ${pct}% complete`}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--azfit-primary)" }} />
          </div>
        ) : total === 0 ? (
          <p className="mt-3 text-xs" style={{ color: "var(--light-text-muted)" }}>
            No plans yet — tap View Plans to add your first goal for today.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {items.slice(0, 3).map((i) => (
              <li key={i.key} className="flex items-center gap-2 text-xs" style={{ color: "var(--page-text)" }}>
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: i.done ? "var(--azfit-primary)" : "transparent",
                    border: `1px solid ${i.done ? "var(--azfit-primary)" : "var(--card-border)"}`,
                  }}
                >
                  {i.done && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate" style={i.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                  {i.label}
                </span>
              </li>
            ))}
            {total > 3 && (
              <li className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                + {total - 3} more
              </li>
            )}
          </ul>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setModalOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--azfit-primary)" }}
        >
          View Plans for Today
        </motion.button>
      </GlassCard>

      {/* Plans bottom sheet (mobile-first) / centered modal (sm+) */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full flex-col rounded-t-2xl border shadow-2xl sm:max-w-md sm:rounded-2xl"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="text-sm font-bold" style={{ color: "var(--page-text)" }}>
                  Plans for Today
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: "var(--light-text-muted)" }}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Daily / Weekly / Monthly / Yearly */}
              <div className="flex gap-1.5 px-4 py-2.5 border-b" style={{ borderColor: "var(--card-border)" }}>
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openRange(r.id)}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all"
                    style={{
                      borderColor: range === r.id ? "var(--azfit-primary)" : "var(--card-border)",
                      color: range === r.id ? "var(--azfit-primary)" : "var(--light-text-muted)",
                      backgroundColor: range === r.id ? "color-mix(in srgb, var(--azfit-primary) 10%, transparent)" : "transparent",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {range === "daily" ? (
                  <>
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
                        Nothing here yet — add your first goal below.
                      </p>
                    ) : (
                      <ul className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                        {items.map((item) => (
                          <li key={item.key} className="flex items-center gap-2.5 py-2">
                            <button
                              onClick={() => handleToggle(item)}
                              disabled={item.auto}
                              title={item.auto ? "Completes itself when the action is done" : item.done ? "Mark not done" : "Mark done"}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-default"
                              style={{
                                borderColor: item.done ? "var(--azfit-primary)" : "var(--card-border)",
                                backgroundColor: item.done ? "var(--azfit-primary)" : "transparent",
                                opacity: item.auto ? 0.7 : 1,
                              }}
                            >
                              {item.done && <Check className="h-3 w-3 text-white" />}
                            </button>
                            <span
                              className="flex-1 truncate text-xs font-medium"
                              style={{
                                color: "var(--page-text)",
                                textDecoration: item.done ? "line-through" : undefined,
                                opacity: item.done ? 0.6 : 1,
                              }}
                            >
                              {item.label}
                            </span>
                            {item.auto && (
                              <span
                                className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
                                style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
                                title={item.trackable ? "Derived from your real activity" : "No trackable signal yet — stays unticked until one exists"}
                              >
                                auto
                              </span>
                            )}
                            {!item.auto && (
                              <button
                                onClick={() => deleteCustom(item.rowId!)}
                                className="rounded p-1 transition-colors hover:text-[var(--danger)]"
                                style={{ color: "var(--light-text-muted)" }}
                                aria-label={`Delete ${item.label}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : rangeLoading || !rangeData ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--azfit-primary)" }} />
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                      {rangeLabel(range, rangeData.summary)}
                    </p>
                    <p className="mt-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                      {rangeData.summary.pct == null
                        ? "Days without plans don't count — add goals in the Daily view."
                        : `${rangeData.summary.daysWithItems} of ${rangeData.summary.dayCount} days had plans.`}
                    </p>
                    {range === "weekly" && (
                      <div className="mt-4 flex h-24 items-end gap-1.5">
                        {rangeData.bars.map((b, i) => (
                          <div key={i} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t-sm"
                              style={{
                                height: `${Math.max(b ?? 0, 4)}%`,
                                minHeight: 4,
                                backgroundColor: b == null ? "var(--card-border)" : "var(--azfit-primary)",
                                opacity: b == null ? 0.35 : 1,
                              }}
                              title={b == null ? "No plans" : `${b}%`}
                            />
                            <span className="text-[9px]" style={{ color: "var(--light-text-muted)" }}>
                              {WEEKDAY_LETTERS[i]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Phase 67: add-custom pinned to the sheet footer — always in
                  view on mobile (the scrollable body never buries it) */}
              {range === "daily" && (
                <div className="flex items-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="Add a goal for today…"
                    className="h-8 text-xs"
                    style={{ backgroundColor: "var(--page-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                  />
                  <button
                    onClick={handleAdd}
                    disabled={!newLabel.trim() || adding}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--azfit-primary)" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration (owner rule: 100% AND >5 items, once per day) */}
      <AnimatePresence>
        {celebrating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setCelebrating(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl border p-6 text-center shadow-2xl"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--azfit-primary) 15%, transparent)" }}
              >
                <PartyPopper className="h-6 w-6" style={{ color: "var(--azfit-primary)" }} />
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--page-text)" }}>
                You're on a roll
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--light-text-muted)" }}>
                Every plan for today is done. Keep it up!
              </p>
              <button
                onClick={() => setCelebrating(false)}
                className="mt-4 w-full rounded-lg py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--azfit-primary)" }}
              >
                Nice — close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
