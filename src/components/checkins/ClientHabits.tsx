import { Footprints } from "lucide-react";
import { useHabits, last7Days, isDoneOnDate } from "./useHabits";
import HabitRow from "./HabitRow";

export default function ClientHabits() {
  const { habits, logs, loading, toggleToday } = useHabits({ role: "client" });
  const today = last7Days()[6];

  if (loading) {
    return (
      <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--card-bg)" }} />
    );
  }

  if (habits.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <Footprints className="mx-auto mb-3 h-10 w-10" style={{ color: "var(--light-text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
          No habits assigned yet
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Your coach will add habits for you to track here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {habits.map((habit) => (
        <HabitRow
          key={habit.id}
          habit={habit}
          logs={logs}
          isTodayDone={isDoneOnDate(logs, habit.id, today)}
          onToggle={(done) => toggleToday(habit.id, done)}
        />
      ))}
    </div>
  );
}
