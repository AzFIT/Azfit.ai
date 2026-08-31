import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Dumbbell,
  CalendarDays,
  Save,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import ExercisePickerDialog from "@/components/exercise/ExercisePickerDialog";
import PresetInput from "@/components/ui/PresetInput";
import {
  SETS_PRESETS,
  REPS_PRESETS,
  TEMPO_PRESETS,
} from "@/lib/presets";
import {
  GROUP_LETTERS,
  MAX_WEEKS,
  buildManualExerciseRows,
  buildManualProgramInsert,
  buildManualWorkoutRows,
  manualLabels,
  validateManualProgram,
  type ManualDay,
  type ManualExercise,
} from "@/lib/manualProgram";
import {
  parseMethodDefaults,
  deriveExerciseDefaults,
  INTENSITY_HEX,
  type MethodDefaults,
} from "@/lib/methodDefaults";

/* ═══════════════════════════════════════════════════════════════════
   Manual Program Builder (Phase 42) — lightweight, trainer-only.
   Persists programs/workouts/exercises in the EXACT aiProgramMapper
   shape so preview (36), PDF print (34), badges (30C) and the player
   (33C) work unchanged. Out of scope: generation, methods, phases,
   progression rules, drag-and-drop.
   ═══════════════════════════════════════════════════════════════════ */

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function newDay(name = ""): ManualDay {
  return { id: uid(), name, exercises: [] };
}

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function ManualProgramBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Phase 42 choice: clientId is REQUIRED (save-unassigned deferred —
  // the AI wizard already covers unassigned drafts; documented).
  const clientId = searchParams.get("clientId");

  const [clientName, setClientName] = useState<string>("");
  const [injuryTerms, setInjuryTerms] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<ManualDay[]>([newDay("Day 1")]);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  // Phase 48, Item 4: optional method with prescription defaults
  const [methodOptions, setMethodOptions] = useState<Array<{ slug: string; name: string; d: MethodDefaults }>>([]);
  const [methodSlug, setMethodSlug] = useState<string>("");
  const selectedMethod = methodOptions.find((m) => m.slug === methodSlug) ?? null;
  const exercisePrefill = selectedMethod ? deriveExerciseDefaults(selectedMethod.d) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("methods")
        .select("slug, name, defaults")
        .not("defaults", "is", null)
        .order("display_order");
      if (cancelled || !data) return;
      const out: Array<{ slug: string; name: string; d: MethodDefaults }> = [];
      for (const m of data) {
        const d = parseMethodDefaults(m.defaults);
        if (d) out.push({ slug: m.slug, name: m.name, d });
      }
      setMethodOptions(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("full_name, intake_profile")
        .eq("id", clientId)
        .maybeSingle();
      if (cancelled || !data) return;
      setClientName(data.full_name);
      const injuries = (data.intake_profile as { injuries?: string } | null)?.injuries;
      if (injuries) {
        setInjuryTerms(injuries.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const errors = useMemo(
    () => validateManualProgram({ name, description, weeks, days }),
    [name, description, weeks, days],
  );

  const updateDay = useCallback((dayId: string, patch: Partial<ManualDay>) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
  }, []);

  const updateExercise = useCallback(
    (dayId: string, exId: string, patch: Partial<ManualExercise>) => {
      setDays((prev) =>
        prev.map((d) =>
          d.id === dayId
            ? {
                ...d,
                exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)),
              }
            : d,
        ),
      );
    },
    [],
  );

  const moveExercise = useCallback((dayId: string, exId: string, dir: -1 | 1) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const idx = d.exercises.findIndex((e) => e.id === exId);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= d.exercises.length) return d;
        const exercises = [...d.exercises];
        [exercises[idx], exercises[to]] = [exercises[to], exercises[idx]];
        return { ...d, exercises };
      }),
    );
  }, []);

  const duplicateDay = useCallback((dayId: string) => {
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.id === dayId);
      if (idx < 0) return prev;
      const src = prev[idx];
      const copy: ManualDay = {
        id: uid(),
        name: `${src.name || `Day ${idx + 1}`} (copy)`,
        exercises: src.exercises.map((e) => ({ ...e, id: uid() })),
      };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }, []);

  const handlePick = useCallback(
    (picked: { name: string }) => {
      if (!pickerDayId) return;
      setDays((prev) =>
        prev.map((d) => {
          if (d.id !== pickerDayId) return d;
          const idx = d.exercises.length;
          // Phase 48: notation-driven group suggestion (superset → pairs,
          // triset → triples, straight → ungrouped)
          let group: string | null = null;
          if (selectedMethod) {
            if (selectedMethod.d.notation === "superset") {
              group = GROUP_LETTERS[Math.min(GROUP_LETTERS.length - 1, Math.floor(idx / 2))];
            } else if (selectedMethod.d.notation === "triset") {
              group = GROUP_LETTERS[Math.min(GROUP_LETTERS.length - 1, Math.floor(idx / 3))];
            }
          }
          const ex: ManualExercise = {
            id: uid(),
            name: picked.name,
            sets: String(exercisePrefill?.sets ?? 3),
            reps: exercisePrefill?.reps ?? "8-12",
            tempo: exercisePrefill?.tempo ?? "3-0-1-0",
            group,
          };
          return { ...d, exercises: [...d.exercises, ex] };
        }),
      );
    },
    [pickerDayId, selectedMethod, exercisePrefill],
  );

  const handleSave = useCallback(async () => {
    if (!user?.id || !clientId || saving) return;
    const draft = { name, description, weeks, days };
    const errs = validateManualProgram(draft);
    if (errs.length > 0) {
      setShowErrors(true);
      toast.error("Fix the highlighted issues before saving");
      return;
    }
    setSaving(true);
    try {
      const programRow = buildManualProgramInsert(draft, user.id, clientId, todayLocal(), methodSlug || undefined);
      const { data: program, error: pErr } = await supabase
        .from("programs")
        .insert(programRow)
        .select("id")
        .single();
      if (pErr) throw pErr;

      const workoutRows = buildManualWorkoutRows(days).map((w) => ({
        ...w,
        program_id: program.id,
      }));
      const { data: workouts, error: wErr } = await supabase
        .from("workouts")
        .insert(workoutRows)
        .select("id");
      if (wErr) throw wErr;

      // insert returns rows in insert order — map day i → workout i
      for (let i = 0; i < days.length; i++) {
        const rows = buildManualExerciseRows(days[i].exercises).map((r) => ({
          ...r,
          workout_id: workouts[i].id,
        }));
        if (rows.length === 0) continue;
        const { error: eErr } = await supabase.from("exercises").insert(rows);
        if (eErr) throw eErr;
      }

      toast.success(`Program "${programRow.name}" saved 💪`);
      navigate(`/client/${clientId}?tab=programs`);
    } catch (err) {
      toast.error("Couldn't save: " + (err instanceof Error ? err.message : "Unknown error"));
      setSaving(false);
    }
  }, [user?.id, clientId, saving, name, description, weeks, days, methodSlug, navigate]);

  const totalExercises = days.reduce((s, d) => s + d.exercises.length, 0);

  if (!clientId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="max-w-sm rounded-2xl border p-6 text-center"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <AlertTriangle className="mx-auto mb-2 h-6 w-6" style={{ color: "#F59E0B" }} />
          <p className="text-sm" style={{ color: "var(--page-text)" }}>
            The manual builder needs a client. Open it from a client&apos;s Programs tab
            via <strong>+ Add Program</strong>.
          </p>
        </div>
      </div>
    );
  }

  const inputCls = "rounded-lg border px-2.5 py-1.5 text-sm";
  const inputStyle = {
    backgroundColor: "var(--light-elevated)",
    borderColor: "var(--card-border)",
    color: "var(--page-text)",
  } as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-32">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(`/client/${clientId}?tab=programs`)}
          className="rounded-lg p-1.5 transition hover:opacity-80"
          title="Back to Programs"
        >
          <ArrowLeft size={18} style={{ color: "var(--page-text)" }} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--page-text)" }}>
            New Program{clientName ? ` — ${clientName}` : ""}
          </h1>
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            Manual builder — no AI, you choose every exercise.
          </p>
        </div>
      </div>

      {/* Details */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl border p-4"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays size={15} style={{ color: "var(--azfit-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Details
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              Program name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push/Pull/Legs — Build Muscle"
              className={`w-full ${inputCls}`}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              Weeks (1–{MAX_WEEKS})
            </label>
            <input
              type="number"
              min={1}
              max={MAX_WEEKS}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value) || 1)}
              className={`w-full ${inputCls}`}
              style={inputStyle}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
          <div>
            <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Goal, focus, notes for the client…"
              className={`w-full ${inputCls}`}
              style={inputStyle}
            />
          </div>
          {/* Phase 48, Item 4: optional method (only methods with defaults) */}
          <div>
            <label className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              Training method (optional — prefills new exercises)
            </label>
            <select
              value={methodSlug}
              onChange={(e) => {
                const next = e.target.value;
                if (
                  next !== methodSlug &&
                  methodSlug &&
                  days.some((d) => d.exercises.length > 0)
                ) {
                  const ok = window.confirm(
                    "Change method? Set/rep defaults reset for NEW exercises only — existing rows keep their values.",
                  );
                  if (!ok) return;
                }
                setMethodSlug(next);
              }}
              className={`w-full ${inputCls}`}
              style={inputStyle}
            >
              <option value="">None (free-form)</option>
              {methodOptions.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
            {selectedMethod && (
              <p className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: INTENSITY_HEX[selectedMethod.d.intensityColor] }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: INTENSITY_HEX[selectedMethod.d.intensityColor] }} />
                {selectedMethod.d.goalTag} · {selectedMethod.d.setsReps} · rest {selectedMethod.d.rest}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      {/* Days */}
      {days.map((day, dayIdx) => {
        const labels = manualLabels(day.exercises);
        return (
          <motion.section
            key={day.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Dumbbell size={15} style={{ color: "#8B5CF6" }} />
              <input
                value={day.name}
                onChange={(e) => updateDay(day.id, { name: e.target.value })}
                placeholder={`Day ${dayIdx + 1} — e.g. Push (Chest/Shoulders/Triceps)`}
                className={`flex-1 ${inputCls} font-semibold`}
                style={inputStyle}
              />
              <button
                onClick={() => duplicateDay(day.id)}
                className="rounded-lg p-1.5 transition hover:opacity-80"
                title="Duplicate day"
              >
                <Copy size={14} style={{ color: "var(--azfit-primary)" }} />
              </button>
              <button
                onClick={() => setDays((prev) => prev.filter((d) => d.id !== day.id))}
                className="rounded-lg p-1.5 transition hover:opacity-80"
                title="Delete day"
              >
                <Trash2 size={14} style={{ color: "var(--danger)" }} />
              </button>
            </div>

            <div className="space-y-1.5">
              {day.exercises.map((ex, exIdx) => (
                <div
                  key={ex.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl px-2 py-2"
                  style={{ backgroundColor: "var(--light-elevated)" }}
                >
                  <span
                    className="w-7 shrink-0 text-center text-[10px] font-bold font-mono"
                    style={{ color: "var(--azfit-primary)" }}
                  >
                    {labels[exIdx]}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-xs font-medium"
                    style={{ color: "var(--page-text)" }}
                    title={ex.name}
                  >
                    {ex.name}
                  </span>
                  <PresetInput
                    type="number"
                    min={1}
                    max={20}
                    ariaLabel="Sets"
                    value={ex.sets}
                    onChange={(v) => updateExercise(day.id, ex.id, { sets: v })}
                    presets={SETS_PRESETS}
                    className="w-14"
                  />
                  <PresetInput
                    ariaLabel="Reps"
                    value={ex.reps}
                    onChange={(v) => updateExercise(day.id, ex.id, { reps: v })}
                    presets={REPS_PRESETS}
                    placeholder="8-12"
                    className="w-20"
                  />
                  <PresetInput
                    ariaLabel="Tempo"
                    value={ex.tempo}
                    onChange={(v) => updateExercise(day.id, ex.id, { tempo: v })}
                    presets={TEMPO_PRESETS}
                    placeholder="3-0-1-0"
                    className="w-24"
                  />
                  <select
                    value={ex.group ?? ""}
                    onChange={(e) =>
                      updateExercise(day.id, ex.id, { group: e.target.value || null })
                    }
                    className="rounded-md border px-1.5 py-1 text-[11px]"
                    style={inputStyle}
                    title="Superset group (same letter = paired)"
                  >
                    <option value="">No pair</option>
                    {GROUP_LETTERS.map((g) => (
                      <option key={g} value={g}>
                        Group {g}
                      </option>
                    ))}
                  </select>
                  <span className="flex items-center shrink-0">
                    <button
                      onClick={() => moveExercise(day.id, ex.id, -1)}
                      disabled={exIdx === 0}
                      className="rounded p-1 transition hover:opacity-80 disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp size={13} style={{ color: "var(--light-text-muted)" }} />
                    </button>
                    <button
                      onClick={() => moveExercise(day.id, ex.id, 1)}
                      disabled={exIdx === day.exercises.length - 1}
                      className="rounded p-1 transition hover:opacity-80 disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown size={13} style={{ color: "var(--light-text-muted)" }} />
                    </button>
                    <button
                      onClick={() =>
                        updateDay(day.id, {
                          exercises: day.exercises.filter((e) => e.id !== ex.id),
                        })
                      }
                      className="rounded p-1 transition hover:opacity-80"
                      title="Remove exercise"
                    >
                      <Trash2 size={12} style={{ color: "var(--danger)" }} />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPickerDayId(day.id)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed py-2 text-xs font-medium transition-colors"
              style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
            >
              <Plus size={13} /> Add exercise
            </button>
          </motion.section>
        );
      })}

      <button
        onClick={() => setDays((prev) => [...prev, newDay(`Day ${prev.length + 1}`)])}
        className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed py-3 text-sm font-semibold transition-colors"
        style={{ borderColor: "var(--card-border)", color: "var(--azfit-primary)" }}
      >
        <Plus size={15} /> Add day
      </button>

      {/* Validation errors (live once save was attempted) */}
      {showErrors && errors.length > 0 && (
        <div
          className="mb-4 rounded-xl border px-3 py-2.5"
          style={{
            borderColor: "rgba(245,158,11,0.4)",
            backgroundColor: "rgba(245,158,11,0.10)",
          }}
        >
          {errors.map((e) => (
            <p key={e} className="text-[11px]" style={{ color: "#F59E0B" }}>
              ⚠ {e}
            </p>
          ))}
        </div>
      )}

      {/* Save bar */}
      <div
        className="sticky bottom-4 flex items-center justify-between rounded-2xl border px-4 py-3 shadow-xl"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <span className="text-xs" style={{ color: "var(--light-text-muted)" }}>
          {days.length} day{days.length !== 1 ? "s" : ""} · {totalExercises} exercise
          {totalExercises !== 1 ? "s" : ""} · {weeks} weeks
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save program"}
        </button>
      </div>

      <ExercisePickerDialog
        open={pickerDayId !== null}
        onOpenChange={(open) => !open && setPickerDayId(null)}
        onSelect={handlePick}
        limitations={injuryTerms}
      />
    </div>
  );
}
