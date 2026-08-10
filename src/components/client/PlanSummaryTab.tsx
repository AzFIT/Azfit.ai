/* ═══════════════════════════════════════════════════════════════
   Plan Summary tab (Phase 61) — generate + view the client-facing
   Blueprint report. Trainer: form → generate → history. Client
   role: read-only view of their own summaries (RLS SELECT own).
   All math lives in src/lib/planBlueprint.ts.
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Plus,
  RefreshCw,
  Loader2,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import {
  computeBlueprint,
  ACTIVITY_PRESETS,
  DEFAULT_INPUTS,
  type BlueprintInputs,
  type BlueprintResult,
  type MacroGrams,
  type StyledMacros,
} from "@/lib/planBlueprint";
import type { Database } from "@/types/supabase";

type SummaryRow = Database["public"]["Tables"]["plan_summaries"]["Row"];

const inputCls =
  "w-full rounded-lg border px-2.5 py-1.5 text-xs bg-[var(--light-elevated)] border-[var(--card-border)] text-[var(--page-text)] focus:outline-none focus:border-[#00AEEF]";
const labelCls = "block text-[10px] font-medium mb-1 text-[var(--light-text-muted)]";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const a = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  return a > 0 && a < 120 ? a : null;
}

/* clients.fitness_goal stores legacy human labels in old rows ("Fat loss",
   "Build Muscle") — map every vocabulary onto the form's select keys. */
const GOAL_SELECT_MAP: Record<string, string> = {
  "fat loss": "lose_weight",
  "lose weight": "lose_weight",
  "reduce body fat": "reduce_body_fat",
  "build muscle": "build_muscle",
  strength: "increase_strength",
  endurance: "improve_fitness",
  "general fitness": "improve_fitness",
  "athletic performance": "improve_fitness",
};

function normalizeGoalForSelect(g: string | null | undefined): string {
  if (!g) return "lose_weight";
  if (["lose_weight", "reduce_body_fat", "build_muscle", "increase_strength", "improve_fitness"].includes(g)) return g;
  const k = g.trim().toLowerCase().replace(/[_-]/g, " ");
  return GOAL_SELECT_MAP[k] ?? "lose_weight";
}

