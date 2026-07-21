import { Check } from "lucide-react";
import type { Habit, HabitLog } from "./useHabits";
import { last7Days, isDoneOnDate, weeklyCompletion, currentStreak } from "./useHabits";

interface HabitRowProps {
  habit: Habit;
  logs: HabitLog[];
  isTodayDone: boolean;
  onToggle: (done: boolean) => void;
  onToggleActive?: (active: boolean) => void;
  disabled?: boolean;
}

export default function HabitRow({
  habit,
  logs,
  isTodayDone,
  onToggle,
  onToggleActive,
  disabled,
}: HabitRowProps) {
  const days = last7Days();
  const streak = currentStreak(logs, habit.id);
  const pct = weeklyCompletion(logs, habit.id);

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
            {habit.target_frequency} · {streak > 0 ? `${streak}-day streak` : "No streak"}
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

          <button
            onClick={() => onToggle(!isTodayDone)}
            disabled={disabled}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
              isTodayDone
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                : "border-slate-600 text-slate-400 hover:border-slate-400"
            } disabled:opacity-50`}
          >
            {isTodayDone && <Check size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
