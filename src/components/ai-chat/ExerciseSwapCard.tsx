import { ArrowRight, Check } from "lucide-react";
import type { ExerciseSwapContent } from "../chat/types";

interface ExerciseSwapCardProps {
  content: ExerciseSwapContent;
  onApply?: () => void;
  onUndo?: () => void;
  onExplain?: () => void;
}

export function ExerciseSwapCard({ content, onApply, onUndo, onExplain }: ExerciseSwapCardProps) {
  return (
    <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Exercise Substitution</span>
      </div>

      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
        {/* Original */}
        <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
          <p className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Original</p>
          <p className="text-sm font-bold" style={{ color: "#EF4444" }}>{content.original.name}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{content.original.reason}</p>
        </div>

        {/* Arrow */}
        <ArrowRight className="h-5 w-5" style={{ color: "#00AEEF" }} />

        {/* Replacement */}
        <div className="rounded-lg border p-3" style={{ borderColor: "#00AEEF", backgroundColor: "rgba(0,174,239,0.05)" }}>
          <p className="text-[10px] uppercase" style={{ color: "#00AEEF" }}>Replacement</p>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{content.replacement.name}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {content.replacement.sets}×{content.replacement.reps} @ RPE {content.replacement.rpe}
          </p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="mt-3 rounded-lg border p-2.5 text-[11px]" style={{ borderColor: "var(--card-border)", backgroundColor: "rgba(0,174,239,0.05)" }}>
        <span className="font-medium" style={{ color: "#00AEEF" }}>Why: </span>
        <span style={{ color: "var(--text-muted)" }}>{content.replacement.reasoning}</span>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onApply}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: "#00AEEF" }}
        >
          <Check className="h-3 w-3" /> Apply Changes
        </button>
        <button
          onClick={onUndo}
          className="rounded-lg border px-3 py-1.5 text-[10px] font-medium"
          style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
        >
          Undo
        </button>
        <button
          onClick={onExplain}
          className="rounded-lg border px-3 py-1.5 text-[10px] font-medium"
          style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
        >
          Explain
        </button>
      </div>
    </div>
  );
}

export default ExerciseSwapCard;
