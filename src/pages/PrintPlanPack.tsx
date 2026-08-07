// ═══════════════════════════════════════════════════════════════
// PrintPlanPack (Phase 54) — one-click professional client Plan Pack.
// /print/plan-pack/:clientRecordId — stats, goals, program summary,
// 7-day meal plan, daily targets, supplement guidance.
// Read-only (zero writes). Export = window.print() → "Save as PDF".
// Ink-friendly like PrintProgram (34) / PrintGrocery (51): hard
// gray-on-white Tailwind, no glass, no dark backgrounds on paper.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { goalLabel } from "@/lib/clientGoals";
import {
  programWeek,
  mealPlanDays,
  stepsSleepFromHabits,
  goalKeysForSupplements,
  type PlanPackItem,
  type DayPlan,
} from "@/lib/planPackPrint";
import { phaseNamesFromJson, progressionRulesFromJson } from "@/lib/programPrint";
import { supplementsForGoals, type Supplement } from "@/lib/supplements";
import type { Database } from "@/types/supabase";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type GoalRow = Database["public"]["Tables"]["client_goals"]["Row"];

interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface PackModel {
  clientName: string;
  trainerName: string;
  generatedOn: string;
  // snapshot
  weightKg: number | null;
  bodyFatPct: number | null;
  heightCm: number | null;
  // goals + program
  goals: GoalRow[];
  program: ProgramRow | null;
  phaseNames: string[];
  progressionRules: { label: string; text: string }[];
  week: { week: number; total: number } | null;
  days: { name: string; exercises: ExerciseRow[] }[];
  // nutrition
  targets: Targets | null;
  mealDays: DayPlan[];
  steps: string | null;
  sleep: string | null;
  supplements: Supplement[];
}

const MEAL_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
const r0 = (n: number) => Math.round(n);

