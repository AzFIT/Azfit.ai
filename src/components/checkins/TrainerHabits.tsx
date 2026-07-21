import { useState } from "react";
import { toast } from "sonner";
import { Footprints, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTrainerClients } from "@/hooks/useSupabaseData";
import { supabase } from "@/lib/supabase";
import { useHabits, last7Days, isDoneOnDate } from "./useHabits";
import HabitRow from "./HabitRow";

export default function TrainerHabits() {
  const { user } = useAuth();
  const { data: clients, loading: clientsLoading } = useTrainerClients();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [habitName, setHabitName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [saving, setSaving] = useState(false);

  const { habits, logs, loading, refresh } = useHabits({
    role: "trainer",
    clientId: selectedClientId || undefined,
  });

  const today = last7Days()[6];

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedClientId || !habitName.trim()) {
      toast.error("Select a client and enter a habit name");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("habits").insert({
      trainer_id: user.id,
      client_id: selectedClientId,
      name: habitName.trim(),
      target_frequency: frequency,
      active: true,
    });
    setSaving(false);

    if (error) {
      toast.error("Failed to assign habit: " + error.message);
      return;
    }

    toast.success("Habit assigned");
    setHabitName("");
    refresh();
  };

  const handleToggleActive = async (habitId: string, active: boolean) => {
    const { error } = await supabase
      .from("habits")
      .update({ active })
      .eq("id", habitId);

    if (error) {
      toast.error("Failed to update habit: " + error.message);
      return;
    }

    toast.success(active ? "Habit activated" : "Habit deactivated");
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* Assign form */}
      <form
        onSubmit={handleAssign}
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Footprints size={18} style={{ color: "var(--azfit-primary)" }} />
          <h3 className="font-semibold" style={{ color: "var(--page-text)" }}>
            Assign Habit
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Client
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
              disabled={clientsLoading}
            >
              <option value="">Select client</option>
              {(clients || []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Habit name
            </label>
            <input
              type="text"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              placeholder="e.g. 10k steps"
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !selectedClientId}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
        >
          <Plus size={16} />
          {saving ? "Assigning..." : "Assign Habit"}
        </button>
      </form>

      {/* Habits list */}
      {loading ? (
        <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--card-bg)" }} />
      ) : selectedClientId ? (
        habits.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No habits for this client yet.
          </p>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                logs={logs}
                isTodayDone={isDoneOnDate(logs, habit.id, today)}
                onToggle={() => { /* trainers don't log client habits here */ }}
                onToggleActive={(active) => handleToggleActive(habit.id, active)}
                disabled
              />
            ))}
          </div>
        )
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Select a client to view their habits.
        </p>
      )}
    </div>
  );
}
