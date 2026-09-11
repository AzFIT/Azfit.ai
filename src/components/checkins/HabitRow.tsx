import { useState } from "react";
import { Check } from "lucide-react";
import ArcSlider from "@/components/ui/ArcSlider";
import { formatNumeric, sliderSpecForTarget } from "@/lib/numericHabits";
import type { Habit, HabitLog } from "./useHabits";
import { last7Days, isDoneOnDate, weeklyCompletion, currentStreak } from "./useHabits";

interface HabitRowProps {
  habit: Habit;
  logs: HabitLog[];
  isTodayDone: boolean;
  onToggle: (done: boolean) => void;
  /** Phase 85: numeric-target habits log a value instead of a bare toggle */
  onLogValue?: (value: number) => Promise<void> | void;
  onToggleActive?: (active: boolean) => void;
  disabled?: boolean;
}

export default function HabitRow({
  habit,
  logs,
  isTodayDone,
  onToggle,
  onLogValue,
  onToggleActive,
  disabled,
}: HabitRowProps) {
  const days = last7Days();
  const today = days[6];
  const streak = currentStreak(logs, habit.id);
  const pct = weeklyCompletion(logs, habit.id);

  /* Phase 85: numeric habit — ArcSlider-derived stepper with a Log
     confirm. draft ?? savedToday: dragging sets draft; after the
     upsert + refresh, savedToday catches up to the same number. */
  const isNumeric = habit.target_value != null;
  const spec = isNumeric ? sliderSpecForTarget(habit.target_value as number) : null;
  const savedToday =
    logs.find((l) => l.habit_id === habit.id && l.log_date === today && l.done && l.value != null)
      ?.value ?? null;
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const effective = draft ?? savedToday;

  const handleLog = async () => {
    if (effective == null || !onLogValue) return;
    setSaving(true);
    try {
      await onLogValue(effective);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold" style={{ color: "var(--page-text)" }}>
              {habit.name}
            </p>
            {onToggleActive && (
              <button
                onClick={() => onToggleActive(!habit.active)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  habit.active
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-slate-500/10 text-slate-400"
                }`}
              >
                {habit.active ? "Active" : "Inactive"}
              </button>
            )}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isNumeric
              ? `${habit.target_frequency} · target ${formatNumeric(habit.target_value as number)}${habit.unit ? ` ${habit.unit}` : ""} · ${streak > 0 ? `${streak}-day streak` : "No streak"}`
              : `${habit.target_frequency} · ${streak > 0 ? `${streak}-day streak` : "No streak"}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* 7-day dots */}
          <div className="flex items-center gap-1.5">
            {days.map((date) => {
              const done = isDoneOnDate(logs, habit.id, date);
              return (
                <div
                  key={date}
                  title={date}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: done ? "var(--azfit-primary)" : "rgba(148,163,184,0.25)",
                  }}
                />
              );
            })}
          </div>

          <div className="text-right" style={{ minWidth: "3rem" }}>
            <p className="text-xs font-bold" style={{ color: "var(--azfit-primary)" }}>
              {pct}%
            </p>
            <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              7-day
            </p>
          </div>

          {/* Phase 85: flag-only habits keep the done toggle untouched.
              Numeric habits log via the ArcSlider control below. */}
          {!isNumeric && (
            <button
              onClick={() => onToggle(!isTodayDone)}
              disabled={disabled}
              // Phase 84 Item 1: real accessible name (was an unnamed button)
              aria-label={isTodayDone ? `Undo ${habit.name} for today` : `Log ${habit.name} for today`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                isTodayDone
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                  : "border-slate-600 text-slate-400 hover:border-slate-400"
              } disabled:opacity-50`}
            >
              {isTodayDone && <Check size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Phase 85: numeric habit control — ArcSlider (Phase 69 pattern,
          tap-to-type fallback intact) + a confirm that upserts
          habit_logs.value for today. */}
      {isNumeric && spec && (
        <div
          className="mt-3 flex flex-col items-center gap-3 border-t pt-3 sm:flex-row sm:justify-between"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="flex justify-center sm:justify-start">
            <ArcSlider
              value={effective}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              unit={habit.unit ?? undefined}
              onChange={setDraft}
              disabled={disabled}
              size={170}
              aria-label={`${habit.name} — today's value`}
            />
          </div>
          <div className="flex w-full flex-col items-center gap-1 sm:w-auto sm:items-end">
            {onLogValue && !disabled && (
              <button
                type="button"
                onClick={handleLog}
                disabled={saving || effective == null}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
              >
                {saving ? "Saving…" : isTodayDone ? "Update" : "Log"}
              </button>
            )}
            <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              {isTodayDone
                ? `Logged today: ${formatNumeric(savedToday ?? 0)}${habit.unit ? ` ${habit.unit}` : ""}`
                : "Not logged today"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
