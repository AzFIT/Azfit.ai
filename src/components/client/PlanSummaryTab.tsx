/* ═══════════════════════════════════════════════════════════════
   Plan Summary tab (Phase 61) — generate + view the client-facing
   Blueprint report. Trainer: form → generate → history. Client
   role: read-only view of their own summaries (RLS SELECT own).
   All math lives in src/lib/planBlueprint.ts.
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Save,
  LoaderCircle,
  CircleAlert,
  RotateCcw,
  FileDown,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { invokePlanExport, PlanExportError } from "@/services/planExport";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draftStore";
import DraftBanner from "@/components/DraftBanner";
import {
  computeBlueprint,
  withCalorieTarget,
  ACTIVITY_PRESETS,
  DEFAULT_INPUTS,
  type BlueprintInputs,
  type BlueprintResult,
  type BlueprintExtras,
  type MacroGrams,
  type StyledMacros,
  type GbcSession,
} from "@/lib/planBlueprint";
import { buildVariedSessions, type TaxonomyExerciseLike } from "@/lib/blueprintTraining";
import { buildCardioPlan } from "@/lib/blueprintCardio";
import { buildWeeklyTargets } from "@/lib/blueprintWeeklyTargets";
import { buildNutritionGuide } from "@/lib/blueprintNutritionGuide";
import {
  buildWarmupProtocol,
  buildSampleDiet,
  hydrationMl,
  SUPPLEMENT_BLOCK,
  SUPPLEMENT_DISCLAIMER,
  MEDICAL_DISCLAIMER,
  type StapleFoodMacros,
} from "@/lib/planSummaryExtras";
import { blueprintFromRow, type BlueprintRow, type PlanBlueprintInput } from "@/lib/planBlueprintInput";
import { validateSession } from "@/lib/trainingEditor";
import { useExerciseTaxonomy } from "@/hooks/useExerciseTaxonomy";
import TrainingPlanEditor from "./TrainingPlanEditor";
import {
  isIncluded,
  includedCount,
  type SectionKey,
} from "@/lib/planSummaryOverrides";
import {
  resolvePlanSummary,
  displayTitle,
  type ResolvedSectionKey,
  type ResolvedSectionOf,
} from "@/lib/planSummaryRender";
import {
  buildDraft,
  overrideFromDraft,
  validateCardDraft,
  headerOverrideFromDraft,
  type CardDraft,
  type WeeklyTargetsDraft,
  type CardioDraft,
  type NutritionGuideDraft,
  type SampleDayDraft,
  type TrackingDraft,
  type FaqDraft,
  type RoadmapDraft,
  type WelcomeDraft,
  type AssessmentDraft,
  type CaloriesDraft,
  type MacrosDraft,
  type TrainingDraft,
  type CoachNotesDraft,
} from "@/lib/planSummaryCardDrafts";
import {
  WelcomeEditor,
  WeeklyTargetsEditor,
  CardioEditor,
  NutritionGuideEditor,
  SampleDayEditor,
  TrackingEditor,
  FaqEditor,
  RoadmapEditor,
  AssessmentEditor,
  CaloriesEditor,
  MacrosEditor,
  TrainingCardEditor,
  CoachNotesEditor,
} from "./PlanSummaryCardEditors";
import { effectiveHeader } from "@/lib/planSummaryOverrides";
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

/* Phase 80 Item 3: compute blueprint-driven report extras from the
   client's client_plan_blueprints row (null when no row exists →
   sections omitted entirely, never empty shells). The 61 engine
   stays pure — this merges at generation time with the report's
   REAL macro targets. Phase 99c: also returns the parsed blueprint
   input + library (with difficulty) so the variety engine and the
   cardio plan build from the same single fetch. */
async function computeExtrasForClient(
  clientId: string,
  weightKg: number,
  macroTargets: { kcal: number; proteinG: number; carbsG: number; fatsG: number },
): Promise<{ extras: BlueprintExtras | null; bp: PlanBlueprintInput | null; library: TaxonomyExerciseLike[] }> {
  const { data: row } = await supabase
    .from("client_plan_blueprints")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  const [libRes, foodsRes] = await Promise.all([
    supabase
      .from("exercise_library")
      .select("id, name, primary_muscle, secondary_muscle, equipment, exercise_type, difficulty")
      .eq("is_active", true),
    supabase
      .from("foods_cache")
      .select("name, category, calories, protein, carbs, fats")
      .eq("source", "seed-staples"),
  ]);
  const library = (libRes.data as TaxonomyExerciseLike[] | null) ?? [];
  if (!row) return { extras: null, bp: null, library };

  const bp = blueprintFromRow(row as unknown as BlueprintRow);
  const foods = (foodsRes.data as StapleFoodMacros[] | null) ?? [];

  const warmup = buildWarmupProtocol(bp.equipmentAccess, bp.injuriesNotes, library);
  const sampleDiet = buildSampleDiet(
    bp.dietPreferences.included,
    bp.dietPreferences.excluded,
    bp.dietaryRestriction,
    bp.dietPreferences.meals,
    macroTargets,
    foods,
  );
  const extras: BlueprintExtras = {
    warmup: warmup.steps.length > 0 ? warmup : undefined,
    sampleDiet: sampleDiet ?? undefined,
    supplements: {
      items: SUPPLEMENT_BLOCK,
      hydration: hydrationMl(weightKg),
      disclaimer: SUPPLEMENT_DISCLAIMER,
    },
  };
  return { extras, bp, library };
}

/* Phase 99c Item 5: welcoming cover message — warm, specific, and
   honest (no promised results, no fabricated numbers). */