export default function PlanSummaryTab({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const canEdit = user?.role === "trainer" || !!user?.isAdmin;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<BlueprintInputs | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => summaries.find((s) => s.id === activeId) ?? summaries[0] ?? null, [summaries, activeId]);
  const report = useMemo(() => (active ? (active.result as unknown as BlueprintResult) : null), [active]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: client }, { data: bc }, { data: trainerName }] = await Promise.all([
      supabase.from("plan_summaries").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("gender, date_of_birth, height_cm, weight_kg, fitness_goal, intake_profile, lifestyle_targets")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("body_composition")
        .select("weight_kg, body_fat_percentage, recorded_at")
        .eq("client_id", clientId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (async () => {
        const { data: c } = await supabase.from("clients").select("trainer_id").eq("id", clientId).maybeSingle();
        if (!c?.trainer_id) return { data: null };
        return supabase.rpc("get_trainer_display_name", { p_trainer_id: c.trainer_id });
      })(),
    ]);
    setSummaries((rows as SummaryRow[] | null) ?? []);
    if (rows && rows.length) setActiveId((rows as SummaryRow[])[0].id);

    // Prefill from whatever exists — honest blanks where nothing is known
    const profile = (client?.intake_profile as Record<string, unknown> | null) ?? {};
    const lifestyle = (client?.lifestyle_targets as Record<string, unknown> | null) ?? {};
    const latest = summariesOfLatest(bc);
    setPrefill({
      ...DEFAULT_INPUTS,
      gender: (client?.gender as BlueprintInputs["gender"]) ?? "female",
      age: ageFromDob(client?.date_of_birth ?? null) ?? DEFAULT_INPUTS.age,
      heightCm: client?.height_cm ?? DEFAULT_INPUTS.heightCm,
      weightKg: latest?.weightKg ?? client?.weight_kg ?? DEFAULT_INPUTS.weightKg,
      bodyFatPct: latest?.bodyFatPct ?? null,
      activityKey: (profile.activity_level as string) === "moderate" ? "moderate" : "office",
      trainerSessionsPerWeek: typeof profile.sessions_per_week === "number" ? profile.sessions_per_week : DEFAULT_INPUTS.trainerSessionsPerWeek,
      soloSessionsPerWeek: 1,
      stepTarget: typeof lifestyle.steps === "number" ? lifestyle.steps : DEFAULT_INPUTS.stepTarget,
      goalType: normalizeGoalForSelect(client?.fitness_goal),
      trainerName: typeof trainerName === "string" && trainerName ? trainerName : "Your Coach",
    });
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async (inputs: BlueprintInputs) => {
    if (!user) return;
    setSaving(true);
    try {
      const result = computeBlueprint(inputs);
      const { data, error } = await supabase
        .from("plan_summaries")
        .insert({
          client_id: clientId,
          trainer_id: user.id,
          inputs: inputs as unknown as Database["public"]["Tables"]["plan_summaries"]["Insert"]["inputs"],
          result: result as unknown as Database["public"]["Tables"]["plan_summaries"]["Insert"]["result"],
          recommended_style: result.recommended.key,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Plan Summary generated");
      setFormOpen(false);
      await load();
      if (data) setActiveId(data.id);
    } catch (err) {
      toast.error("Couldn't generate: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("plan_summaries").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete the summary");
      return;
    }
    toast.success("Summary deleted");
    await load();
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
          Plan Summary
        </h3>
        <div className="flex items-center gap-2">
          {report && (
            <button
              onClick={() => navigate(`/clients/${clientId}/plan-summary/print`)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:opacity-80"
              style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            >
              <Printer size={13} /> Print / PDF
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              {report ? <RefreshCw size={13} /> : <Plus size={13} />}
              {report ? "Regenerate" : "Generate Plan Summary"}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!report && !formOpen && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <FileText className="mx-auto mb-2 h-7 w-7" style={{ color: "var(--light-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            No Plan Summary yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs" style={{ color: "var(--light-text-muted)" }}>
            {canEdit
              ? "Generate a professional Blueprint from this client's stats — calorie targets, macro options, GBC training plan, roadmap — ready to walk through together at your first session."
              : "Your coach will share your Plan Summary here once it's generated."}
          </p>
        </div>
      )}

      {/* History strip */}
      {summaries.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {summaries.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${s.id === active?.id ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)]"}`}
            >
              {formatDate(s.created_at)}
            </button>
          ))}
        </div>
      )}

      {/* The report */}
      {report && active && (
        <BlueprintReportView
          report={report}
          createdAt={active.created_at}
          canEdit={canEdit}
          onDelete={() => remove(active.id)}
        />
      )}

      {/* Generate form */}
      <AnimatePresence>
        {formOpen && prefill && canEdit && (
          <BlueprintForm initial={report && active ? (active.inputs as unknown as BlueprintInputs) : prefill} saving={saving} onCancel={() => setFormOpen(false)} onGenerate={generate} />
        )}
      </AnimatePresence>
    </div>
  );
}

function summariesOfLatest(bc: { weight_kg: number | null; body_fat_percentage: number | null } | null): { weightKg: number | null; bodyFatPct: number | null } | null {
  if (!bc) return null;
  return { weightKg: bc.weight_kg, bodyFatPct: bc.body_fat_percentage };
}

/* ── Input form ──────────────────────────────────────────────── */

function BlueprintForm({
  initial,
  saving,
  onCancel,
  onGenerate,
}: {
  initial: BlueprintInputs;
  saving: boolean;
  onCancel: () => void;
  onGenerate: (inputs: BlueprintInputs) => void;
}) {
  const [d, setD] = useState<BlueprintInputs>(initial);
  const set = <K extends keyof BlueprintInputs>(k: K, v: BlueprintInputs[K]) => setD((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
  const valid = d.weightKg > 0 && d.heightCm > 0 && d.age > 0 && d.trainerName.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
          Blueprint inputs — prefilled from the client record
        </h4>
        <button onClick={onCancel} className="rounded p-1 hover:opacity-70" style={{ color: "var(--light-text-muted)" }}>
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Gender</label>
          <select className={inputCls} value={d.gender} onChange={(e) => set("gender", e.target.value as BlueprintInputs["gender"])}>
            {(["female", "male", "other"] as const).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Age</label>
          <input type="number" className={inputCls} value={d.age || ""} onChange={(e) => set("age", num(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Height (cm)</label>
          <input type="number" className={inputCls} value={d.heightCm || ""} onChange={(e) => set("heightCm", num(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Weight (kg)</label>
          <input type="number" step="0.1" className={inputCls} value={d.weightKg || ""} onChange={(e) => set("weightKg", num(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Body fat % (optional)</label>
          <input
            type="number"
            step="0.1"
            className={inputCls}
            value={d.bodyFatPct ?? ""}
            placeholder="—"
            onChange={(e) => set("bodyFatPct", e.target.value.trim() === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelCls}>Activity level</label>
          <select className={inputCls} value={d.activityKey} onChange={(e) => set("activityKey", e.target.value as BlueprintInputs["activityKey"])}>
            {Object.entries(ACTIVITY_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Trainer sessions / wk</label>
          <select className={inputCls} value={d.trainerSessionsPerWeek} onChange={(e) => set("trainerSessionsPerWeek", Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Solo sessions / wk</label>
          <select className={inputCls} value={d.soloSessionsPerWeek} onChange={(e) => set("soloSessionsPerWeek", Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Daily step target</label>
          <input type="number" step="500" className={inputCls} value={d.stepTarget || ""} onChange={(e) => set("stepTarget", num(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Goal</label>
          <select className={inputCls} value={d.goalType} onChange={(e) => set("goalType", e.target.value)}>
            <option value="lose_weight">Lose weight</option>
            <option value="reduce_body_fat">Reduce body fat</option>
            <option value="build_muscle">Build muscle</option>
            <option value="increase_strength">Increase strength</option>
            <option value="improve_fitness">Improve fitness</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Pace</label>
          <select className={inputCls} value={d.pace} onChange={(e) => set("pace", e.target.value as BlueprintInputs["pace"])}>
            <option value="conservative">Conservative (~15%)</option>
            <option value="standard">Standard (~20%)</option>
            <option value="aggressive">Aggressive (~25%)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Program length (weeks)</label>
          <select className={inputCls} value={d.programWeeks} onChange={(e) => set("programWeeks", Number(e.target.value))}>
            {[8, 10, 12, 14, 16, 20].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Mid-program diet break (weeks 11–12)</label>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => set("dietBreak", v)}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${d.dietBreak === v ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)]"}`}
              >
                {v ? "Include" : "Skip"}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Trainer name (report header)</label>
          <input className={inputCls} value={d.trainerName} onChange={(e) => set("trainerName", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Business name (optional)</label>
          <input className={inputCls} value={d.businessName ?? ""} onChange={(e) => set("businessName", e.target.value || undefined)} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-medium" style={{ color: "var(--light-text-muted)" }}>
          Cancel
        </button>
        <button
          onClick={() => onGenerate(d)}
          disabled={!valid || saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? "Generating…" : "Generate Blueprint"}
        </button>
      </div>
    </motion.div>
  );
}

/* ── Report renderer (app-themed) ────────────────────────────── */

function Section({ title, children, highlighted }: { title: string; children: React.ReactNode; highlighted?: boolean }) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: highlighted ? "#00AEEF" : "var(--card-border)",
        borderLeft: highlighted ? "3px solid #00AEEF" : undefined,
      }}
    >
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
        {title}
      </h4>
      {children}
    </section>
  );
}

const rowCls = "flex items-center justify-between border-b py-1.5 text-xs last:border-0";
const rowLabel = "text-[var(--light-text-muted)]";
const rowValue = "font-semibold text-[var(--page-text)]";

function BlueprintReportView({ report, createdAt, canEdit, onDelete }: { report: BlueprintResult; createdAt: string; canEdit: boolean; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const a = report.assessment;
  const n = (k: number) => k + (report.femaleReassurance ? 1 : 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--page-text)" }}>
            Your Plan Summary{report.header.businessName ? ` — ${report.header.businessName}` : ""}
          </p>
          <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            Prepared by {report.header.trainerName} · generated {formatDate(createdAt)} · reviewed together at your next session
          </p>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button onClick={onDelete} className="rounded-lg px-2 py-1 text-[10px] font-medium hover:opacity-70" style={{ color: "#EF4444" }}>
              Delete
            </button>
          )}
          <button onClick={() => setExpanded((e) => !e)} className="rounded-lg p-1 hover:opacity-70" style={{ color: "var(--light-text-muted)" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <Section title={`${n(1)} · Starting Assessment`}>
            <div className={rowCls}><span className={rowLabel}>Weight</span><span className={rowValue}>{a.weightKg} kg</span></div>
            <div className={rowCls}><span className={rowLabel}>Height</span><span className={rowValue}>{a.heightCm} cm</span></div>
            <div className={rowCls}><span className={rowLabel}>BMI</span><span className={rowValue}>{a.bmi}</span></div>
            <div className={rowCls}><span className={rowLabel}>Body fat</span><span className={rowValue}>{a.bodyFatPct != null ? `${a.bodyFatPct}%` : "—"}</span></div>
            <div className={rowCls}><span className={rowLabel}>Fat mass</span><span className={rowValue}>{a.fatMassKg != null ? `${a.fatMassKg} kg` : "—"}</span></div>
            <div className={rowCls}><span className={rowLabel}>Lean mass</span><span className={rowValue}>{a.leanMassKg != null ? `${a.leanMassKg} kg` : "—"}</span></div>
            <div className={rowCls}><span className={rowLabel}>BMR ({a.bmrMethod === "katch-mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"})</span><span className={rowValue}>{a.bmr.toLocaleString()} kcal</span></div>
            <div className={rowCls}><span className={rowLabel}>Maintenance calories</span><span className={rowValue}>{a.maintenance.toLocaleString()} kcal</span></div>
            <p className="mt-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
              Goal: {report.goal.statement}
            </p>
          </Section>

          {report.femaleReassurance && (
            <Section title="2 · A note before we start">
              <p className="text-xs leading-relaxed" style={{ color: "var(--page-text)" }}>
                You will NOT bulk up. Women carry roughly 1/10 to 1/20 of the testosterone men do, and in a calorie deficit there is simply no surplus to build size from. Lifting weights in a deficit makes you smaller and firmer — "toned" is just muscle plus less fat. The strength work in this plan is what keeps your shape while the fat comes off.
              </p>
            </Section>
          )}

          <Section title={`${n(2)} · Calorie Targets`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>Maintenance</p>
                <p className="stat-numeral text-xl" style={{ color: "var(--page-text)" }}>{report.calories.maintenance.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>kcal / day</p>
              </div>
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#00AEEF", backgroundColor: "var(--light-elevated)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "#00AEEF" }}>Your target</p>
                <p className="stat-numeral text-xl" style={{ color: "var(--page-text)" }}>{report.calories.target.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  {report.goal.isFatLoss
                    ? `${Math.round(report.calories.deficitPct * 100)}% deficit · ~${report.outcomes?.weeklyLossKg} kg/week`
                    : "at maintenance"}
                </p>
              </div>
            </div>
            {report.calories.clampedByFloor && (
              <p className="mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium" style={{ borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                Note: your target was raised to the safety floor (BMR × 1.05 / 1,200 kcal) — a deeper deficit would cost muscle.
              </p>
            )}
          </Section>

          <Section title={`${n(3)} · Macro Targets — All Options`}>
            <MacroTable
              title={`At your target (${report.calories.target.toLocaleString()} kcal)`}
              styles={report.macroStyles}
              gramsOf={(s) => s.atTarget}
              recommendedKey={report.recommended.key}
              floor={report.proteinFloor.grams}
              showFlags
            />
            <MacroTable
              title={`At maintenance (${report.calories.maintenance.toLocaleString()} kcal)`}
              styles={report.macroStyles}
              gramsOf={(s) => s.atMaintenance}
              recommendedKey={null}
              floor={null}
            />
            <p className="mt-2 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
              Protein floor: {report.proteinFloor.grams} g ({report.proteinFloor.basis}). Recommended:{" "}
              <strong style={{ color: "#00AEEF" }}>{report.recommended.name}</strong> — {report.recommended.reason}.
            </p>
          </Section>

          <Section title={`${n(4)} · Training Plan (GBC) · ${report.training.sessions.length} sessions + ${report.training.stepTarget.toLocaleString()} steps/day`}>
            {report.training.sessions.map((s, i) => (
              <div key={i} className="mb-3 rounded-lg border p-3 last:mb-0" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
                <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--page-text)" }}>{s.name}</p>
                {s.blocks.map((b) => (
                  <div key={b.label} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span style={{ color: "var(--page-text)" }}>
                      <span className="font-mono font-bold" style={{ color: "#00AEEF" }}>{b.label}</span> {b.exercises}
                    </span>
                    <span className="shrink-0 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                      {b.setsReps} · {b.tempo} · rest {b.rest}
                    </span>
                  </div>
                ))}
                {(s.finisher || s.rounds) && (
                  <p className="mt-1.5 text-[10px] font-medium" style={{ color: "#8B5CF6" }}>
                    {[s.rounds, s.finisher].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              {report.training.restRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Section>

          <Section title={`${n(5)} · Sample Day of Eating (${report.recommended.name})`}>
            {report.sampleDay.meals.map((m) => (
              <div key={m.name} className="mb-2 last:mb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>{m.name}</p>
                  <p className="shrink-0 text-[10px] tabular-nums" style={{ color: "var(--light-text-muted)" }}>
                    {m.macros.kcal} kcal · P{m.macros.p} C{m.macros.c} F{m.macros.f}
                  </p>
                </div>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>{m.items.join(" · ")}</p>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
              <span>Day total</span>
              <span className="tabular-nums">
                {report.sampleDay.totals.kcal} kcal · P{report.sampleDay.totals.p} C{report.sampleDay.totals.c} F{report.sampleDay.totals.f}
                {report.sampleDay.withinTolerance && <span style={{ color: "#22C55E" }}> · on target ±5%</span>}
              </span>
            </div>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              {report.foodRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Section>

          <Section title={`${n(6)} · Tracking & Accountability`}>
            {report.tracking.map((t) => (
              <div key={t.what} className={rowCls}>
                <span className={rowLabel}>{t.what}</span>
                <span className="text-right text-xs">
                  <span className="font-semibold" style={{ color: "var(--page-text)" }}>{t.frequency}</span>
                  <span className="block text-[10px]" style={{ color: "var(--light-text-muted)" }}>{t.note}</span>
                </span>
              </div>
            ))}
          </Section>

          <Section title={`${n(7)} · Program Roadmap (${report.goal.programWeeks} weeks)`}>
            {report.roadmap.map((p) => (
              <div key={p.weeks} className="mb-2 flex gap-3 last:mb-0">
                <span className="w-12 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold" style={{ backgroundColor: "var(--light-elevated)", color: "#00AEEF" }}>
                  Wk {p.weeks}
                </span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>{p.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>{p.note}</p>
                </div>
              </div>
            ))}
            {report.outcomes && (
              <p className="mt-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
                Realistic outcome: {report.outcomes.projectedFatLossKg} kg fat down ({report.outcomes.weeklyLossRange[0]}–{report.outcomes.weeklyLossRange[1]} kg/week) → ~{report.outcomes.endWeightKg} kg{report.outcomes.endBodyFatPct != null ? `, ~${report.outcomes.endBodyFatPct}% BF` : ""} at week {report.goal.programWeeks}.
              </p>
            )}
          </Section>

          <Section title={`${n(8)} · FAQ`}>
            {report.faq.map((f) => (
              <div key={f.q} className="mb-2 last:mb-0">
                <p className="text-xs font-semibold" style={{ color: "#00AEEF" }}>{f.q}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--page-text)" }}>{f.a}</p>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function MacroTable({
  title,
  styles,
  gramsOf,
  recommendedKey,
  floor,
  showFlags = false,
}: {
  title: string;
  styles: StyledMacros[];
  gramsOf: (s: StyledMacros) => MacroGrams & { belowFloor?: boolean; note?: string | null };
  recommendedKey: string | null;
  floor: number | null;
  showFlags?: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>{title}</p>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ backgroundColor: "var(--light-elevated)", color: "var(--light-text-muted)" }}>
              <th className="px-2 py-1.5 text-left font-medium">Style</th>
              <th className="px-2 py-1.5 text-right font-medium">P</th>
              <th className="px-2 py-1.5 text-right font-medium">C</th>
              <th className="px-2 py-1.5 text-right font-medium">F</th>
              <th className="px-2 py-1.5 text-left font-medium">Best for</th>
            </tr>
          </thead>
          <tbody>
            {styles.map((s) => {
              const g = gramsOf(s);
              const rec = s.key === recommendedKey;
              return (
                <tr key={s.key} style={{ borderTop: "1px solid var(--card-border)", backgroundColor: rec ? "var(--light-elevated)" : undefined }}>
                  <td className="px-2 py-1.5 font-semibold" style={{ color: rec ? "#00AEEF" : "var(--page-text)" }}>
                    {s.name}
                    {rec && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ backgroundColor: "rgba(0,174,239,0.12)", color: "#00AEEF" }}>rec</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: showFlags && g.belowFloor ? "#F59E0B" : "var(--page-text)" }}>
                    {g.proteinG} g{showFlags && g.belowFloor ? " ⚠" : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "var(--page-text)" }}>{g.carbsG} g</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "var(--page-text)" }}>{g.fatsG} g</td>
                  <td className="px-2 py-1.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{s.bestFor}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showFlags && floor != null && styles.some((s) => gramsOf(s).belowFloor) && (
        <p className="mt-1 text-[10px]" style={{ color: "#F59E0B" }}>
          ⚠ below your protein floor ({floor} g) — boost protein by trimming carbs.
        </p>
      )}
    </div>
  );
}
