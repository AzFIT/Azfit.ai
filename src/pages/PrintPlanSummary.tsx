// ═══════════════════════════════════════════════════════════════
// PrintPlanSummary (Phase 61) — ink-friendly client Blueprint.
// /clients/:id/plan-summary/print?v=<summaryId> (latest by default).
// Read-only (RLS: trainer manages, client reads own). Export =
// window.print() → "Save as PDF" (zero deps), like PrintPlanPack.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatNumber } from "@/lib/utils";
import type { BlueprintResult } from "@/lib/planBlueprint";
import { MEDICAL_DISCLAIMER } from "@/lib/planSummaryExtras";
import { effectiveHeader } from "@/lib/planSummaryOverrides";
import {
  resolvePlanSummary,
  displayTitle,
  type ResolvedSectionKey,
  type ResolvedSectionOf,
} from "@/lib/planSummaryRender";
import type { Database } from "@/types/supabase";

type SummaryRow = Database["public"]["Tables"]["plan_summaries"]["Row"];

const th = "px-2 py-1 text-left font-semibold";
const td = "px-2 py-1 text-gray-700";
const sec = "pack-section mt-4";

export default function PrintPlanSummaryPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<BlueprintResult | null>(null);
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setError("No client specified.");
        setLoading(false);
        return;
      }
      const versionId = searchParams.get("v");
      const query = supabase.from("plan_summaries").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(1);
      const { data: row, error: rErr = null } = versionId
        ? await supabase.from("plan_summaries").select("*").eq("id", versionId).eq("client_id", id).maybeSingle()
        : await query.maybeSingle();
      if (rErr || !row) {
        if (!cancelled) {
          setError("No Plan Summary exists for this client yet — generate one from the Plan Summary tab first.");
          setLoading(false);
        }
        return;
      }
      const { data: client } = await supabase.from("clients").select("full_name").eq("id", id).maybeSingle();
      if (cancelled) return;
      setReport((row as SummaryRow).result as unknown as BlueprintResult);
      setClientName(client?.full_name ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#00AEEF]" />
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-white text-gray-900">
        <p className="max-w-md text-center text-sm">{error ?? "Couldn't load the summary."}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-gray-500 underline">
          Go back
        </button>
      </div>
    );
  }

  const m = report;
  // Phase 99d: overrides + include ticks. Phase 99e: ALL section
  // resolution (presence, include, order, numbering, titles, effective
  // data) comes from the SHARED resolver — the app report, this print
  // view and the plan-export edge function consume the same output.
  // Phase 99g: the core cards (assessment/calories/macros/training) +
  // Coach's Notes + the header override render their effective values.
  const byKey = new Map(
    resolvePlanSummary(m).map((s) => [s.key, s] as const),
  );
  function sectionOf<K extends ResolvedSectionKey>(k: K): ResolvedSectionOf<K> | undefined {
    return byKey.get(k) as ResolvedSectionOf<K> | undefined;
  }
  const num = (k: ResolvedSectionKey) => byKey.get(k)?.number ?? 0;
  const secTitle = (k: ResolvedSectionKey, t: string) => {
    const s = byKey.get(k);
    return s && s.number > 0 ? displayTitle(s) : t;
  };
  const welcome = sectionOf("welcome")?.data;
  const weeklyTargets = sectionOf("weeklyTargets")?.data;
  const cardio = sectionOf("cardio")?.data;
  const nutritionGuide = sectionOf("nutritionGuide")?.data;
  const sampleDay = sectionOf("sampleDay")?.data;
  const tracking = sectionOf("tracking")?.data.rows;
  const roadmap = sectionOf("roadmap")?.data.phases;
  const faq = sectionOf("faq")?.data.items;
  const femaleNote = sectionOf("femaleNote")?.data.text;
  const warmup = sectionOf("warmup")?.data;
  const sampleDiet = sectionOf("sampleDiet")?.data;
  const supplements = sectionOf("supplements")?.data;
  const assessment = sectionOf("assessment")?.data;
  const calories = sectionOf("calories")?.data;
  const macros = sectionOf("macros")?.data;
  const training = sectionOf("training")?.data;
  const coachNotes = sectionOf("coachNotes")?.data;
  const header = effectiveHeader(m);
  const genDate = new Date(m.header.generatedIso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      <style>{`
        @page { size: A4; margin: 11mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .pack-section { page-break-inside: avoid; break-inside: avoid; }
        /* Phase 99d Item 3: real logo top-centre — print only, no
           screen-layout change. */
        .print-only-logo { display: none; }
        @media print {
          .print-only-logo { display: block; margin: 0 auto 6mm; }
        }
      `}</style>

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

      <div className="mx-auto max-w-[185mm] px-6 py-5">
        {/* Phase 99d Item 3: AzFIT logo top-middle (print-only element) */}
        <img src={`${import.meta.env.BASE_URL}azfit-logo-header.png`} alt="AzFIT" className="print-only-logo h-14 object-contain" />

        {/* Header */}
        <header className="border-b-2 border-gray-900 pb-3">
          <div className="flex items-start justify-between">
            <div>
              {/* Phase FIX-3 Item 5: the 99d spec's real logo asset renders
                  top-middle above (print-only) — no text logo, no hex. */}
              <h1 className="text-2xl font-bold">Your Plan Summary</h1>
              <p className="mt-1 text-sm text-gray-600">
                Prepared for <strong className="text-gray-900">{clientName}</strong> by {header.trainerName}
                {header.businessName ? ` · ${header.businessName}` : ""}
              </p>
            </div>
            <p className="text-right text-xs text-gray-500">{genDate}</p>
          </div>
        </header>

        {/* Phase 99c: welcoming cover with the real logo. Phase 99d:
            effective (override-merged) values + include tick. */}
        {welcome && (
          <section className={`${sec} rounded-lg border border-gray-200 px-4 py-4 text-center`}>
            <img src={`${import.meta.env.BASE_URL}azfit-logo-header.png`} alt="AzFIT" className="mx-auto mb-2 h-12 object-contain" />
            <h2 className="text-base font-bold">{welcome.title}</h2>
            <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-gray-600">{welcome.message}</p>
          </section>
        )}

        {/* 1. Starting Assessment — 99g: effective (override-merged) data. */}
        {assessment && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{num("assessment")} · Starting Assessment</h2>
          <table className="mt-1 w-full text-[11px]">
            <tbody>
              {[
                ["Weight", `${assessment.weightKg} kg`],
                ["Height", `${assessment.heightCm} cm`],
                ["BMI", String(assessment.bmi)],
                ["Body fat", assessment.bodyFatPct != null ? `${assessment.bodyFatPct}%` : "—"],
                ["Fat mass", assessment.fatMassKg != null ? `${assessment.fatMassKg} kg` : "—"],
                ["Lean mass", assessment.leanMassKg != null ? `${assessment.leanMassKg} kg` : "—"],
                [`BMR (${assessment.bmrMethod === "katch-mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"})`, `${formatNumber(assessment.bmr)} kcal`],
                ["Maintenance calories", `${formatNumber(assessment.maintenance)} kcal`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-100">
                  <td className={`${td} font-medium`}>{k}</td>
                  <td className={`${td} text-right font-semibold`}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 rounded bg-gray-100 px-3 py-2 text-[11px] font-medium">Goal: {assessment.goalStatement}</p>
        </section>
        )}

        {/* 2. Female reassurance */}
        {femaleNote && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("femaleNote", "A note before we start")}</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-700">{femaleNote}</p>
          </section>
        )}

        {/* 3. Calorie Targets — 99g: effective data + recomputed weekly
            loss when the card is edited. */}
        {calories && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("calories", "Calorie Targets")}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 text-center">
            <div className="rounded border border-gray-200 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Maintenance</p>
              <p className="text-xl font-bold">{formatNumber(calories.maintenance)}</p>
              <p className="text-[10px] text-gray-500">kcal / day</p>
            </div>
            <div className="rounded border-2 border-gray-900 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-900">Your target</p>
              <p className="text-xl font-bold">{formatNumber(calories.target)}</p>
              <p className="text-[10px] text-gray-600">
                {m.goal.isFatLoss ? `${Math.round(calories.deficitPct * 100)}% deficit${calories.weeklyLossKg != null ? ` · ~${calories.weeklyLossKg} kg/week` : ""}` : "at maintenance"}
              </p>
            </div>
          </div>
          {calories.clampedByFloor && (
            <p className="mt-2 text-[10px] italic text-gray-600">
              Note: your target was raised to the safety floor (BMR × 1.05 / 1,200 kcal) — a deeper deficit would cost muscle.
            </p>
          )}
        </section>
        )}

        {/* 4. Macro tables — 99g: effective grams + recomended pick. */}
        {macros && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("macros", "Macro Targets — All Options")}</h2>
          {[
            { title: `At your target (${formatNumber(macros.target)} kcal)`, grams: (s: BlueprintResult["macroStyles"][number]) => s.atTarget, flags: true },
            { title: `At maintenance (${formatNumber(macros.maintenance)} kcal)`, grams: (s: BlueprintResult["macroStyles"][number]) => s.atMaintenance, flags: false },
          ].map((tbl) => (
            <div key={tbl.title} className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{tbl.title}</p>
              <table className="mt-0.5 w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className={th}>Style</th>
                    <th className={`${th} text-right`}>Protein</th>
                    <th className={`${th} text-right`}>Carbs</th>
                    <th className={`${th} text-right`}>Fats</th>
                    <th className={th}>Best for</th>
                  </tr>
                </thead>
                <tbody>
                  {macros.styles.map((s) => {
                    const g = tbl.grams(s);
                    const rec = s.key === macros.recommended.key;
                    return (
                      <tr key={s.key} className="border-b border-gray-100" style={rec ? { backgroundColor: "rgba(0,174,239,0.07)" } : undefined}>
                        <td className={`${td} font-semibold`}>
                          {s.name}
                          {rec && <span className="ml-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">rec</span>}
                        </td>
                        <td className={`${td} text-right`}>
                          {g.proteinG} g{tbl.flags && s.atTarget.belowFloor ? " ⚠" : ""}
                        </td>
                        <td className={`${td} text-right`}>{g.carbsG} g</td>
                        <td className={`${td} text-right`}>{g.fatsG} g</td>
                        <td className={`${td} text-gray-500`}>{s.bestFor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          <p className="mt-1.5 text-[10px] text-gray-600">
            Protein floor: {macros.proteinFloor.grams} g ({macros.proteinFloor.basis}). Recommended: <strong>{macros.recommended.name}</strong> — {macros.recommended.reason}.
            {macros.anyBelowFloor && " ⚠ below the floor — boost protein by trimming carbs."}
          </p>
        </section>
        )}

        {/* Phase 99c: Weekly Targets & Expectations — 99d: effective +
            include-tickable */}
        {weeklyTargets && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("weeklyTargets", "Your Weekly Targets & Expectations")}</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 text-center">
              <div className="rounded border border-gray-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Starting point</p>
                <p className="text-lg font-bold">{weeklyTargets.baseline.weightKg != null ? `${weeklyTargets.baseline.weightKg} kg` : "Not recorded yet"}</p>
                <p className="text-[10px] text-gray-500">
                  {weeklyTargets.baseline.bodyFatPct != null ? `${weeklyTargets.baseline.bodyFatPct}% body fat · ` : ""}
                  {weeklyTargets.baseline.recordedAt
                    ? `first logged ${new Date(weeklyTargets.baseline.recordedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                    : "log your first weigh-in"}
                </p>
              </div>
              <div className="rounded border-2 border-gray-900 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-900">The goal</p>
                <p className="text-lg font-bold">{weeklyTargets.goal.targetWeightKg != null ? `${weeklyTargets.goal.targetWeightKg} kg` : weeklyTargets.goal.label}</p>
                <p className="text-[10px] text-gray-600">
                  {[
                    weeklyTargets.goal.targetBodyFatPct != null ? `${weeklyTargets.goal.targetBodyFatPct}% BF` : null,
                    weeklyTargets.goal.targetDate
                      ? `by ${new Date(weeklyTargets.goal.targetDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || weeklyTargets.goal.label}
                </p>
              </div>
            </div>
            {weeklyTargets.weeklyRate && (
              <p className="mt-2 rounded bg-gray-100 px-3 py-2 text-[11px] font-medium">
                Realistic pace: <strong>{weeklyTargets.weeklyRate.label}</strong> — week to week, never day to day.
              </p>
            )}
            {weeklyTargets.goalDateHonestNote && (
              <p className="mt-2 rounded border border-gray-400 px-3 py-2 text-[10px] italic text-gray-700">{weeklyTargets.goalDateHonestNote}</p>
            )}
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">What to expect</p>
            {weeklyTargets.expectations.map((e) => (
              <div key={e.weeks} className="mt-1 flex gap-3">
                <span className="w-20 shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-center text-[9px] font-bold text-white">{e.weeks}</span>
                <div>
                  <p className="text-[11px] font-semibold">{e.focus}</p>
                  <p className="text-[10px] text-gray-600">{e.expectation}</p>
                </div>
              </div>
            ))}
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Wins that aren't the scale</p>
            <ul className="list-inside list-disc text-[10px] text-gray-600">
              {weeklyTargets.nonScaleVictories.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            {weeklyTargets.notes.map((nt) => (
              <p key={nt} className="mt-1.5 text-[10px] italic text-gray-500">{nt}</p>
            ))}
          </section>
        )}

        {/* Phase 80: Dynamic Warm-Up (only when the summary carries
            blueprint extras) */}
        {warmup && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("warmup", "Dynamic Warm-Up & Mobility")}</h2>
            <ol className="mt-1.5 list-inside list-decimal text-[11px]">
              {warmup.steps.map((s) => (
                <li key={s.name}>
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-gray-500"> — {s.muscle}</span>
                </li>
              ))}
            </ol>
            {warmup.note && <p className="mt-1.5 text-[10px] text-gray-500">{warmup.note}</p>}
          </section>
        )}

        {/* 5. Training Plan — 99g: effective (override-merged) sessions +
            rest rules. */}
        {training && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">
            {secTitle("training", `Training Plan (GBC) · ${training.sessions.length} sessions + ${formatNumber(training.stepTarget)} steps/day`)}
          </h2>
          {training.sessions.map((s, i) => (
            <div key={i} className="mt-2">
              <p className="rounded bg-gray-900 px-2.5 py-1 text-[10px] font-bold uppercase text-white">{s.name}</p>
              <table className="mt-0.5 w-full text-[10px]">
                <tbody>
                  {s.blocks.map((b) => (
                    <tr key={b.label} className="border-b border-gray-100">
                      <td className={`${td} w-8 font-mono font-bold`}>{b.label}</td>
                      <td className={`${td} font-medium`}>{b.exercises}</td>
                      <td className={`${td} text-right text-gray-600`}>{b.setsReps}</td>
                      <td className={`${td} text-right text-gray-600`}>{b.tempo}</td>
                      <td className={`${td} text-right text-gray-600`}>rest {b.rest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(s.finisher || s.rounds) && (
                <p className="mt-0.5 text-[10px] font-semibold text-gray-700">{[s.rounds, s.finisher].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          ))}
          <ul className="mt-2 list-inside list-disc text-[10px] text-gray-600">
            {training.restRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {m.trainingMeta && (
            <ul className="mt-1.5 list-inside list-disc border-t border-gray-200 pt-1.5 text-[10px] italic text-gray-500">
              {m.trainingMeta.notes.map((nt) => (
                <li key={nt}>{nt}</li>
              ))}
            </ul>
          )}
        </section>
        )}

        {/* Phase 99c: Cardio — machines, intensity & progression. 99d:
            effective values + include tick. */}
        {cardio && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("cardio", "Cardio — Machines, Intensity & Progression")}</h2>
            {cardio.rows.map((r) => (
              <div key={r.machine + r.protocol} className="mt-2 rounded border border-gray-200 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-bold">{r.machine}</p>
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[8px] font-bold uppercase text-white">{r.difficulty}</span>
                </div>
                <p className="text-[10px] font-semibold text-gray-700">{r.protocol} · {r.basis}</p>
                <p className="text-[10px] text-gray-600">{r.intensity}</p>
                <p className="text-[10px] text-gray-600">{r.schedule}</p>
                <table className="mt-1 w-full text-[9px]">
                  <tbody>
                    {r.progression.map((pg) => (
                      <tr key={pg.label} className="border-b border-gray-100">
                        <td className="px-1 py-0.5 font-semibold text-gray-700">{pg.label}</td>
                        <td className="px-1 py-0.5 text-right text-gray-600">{pg.prescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="mt-2 rounded bg-gray-100 px-3 py-2 text-[11px] font-medium">
              ≈ {cardio.weeklyMinutes} cardio minutes/week · {cardio.stepNote}
            </p>
            {cardio.notes.map((nt) => (
              <p key={nt} className="mt-1 text-[10px] italic text-gray-500">{nt}</p>
            ))}
          </section>
        )}

        {/* Phase 99c: goal-adaptive eating guide — 99d: effective +
            include tick. */}
        {nutritionGuide && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("nutritionGuide", nutritionGuide.title)}</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-700">{nutritionGuide.intro}</p>
            {nutritionGuide.safetyCallout && (
              <p className="mt-2 rounded border border-gray-900 px-3 py-2 text-[11px] font-bold">{nutritionGuide.safetyCallout}</p>
            )}
            {nutritionGuide.blocks.map((b) => (
              <div key={b.heading} className="mt-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-900">{b.heading}</p>
                <ul className="list-inside list-disc text-[10px] text-gray-700">
                  {b.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-900">Who should NOT be in a deficit</p>
            <ul className="list-inside list-disc text-[10px] text-gray-600">
              {nutritionGuide.whoShouldNotCut.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            {nutritionGuide.notes.map((nt) => (
              <p key={nt} className="mt-1.5 text-[10px] italic text-gray-500">{nt}</p>
            ))}
          </section>
        )}

        {/* 6. Sample Day — 99d: effective (override-merged) + tick. */}
        {sampleDay && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("sampleDay", `Sample Day of Eating (${m.recommended.name})`)}</h2>
          <table className="mt-1 w-full text-[10px]">
            <tbody>
              {sampleDay.meals.map((meal) => (
                <tr key={meal.name} className="border-b border-gray-100 align-top">
                  <td className={`${td} w-1/2`}>
                    <p className="font-semibold">{meal.name}</p>
                    <p className="text-gray-500">{meal.items.join(" · ")}</p>
                  </td>
                  <td className={`${td} text-right text-gray-600`}>
                    {meal.macros.kcal} kcal · P{meal.macros.p} C{meal.macros.c} F{meal.macros.f}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className={td}>Day total</td>
                <td className={`${td} text-right`}>
                  {sampleDay.totals.kcal} kcal · P{sampleDay.totals.p} C{sampleDay.totals.c} F{sampleDay.totals.f}
                  {sampleDay.withinTolerance ? " (on target ±5%)" : ""}
                </td>
              </tr>
            </tbody>
          </table>
          <ul className="mt-2 list-inside list-disc text-[10px] text-gray-600">
            {m.foodRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
        )}

        {/* Phase 80: Sample Diet Day (blueprint foods) */}
        {sampleDiet && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("sampleDiet", "Sample Diet Day — Your Foods")}</h2>
            <table className="mt-1 w-full text-[10px]">
              <tbody>
                {sampleDiet.meals.map((meal) => (
                  <tr key={meal.name} className="border-b border-gray-100 align-top">
                    <td className={`${td} w-1/2`}>
                      <p className="font-semibold">{meal.name}</p>
                      <p className="text-gray-500">{meal.items.map((i) => `${i.food} ${i.grams} g`).join(" · ")}</p>
                    </td>
                    <td className={`${td} text-right text-gray-600`}></td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className={td}>Day total</td>
                  <td className={`${td} text-right`}>
                    {sampleDiet.totals.kcal} kcal · P{sampleDiet.totals.proteinG} C{sampleDiet.totals.carbsG} F{sampleDiet.totals.fatsG}
                    {sampleDiet.withinTolerance ? " (within ±10% of target)" : ""}
                  </td>
                </tr>
              </tbody>
            </table>
            {sampleDiet.note && <p className="mt-1.5 text-[10px] text-gray-500">{sampleDiet.note}</p>}
          </section>
        )}

        {/* Phase 80: Supplementation & Hydration */}
        {supplements && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("supplements", "Supplementation & Hydration")}</h2>
            <table className="mt-1 w-full text-[10px]">
              <tbody>
                {supplements.items.map((s) => (
                  <tr key={s.name} className="border-b border-gray-100">
                    <td className={`${td} font-medium`}>{s.name}</td>
                    <td className={`${td} text-right font-semibold`}>{s.dose}</td>
                    <td className={`${td} text-right text-gray-500`}>{s.note}</td>
                  </tr>
                ))}
                <tr className="border-b border-gray-100">
                  <td className={`${td} font-medium`}>Water</td>
                  <td className={`${td} text-right font-semibold`}>
                    {(supplements.hydration.min / 1000).toFixed(1)}–{(supplements.hydration.max / 1000).toFixed(1)} L/day
                  </td>
                  <td className={`${td} text-right text-gray-500`}>30–35 ml per kg bodyweight</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1.5 text-[10px] italic text-gray-500">{supplements.disclaimer}</p>
          </section>
        )}

        {/* 7. Tracking — 99d: effective + tick. */}
        {tracking && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("tracking", "Tracking & Accountability")}</h2>
          <table className="mt-1 w-full text-[10px]">
            <tbody>
              {tracking.map((t) => (
                <tr key={t.what} className="border-b border-gray-100">
                  <td className={`${td} font-medium`}>{t.what}</td>
                  <td className={`${td} text-right font-semibold`}>{t.frequency}</td>
                  <td className={`${td} text-right text-gray-500`}>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        )}

        {/* 8. Roadmap — 99d: effective + tick. */}
        {roadmap && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("roadmap", `Program Roadmap (${m.goal.programWeeks} weeks)`)}</h2>
          {roadmap.map((p) => (
            <div key={p.weeks} className="mt-1.5 flex gap-3">
              <span className="w-14 shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">Wk {p.weeks}</span>
              <div>
                <p className="text-[11px] font-semibold">{p.name}</p>
                <p className="text-[10px] text-gray-600">{p.note}</p>
              </div>
            </div>
          ))}
          {m.outcomes && (
            <p className="mt-2 rounded bg-gray-100 px-3 py-2 text-[11px] font-medium">
              Realistic outcome: {m.outcomes.projectedFatLossKg} kg fat down ({m.outcomes.weeklyLossRange[0]}–{m.outcomes.weeklyLossRange[1]} kg/week) → ~{m.outcomes.endWeightKg} kg{m.outcomes.endBodyFatPct != null ? `, ~${m.outcomes.endBodyFatPct}% BF` : ""} at week {m.goal.programWeeks}.
            </p>
          )}
        </section>
        )}

        {/* 9. FAQ — 99d: effective + tick. */}
        {faq && (
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("faq", "FAQ")}</h2>
          {faq.map((f) => (
            <div key={f.q} className="mt-2">
              <p className="text-[11px] font-bold">{f.q}</p>
              <p className="text-[10px] leading-relaxed text-gray-700">{f.a}</p>
            </div>
          ))}
        </section>
        )}

        {/* Phase 99g Item 2: Coach's Notes — last card, plain paragraphs. */}
        {coachNotes && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{secTitle("coachNotes", "Coach's Notes")}</h2>
            {coachNotes.paragraphs.map((p, i) => (
              <p key={`${i}-${p.slice(0, 24)}`} className="mt-1.5 text-[11px] leading-relaxed text-gray-700">{p}</p>
            ))}
          </section>
        )}

        <footer className="mt-5 border-t border-gray-200 pt-3 text-[10px] text-gray-400">
          <p className="mb-1.5 text-gray-500">{MEDICAL_DISCLAIMER}</p>
          Prepared by {header.trainerName}
          {header.businessName ? ` · ${header.businessName}` : ""} — generated {genDate}. Reviewed together at your next session.
        </footer>
      </div>
    </div>
  );
}
