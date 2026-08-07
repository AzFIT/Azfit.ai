import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Plus, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import { SETS_PRESETS, REPS_PRESETS, TEMPO_PRESETS } from "@/lib/presets";
import {
  summarizeVerdicts,
  VERDICT_META,
  type TrialVerdict,
} from "@/lib/trialIntake";
import ExercisePickerDialog from "@/components/exercise/ExercisePickerDialog";
import PresetInput from "@/components/ui/PresetInput";
import type { Database } from "@/types/supabase";

/* ═══════════════════════════════════════════════════════════════
   Phase 53 — Trial Assessments tab (ClientProfile).
   Trainer: list + structured editor (picker/custom items, verdicts).
   Client role: read-only view of their own assessments.
   ═══════════════════════════════════════════════════════════════ */

type AssessmentRow = Database["public"]["Tables"]["trial_assessments"]["Row"];
type ItemRow = Database["public"]["Tables"]["trial_assessment_items"]["Row"];

interface DraftItem {
  exercise_library_id: string | null;
  exercise_name: string;
  equipment: string;
  sets: string;
  reps: string;
  tempo: string;
  verdict: TrialVerdict | null;
  notes: string;
}

const EMPTY_DRAFT: DraftItem = {
  exercise_library_id: null,
  exercise_name: "",
  equipment: "",
  sets: "",
  reps: "",
  tempo: "",
  verdict: null,
  notes: "",
};

const VERDICTS: TrialVerdict[] = ["can_do", "needs_modification", "cannot_do"];

const inputCls =
  "w-full rounded-lg border px-2.5 py-1.5 text-xs bg-[var(--light-elevated)] border-[var(--card-border)] text-[var(--page-text)] focus:outline-none focus:border-[#00AEEF]";

function VerdictChips({ items }: { items: { verdict: string | null }[] }) {
  const s = summarizeVerdicts(items);
  if (s.total === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {VERDICTS.map((v) =>
        s[v] > 0 ? (
          <span
            key={v}
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: VERDICT_META[v].bg, color: VERDICT_META[v].color }}
          >
            {s[v]} {VERDICT_META[v].label}
          </span>
        ) : null,
      )}
      {s.unset > 0 && (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: "var(--light-elevated)", color: "var(--light-text-muted)" }}
        >
          {s.unset} unrated
        </span>
      )}
    </span>
  );
}