export default function PrintPlanPackPage() {
  const { clientRecordId } = useParams();
  const navigate = useNavigate();
  const [model, setModel] = useState<PackModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientRecordId) {
        setError("No client specified.");
        setLoading(false);
        return;
      }

      // 1) Anchor: the clients row
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientRecordId)
        .maybeSingle();
      if (cErr || !client) {
        if (!cancelled) {
          setError("Client not found.");
          setLoading(false);
        }
        return;
      }
      const c = client as ClientRow;

      // 2) Parallel: trainer name, goals, latest body comp, active program, meal plan, habits, profile
      const [trainerRes, goalsRes, bcRes, progRes, planRes, habitsRes, profRes] = await Promise.all([
        supabase.rpc("get_trainer_display_name", { p_trainer_id: c.trainer_id }),
        supabase.from("client_goals").select("*").eq("client_id", c.id).eq("is_achieved", false).order("created_at"),
        supabase
          .from("body_composition")
          .select("weight_kg, body_fat_percentage, recorded_at")
          .eq("client_id", c.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("programs")
          .select("*")
          .eq("client_id", c.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("meal_plans")
          .select("items")
          .eq("client_id", c.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("habits").select("name, target_frequency, active").eq("client_id", c.id),
        supabase.from("profiles").select("id").eq("email", c.email).maybeSingle(),
      ]);
      if (cancelled) return;

      const program = (progRes.data as ProgramRow | null) ?? null;

      // 3) Program days + exercises
      let days: PackModel["days"] = [];
      if (program) {
        const { data: workouts } = await supabase
          .from("workouts")
          .select("*")
          .eq("program_id", program.id)
          .order("day_of_week", { ascending: true });
        const wRows = (workouts as WorkoutRow[] | null) ?? [];
        const wIds = wRows.map((w) => w.id);
        const { data: exercises } = wIds.length
          ? await supabase.from("exercises").select("*").in("workout_id", wIds).order("order_index", { ascending: true })
          : { data: [] as ExerciseRow[] };
        if (cancelled) return;
        const exRows = (exercises as ExerciseRow[] | null) ?? [];
        days = wRows.map((w) => ({ name: w.name, exercises: exRows.filter((e) => e.workout_id === w.id) }));
      }

      // 4) Nutrition targets — profile table first, intake_profile.computed_targets
      //    fallback for account-less clients (26C shape: no _g suffixes)
      let targets: Targets | null = null;
      const profId = (profRes.data as { id: string } | null)?.id;
      if (profId) {
        const { data: nt } = await supabase
          .from("nutrition_targets")
          .select("calories, protein_g, carbs_g, fats_g")
          .eq("user_id", profId)
          .maybeSingle();
        if (cancelled) return;
        if (nt)
          targets = {
            calories: nt.calories ?? 0,
            protein: nt.protein_g ?? 0,
            carbs: nt.carbs_g ?? 0,
            fats: nt.fats_g ?? 0,
          };
      }
      if (!targets) {
        const ct = (c.intake_profile as { computed_targets?: Record<string, unknown> } | null)?.computed_targets;
        if (ct && typeof ct.calories === "number") {
          targets = {
            calories: ct.calories as number,
            protein: (ct.protein_g ?? ct.protein ?? 0) as number,
            carbs: (ct.carbs_g ?? ct.carbs ?? 0) as number,
            fats: (ct.fats_g ?? ct.fats ?? 0) as number,
          };
        }
      }

      const goals = (goalsRes.data as GoalRow[] | null) ?? [];
      const planItems = (((planRes.data as { items: unknown } | null)?.items as PlanPackItem[]) ?? []) || [];
      const { steps, sleep } = stepsSleepFromHabits(
        (habitsRes.data as { name: string; target_frequency: string | null; active: boolean }[] | null) ?? [],
      );

      setModel({
        clientName: c.full_name,
        trainerName:
          typeof trainerRes.data === "string" && trainerRes.data ? trainerRes.data : "AzFIT Trainer",
        generatedOn: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        weightKg: (bcRes.data as { weight_kg: number | null } | null)?.weight_kg ?? c.weight_kg ?? null,
        bodyFatPct:
          (bcRes.data as { body_fat_percentage: number | null } | null)?.body_fat_percentage ??
          c.body_fat_percentage ??
          null,
        heightCm: c.height_cm,
        goals,
        program,
        phaseNames: program ? phaseNamesFromJson(program.phases) : [],
        progressionRules: program ? progressionRulesFromJson(program.progression_rules) : [],
        week: program ? programWeek(program.start_date, program.duration_weeks, new Date()) : null,
        days,
        targets,
        mealDays: mealPlanDays(planItems),
        steps,
        sleep,
        supplements: supplementsForGoals(goalKeysForSupplements(goals, c.fitness_goal)),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientRecordId]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#00AEEF]" />
      </div>
    );
  }
  if (error || !model) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-white text-gray-900">
        <p className="text-sm">{error ?? "Couldn't build the plan pack."}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-gray-500 underline">
          Go back
        </button>
      </div>
    );
  }

  const m = model;

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @page { @bottom-center { content: "Page " counter(page) " of " counter(pages); } }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .pack-section { page-break-inside: avoid; }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
        >
          <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-[190mm] px-6 py-6">
        {/* 1 ── Header block ── */}
        <header className="border-b-2 border-gray-900 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-black tracking-tight">
                Az<span className="text-[#00AEEF]">FIT</span>
              </p>
              <h1 className="mt-1 text-2xl font-bold">Personal Training Plan</h1>
              <p className="mt-1 text-sm text-gray-600">
                Prepared for <strong className="text-gray-900">{m.clientName}</strong> by {m.trainerName}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Generated {m.generatedOn}</p>
              {m.program && (
                <p className="mt-1 font-semibold text-gray-900">
                  {m.week === null
                    ? "Not started"
                    : m.week.week === 0
                      ? "Starts soon"
                      : `Week ${m.week.week} of ${m.week.total}`}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* 2 ── Client snapshot ── */}
        <section className="pack-section mt-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Weight", value: m.weightKg != null ? `${m.weightKg} kg` : "—" },
              { label: "Body Fat", value: m.bodyFatPct != null ? `${m.bodyFatPct}%` : "—" },
              { label: "Height", value: m.heightCm != null ? `${m.heightCm} cm` : "—" },
            ].map((s) => (
              <div key={s.label} className="rounded border border-gray-200 px-3 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{s.label}</p>
                <p className="mt-0.5 text-base font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3 ── Goals & timeline ── */}
        <section className="pack-section mt-5">
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">Goals & Timeline</h2>
          {m.goals.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.goals.map((g) => (
                <span key={g.id} className="rounded-full border border-gray-300 px-2.5 py-0.5 text-[11px] font-medium">
                  {goalLabel(g)}
                  {g.target_date ? ` — by ${new Date(`${g.target_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No goals recorded yet.</p>
          )}

          {m.program ? (
            <div className="mt-3">
              <p className="text-xs text-gray-600">
                <strong className="text-gray-900">{m.program.name}</strong> — {m.program.duration_weeks} weeks,{" "}
                {m.program.frequency_per_week}×/week
                {m.phaseNames.length > 0 && <> — Phases: {m.phaseNames.join(" → ")}</>}
              </p>
              {/* Week timeline bar (pure CSS) */}
              {m.week && m.week.week >= 1 && (
                <div className="mt-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: m.week.total }, (_, i) => (
                      <div
                        key={i}
                        className={`h-2.5 flex-1 rounded-sm ${i + 1 < m.week!.week ? "bg-gray-400" : i + 1 === m.week!.week ? "bg-gray-900" : "bg-gray-200"}`}
                        title={`Week ${i + 1}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Week {m.week.week} of {m.week.total}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-500">Training program to be assigned.</p>
          )}
        </section>

        {/* 4 ── Training program summary ── */}
        {m.program && m.days.length > 0 && (
          <section className="pack-section mt-5">
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">Training Program</h2>
            <div className="mt-2 space-y-1.5">
              {m.days.map((d, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <p className="font-semibold">
                    {d.name} <span className="font-normal text-gray-500">({d.exercises.length} exercises)</span>
                  </p>
                  <p className="text-right text-gray-600">
                    {d.exercises.slice(0, 3).map((e) => e.name).join(", ")}
                    {d.exercises.length > 3 && ` + ${d.exercises.length - 3} more`}
                  </p>
                </div>
              ))}
            </div>
            {m.progressionRules.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-[11px] text-gray-600">
                {m.progressionRules.map((r, i) => (
                  <li key={i}>
                    <strong className="text-gray-900">{r.label}:</strong> {r.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10px] italic text-gray-400">Full session detail is in the separate Program PDF.</p>
          </section>
        )}

        {/* 5 ── 7-day meal plan ── */}
        <section className="pack-section mt-5">
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">Meal Plan</h2>
          {m.mealDays.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">Meal plan to be assigned after assessment.</p>
          ) : (
            <div className="mt-2 space-y-3">
              {m.mealDays.map((d) => (
                <div key={d.day} className="break-inside-avoid">
                  <p className="rounded bg-gray-900 px-2.5 py-1 text-[11px] font-bold uppercase text-white">
                    Day {d.day}
                  </p>
                  <table className="mt-1 w-full text-[11px]">
                    <tbody>
                      {d.meals.map((meal) => (
                        <tr key={meal.meal} className="border-b border-gray-100">
                          <td className="py-1 pr-2 font-medium">
                            {MEAL_LABEL[meal.meal] ?? meal.meal}
                            <span className="block text-[10px] font-normal text-gray-500">
                              {meal.items.map((it) => it.name).join(" · ")}
                            </span>
                          </td>
                          <td className="py-1 text-right font-semibold">{r0(meal.totals.calories)} kcal</td>
                          <td className="w-16 py-1 text-right text-gray-600">P {r0(meal.totals.protein)}g</td>
                          <td className="w-16 py-1 text-right text-gray-600">C {r0(meal.totals.carbs)}g</td>
                          <td className="w-16 py-1 text-right text-gray-600">F {r0(meal.totals.fats)}g</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="py-1">Day total</td>
                        <td className="py-1 text-right">{r0(d.totals.calories)} kcal</td>
                        <td className="py-1 text-right">P {r0(d.totals.protein)}g</td>
                        <td className="py-1 text-right">C {r0(d.totals.carbs)}g</td>
                        <td className="py-1 text-right">F {r0(d.totals.fats)}g</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6 ── Daily targets ── */}
        <section className="pack-section mt-5">
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">Daily Targets</h2>
          {m.targets ? (
            <div className="mt-2 grid grid-cols-4 gap-3">
              {[
                { label: "Calories", value: `${r0(m.targets.calories)} kcal` },
                { label: "Protein", value: `${r0(m.targets.protein)} g` },
                { label: "Carbs", value: `${r0(m.targets.carbs)} g` },
                { label: "Fats", value: `${r0(m.targets.fats)} g` },
              ].map((t) => (
                <div key={t.label} className="rounded border border-gray-200 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t.label}</p>
                  <p className="mt-0.5 text-sm font-bold">{t.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Nutrition targets to be set after assessment.</p>
          )}
          {(m.steps || m.sleep) && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {m.steps && <span className="rounded-full border border-gray-300 px-2.5 py-0.5">Steps: {m.steps}</span>}
              {m.sleep && <span className="rounded-full border border-gray-300 px-2.5 py-0.5">Sleep: {m.sleep}</span>}
            </div>
          )}
        </section>

        {/* 7 ── Supplement guidance ── */}
        {m.supplements.length > 0 && (
          <section className="pack-section mt-5">
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">Supplement Guidance</h2>
            <table className="mt-2 w-full text-[11px]">
              <tbody>
                {m.supplements.map((s) => (
                  <tr key={s.name} className="border-b border-gray-100 align-top">
                    <td className="py-1.5 pr-2 font-semibold">{s.name}</td>
                    <td className="w-40 py-1.5 pr-2 text-gray-600">{s.dose}</td>
                    <td className="py-1.5 text-gray-600">{s.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] italic text-gray-500">
              General guidance only — consult a healthcare professional before starting any supplement.
            </p>
          </section>
        )}

        {/* 8 ── Footer ── */}
        <footer className="mt-6 border-t border-gray-200 pt-3 text-[10px] text-gray-400">
          Generated by AzFIT for {m.clientName} — {m.generatedOn}. Program detail, logging and progress tracking live in
          the AzFIT app.
        </footer>
      </div>
    </div>
  );
}
