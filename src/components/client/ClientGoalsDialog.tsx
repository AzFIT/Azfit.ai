import { useState } from "react";
import { Target, Trash2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  GOAL_TYPE_LABELS,
  goalLabel,
  type ClientGoalRow,
  type ClientGoalType,
} from "@/lib/clientGoals";
import { formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientGoalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string; // clients.id
  goals: ClientGoalRow[];
  onChanged: () => void;
}

const GOAL_TYPES = Object.keys(GOAL_TYPE_LABELS) as ClientGoalType[];

export default function ClientGoalsDialog({
  open,
  onOpenChange,
  clientId,
  goals,
  onChanged,
}: ClientGoalsDialogProps) {
  const [goalType, setGoalType] = useState<ClientGoalType>("lose_weight");
  const [customLabel, setCustomLabel] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetBf, setTargetBf] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const needsTarget = goalType === "lose_weight" || goalType === "reduce_body_fat";
  const addValid =
    (goalType !== "custom" || customLabel.trim() !== "") &&
    (!needsTarget || targetWeight.trim() !== "" || targetBf.trim() !== "");

  const handleAdd = async () => {
    if (!addValid || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_goals").insert({
        client_id: clientId,
        goal_type: goalType,
        custom_label: goalType === "custom" ? customLabel.trim() : null,
        target_weight_kg: targetWeight.trim() ? Number(targetWeight) : null,
        target_body_fat_pct: targetBf.trim() ? Number(targetBf) : null,
        start_date: startDate || today,
        target_date: targetDate || null,
      });
      if (error) throw error;
      toast.success("Goal added");
      setCustomLabel("");
      setTargetWeight("");
      setTargetBf("");
      setTargetDate("");
      onChanged();
    } catch (err) {
      toast.error("Failed to add goal: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (goal: ClientGoalRow) => {
    const { error } = await supabase
      .from("client_goals")
      .update({ is_achieved: !goal.is_achieved, updated_at: new Date().toISOString() })
      .eq("id", goal.id);
    if (error) {
      toast.error("Failed to update goal: " + error.message);
      return;
    }
    toast.success(goal.is_achieved ? "Goal reopened" : "Goal achieved 🎉");
    onChanged();
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    const { error } = await supabase.from("client_goals").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete goal: " + error.message);
      return;
    }
    toast.success("Goal deleted");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <Target className="h-5 w-5 text-[#00AEEF]" />
            Client Goals
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Existing goals */}
          {goals.length === 0 ? (
            <p className="py-2 text-center text-xs text-[#64748B]">
              No goals yet — add the first one below.
            </p>
          ) : (
            <div className="space-y-2">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                  style={{
                    borderColor: "#2A3447",
                    backgroundColor: goal.is_achieved ? "rgba(34,197,94,0.06)" : "#111827",
                    opacity: goal.is_achieved ? 0.75 : 1,
                  }}
                >
                  <button
                    onClick={() => handleToggle(goal)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition"
                    style={{
                      borderColor: goal.is_achieved ? "#22C55E" : "#2A3447",
                      backgroundColor: goal.is_achieved ? "#22C55E" : "transparent",
                    }}
                    title={goal.is_achieved ? "Mark not achieved" : "Mark achieved"}
                  >
                    {goal.is_achieved && <Check size={12} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{
                        color: "#F0F0F0",
                        textDecoration: goal.is_achieved ? "line-through" : "none",
                      }}
                    >
                      {goalLabel(goal)}
                    </p>
                    <p className="text-[10px] text-[#64748B]">
                      {[
                        goal.target_weight_kg != null && `Target ${goal.target_weight_kg} kg`,
                        goal.target_body_fat_pct != null && `Target ${goal.target_body_fat_pct}%`,
                        goal.target_date && `by ${formatDate(goal.target_date)}`,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "No target set"}
                    </p>
                  </div>
                  {confirmDeleteId === goal.id ? (
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold"
                      style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#EF4444" }}
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(goal.id)}
                      className="shrink-0 p-1.5 rounded-lg hover:opacity-80"
                      title="Delete goal"
                    >
                      <Trash2 size={13} style={{ color: "#EF4444" }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add goal form */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: "#2A3447" }}>
            <p className="text-xs font-semibold text-[#94A3B8]">Add goal</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs text-[#94A3B8]">Type</Label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as ClientGoalType)}
                  className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                >
                  {GOAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GOAL_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              {goalType === "custom" && (
                <div className="col-span-2">
                  <Label className="text-xs text-[#94A3B8]">Custom goal label</Label>
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Run a 10k"
                    className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs text-[#94A3B8]">
                  Target weight (kg){needsTarget ? " *" : ""}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder="optional"
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
              <div>
                <Label className="text-xs text-[#94A3B8]">
                  Target body fat (%){needsTarget ? " *" : ""}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={targetBf}
                  onChange={(e) => setTargetBf(e.target.value)}
                  placeholder="optional"
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
              <div>
                <Label className="text-xs text-[#94A3B8]">Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
              <div>
                <Label className="text-xs text-[#94A3B8]">Target date (optional)</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
            </div>
            {needsTarget && (
              <p className="text-[10px] text-[#64748B]">* at least one target required for this type</p>
            )}
            <Button
              onClick={handleAdd}
              disabled={!addValid || saving}
              className="w-full bg-[#00AEEF] text-white hover:bg-[#00AEEF]/90 disabled:opacity-50 gap-1.5"
            >
              <Plus size={14} />
              {saving ? "Saving…" : "Add goal"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2A3447] text-[#94A3B8]"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