export default function AssessmentsTab({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const canEdit = user?.role === "trainer" || !!user?.isAdmin;

  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [itemsByAssessment, setItemsByAssessment] = useState<Map<string, ItemRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ── Editor state ── */
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState("Trial Assessment");
  const [assessedOn, setAssessedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [generalNotes, setGeneralNotes] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("trial_assessments")
      .select("*")
      .eq("client_record_id", clientId)
      .order("assessed_on", { ascending: false });
    const list = (rows as AssessmentRow[] | null) ?? [];
    setAssessments(list);
    if (list.length) {
      const { data: items } = await supabase
        .from("trial_assessment_items")
        .select("*")
        .in("assessment_id", list.map((a) => a.id))
        .order("order_index", { ascending: true });
      const map = new Map<string, ItemRow[]>();
      for (const it of (items as ItemRow[] | null) ?? []) {
        map.set(it.assessment_id, [...(map.get(it.assessment_id) ?? []), it]);
      }
      setItemsByAssessment(map);
    } else {
      setItemsByAssessment(new Map());
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetEditor = () => {
    setTitle("Trial Assessment");
    setAssessedOn(new Date().toISOString().slice(0, 10));
    setGeneralNotes("");
    setDrafts([]);
    setCustomName("");
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    setDrafts((d) => [...d, { ...EMPTY_DRAFT, exercise_name: name }]);
    setCustomName("");
  };

  const setDraft = <K extends keyof DraftItem>(idx: number, key: K, value: DraftItem[K]) =>
    setDrafts((d) => d.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));

  const saveError = useMemo(() => {
    if (!drafts.length) return "Add at least one exercise";
    if (drafts.some((d) => !d.exercise_name.trim())) return "Every item needs a name";
    return null;
  }, [drafts]);

  const handleSave = async () => {
    if (!user || saveError) return;
    setSaving(true);
    try {
      // Phase 35 flush pattern: parent row first, then items
      const { data: assessment, error: aErr } = await supabase
        .from("trial_assessments")
        .insert({
          client_record_id: clientId,
          trainer_id: user.id,
          title: title.trim() || "Trial Assessment",
          assessed_on: assessedOn,
          general_notes: generalNotes.trim() || null,
        })
        .select()
        .single();
      if (aErr || !assessment) throw aErr || new Error("Failed to save assessment");

      const { error: iErr } = await supabase.from("trial_assessment_items").insert(
        drafts.map((d, i) => ({
          assessment_id: assessment.id,
          exercise_library_id: d.exercise_library_id,
          exercise_name: d.exercise_name.trim(),
          equipment: d.equipment.trim() || null,
          sets: parseInt(d.sets, 10) || null,
          reps: d.reps.trim() || null,
          tempo: d.tempo.trim() || null,
          verdict: d.verdict,
          notes: d.notes.trim() || null,
          order_index: i,
        })),
      );
      if (iErr) throw iErr;

      toast.success("Assessment saved");
      resetEditor();
      setEditorOpen(false);
      await load();
    } catch (err) {
      toast.error("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════ RENDER ═══════════ */

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#00AEEF" }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
          Trial Assessments
        </h3>
        {canEdit && !editorOpen && (
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
          >
            <Plus size={13} /> New Trial Assessment
          </button>
        )}
      </div>

      {/* ── Editor ── */}
      <AnimatePresence>
        {editorOpen && canEdit && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                  Title
                </label>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                  Date
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={assessedOn}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setAssessedOn(e.target.value)}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {drafts.map((d, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-2.5"
                  style={{ backgroundColor: "var(--light-elevated)", borderColor: "var(--card-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={d.exercise_name}
                      onChange={(e) => setDraft(i, "exercise_name", e.target.value)}
                      placeholder="Exercise name"
                    />
                    <button
                      onClick={() => setDrafts((p) => p.filter((_, x) => x !== i))}
                      className="shrink-0 rounded-md p-1.5 hover:opacity-70"
                      style={{ color: "var(--light-text-muted)" }}
                      title="Remove item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className={`${inputCls} w-28`}
                      value={d.equipment}
                      onChange={(e) => setDraft(i, "equipment", e.target.value)}
                      placeholder="Equipment"
                    />
                    <PresetInput
                      type="number"
                      min={1}
                      max={20}
                      ariaLabel="Sets"
                      value={d.sets}
                      onChange={(v) => setDraft(i, "sets", v)}
                      presets={SETS_PRESETS}
                      placeholder="Sets"
                      className="w-16"
                    />
                    <PresetInput
                      ariaLabel="Reps"
                      value={d.reps}
                      onChange={(v) => setDraft(i, "reps", v)}
                      presets={REPS_PRESETS}
                      placeholder="Reps"
                      className="w-20"
                    />
                    <PresetInput
                      ariaLabel="Tempo"
                      value={d.tempo}
                      onChange={(v) => setDraft(i, "tempo", v)}
                      presets={TEMPO_PRESETS}
                      placeholder="Tempo"
                      className="w-20"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {VERDICTS.map((v) => {
                      const active = d.verdict === v;
                      const meta = VERDICT_META[v];
                      return (
                        <button
                          key={v}
                          onClick={() => setDraft(i, "verdict", active ? null : v)}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition"
                          style={{
                            borderColor: active ? meta.color : "var(--card-border)",
                            backgroundColor: active ? meta.bg : "transparent",
                            color: active ? meta.color : "var(--light-text-muted)",
                          }}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                    <input
                      className={`${inputCls} mt-1.5 w-full`}
                      value={d.notes}
                      onChange={(e) => setDraft(i, "notes", e.target.value)}
                      placeholder="Notes (optional)"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add item controls */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:opacity-80"
                style={{ borderColor: "#00AEEF", color: "#00AEEF" }}
              >
                <Plus size={13} /> From exercise library
              </button>
              <div className="flex min-w-[200px] flex-1 items-center gap-2">
                <input
                  className={inputCls}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                  placeholder="Custom exercise name…"
                />
                <button
                  onClick={addCustom}
                  disabled={!customName.trim()}
                  className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                >
                  Add custom
                </button>
              </div>
            </div>

            {/* General notes */}
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                General notes
              </label>
              <textarea
                rows={2}
                className={inputCls}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Overall impressions, movement quality, next steps…"
              />
            </div>

            {/* Editor actions */}
            <div className="mt-3 flex items-center justify-end gap-2">
              {saveError && (
                <span className="mr-auto text-[11px]" style={{ color: "#F59E0B" }}>
                  {saveError}
                </span>
              )}
              <button
                onClick={() => {
                  setEditorOpen(false);
                  resetEditor();
                }}
                className="rounded-lg px-3 py-2 text-xs font-medium"
                style={{ color: "var(--light-text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !!saveError}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                {saving ? "Saving…" : "Save Assessment"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── List ── */}
      {assessments.length === 0 && !editorOpen ? (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <ClipboardList className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--light-text-muted)" }} />
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            No trial assessments yet{canEdit ? " — record what this client can and can't do." : "."}
          </p>
        </div>
      ) : (
        assessments.map((a) => {
          const items = itemsByAssessment.get(a.id) ?? [];
          const expanded = expandedId === a.id;
          return (
            <div
              key={a.id}
              className="rounded-xl border"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <button
                onClick={() => setExpandedId(expanded ? null : a.id)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                    {a.title}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {formatDate(a.assessed_on + "T00:00:00")} • {items.length} item{items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <VerdictChips items={items} />
                  {expanded ? (
                    <ChevronUp size={14} style={{ color: "var(--light-text-muted)" }} />
                  ) : (
                    <ChevronDown size={14} style={{ color: "var(--light-text-muted)" }} />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: "var(--card-border)" }}>
                      {items.length === 0 ? (
                        <p className="py-2 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                          No items recorded.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {items.map((it) => (
                            <div
                              key={it.id}
                              className="rounded-lg px-2.5 py-2"
                              style={{ backgroundColor: "var(--light-elevated)" }}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium" style={{ color: "var(--page-text)" }}>
                                  {it.exercise_name}
                                </span>
                                {it.verdict && (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                    style={{
                                      backgroundColor: VERDICT_META[it.verdict].bg,
                                      color: VERDICT_META[it.verdict].color,
                                    }}
                                  >
                                    {VERDICT_META[it.verdict].label}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                                {[
                                  it.equipment,
                                  it.sets != null ? `${it.sets} sets` : null,
                                  it.reps ? `${it.reps} reps` : null,
                                  it.tempo ? `tempo ${it.tempo}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || "—"}
                              </p>
                              {it.notes && (
                                <p className="mt-0.5 text-[10px] italic" style={{ color: "var(--light-text-muted)" }}>
                                  {it.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {a.general_notes && (
                        <p className="mt-2 border-t pt-2 text-[11px]" style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}>
                          {a.general_notes}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}

      {/* Library picker (31B) — equipment auto-fills from the selected row */}
      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(ex) =>
          setDrafts((d) => [
            ...d,
            { ...EMPTY_DRAFT, exercise_library_id: ex.id, exercise_name: ex.name, equipment: ex.equipment },
          ])
        }
      />
    </div>
  );
}
