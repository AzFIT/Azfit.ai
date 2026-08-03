import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router";
import {
  Dumbbell,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
  Pencil,
  Archive,
  ArchiveRestore,
  SquarePen,
  Printer,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { ClientGeneratedProgram } from "@/types/client";

interface ProgramsTabProps {
  programs: ClientGeneratedProgram[];
  onStartWorkout?: (workoutId: string, clientId: string) => void;
  onChanged?: () => void;
  clientId?: string; // clients.id — for the empty-state Build Program link
}

export default function ProgramsTab({ programs, onStartWorkout, onChanged, clientId }: ProgramsTabProps) {
  const navigate = useNavigate();
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [phaseEditId, setPhaseEditId] = useState<string | null>(null);
  const [phaseDraft, setPhaseDraft] = useState("");
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  // Phase 35 ITEM 3: inline prescription editing (writes future-session
  // targets on the exercises row; never touches workout_log_entries)
  const [rxEditId, setRxEditId] = useState<string | null>(null);
  const [rxDraft, setRxDraft] = useState<{ sets: string; reps: string; tempo: string }>({ sets: "", reps: "", tempo: "" });
  const [rxBusy, setRxBusy] = useState(false);

  const startRxEdit = (ex: { id?: string; sets: number; reps: string; tempo: string }) => {
    if (!ex.id) return;
    setRxEditId(ex.id);
    setRxDraft({ sets: String(ex.sets), reps: ex.reps, tempo: ex.tempo });
  };

  const savePrescription = async (ex: { id?: string; name: string; sets: number; reps: string; notesRaw?: string | null }) => {
    if (!ex.id || rxBusy) return;
    setRxBusy(true);
    try {
      const sets = Math.max(1, Math.min(20, parseInt(rxDraft.sets, 10) || ex.sets));
      const reps = rxDraft.reps.trim() || ex.reps;
      const tempo = rxDraft.tempo.trim();
      let notes: Record<string, unknown> = {};
      try {
        notes = ex.notesRaw ? (JSON.parse(ex.notesRaw) as Record<string, unknown>) : {};
      } catch {
        notes = {};
      }
      if (tempo) notes.tempo = tempo;
      const { error } = await supabase
        .from("exercises")
        .update({ sets, reps, notes: JSON.stringify(notes) })
        .eq("id", ex.id);
      if (error) throw error;
      toast.success(`Prescription updated for ${ex.name}`);
      setRxEditId(null);
      onChanged?.();
    } catch (err) {
      toast.error("Couldn't save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setRxBusy(false);
    }
  };
  // Optimistic display overrides (reverted on error)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [phaseOverrides, setPhaseOverrides] = useState<Record<string, string>>({});

  const visible = showArchived
    ? programs
    : programs.filter((p) => p.status !== "archived");

  const hasArchived = programs.some((p) => p.status === "archived");

  // Empty state: no ACTIVE programs (archived-only clients see it under the toggle)
  if (visible.length === 0) {
    return (
      <div className="space-y-3">
        {hasArchived && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition hover:opacity-80"
              style={{ color: "var(--azfit-primary)" }}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
          </div>
        )}
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-12"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <Dumbbell size={32} style={{ color: "var(--light-text-muted)" }} />
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--light-text-muted)" }}
          >
            No programs yet — build one tailored to this client.
          </p>
          {clientId && (
            <button
              onClick={() => navigate(`/ai-program-builder?clientId=${clientId}`)}
              className="mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--azfit-primary)" }}
            >
              <Plus size={14} />
              Build Program
            </button>
          )}
        </div>
      </div>
    );
  }

  const setBusy = (id: string, v: boolean) =>
    setBusyIds((prev) => ({ ...prev, [id]: v }));

  const handleRenameSave = async (program: ClientGeneratedProgram) => {
    const next = renameDraft.trim();
    if (!next || next === program.name) {
      setRenamingId(null);
      return;
    }
    if (busyIds[program.id]) return;
    setBusy(program.id, true);
    setNameOverrides((prev) => ({ ...prev, [program.id]: next }));
    setRenamingId(null);
    try {
      const { error } = await supabase
        .from("programs")
        .update({ name: next })
        .eq("id", program.id);
      if (error) throw error;
      toast.success("Program renamed");
      onChanged?.();
    } catch (err) {
      setNameOverrides((prev) => {
        const copy = { ...prev };
        delete copy[program.id];
        return copy;
      });
      toast.error("Failed to rename: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBusy(program.id, false);
    }
  };

  const handlePhaseSave = async (program: ClientGeneratedProgram) => {
    const next = phaseDraft.trim();
    const current = program.phases[0]?.name || "Program Phase";
    if (!next || next === current) {
      setPhaseEditId(null);
      return;
    }
    if (busyIds[program.id]) return;
    setBusy(program.id, true);
    setPhaseOverrides((prev) => ({ ...prev, [program.id]: next }));
    setPhaseEditId(null);
    try {
      const { error } = await supabase
        .from("programs")
        .update({ phase_name: next })
        .eq("id", program.id);
      if (error) throw error;
      toast.success("Phase name updated");
      onChanged?.();
    } catch (err) {
      setPhaseOverrides((prev) => {
        const copy = { ...prev };
        delete copy[program.id];
        return copy;
      });
      toast.error("Failed to update: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBusy(program.id, false);
    }
  };

  const handleSetStatus = async (program: ClientGeneratedProgram, status: "active" | "archived") => {
    if (busyIds[program.id]) return;
    setBusy(program.id, true);
    setConfirmArchiveId(null);
    try {
      const { error } = await supabase
        .from("programs")
        .update({ status })
        .eq("id", program.id);
      if (error) throw error;
      toast.success(status === "archived" ? "Program archived" : "Program restored");
      onChanged?.();
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBusy(program.id, false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Show archived toggle */}
      {hasArchived && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition hover:opacity-80"
            style={{ color: "var(--azfit-primary)" }}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
      )}

      {visible.map((program) => {
        const isArchived = program.status === "archived";
        const displayName = nameOverrides[program.id] ?? program.name;
        const displayPhase = phaseOverrides[program.id] ?? program.phases[0]?.name;
        return (
          <motion.div
            key={program.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              opacity: isArchived ? 0.65 : 1,
            }}
          >
            {/* Program Header */}
            <div className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                  style={{ backgroundColor: "rgba(13,148,136,0.15)" }}
                >
                  <Dumbbell size={20} style={{ color: "#0D9488" }} />
                </div>
                <div className="min-w-0 flex-1">
                  {renamingId === program.id ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSave(program);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => handleRenameSave(program)}
                      className="w-full rounded-lg border px-2 py-1 text-sm"
                      style={{
                        backgroundColor: "var(--light-elevated)",
                        borderColor: "var(--azfit-primary)",
                        color: "var(--page-text)",
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          setExpandedProgram(
                            expandedProgram === program.id ? null : program.id,
                          )
                        }
                        className="text-left"
                      >
                        <h3
                          className="text-sm font-semibold"
                          style={{ color: "var(--page-text)" }}
                        >
                          {displayName}
                        </h3>
                      </button>
                      {!isArchived && (
                        <button
                          onClick={() => {
                            setRenamingId(program.id);
                            setRenameDraft(displayName);
                          }}
                          className="p-1 rounded hover:opacity-80 shrink-0"
                          title="Rename program"
                        >
                          <Pencil size={11} style={{ color: "var(--light-text-muted)" }} />
                        </button>
                      )}
                    </div>
                  )}
                  <p
                    className="text-xs"
                    style={{ color: "var(--light-text-muted)" }}
                  >
                    {program.category} • {program.level} • {program.totalWeeks}{" "}
                    weeks
                    {program.createdAt && ` • Created ${formatDate(program.createdAt)}`}
                    {program.startDate &&
                      ` • ${formatDate(program.startDate)}${program.endDate ? ` → ${formatDate(program.endDate)}` : ""}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isArchived && (
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(148,163,184,0.15)",
                      color: "var(--light-text-muted)",
                    }}
                  >
                    Archived
                  </span>
                )}
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "rgba(13,148,136,0.1)",
                    color: "#0D9488",
                  }}
                >
                  {program.frequency}x/week
                </span>
                <button
                  onClick={() =>
                    setExpandedProgram(
                      expandedProgram === program.id ? null : program.id,
                    )
                  }
                  className="p-1 rounded hover:opacity-80"
                >
                  {expandedProgram === program.id ? (
                    <ChevronUp
                      size={16}
                      style={{ color: "var(--light-text-muted)" }}
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      style={{ color: "var(--light-text-muted)" }}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* Action row */}
            <div
              className="flex items-center gap-2 px-4 pb-3 border-b"
              style={{ borderColor: "var(--card-border)" }}
            >
              {isArchived ? (
                <button
                  onClick={() => handleSetStatus(program, "active")}
                  disabled={!!busyIds[program.id]}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "rgba(13,148,136,0.12)", color: "#0D9488" }}
                >
                  <ArchiveRestore size={12} />
                  Restore
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate(`/ai-program-builder?load=${program.id}`)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: "rgba(0,174,239,0.12)", color: "var(--azfit-primary)" }}
                  >
                    <SquarePen size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/print/program/${program.id}`)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}
                    title="Export PDF"
                  >
                    <Printer size={12} />
                    Export PDF
                  </button>
                  {confirmArchiveId === program.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                        Archive? Client won&apos;t see it.
                      </span>
                      <button
                        onClick={() => handleSetStatus(program, "archived")}
                        disabled={!!busyIds[program.id]}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: "var(--danger)" }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmArchiveId(null)}
                        className="rounded-lg px-2 py-1 text-[11px]"
                        style={{ color: "var(--light-text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmArchiveId(program.id)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90"
                      style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--danger)" }}
                    >
                      <Archive size={12} />
                      Archive
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
              {expandedProgram === program.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-4 space-y-3">
                    <p
                      className="text-xs"
                      style={{ color: "var(--light-text-secondary)" }}
                    >
                      {program.description}
                    </p>

                    {/* Progression rules (read-only, Phase 30D) */}
                    {program.progressionRules && program.progressionRules.length > 0 && (
                      <div
                        className="rounded-xl border px-3 py-2.5"
                        style={{
                          backgroundColor: "var(--light-elevated)",
                          borderColor: "var(--card-border)",
                        }}
                      >
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          Progression Rules
                        </span>
                        <ul className="mt-1.5 space-y-1">
                          {program.progressionRules.map((r, i) => (
                            <li key={i} className="text-xs">
                              <span className="font-medium" style={{ color: "var(--page-text)" }}>{r.label}</span>
                              <span style={{ color: "var(--light-text-secondary)" }}> — {r.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Phases */}
                    {program.phases.map((phase) => (
                      <div
                        key={phase.id}
                        className="rounded-xl border"
                        style={{
                          backgroundColor: "var(--light-elevated)",
                          borderColor: "var(--card-border)",
                        }}
                      >
                        <div className="w-full flex items-center justify-between p-3">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {phaseEditId === program.id ? (
                              <input
                                autoFocus
                                value={phaseDraft}
                                onChange={(e) => setPhaseDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handlePhaseSave(program);
                                  if (e.key === "Escape") setPhaseEditId(null);
                                }}
                                onBlur={() => handlePhaseSave(program)}
                                className="rounded-lg border px-2 py-0.5 text-xs"
                                style={{
                                  backgroundColor: "var(--card-bg)",
                                  borderColor: "var(--azfit-primary)",
                                  color: "var(--page-text)",
                                }}
                              />
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    setExpandedPhase(
                                      expandedPhase === phase.id ? null : phase.id,
                                    )
                                  }
                                  className="text-left"
                                >
                                  <span
                                    className="text-xs font-semibold"
                                    style={{ color: "var(--page-text)" }}
                                  >
                                    {displayPhase}
                                  </span>
                                </button>
                                {!isArchived && (
                                  <button
                                    onClick={() => {
                                      setPhaseEditId(program.id);
                                      setPhaseDraft(displayPhase || "");
                                    }}
                                    className="p-1 rounded hover:opacity-80 shrink-0"
                                    title="Edit phase name"
                                  >
                                    <Pencil size={10} style={{ color: "var(--light-text-muted)" }} />
                                  </button>
                                )}
                              </>
                            )}
                            <span
                              className="text-[10px] ml-1 shrink-0"
                              style={{ color: "var(--light-text-muted)" }}
                            >
                              {phase.durationWeeks} weeks
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setExpandedPhase(
                                expandedPhase === phase.id ? null : phase.id,
                              )
                            }
                            className="p-1 rounded hover:opacity-80"
                          >
                            {expandedPhase === phase.id ? (
                              <ChevronUp
                                size={14}
                                style={{ color: "var(--light-text-muted)" }}
                              />
                            ) : (
                              <ChevronDown
                                size={14}
                                style={{ color: "var(--light-text-muted)" }}
                              />
                            )}
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedPhase === phase.id && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2">
                                {phase.workouts.map((workout) => (
                                  <div
                                    key={workout.id}
                                    className="rounded-lg"
                                    style={{ backgroundColor: "var(--card-bg)" }}
                                  >
                                    <button
                                      onClick={() =>
                                        setExpandedWorkout(
                                          expandedWorkout === workout.id ? null : workout.id,
                                        )
                                      }
                                      className="w-full flex items-center justify-between p-2.5 text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                                          style={{
                                            backgroundColor:
                                              "rgba(13,148,136,0.15)",
                                            color: "#0D9488",
                                          }}
                                        >
                                          {workout.dayNumber}
                                        </span>
                                        <div>
                                          <p
                                            className="text-xs font-medium"
                                            style={{ color: "var(--page-text)" }}
                                          >
                                            {workout.name}
                                          </p>
                                          <p
                                            className="text-[10px]"
                                            style={{
                                              color: "var(--light-text-muted)",
                                            }}
                                          >
                                            Day {workout.dayNumber} •{" "}
                                            {workout.exercises.length} exercises
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="flex items-center gap-1 text-[10px]"
                                          style={{ color: "var(--light-text-muted)" }}
                                        >
                                          <Clock size={10} />
                                          {workout.estimatedMinutes}m
                                        </span>
                                        {expandedWorkout === workout.id ? (
                                          <ChevronUp size={14} style={{ color: "var(--light-text-muted)" }} />
                                        ) : (
                                          <ChevronDown size={14} style={{ color: "var(--light-text-muted)" }} />
                                        )}
                                      </div>
                                    </button>

                                    <AnimatePresence>
                                      {expandedWorkout === workout.id && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="px-3 pb-3 space-y-1">
                                            {workout.exercises.map((ex) => (
                                              rxEditId && rxEditId === ex.id ? (
                                                <div
                                                  key={ex.order + ex.name}
                                                  className="rounded-md px-2 py-2 space-y-2"
                                                  style={{ backgroundColor: "var(--light-elevated)", border: "1px solid var(--azfit-primary)" }}
                                                >
                                                  <p className="text-xs font-medium truncate" style={{ color: "var(--page-text)" }}>{ex.name}</p>
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>Sets</label>
                                                    <input
                                                      type="number"
                                                      min={1}
                                                      max={20}
                                                      value={rxDraft.sets}
                                                      onChange={(e) => setRxDraft((d) => ({ ...d, sets: e.target.value }))}
                                                      className="w-14 rounded-md border px-2 py-1 text-xs"
                                                      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                                                    />
                                                    <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>Reps</label>
                                                    <input
                                                      value={rxDraft.reps}
                                                      onChange={(e) => setRxDraft((d) => ({ ...d, reps: e.target.value }))}
                                                      placeholder="8-12"
                                                      className="w-16 rounded-md border px-2 py-1 text-xs"
                                                      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                                                    />
                                                    <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>Tempo</label>
                                                    <input
                                                      value={rxDraft.tempo}
                                                      onChange={(e) => setRxDraft((d) => ({ ...d, tempo: e.target.value }))}
                                                      placeholder="3-0-1-0"
                                                      className="w-20 rounded-md border px-2 py-1 text-xs"
                                                      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                                                    />
                                                    <button
                                                      onClick={() => savePrescription(ex)}
                                                      disabled={rxBusy}
                                                      className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                                      style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
                                                    >
                                                      {rxBusy ? "Saving…" : "Save"}
                                                    </button>
                                                    <button
                                                      onClick={() => setRxEditId(null)}
                                                      className="rounded-md px-2 py-1 text-[11px]"
                                                      style={{ color: "var(--light-text-muted)" }}
                                                    >
                                                      Cancel
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                              <div
                                                key={ex.order + ex.name}
                                                className="flex items-center justify-between rounded-md px-2 py-1.5"
                                                style={{ backgroundColor: "var(--light-elevated)" }}
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <span
                                                    className="text-[10px] font-bold font-mono shrink-0"
                                                    style={{ color: "#0D9488" }}
                                                  >
                                                    {ex.order}
                                                  </span>
                                                  <span
                                                    className="text-xs truncate"
                                                    style={{ color: "var(--page-text)" }}
                                                  >
                                                    {ex.name}
                                                  </span>
                                                  {(() => {
                                                    if (!ex.supersetGroup) return null;
                                                    const members = workout.exercises.filter(
                                                      (x) => x.supersetGroup === ex.supersetGroup
                                                    );
                                                    if (members.length < 2) return null;
                                                    return (
                                                      <span
                                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-bold shrink-0"
                                                        style={{ borderColor: "rgba(139, 92, 246, 0.5)", color: "#8B5CF6" }}
                                                      >
                                                        {members.map((x) => x.order).join(" ↔ ")}
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                  <span
                                                    className="text-[10px]"
                                                    style={{ color: "var(--light-text-muted)" }}
                                                  >
                                                    {ex.sets} × {ex.reps}
                                                    {ex.load ? ` @ ${ex.load}kg` : ""}
                                                  </span>
                                                  {ex.id && (
                                                    <button
                                                      onClick={() => startRxEdit(ex)}
                                                      className="p-0.5 rounded hover:opacity-80"
                                                      title="Edit prescription"
                                                    >
                                                      <Pencil size={10} style={{ color: "var(--azfit-primary)" }} />
                                                    </button>
                                                  )}
                                                </span>
                                              </div>
                                              )
                                            ))}

                                            {onStartWorkout && program.clientId && (
                                              <button
                                                onClick={() =>
                                                  onStartWorkout(workout.id, program.clientId!)
                                                }
                                                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white transition hover:opacity-90"
                                                style={{ backgroundColor: "var(--azfit-primary)" }}
                                              >
                                                <Play size={12} />
                                                Start Workout
                                              </button>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