function buildWelcome(firstName: string, trainerName: string, programWeeks: number, goalLabel: string): { title: string; message: string } {
  return {
    title: `Welcome aboard, ${firstName}!`,
    message: `This is your personal plan for the next ${programWeeks} weeks — built around your ${goalLabel} goal, your schedule, and the equipment you actually have. Everything in here is a starting point: we review it together, adjust as your body responds, and celebrate the wins along the way. Show up, log honestly, and ask me anything. — ${trainerName}`,
  };
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
  // Phase FIX-3 Item 4: when the Blueprint Inputs form opens (Generate /
  // "Regenerate anyway"), scroll it into view — it renders at the bottom
  // of a long page and looked like nothing happened.
  const formRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!formOpen) return;
    const t = window.setTimeout(() => {
      const el = formRef.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Browsers with OS-level animations disabled silently NO-OP smooth
      // scrolling (verified live in the owner's browser) — detect no
      // movement and fall back to an instant jump so the form is never
      // left 3000px below the fold.
      const before = window.scrollY;
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - before) < 2) el.scrollIntoView({ behavior: "auto", block: "start" });
      }, 150);
    }, 60);
    return () => window.clearTimeout(t);
  }, [formOpen]);

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
      let result = computeBlueprint(inputs);
      // Phase 99c Item 6: TDEE consistency — when the client has saved
      // intake targets (97b calculator), they drive EVERY number here.
      const [{ data: clientRow }, { data: goalRow }, { data: firstBc }, { data: latestBc }] = await Promise.all([
        supabase.from("clients").select("full_name, gender, intake_profile").eq("id", clientId).maybeSingle(),
        supabase
          .from("client_goals")
          .select("goal_type, custom_label, target_weight_kg, target_body_fat_pct, target_date, notes")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("body_composition")
          .select("weight_kg, body_fat_percentage, recorded_at")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("body_composition")
          .select("weight_kg, body_fat_percentage, recorded_at")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const savedT = (clientRow?.intake_profile as { computed_targets?: { calories?: number; protein?: number; carbs?: number; fats?: number } } | null)?.computed_targets;
      const savedKcal = savedT?.calories;
      if (typeof savedKcal === "number" && savedKcal > 0) {
        result = withCalorieTarget(result, {
          calories: savedKcal,
          protein: typeof savedT?.protein === "number" ? savedT.protein : null,
          carbs: typeof savedT?.carbs === "number" ? savedT.carbs : null,
          fats: typeof savedT?.fats === "number" ? savedT.fats : null,
        });
      }

      // Phase 80 + 99c: merge blueprint-driven extras when the client has a
      // client_plan_blueprints row (Phase 79). Older summaries without
      // extras render unchanged — the sections are simply omitted.
      const recStyle = result.macroStyles.find((s) => s.key === result.recommended.key) ?? result.macroStyles[0];
      const ctx = await computeExtrasForClient(clientId, inputs.weightKg, {
        kcal: result.calories.target,
        proteinG: recStyle.atTarget.proteinG,
        carbsG: recStyle.atTarget.carbsG,
        fatsG: recStyle.atTarget.fatsG,
      });
      if (ctx.extras) result = { ...result, extras: ctx.extras };

      // Phase 99c Item 1: taxonomy-driven training variety — replaces the
      // hardcoded GBC templates whenever the library is available; falls
      // back to them (varied:false, honest note) otherwise.
      const varied = buildVariedSessions(
        {
          trainerSessionsPerWeek: inputs.trainerSessionsPerWeek,
          soloSessionsPerWeek: inputs.soloSessionsPerWeek,
          equipmentAccess: ctx.bp?.equipmentAccess ?? null,
          injuriesNotes: ctx.bp?.injuriesNotes ?? "",
          isFatLoss: result.goal.isFatLoss,
        },
        ctx.library,
      );
      result = varied
        ? {
            ...result,
            training: { ...result.training, sessions: varied.sessions },
            trainingMeta: { varied: true, notes: varied.notes },
          }
        : {
            ...result,
            trainingMeta: { varied: false, notes: ["Exercise library unavailable at generation time — showing the standard GBC template. Regenerate to build varied sessions from your library."] },
          };

      // Phase 99c Item 2: cardio plan (machines gated by equipment access;
      // difficulty dial derived from weekly session count — coarse, documented).
      result = {
        ...result,
        cardio: buildCardioPlan({
          goalType: inputs.goalType,
          equipmentAccess: ctx.bp?.equipmentAccess ?? null,
          sessionsPerWeek: inputs.trainerSessionsPerWeek + inputs.soloSessionsPerWeek,
          stepTarget: inputs.stepTarget,
          experience: inputs.trainerSessionsPerWeek <= 1 ? "beginner" : "intermediate",
        }),
      };

      // Phase 99c Item 3: weekly targets from the FIRST recorded measurements.
      const firstPoint = firstBc
        ? { recordedAt: firstBc.recorded_at, weightKg: firstBc.weight_kg, bodyFatPct: firstBc.body_fat_percentage }
        : null;
      const latestPoint = latestBc
        ? { recordedAt: latestBc.recorded_at, weightKg: latestBc.weight_kg, bodyFatPct: latestBc.body_fat_percentage }
        : null;
      result = {
        ...result,
        weeklyTargets: buildWeeklyTargets({
          first: firstPoint,
          latest: latestPoint,
          goalRow: (goalRow as import("@/lib/blueprintWeeklyTargets").GoalRowLike | null) ?? null,
          weightKgNow: inputs.weightKg,
          programWeeks: inputs.programWeeks,
          isFatLoss: result.goal.isFatLoss,
          gender: inputs.gender,
        }),
      };

      // Phase 99c Item 4: goal-adaptive eating guide (low-calorie toolkit
      // for fat loss; "fuel the work" variant otherwise).
      const recG = result.macroStyles.find((s) => s.key === result.recommended.key) ?? result.macroStyles[0];
      result = {
        ...result,
        nutritionGuide: buildNutritionGuide({
          isFatLoss: result.goal.isFatLoss,
          targetKcal: result.calories.target,
          maintenanceKcal: result.calories.maintenance,
          clampedByFloor: result.calories.clampedByFloor,
          proteinG: recG.atTarget.proteinG,
          dietBreak: inputs.dietBreak,
        }),
      };

      // Phase 99c Item 5: welcoming cover.
      const firstName = (clientRow?.full_name ?? "").trim().split(/\s+/)[0] || "there";
      result = {
        ...result,
        welcome: buildWelcome(firstName, inputs.trainerName, inputs.programWeeks, result.weeklyTargets?.goal.label ?? "training"),
      };

      const finalResult = result;
      const { data, error } = await supabase
        .from("plan_summaries")
        .insert({
          client_id: clientId,
          trainer_id: user.id,
          inputs: inputs as unknown as Database["public"]["Tables"]["plan_summaries"]["Insert"]["inputs"],
          result: finalResult as unknown as Database["public"]["Tables"]["plan_summaries"]["Insert"]["result"],
          recommended_style: result.recommended.key,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Plan Summary generated");
      clearDraft(`plan-summary-${clientId}`); // Task 6: generated — draft done
      setFormOpen(false);
      await load();
      if (data) setActiveId(data.id);
    } catch (err) {
      toast.error("Couldn't generate: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  /* Phase 99c Item 6 write-back: push this report's computed targets
     into clients.intake_profile.computed_targets (the Nutrition tab's
     source), so both surfaces stay consistent. */
  const saveTargetsToIntake = async () => {
    if (!report) throw new Error("No active summary");
    const rec = report.macroStyles.find((s) => s.key === report.recommended.key) ?? report.macroStyles[0];
    const { data: crow, error: readErr } = await supabase.from("clients").select("intake_profile").eq("id", clientId).maybeSingle();
    if (readErr) throw readErr;
    const merged = {
      ...((crow?.intake_profile as Record<string, unknown> | null) ?? {}),
      computed_targets: {
        calories: report.calories.target,
        protein: rec.atTarget.proteinG,
        carbs: rec.atTarget.carbsG,
        fats: rec.atTarget.fatsG,
      },
    };
    const { error } = await supabase.from("clients").update({ intake_profile: merged as unknown as Database["public"]["Tables"]["clients"]["Update"]["intake_profile"] }).eq("id", clientId);
    if (error) throw error;
    // Reflect the new source of truth on the stored summary too.
    const next = { ...report, targetsSource: "saved" as const };
    await supabase
      .from("plan_summaries")
      .update({ result: next as unknown as Database["public"]["Tables"]["plan_summaries"]["Update"]["result"] })
      .eq("id", active!.id);
    await load();
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

  /* Phase 81 Item 2: persist an edited training module back to the
     SAME plan_summaries row (update only — same id, result jsonb
     replaced with the edited sessions merged in). */
  const saveTraining = useCallback(
    async (sessions: GbcSession[]) => {
      if (!active || !report) throw new Error("No active summary");
      const next = { ...report, training: { ...report.training, sessions } };
      const { error } = await supabase
        .from("plan_summaries")
        .update({ result: next as unknown as Database["public"]["Tables"]["plan_summaries"]["Update"]["result"] })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
      await load();
    },
    [active, report, load],
  );

  /* Phase 99d Items 1+2: persist a modified result JSONB (per-card
     overrides or include ticks) back to the SAME plan_summaries row —
     same pattern as saveTraining above. */
  const persistResult = useCallback(
    async (next: BlueprintResult, message: string) => {
      if (!active) throw new Error("No active summary");
      const { error } = await supabase
        .from("plan_summaries")
        .update({ result: next as unknown as Database["public"]["Tables"]["plan_summaries"]["Update"]["result"] })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
      toast.success(message);
      await load();
    },
    [active, load],
  );

  /* Phase 99d Item 1: Regenerate REPLACES the stored result with a fresh
     generation — all manual overrides are cleared (nothing carries over).
     The confirm dialog says exactly that. */
  const [confirmRegen, setConfirmRegen] = useState(false);

  /* Phase 99e Item 3: Export to Google Doc via the plan-export edge
     function. Progress state, honest not-configured 503 handling, and
     the KC-audit popup lesson: when window.open is blocked the URL is
     kept in an inline copyable banner instead of being lost. */
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const exportToDoc = async () => {
    if (!active || exporting) return;
    setExporting(true);
    setExportUrl(null);
    try {
      const { url } = await invokePlanExport(active.id);
      toast.success("Exported to Google Drive");
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        setExportUrl(url);
        toast.info("Popup blocked — open the document with the link below");
      }
    } catch (err) {
      if (err instanceof PlanExportError && (err.status === 503 || err.code === "not_configured")) {
        toast.error("Export needs the Google service account secret — ask your admin");
      } else if (err instanceof PlanExportError && err.status === 404) {
        toast.error("Couldn't export this summary — refresh and try again");
      } else {
        toast.error(err instanceof Error ? err.message : "Export failed — please try again");
      }
    } finally {
      setExporting(false);
    }
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
              <Printer size={13} /> Print / PDF · {includedCount(report)} sections
            </button>
          )}
          {report && canEdit && (
            <button
              type="button"
              onClick={() => void exportToDoc()}
              disabled={exporting}
              aria-label="Export to Google Doc"
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:opacity-80 disabled:opacity-60"
              style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            >
              {exporting ? <LoaderCircle size={13} className="animate-spin" /> : <FileDown size={13} />}
              {exporting ? "Exporting…" : "Export to Doc"}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => (report ? setConfirmRegen(true) : setFormOpen(true))}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              {report ? <RefreshCw size={13} /> : <Plus size={13} />}
              {report ? "Regenerate" : "Generate Plan Summary"}
            </button>
          )}
        </div>
      </div>

      {/* Phase 99e: popup-blocked fallback — the doc URL stays copyable. */}
      {exportUrl && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
        >
          <span>Your Google Doc is ready:</span>
          <a href={exportUrl} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--azfit-primary)" }}>
            Open document
          </a>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(exportUrl);
              toast.success("Link copied");
            }}
            className="rounded-md border px-2 py-1 text-[10px] font-semibold"
            style={{ borderColor: "var(--card-border)" }}
          >
            Copy link
          </button>
          <button
            type="button"
            aria-label="Dismiss export link"
            onClick={() => setExportUrl(null)}
            className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center"
            style={{ color: "var(--light-text-muted)" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          onSaveTraining={saveTraining}
          onSaveTargets={saveTargetsToIntake}
          onPersistResult={persistResult}
          onReload={load}
        />
      )}

      {/* Generate form */}
      <AnimatePresence>
        {formOpen && prefill && canEdit && (
          <div ref={formRef}>
            <BlueprintForm draftKey={`plan-summary-${clientId}`} initial={report && active ? (active.inputs as unknown as BlueprintInputs) : prefill} saving={saving} onCancel={() => setFormOpen(false)} onGenerate={generate} />
          </div>
        )}
      </AnimatePresence>

      {/* Phase 99d Item 1: regenerate clears ALL manual overrides —
          confirm says exactly that before proceeding. */}
      {confirmRegen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-2xl">
            <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
              Regenerate the Plan Summary?
            </p>
            <p className="mt-1.5 text-xs" style={{ color: "var(--light-text-muted)" }}>
              Regenerate replaces generated content — your manual edits will be cleared.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmRegen(false)}
                className="min-h-[44px] flex-1 rounded-lg border border-[var(--card-border)] text-xs font-semibold text-[var(--page-text)] transition hover:opacity-70"
              >
                Keep edits
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmRegen(false);
                  setFormOpen(true);
                }}
                className="min-h-[44px] flex-1 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                Regenerate anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function summariesOfLatest(bc: { weight_kg: number | null; body_fat_percentage: number | null } | null): { weightKg: number | null; bodyFatPct: number | null } | null {
  if (!bc) return null;
  return { weightKg: bc.weight_kg, bodyFatPct: bc.body_fat_percentage };
}

