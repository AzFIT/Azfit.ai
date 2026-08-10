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
  const a = m.assessment;
  const n = (k: number) => k + (m.femaleReassurance ? 1 : 0);
  const genDate = new Date(m.header.generatedIso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      <style>{`
        @page { size: A4; margin: 11mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .pack-section { page-break-inside: avoid; }
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
        {/* Header */}
        <header className="border-b-2 border-gray-900 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-black tracking-tight">
                Az<span className="text-[#00AEEF]">FIT</span>
              </p>
              <h1 className="mt-1 text-2xl font-bold">Your Plan Summary</h1>
              <p className="mt-1 text-sm text-gray-600">
                Prepared for <strong className="text-gray-900">{clientName}</strong> by {m.header.trainerName}
                {m.header.businessName ? ` · ${m.header.businessName}` : ""}
              </p>
            </div>
            <p className="text-right text-xs text-gray-500">{genDate}</p>
          </div>
        </header>

        {/* 1. Starting Assessment */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(1)} · Starting Assessment</h2>
          <table className="mt-1 w-full text-[11px]">
            <tbody>
              {[
                ["Weight", `${a.weightKg} kg`],
                ["Height", `${a.heightCm} cm`],
                ["BMI", String(a.bmi)],
                ["Body fat", a.bodyFatPct != null ? `${a.bodyFatPct}%` : "—"],
                ["Fat mass", a.fatMassKg != null ? `${a.fatMassKg} kg` : "—"],
                ["Lean mass", a.leanMassKg != null ? `${a.leanMassKg} kg` : "—"],
                [`BMR (${a.bmrMethod === "katch-mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"})`, `${formatNumber(a.bmr)} kcal`],
                ["Maintenance calories", `${formatNumber(a.maintenance)} kcal`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-100">
                  <td className={`${td} font-medium`}>{k}</td>
                  <td className={`${td} text-right font-semibold`}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 rounded bg-gray-100 px-3 py-2 text-[11px] font-medium">Goal: {m.goal.statement}</p>
        </section>

        {/* 2. Female reassurance */}
        {m.femaleReassurance && (
          <section className={sec}>
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">2 · A note before we start</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-700">
              You will NOT bulk up. Women carry roughly 1/10 to 1/20 of the testosterone men do, and in a calorie deficit there is simply no surplus to build size from. Lifting weights in a deficit makes you smaller and firmer — "toned" is just muscle plus less fat. The strength work in this plan is what keeps your shape while the fat comes off.
            </p>
          </section>
        )}

        {/* 3. Calorie Targets */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(2)} · Calorie Targets</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 text-center">
            <div className="rounded border border-gray-200 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Maintenance</p>
              <p className="text-xl font-bold">{formatNumber(m.calories.maintenance)}</p>
              <p className="text-[10px] text-gray-500">kcal / day</p>
            </div>
            <div className="rounded border-2 border-gray-900 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-900">Your target</p>
              <p className="text-xl font-bold">{formatNumber(m.calories.target)}</p>
              <p className="text-[10px] text-gray-600">
                {m.goal.isFatLoss ? `${Math.round(m.calories.deficitPct * 100)}% deficit · ~${m.outcomes?.weeklyLossKg} kg/week` : "at maintenance"}
              </p>
            </div>
          </div>
          {m.calories.clampedByFloor && (
            <p className="mt-2 text-[10px] italic text-gray-600">
              Note: your target was raised to the safety floor (BMR × 1.05 / 1,200 kcal) — a deeper deficit would cost muscle.
            </p>
          )}
        </section>

        {/* 4. Macro tables */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(3)} · Macro Targets — All Options</h2>
          {[
            { title: `At your target (${formatNumber(m.calories.target)} kcal)`, grams: (s: BlueprintResult["macroStyles"][number]) => s.atTarget, flags: true },
            { title: `At maintenance (${formatNumber(m.calories.maintenance)} kcal)`, grams: (s: BlueprintResult["macroStyles"][number]) => s.atMaintenance, flags: false },
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
                  {m.macroStyles.map((s) => {
                    const g = tbl.grams(s);
                    const rec = s.key === m.recommended.key;
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
            Protein floor: {m.proteinFloor.grams} g ({m.proteinFloor.basis}). Recommended: <strong>{m.recommended.name}</strong> — {m.recommended.reason}.
            {m.macroStyles.some((s) => s.atTarget.belowFloor) && " ⚠ below the floor — boost protein by trimming carbs."}
          </p>
        </section>

        {/* 5. Training Plan */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">
            {n(4)} · Training Plan (GBC) · {m.training.sessions.length} sessions + {formatNumber(m.training.stepTarget)} steps/day
          </h2>
          {m.training.sessions.map((s, i) => (
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
            {m.training.restRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        {/* 6. Sample Day */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(5)} · Sample Day of Eating ({m.recommended.name})</h2>
          <table className="mt-1 w-full text-[10px]">
            <tbody>
              {m.sampleDay.meals.map((meal) => (
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
                  {m.sampleDay.totals.kcal} kcal · P{m.sampleDay.totals.p} C{m.sampleDay.totals.c} F{m.sampleDay.totals.f}
                  {m.sampleDay.withinTolerance ? " (on target ±5%)" : ""}
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

        {/* 7. Tracking */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(6)} · Tracking & Accountability</h2>
          <table className="mt-1 w-full text-[10px]">
            <tbody>
              {m.tracking.map((t) => (
                <tr key={t.what} className="border-b border-gray-100">
                  <td className={`${td} font-medium`}>{t.what}</td>
                  <td className={`${td} text-right font-semibold`}>{t.frequency}</td>
                  <td className={`${td} text-right text-gray-500`}>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 8. Roadmap */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(7)} · Program Roadmap ({m.goal.programWeeks} weeks)</h2>
          {m.roadmap.map((p) => (
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

        {/* 9. FAQ */}
        <section className={sec}>
          <h2 className="border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide">{n(8)} · FAQ</h2>
          {m.faq.map((f) => (
            <div key={f.q} className="mt-2">
              <p className="text-[11px] font-bold">{f.q}</p>
              <p className="text-[10px] leading-relaxed text-gray-700">{f.a}</p>
            </div>
          ))}
        </section>

        <footer className="mt-5 border-t border-gray-200 pt-3 text-[10px] text-gray-400">
          Prepared by {m.header.trainerName}
          {m.header.businessName ? ` · ${m.header.businessName}` : ""} — generated {genDate}. Reviewed together at your next session.
        </footer>
      </div>
    </div>
  );
}
