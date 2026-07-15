import { useState } from "react";
import { Dumbbell, Clock, FileText, Check } from "lucide-react";
import type { ProgramContent } from "../chat/types";

interface ProgramCardProps {
  content: ProgramContent;
  onApply?: () => void;
  onModify?: () => void;
  onExport?: () => void;
}

export function ProgramCard({ content, onApply, onModify, onExport }: ProgramCardProps) {
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" style={{ color: "#00AEEF" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Generated Program
            </span>
          </div>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            {content.periodization} • {content.weeks} weeks • {content.daysPerWeek} days/week
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onApply}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-white"
            style={{ backgroundColor: "#00AEEF" }}
          >
            <Check className="h-3 w-3" /> Apply
          </button>
          <button
            onClick={onModify}
            className="rounded-lg border px-2.5 py-1 text-[10px] font-medium"
            style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
          >
            Modify
          </button>
          <button
            onClick={onExport}
            className="rounded-lg border px-2.5 py-1 text-[10px] font-medium"
            style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
          >
            <FileText className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {content.days.map((day, i) => (
          <button
            key={day.dayNumber}
            onClick={() => setActiveDay(i)}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all"
            style={{
              backgroundColor: i === activeDay ? "#00AEEF" : "transparent",
              color: i === activeDay ? "#fff" : "var(--text-muted)",
              border: i === activeDay ? "none" : `1px solid var(--card-border)`,
            }}
          >
            Day {day.dayNumber}
          </button>
        ))}
      </div>

      {/* Exercise List */}
      <div className="space-y-2">
        {content.days[activeDay]?.exercises.map((ex, j) => (
          <div
            key={j}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {ex.name}
              </p>
              {ex.notes && (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {ex.notes}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1">
                <Dumbbell className="h-3 w-3" />
                {ex.sets}×{ex.reps}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                RPE {ex.rpe}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProgramCard;