/* ── Input form ──────────────────────────────────────────────── */

function BlueprintForm({
  draftKey,
  initial,
  saving,
  onCancel,
  onGenerate,
}: {
  draftKey: string;
  initial: BlueprintInputs;
  saving: boolean;
  onCancel: () => void;
  onGenerate: (inputs: BlueprintInputs) => void;
}) {
  const [d, setD] = useState<BlueprintInputs>(initial);
  const set = <K extends keyof BlueprintInputs>(k: K, v: BlueprintInputs[K]) => setD((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
  const valid = d.weightKg > 0 && d.heightCm > 0 && d.age > 0 && d.trainerName.trim().length > 0;

  // Task 6: draft autosave for the blueprint inputs (form remounts per open,
  // so the lazy read + effect guard covers the whole lifecycle)
  const [draftInfo, setDraftInfo] = useState(() => loadDraft<BlueprintInputs>(draftKey));
  useEffect(() => {
    if (JSON.stringify(d) === JSON.stringify(initial)) return;
    saveDraft(draftKey, d);
  }, [draftKey, d, initial]);

  const resumeDraft = () => {
    const draft = loadDraft<BlueprintInputs>(draftKey);
    if (draft) setD(draft.data);
    setDraftInfo(null);
  };
  const discardDraft = () => {
    clearDraft(draftKey);
    setDraftInfo(null);
  };

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
      {draftInfo && (
        <div className="mb-3">
          <DraftBanner savedAt={draftInfo.savedAt} onResume={resumeDraft} onDiscard={discardDraft} />
        </div>
      )}
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

function Section({ title, children, highlighted, actions }: { title: string; children: React.ReactNode; highlighted?: boolean; actions?: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: highlighted ? "#00AEEF" : "var(--card-border)",
        borderLeft: highlighted ? "3px solid #00AEEF" : undefined,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
          {title}
        </h4>
        {actions}
      </div>
      {children}
    </section>
  );
}

const rowCls = "flex items-center justify-between border-b py-1.5 text-xs last:border-0";
const rowLabel = "text-[var(--light-text-muted)]";
const rowValue = "font-semibold text-[var(--page-text)]";

export function BlueprintReportView({ report, createdAt, canEdit, onDelete, onSaveTraining, onSaveTargets, onPersistResult, onReload }: { report: BlueprintResult; createdAt: string; canEdit: boolean; onDelete: () => void; onSaveTraining: (sessions: GbcSession[]) => Promise<void>; onSaveTargets: () => Promise<void>; onPersistResult: (next: BlueprintResult, message: string) => Promise<void>; onReload: () => Promise<void> }) {
  const [expanded, setExpanded] = useState(true);
  // Phase 81 Item 2: trainer-only training-module edit mode
  const [editMode, setEditMode] = useState(false);
  const [draftSessions, setDraftSessions] = useState<GbcSession[] | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingTargets, setSavingTargets] = useState(false);
  // Phase 99d Item 1: per-card inline editing via result.overrides
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const { rows: taxonomyRows } = useExerciseTaxonomy();
  // Phase 99e: ALL section resolution (presence, include ticks, order,
  // numbering, titles, effective override-merged data) comes from the
  // SHARED resolver — the same output the print view and the plan-export
  // edge function consume. A section absent from the resolver map is not
  // rendered (include ticks + presence rules live in the resolver).
  const byKey = new Map(
    resolvePlanSummary(report).map((s) => [s.key, s] as const),
  );
  function sectionOf<K extends ResolvedSectionKey>(k: K): ResolvedSectionOf<K> | undefined {
    return byKey.get(k) as ResolvedSectionOf<K> | undefined;
  }
  const secTitle = (k: ResolvedSectionKey, t: string) => {
    const s = byKey.get(k);
    return s && s.number > 0 ? displayTitle(s) : t;
  };
  const welcome = sectionOf("welcome")?.data;
  const weeklyTargets = sectionOf("weeklyTargets")?.data;
  const cardio = sectionOf("cardio")?.data;
  const nutritionGuide = sectionOf("nutritionGuide")?.data;
  const sampleDay = sectionOf("sampleDay")?.data;
  const warmup = sectionOf("warmup")?.data;
  const sampleDiet = sectionOf("sampleDiet")?.data;
  const supplements = sectionOf("supplements")?.data;
  const tracking = sectionOf("tracking")?.data.rows;
  const roadmap = sectionOf("roadmap")?.data.phases;
  const faq = sectionOf("faq")?.data.items;
  const femaleNoteText = sectionOf("femaleNote")?.data.text;
  // Phase 99g: the core cards render their EFFECTIVE (override-merged)
  // resolved data — the same values print + export consume.
  const assessment = sectionOf("assessment")?.data;
  const calories = sectionOf("calories")?.data;
  const macros = sectionOf("macros")?.data;
  const training = sectionOf("training")?.data;
  const coachNotes = sectionOf("coachNotes")?.data;
  const header = effectiveHeader(report);

  /* Phase 99d Item 2: optimistic include-tick state. Without this, the
     controlled checkbox snaps back to its old `checked` prop the moment
     load()'s setLoading(true) re-renders mid-save — the toggle looks
     dead to the trainer (and to Playwright). pendingInclude holds the
     intended value until the refreshed report lands. */
  const [pendingInclude, setPendingInclude] = useState<Partial<Record<SectionKey, boolean>>>({});
  const isInc = (key: SectionKey) => pendingInclude[key] ?? isIncluded(report.included, key);

  const toggleIncluded = async (key: SectionKey) => {
    const currently = isIncluded(report.included, key);
    if (currently && includedCount(report) <= 1) {
      toast.error("At least one section must stay included");
      return;
    }
    setPendingInclude((p) => ({ ...p, [key]: !currently }));
    try {
      await onPersistResult({ ...report, included: { ...report.included, [key]: !currently } }, currently ? "Section excluded from the summary" : "Section included in the summary");
    } catch (err) {
      toast.error("Couldn't update the include tick: " + (err instanceof Error ? err.message : "unknown error"));
      await onReload();
    } finally {
      setPendingInclude((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  /* Phase 99g: a card "has edits" when its override exists — plus the
     welcome card (override OR a header-name override) and Coach's
     Notes (any saved text — it's a top-level field, not an override). */
  const hasCardEdits = (key: SectionKey) => {
    if (key === "welcome") {
      return !!(
        report.overrides?.welcome ||
        report.headerOverride?.trainerName !== undefined ||
        report.headerOverride?.businessName !== undefined
      );
    }
    if (key === "coachNotes") return coachNotes != null;
    return !!(report.overrides as Record<string, unknown> | undefined)?.[key];
  };

  const resetCard = async (key: SectionKey, cardTitle: string) => {
    try {
      if (key === "coachNotes") {
        // Coach's Notes is a top-level result field — reset clears it.
        await onPersistResult({ ...report, coachNotes: null }, `${cardTitle} removed`);
        return;
      }
      const overrides: Record<string, unknown> = { ...(report.overrides as Record<string, unknown> | undefined) };
      delete overrides[key];
      const next: BlueprintResult = { ...report, overrides: overrides as BlueprintResult["overrides"] };
      // Resetting the welcome card also clears the header override.
      if (key === "welcome") next.headerOverride = undefined;
      await onPersistResult(next, `${cardTitle} reset to the generated version`);
    } catch (err) {
      toast.error("Couldn't reset the card: " + (err instanceof Error ? err.message : "unknown error"));
      await onReload();
    }
  };

  const saveCard = async (key: SectionKey) => {
    // FIX-2: these guards were silent no-ops — a click on Save changes with
    // no effect and no explanation reads as a broken app. They should never
    // fire in practice, but if they ever do the trainer gets told.
    if (!draft) {
      toast.error("This card isn't open for editing — reopen it and try again");
      return;
    }
    // Phase 99g: validated cards reject out-of-range values with an honest
    // message — never clamp silently.
    const invalid = validateCardDraft(key, draft);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setEditingSaving(true);
    try {
      if (key === "coachNotes") {
        // Coach's Notes lives at the TOP level of result, not in overrides.
        const text = (draft as CoachNotesDraft).text.trim();
        await onPersistResult({ ...report, coachNotes: text ? text : null }, text ? "Coach's Notes saved" : "Coach's Notes removed");
      } else if (key === "welcome") {
        const override = overrideFromDraft(key, draft);
        await onPersistResult(
          { ...report, overrides: { ...report.overrides, [key]: override }, headerOverride: headerOverrideFromDraft(draft as WelcomeDraft, report) },
          "Card saved",
        );
      } else {
        const override = overrideFromDraft(key, draft);
        if (override === undefined) {
          toast.error("This card can't be edited — nothing was saved");
          return;
        }
        await onPersistResult({ ...report, overrides: { ...report.overrides, [key]: override } }, "Card saved");
      }
      setEditing(null);
      setDraft(null);
    } catch (err) {
      toast.error("Couldn't save the edit: " + (err instanceof Error ? err.message : "unknown error"));
      await onReload();
    } finally {
      setEditingSaving(false);
    }
  };

  /* Phase 99d Item 2: per-card header actions (trainer-only) — Edited
     marker + reset, pencil for editable cards, include tick. */
  const cardActions = (key: SectionKey, cardTitle: string, opts?: { editable?: boolean }) =>
    canEdit ? (
      <div className="flex items-center gap-1.5">
        {hasCardEdits(key) && (
          <>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: "rgba(0,174,239,0.12)", color: "#00AEEF" }}>
              Edited
            </span>
            <button
              type="button"
              aria-label={`Reset ${cardTitle} to generated`}
              onClick={() => void resetCard(key, cardTitle)}
              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 text-[10px] font-semibold text-[var(--page-text)] transition hover:opacity-70"
            >
              <RotateCcw size={11} style={{ color: "var(--azfit-primary)" }} />
              Reset
            </button>
          </>
        )}
        {opts?.editable && editing !== key && (
          <button
            type="button"
            aria-label={`Edit ${cardTitle}`}
            onClick={() => {
              const d = buildDraft(key, report);
              if (d) {
                setDraft(d);
                setEditing(key);
              }
            }}
            className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 text-[10px] font-semibold text-[var(--page-text)] transition hover:border-[var(--azfit-primary)]/50"
          >
            <Pencil size={11} style={{ color: "var(--azfit-primary)" }} />
            Edit
          </button>
        )}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-[var(--light-text-muted)]" aria-label={`Include ${cardTitle} in summary`}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#00AEEF]"
            checked={isInc(key)}
            onChange={() => void toggleIncluded(key)}
          />
          Include
        </label>
      </div>
    ) : undefined;

  /* Phase 99d Item 1: Save / Discard shell around an open card editor. */
  const editorShell = (key: SectionKey, children: React.ReactNode) => (
    <>
      {children}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={editingSaving}
          onClick={() => void saveCard(key)}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))" }}
        >
          {editingSaving && <Loader2 size={12} className="animate-spin" />}
          Save changes
        </button>
        <button
          type="button"
          disabled={editingSaving}
          onClick={() => {
            setEditing(null);
            setDraft(null);
          }}
          className="min-h-[44px] rounded-lg border border-[var(--card-border)] px-4 text-xs font-semibold text-[var(--page-text)] disabled:opacity-40"
        >
          Discard
        </button>
      </div>
    </>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--page-text)" }}>
            Your Plan Summary{header.businessName ? ` — ${header.businessName}` : ""}
          </p>
          <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            Prepared by {header.trainerName} · generated {formatDate(createdAt)} · reviewed together at your next session
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
          {/* Phase 99c Item 5: welcoming cover — first card, unnumbered.
              Phase 99d: editable via overrides + include tick. */}
          {welcome && isIncluded(report.included, "welcome") && (
            <section
              className="rounded-xl border p-5 text-center"
              style={{
                background: "linear-gradient(135deg, rgba(0,174,239,0.10), rgba(139,92,246,0.10))",
                borderColor: "var(--card-border)",
              }}
            >
              {canEdit && (
                <div className="mb-1 flex items-center justify-end gap-1.5">
                  {hasCardEdits("welcome") && (
                    <>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: "rgba(0,174,239,0.12)", color: "#00AEEF" }}>
                        Edited
                      </span>
                      <button
                        type="button"
                        aria-label="Reset Welcome to generated"
                        onClick={() => void resetCard("welcome", "Welcome")}
                        className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 text-[10px] font-semibold text-[var(--page-text)] transition hover:opacity-70"
                      >
                        <RotateCcw size={11} style={{ color: "var(--azfit-primary)" }} />
                        Reset
                      </button>
                    </>
                  )}
                  {editing !== "welcome" && (
                    <button
                      type="button"
                      aria-label="Edit Welcome"
                      onClick={() => {
                        const d = buildDraft("welcome", report);
                        if (d) {
                          setDraft(d);
                          setEditing("welcome");
                        }
                      }}
                      className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 text-[10px] font-semibold text-[var(--page-text)] transition hover:border-[var(--azfit-primary)]/50"
                    >
                      <Pencil size={11} style={{ color: "var(--azfit-primary)" }} />
                      Edit
                    </button>
                  )}
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-[var(--light-text-muted)]" aria-label="Include Welcome in summary">
                    <input type="checkbox" className="h-4 w-4 accent-[#00AEEF]" checked={isInc("welcome")} onChange={() => void toggleIncluded("welcome")} />
                    Include
                  </label>
                </div>
              )}
              {editing === "welcome" && draft ? (
                editorShell("welcome", <WelcomeEditor value={draft as WelcomeDraft} onChange={setDraft} />)
              ) : (
                <>
                  <img src={`${import.meta.env.BASE_URL}azfit-logo-header.png`} alt="AzFIT" className="mx-auto mb-2 h-10 object-contain" />
                  <h4 className="text-base font-bold" style={{ color: "var(--page-text)" }}>
                    {welcome.title}
                  </h4>
                  <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed" style={{ color: "var(--light-text-muted)" }}>
                    {welcome.message}
                  </p>
                </>
              )}
            </section>
          )}

          {assessment && (
          <Section title={secTitle("assessment", "Starting Assessment")} actions={cardActions("assessment", "Starting Assessment", { editable: true })}>
            {editing === "assessment" && draft ? (
              editorShell("assessment", <AssessmentEditor value={draft as AssessmentDraft} onChange={setDraft} />)
            ) : (
              <>
            <div className={rowCls}><span className={rowLabel}>Weight</span><span className={rowValue}>{assessment.weightKg} kg</span></div>
            <div className={rowCls}><span className={rowLabel}>Height</span><span className={rowValue}>{assessment.heightCm} cm</span></div>
            <div className={rowCls}><span className={rowLabel}>BMI</span><span className={rowValue}>{assessment.bmi}</span></div>
            <div className={rowCls}><span className={rowLabel}>Body fat</span><span className={rowValue}>{assessment.bodyFatPct != null ? `${assessment.bodyFatPct}%` : "—"}</span></div>
            <div className={rowCls}><span className={rowLabel}>Fat mass</span><span className={rowValue}>{assessment.fatMassKg != null ? `${assessment.fatMassKg} kg` : "—"}</span></div>
            <div className={rowCls}><span className={rowLabel}>Lean mass</span><span className={rowValue}>{assessment.leanMassKg != null ? `${assessment.leanMassKg} kg` : "—"}</span></div>
            <div className={rowCls}><span className={rowLabel}>BMR ({assessment.bmrMethod === "katch-mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"})</span><span className={rowValue}>{assessment.bmr.toLocaleString()} kcal</span></div>
            <div className={rowCls}><span className={rowLabel}>Maintenance calories</span><span className={rowValue}>{assessment.maintenance.toLocaleString()} kcal</span></div>
            <p className="mt-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
              Goal: {assessment.goalStatement}
            </p>
              </>
            )}
          </Section>
          )}

          {femaleNoteText && (
            <Section title={secTitle("femaleNote", "A note before we start")}>
              <p className="text-xs leading-relaxed" style={{ color: "var(--page-text)" }}>{femaleNoteText}</p>
            </Section>
          )}

          {calories && (
          <Section title={secTitle("calories", "Calorie Targets")} actions={cardActions("calories", "Calorie Targets", { editable: true })}>
            {editing === "calories" && draft ? (
              editorShell("calories", <CaloriesEditor value={draft as CaloriesDraft} onChange={setDraft} />)
            ) : (
              <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>Maintenance</p>
                <p className="stat-numeral text-xl" style={{ color: "var(--page-text)" }}>{calories.maintenance.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>kcal / day</p>
              </div>
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#00AEEF", backgroundColor: "var(--light-elevated)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "#00AEEF" }}>Your target</p>
                <p className="stat-numeral text-xl" style={{ color: "var(--page-text)" }}>{calories.target.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  {calories.isFatLoss
                    ? `${Math.round(calories.deficitPct * 100)}% deficit${calories.weeklyLossKg != null ? ` · ~${calories.weeklyLossKg} kg/week` : ""}`
                    : "at maintenance"}
                </p>
              </div>
            </div>
            {calories.clampedByFloor && (
              <p className="mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium" style={{ borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                Note: your target was raised to the safety floor (BMR × 1.05 / 1,200 kcal) — a deeper deficit would cost muscle.
              </p>
            )}
            {/* Phase 99c Item 6: provenance + write-back for TDEE consistency */}
            {report.targetsSource === "saved" ? (
              <p className="mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)", color: "var(--light-text-muted)" }}>
                Targets synced from the saved intake profile (TDEE calculator) — every number in this report matches the Nutrition tab.
              </p>
            ) : (
              canEdit && (
                <button
                  type="button"
                  disabled={savingTargets}
                  onClick={async () => {
                    setSavingTargets(true);
                    try {
                      await onSaveTargets();
                      toast.success("Targets saved to the Nutrition tab");
                    } catch (err) {
                      toast.error("Couldn't save targets: " + (err instanceof Error ? err.message : "unknown error"));
                    } finally {
                      setSavingTargets(false);
                    }
                  }}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11px] font-semibold text-[var(--page-text)] transition hover:border-[var(--azfit-primary)]/50 disabled:opacity-50"
                >
                  {savingTargets ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} style={{ color: "var(--azfit-primary)" }} />}
                  Save these targets to the client's Nutrition tab
                </button>
              )
            )}
              </>
            )}
          </Section>
          )}

          {macros && (
          <Section title={secTitle("macros", "Macro Targets — All Options")} actions={cardActions("macros", "Macro Targets", { editable: true })}>
            {editing === "macros" && draft ? (
              editorShell("macros", <MacrosEditor value={draft as MacrosDraft} onChange={setDraft} />)
            ) : (
              <>
            <MacroTable
              title={`At your target (${calories ? calories.target.toLocaleString() : report.calories.target.toLocaleString()} kcal)`}
              styles={macros.styles}
              gramsOf={(s) => s.atTarget}
              recommendedKey={macros.recommended.key}
              floor={macros.proteinFloor.grams}
              showFlags
            />
            <MacroTable
              title={`At maintenance (${macros.maintenance.toLocaleString()} kcal)`}
              styles={macros.styles}
              gramsOf={(s) => s.atMaintenance}
              recommendedKey={null}
              floor={null}
            />
            <p className="mt-2 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
              Protein floor: {macros.proteinFloor.grams} g ({macros.proteinFloor.basis}). Recommended:{" "}
              <strong style={{ color: "#00AEEF" }}>{macros.recommended.name}</strong> — {macros.recommended.reason}.
            </p>
              </>
            )}
          </Section>
          )}

          {/* Phase 99c Item 3: weekly targets — baseline vs goal, realistic
              weekly rate, phase expectations, non-scale victories. Absent in
              summaries generated before 99c. Phase 99d: editable +
              include-tickable via the overrides system. */}
          {weeklyTargets && isIncluded(report.included, "weeklyTargets") && (
            <Section title={secTitle("weeklyTargets", "Your Weekly Targets & Expectations")} actions={cardActions("weeklyTargets", "Weekly Targets", { editable: true })}>
              {editing === "weeklyTargets" && draft ? (
                editorShell("weeklyTargets", <WeeklyTargetsEditor value={draft as WeeklyTargetsDraft} onChange={setDraft} />)
              ) : (
                (() => {
                const wt = weeklyTargets;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>Starting point</p>
                        <p className="stat-numeral text-lg" style={{ color: "var(--page-text)" }}>
                          {wt.baseline.weightKg != null ? `${wt.baseline.weightKg} kg` : "Not recorded yet"}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                          {wt.baseline.bodyFatPct != null ? `${wt.baseline.bodyFatPct}% body fat · ` : ""}
                          {wt.baseline.recordedAt ? `first logged ${formatDate(wt.baseline.recordedAt)}` : "log your first weigh-in"}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#8B5CF6" }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "#8B5CF6" }}>The goal</p>
                        <p className="stat-numeral text-lg" style={{ color: "var(--page-text)" }}>
                          {wt.goal.targetWeightKg != null ? `${wt.goal.targetWeightKg} kg` : wt.goal.label}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                          {[wt.goal.targetBodyFatPct != null ? `${wt.goal.targetBodyFatPct}% BF` : null, wt.goal.targetDate ? `by ${formatDate(wt.goal.targetDate)}` : null].filter(Boolean).join(" · ") || wt.goal.label}
                        </p>
                      </div>
                    </div>
                    {wt.weeklyRate && (
                      <p className="mt-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
                        Realistic pace: <strong style={{ color: "#00AEEF" }}>{wt.weeklyRate.label}</strong> — week to week, never day to day.
                      </p>
                    )}
                    {wt.goalDateHonestNote && (
                      <p className="mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium" style={{ borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                        {wt.goalDateHonestNote}
                      </p>
                    )}
                    <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                      What to expect
                    </p>
                    {wt.expectations.map((e) => (
                      <div key={e.weeks} className="mb-1.5 flex gap-3 last:mb-0">
                        <span className="w-20 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold" style={{ backgroundColor: "var(--light-elevated)", color: "#00AEEF" }}>
                          {e.weeks}
                        </span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>{e.focus}</p>
                          <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>{e.expectation}</p>
                        </div>
                      </div>
                    ))}
                    <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                      Wins that aren't the scale
                    </p>
                    <ul className="list-inside list-disc space-y-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                      {wt.nonScaleVictories.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                    {wt.notes.map((note) => (
                      <p key={note} className="mt-2 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{note}</p>
                    ))}
                  </>
                );
                })()
              )}
            </Section>
          )}

          {/* Phase 80: blueprint-driven sections — only when the stored
              summary carries extras (blueprint row existed at generate
              time). Section numbers shift dynamically. */}
          {warmup && (
            <Section title={secTitle("warmup", "Dynamic Warm-Up & Mobility")} actions={cardActions("warmup", "Warm-Up")}>
              <ol className="list-inside list-decimal space-y-1 text-xs" style={{ color: "var(--page-text)" }}>
                {warmup.steps.map((s) => (
                  <li key={s.name}>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}> — {s.muscle}</span>
                  </li>
                ))}
              </ol>
              {warmup.note && (
                <p className="mt-2 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{warmup.note}</p>
              )}
            </Section>
          )}

          {training && isIncluded(report.included, "training") && (
          <Section title={secTitle("training", `Training Plan (GBC) · ${training.sessions.length} sessions + ${training.stepTarget.toLocaleString()} steps/day`)} actions={cardActions("training", "Training Plan", { editable: true })}>
            {/* Phase 99g: pencil editing (text-level overrides) takes
                precedence; the Phase 81 module editor below is for
                swapping in different exercises from the library. */}
            {editing === "training" && draft ? (
              editorShell("training", <TrainingCardEditor value={draft as TrainingDraft} onChange={setDraft} />)
            ) : (
            <>
            {/* Phase 81 Item 2: trainer-only edit toggle */}
            {canEdit && !editMode && (
              <button
                type="button"
                onClick={() => { setDraftSessions(JSON.parse(JSON.stringify(report.training.sessions)) as GbcSession[]); setEditMode(true); }}
                className="mb-2 flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 text-[11px] font-semibold text-[var(--page-text)] hover:border-[var(--azfit-primary)]/50"
              >
                <Pencil size={12} style={{ color: "var(--azfit-primary)" }} />
                Edit training plan
              </button>
            )}
            {editMode && draftSessions ? (
              <>
                <TrainingPlanEditor
                  sessions={draftSessions}
                  taxonomy={taxonomyRows}
                  onChange={setDraftSessions}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const invalid = draftSessions.map((s) => validateSession(s)).filter((v) => !v.valid);
                      if (invalid.length > 0) {
                        setSaveState("error");
                        setSaveError(invalid[0].errors[0] ?? "Validation failed");
                        return;
                      }
                      setSaveState("saving");
                      setSaveError(null);
                      try {
                        await onSaveTraining(draftSessions);
                        setSaveState("idle");
                        setEditMode(false);
                        setDraftSessions(null);
                        toast.success("Training plan saved");
                      } catch (err) {
                        setSaveState("error");
                        setSaveError(err instanceof Error ? err.message : "Save failed");
                      }
                    }}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))" }}
                  >
                    <Save size={13} />
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditMode(false); setDraftSessions(null); }}
                    className="min-h-[44px] rounded-lg border border-[var(--card-border)] px-4 text-xs font-semibold text-[var(--page-text)]"
                  >
                    Discard
                  </button>
                </div>
              </>
            ) : (
              <>
            {training.sessions.map((s, i) => (
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
              {training.restRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {report.trainingMeta && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 border-t pt-2 text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}>
                {report.trainingMeta.notes.map((nt) => (
                  <li key={nt}>{nt}</li>
                ))}
              </ul>
            )}
              </>
            )}
            </>
            )}
          </Section>
          )}

          {/* Phase 99c Item 2: cardio prescription — machines gated by the
              client's real equipment access, with difficulty, intensity and
              a 4-week progression. Absent in pre-99c summaries. Phase 99d:
              editable + include-tickable via the overrides system. */}
          {cardio && isIncluded(report.included, "cardio") && (
            <Section title={secTitle("cardio", "Cardio — Machines, Intensity & Progression")} actions={cardActions("cardio", "Cardio", { editable: true })}>
              {editing === "cardio" && draft ? (
                editorShell("cardio", <CardioEditor value={draft as CardioDraft} onChange={setDraft} />)
              ) : (
                <>
              {cardio.rows.map((r) => (
                <div key={r.machine + r.protocol} className="mb-3 rounded-lg border p-3 last:mb-0" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-bold" style={{ color: "var(--page-text)" }}>{r.machine}</p>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: "var(--light-elevated)", color: "#00AEEF" }}>
                      {r.difficulty}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium" style={{ color: "#8B5CF6" }}>{r.protocol} · {r.basis}</p>
                  <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>{r.intensity}</p>
                  <p className="mt-1 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{r.schedule}</p>
                  <div className="mt-1.5 space-y-0.5">
                    {r.progression.map((pg) => (
                      <p key={pg.label} className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                        <span className="font-semibold" style={{ color: "var(--page-text)" }}>{pg.label}:</span> {pg.prescription}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              <p className="mt-2 rounded-lg px-3 py-2 text-[11px] font-medium" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
                ≈ {cardio.weeklyMinutes} cardio minutes/week · {cardio.stepNote}
              </p>
              {cardio.notes.map((nt) => (
                <p key={nt} className="mt-1.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{nt}</p>
              ))}
                </>
              )}
            </Section>
          )}

          {/* Phase 99c Item 4: goal-adaptive eating guide. Absent in
              pre-99c summaries. */}
          {nutritionGuide && isIncluded(report.included, "nutritionGuide") && (
            <Section title={secTitle("nutritionGuide", nutritionGuide.title)} actions={cardActions("nutritionGuide", "Nutrition Guide", { editable: true })}>
              {editing === "nutritionGuide" && draft ? (
                editorShell("nutritionGuide", <NutritionGuideEditor value={draft as NutritionGuideDraft} onChange={setDraft} />)
              ) : (
                <>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--page-text)" }}>{nutritionGuide.intro}</p>
              {nutritionGuide.safetyCallout && (
                <p className="mt-2 rounded-lg border px-3 py-2 text-[11px] font-bold" style={{ borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                  {nutritionGuide.safetyCallout}
                </p>
              )}
              {nutritionGuide.blocks.map((b) => (
                <div key={b.heading} className="mt-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#00AEEF" }}>{b.heading}</p>
                  <ul className="list-inside list-disc space-y-0.5 text-[11px]" style={{ color: "var(--page-text)" }}>
                    {b.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--card-border)" }}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Who should NOT be in a deficit
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  {nutritionGuide.whoShouldNotCut.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              {nutritionGuide.notes.map((nt) => (
                <p key={nt} className="mt-2 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{nt}</p>
              ))}
                </>
              )}
            </Section>
          )}

          {sampleDay && (
          <Section title={secTitle("sampleDay", `Sample Day of Eating (${report.recommended.name})`)} actions={cardActions("sampleDay", "Sample Day of Eating", { editable: true })}>
            {editing === "sampleDay" && draft ? (
              editorShell("sampleDay", <SampleDayEditor value={draft as SampleDayDraft} onChange={setDraft} />)
            ) : (
              <>
            {sampleDay.meals.map((m) => (
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
                {sampleDay.totals.kcal} kcal · P{sampleDay.totals.p} C{sampleDay.totals.c} F{sampleDay.totals.f}
                {sampleDay.withinTolerance && <span style={{ color: "#22C55E" }}> · on target ±5%</span>}
              </span>
            </div>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              {report.foodRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
              </>
            )}
          </Section>
          )}

          {sampleDiet && (
            <Section title={secTitle("sampleDiet", "Sample Diet Day — Your Foods")} actions={cardActions("sampleDiet", "Sample Diet Day")}>
              {sampleDiet.meals.map((m) => (
                <div key={m.name} className="mb-2 last:mb-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>{m.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {m.items.map((i) => `${i.food} ${i.grams} g`).join(" · ")}
                  </p>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}>
                <span>Day total</span>
                <span className="tabular-nums">
                  {sampleDiet.totals.kcal} kcal · P{sampleDiet.totals.proteinG} C{sampleDiet.totals.carbsG} F{sampleDiet.totals.fatsG}
                  {sampleDiet.withinTolerance && <span style={{ color: "#22C55E" }}> · within ±10% of target</span>}
                </span>
              </div>
              {sampleDiet.note && (
                <p className="mt-2 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{sampleDiet.note}</p>
              )}
            </Section>
          )}

          {supplements && (
            <Section title={secTitle("supplements", "Supplementation & Hydration")} actions={cardActions("supplements", "Supplements")}>
              {supplements.items.map((s) => (
                <div key={s.name} className={rowCls}>
                  <span className={rowLabel}>{s.name}</span>
                  <span className="text-right text-xs">
                    <span className="font-semibold" style={{ color: "var(--page-text)" }}>{s.dose}</span>
                    <span className="block text-[10px]" style={{ color: "var(--light-text-muted)" }}>{s.note}</span>
                  </span>
                </div>
              ))}
              <div className={rowCls}>
                <span className={rowLabel}>Water</span>
                <span className="text-right text-xs">
                  <span className="font-semibold" style={{ color: "var(--page-text)" }}>
                    {(supplements.hydration.min / 1000).toFixed(1)}–{(supplements.hydration.max / 1000).toFixed(1)} L/day
                  </span>
                  <span className="block text-[10px]" style={{ color: "var(--light-text-muted)" }}>30–35 ml per kg of your bodyweight</span>
                </span>
              </div>
              <p className="mt-2 text-[10px]" style={{ color: "var(--light-text-muted)" }}>{supplements.disclaimer}</p>
            </Section>
          )}

          {tracking && (
          <Section title={secTitle("tracking", "Tracking & Accountability")} actions={cardActions("tracking", "Tracking & Accountability", { editable: true })}>
            {editing === "tracking" && draft ? (
              editorShell("tracking", <TrackingEditor value={draft as TrackingDraft} onChange={setDraft} />)
            ) : (
              <>
            {tracking.map((t) => (
              <div key={t.what} className={rowCls}>
                <span className={rowLabel}>{t.what}</span>
                <span className="text-right text-xs">
                  <span className="font-semibold" style={{ color: "var(--page-text)" }}>{t.frequency}</span>
                  <span className="block text-[10px]" style={{ color: "var(--light-text-muted)" }}>{t.note}</span>
                </span>
              </div>
            ))}
              </>
            )}
          </Section>
          )}

          {roadmap && (
          <Section title={secTitle("roadmap", `Program Roadmap (${report.goal.programWeeks} weeks)`)} actions={cardActions("roadmap", "Program Roadmap", { editable: true })}>
            {editing === "roadmap" && draft ? (
              editorShell("roadmap", <RoadmapEditor value={draft as RoadmapDraft} onChange={setDraft} />)
            ) : (
              <>
            {roadmap.map((p) => (
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
              </>
            )}
          </Section>
          )}

          {faq && (
          <Section title={secTitle("faq", "FAQ")} actions={cardActions("faq", "FAQ", { editable: true })}>
            {editing === "faq" && draft ? (
              editorShell("faq", <FaqEditor value={draft as FaqDraft} onChange={setDraft} />)
            ) : (
              <>
            {faq.map((f) => (
              <div key={f.q} className="mb-2 last:mb-0">
                <p className="text-xs font-semibold" style={{ color: "#00AEEF" }}>{f.q}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--page-text)" }}>{f.a}</p>
              </div>
            ))}
              </>
            )}
          </Section>
          )}

          {/* Phase 99g Item 2: Coach's Notes — trainer free-text card.
              Stored top-level as result.coachNotes (absent = no card).
              Renders here, in print, and in the plan-export doc. The
              editor must open even when the card doesn't exist yet —
              hence the editing-branch in the guard, not just coachNotes. */}
          {(coachNotes || (editing === "coachNotes" && draft)) && (
            <Section title={secTitle("coachNotes", "Coach's Notes")} actions={cardActions("coachNotes", "Coach's Notes", { editable: true })}>
              {editing === "coachNotes" && draft ? (
                editorShell("coachNotes", <CoachNotesEditor value={draft as CoachNotesDraft} onChange={setDraft} />)
              ) : (
                coachNotes?.paragraphs.map((p, i) => (
                  <p key={`${i}-${p.slice(0, 24)}`} className="mb-1.5 text-[11px] leading-relaxed last:mb-0" style={{ color: "var(--page-text)" }}>{p}</p>
                ))
              )}
            </Section>
          )}
          {coachNotes == null && canEdit && isInc("coachNotes") && editing !== "coachNotes" && (
            <button
              type="button"
              aria-label="Add Coach's Notes"
              onClick={() => { setDraft({ text: "" } satisfies CoachNotesDraft); setEditing("coachNotes"); }}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--card-border)] px-3 py-2 text-[11px] font-semibold text-[var(--light-text-muted)] transition hover:border-[var(--azfit-primary)]/50 hover:text-[var(--page-text)]"
            >
              <Plus size={12} />
              Add Coach's Notes
            </button>
          )}

          {/* Phase 80 Item 2: medical disclaimer — footer of the
              on-screen report (the print page carries it too) */}
          <p className="mt-4 border-t pt-3 text-center text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}>
            {MEDICAL_DISCLAIMER}
          </p>

          {/* Phase 81: blocking training-save overlay (Phase 66 pattern) */}
          <AnimatePresence>
            {(saveState === "saving" || saveState === "error") && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              >
                <div className="w-full max-w-xs rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center shadow-2xl">
                  {saveState === "saving" ? (
                    <>
                      <LoaderCircle className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--azfit-primary)]" />
                      <p className="text-sm font-medium text-[var(--page-text)]">Saving training plan…</p>
                    </>
                  ) : (
                    <>
                      <CircleAlert className="mx-auto mb-3 h-8 w-8 text-[var(--danger)]" />
                      <p className="text-sm font-medium text-[var(--page-text)]">Couldn't save</p>
                      <p className="mt-1 text-xs text-[var(--light-text-muted)]">{saveError}</p>
                      <button
                        type="button"
                        onClick={() => setSaveState("idle")}
                        className="mt-4 w-full rounded-lg border border-[var(--card-border)] py-2 text-xs font-semibold text-[var(--page-text)]"
                      >
                        Back to editing
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
