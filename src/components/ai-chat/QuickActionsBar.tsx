import { Sparkles, BarChart3, Dumbbell, Apple, RefreshCw, TrendingDown } from "lucide-react";

const QUICK_ACTIONS = [
  { label: "Gen Program", icon: Sparkles, color: "var(--ai-violet)", prompt: "Generate a 4-week hypertrophy program" },
  { label: "Analyze", icon: BarChart3, color: "#00AEEF", prompt: "Analyze my client progress" },
  { label: "Check Form", icon: Dumbbell, color: "#22C55E", prompt: "Check form for deadlift" },
  { label: "Meal Plan", icon: Apple, color: "#F59E0B", prompt: "Create a meal plan" },
  { label: "Substitute", icon: RefreshCw, color: "#06B6D4", prompt: "Substitute squat for knee pain" },
  { label: "Deload", icon: TrendingDown, color: "#EF4444", prompt: "Recommend a deload week" },
] as const;

interface QuickActionsBarProps {
  onActionClick?: (prompt: string) => void;
}

export function QuickActionsBar({ onActionClick }: QuickActionsBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => onActionClick?.(action.prompt)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all hover:opacity-80"
            style={{
              borderColor: action.color + "40",
              backgroundColor: action.color + "10",
              color: action.color,
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

export default QuickActionsBar;
