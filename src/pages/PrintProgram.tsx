// ═══════════════════════════════════════════════════════════════
// PrintProgram (Phase 34) — ink-friendly printable program sheet.
// Saved program: /print/program/:programId
// Wizard draft:  /print/program/draft (model via sessionStorage)
// Export = browser window.print() → "Save as PDF" (zero deps).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildPrintModel, type PrintProgram } from "@/lib/programPrint";
import type { Database } from "@/types/supabase";

type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

const DRAFT_KEY = "azfit-print-draft";

export default function PrintProgramPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [model, setModel] = useState<PrintProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (programId === "draft") {
        try {
          const raw = sessionStorage.getItem(DRAFT_KEY);
          if (raw) setModel(JSON.parse(raw) as PrintProgram);
          else setError("No draft found — build a program in the wizard first.");
        } catch {
          setError("Couldn't read the draft program.");
        }
        setLoading(false);
        return;
      }
      if (!programId) {
        setError("No program specified.");
        setLoading(false);
        return;
      }

      // Saved program: rows + client name + trainer display name
      const { data: program, error: pErr } = await supabase
        .from("programs")
        .select("*")
        .eq("id", programId)
        .maybeSingle();
      if (pErr || !program) {
        if (!cancelled) {
          setError("Program not found.");
          setLoading(false);
        }
        return;
      }
      const { data: workouts } = await supabase
        .from("workouts")
        .select("*")
        .eq("program_id", program.id);
      const workoutIds = (workouts ?? []).map((w) => w.id);
      const { data: exercises } = workoutIds.length
        ? await supabase.from("exercises").select("*").in("workout_id", workoutIds)
        : { data: [] as ExerciseRow[] };
      let clientName = "Unassigned";
      if (program.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("full_name")
          .eq("id", program.client_id)
          .maybeSingle();
        if (client?.full_name) clientName = client.full_name;
      }
      const { data: trainerName } = await supabase.rpc("get_trainer_display_name", {
        p_trainer_id: program.trainer_id,
      });
      if (!cancelled) {
        setModel(
          buildPrintModel(
            program as ProgramRow,
            (workouts ?? []) as WorkoutRow[],
            (exercises ?? []) as ExerciseRow[],
            clientName,
            typeof trainerName === "string" && trainerName ? trainerName : "AzFIT Trainer"
          )
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#00AEEF]" />
      </div>
    );
  }
  if (error || !model) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-white p-6 text-center text-gray-800">
        <p className="text-sm">{error ?? "Nothing to print."}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-[#00AEEF] underline">
          ← Back
        </button>
      </div>
    );
  }

  const dateBits = [
    model.createdDate ? `Created ${model.createdDate}` : null,
    model.startDate && model.endDate ? `${model.startDate} → ${model.endDate}` : model.startDate ? `Starts ${model.startDate}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      {/* Print rules: A4, hide the toolbar, avoid splitting a day card */}
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .day-card { page-break-inside: avoid; }
      `}</style>

      {/* On-screen toolbar (never printed) */}
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

      {/* Sheet */}
      <div className="mx-auto max-w-[190mm] px-6 py-6">
        {/* Header */}
        <header className="border-b-2 border-gray-900 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">AzFIT</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight">{model.title}</h1>
            </div>
            <div className="text-right text-[11px] leading-5 text-gray-600">
              <p><span className="font-semibold text-gray-900">Client:</span> {model.clientName}</p>
              <p><span className="font-semibold text-gray-900">Coach:</span> {model.trainerName}</p>
              {dateBits.map((d) => (
                <p key={d}>{d}</p>
              ))}
            </div>
          </div>
          {model.phaseNames.length > 0 && (
            <p className="mt-1.5 text-[11px] text-gray-600">
              <span className="font-semibold text-gray-900">Phases:</span> {model.phaseNames.join(" → ")}
            </p>
          )}
        </header>

        {/* Days */}
        {model.days.map((day) => (
          <section key={day.label} className="day-card mt-4 break-inside-avoid">
            <h2 className="rounded bg-gray-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {day.label}
            </h2>
            <table className="mt-1.5 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-gray-400 text-left text-gray-500">
                  <th className="w-10 py-1 pr-2 font-semibold">Ord</th>
                  <th className="py-1 pr-2 font-semibold">Exercise</th>
                  <th className="w-20 py-1 pr-2 font-semibold">Sets × Reps</th>
                  <th className="w-16 py-1 pr-2 font-semibold">Tempo</th>
                  <th className="w-12 py-1 pr-2 font-semibold">Rest</th>
                  <th className="py-1 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((ex, i) => (
                  <tr key={`${ex.order}-${ex.name}-${i}`} className="border-b border-gray-200">
                    <td className="py-1 pr-2 font-mono font-bold text-gray-900">{ex.order}</td>
                    <td className="py-1 pr-2 font-medium text-gray-900">{ex.name}</td>
                    <td className="py-1 pr-2 tabular-nums">{ex.setsReps}</td>
                    <td className="py-1 pr-2 font-mono">{ex.tempo ?? ""}</td>
                    <td className="py-1 pr-2 font-mono">{ex.rest ?? ""}</td>
                    <td className="py-1 text-gray-600">{ex.notes.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {/* Footer */}
        <footer className="mt-6 border-t border-gray-300 pt-3">
          {model.progressionRules.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Progression</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-gray-700">
                {model.progressionRules.map((r) => (
                  <li key={r.label}>
                    <span className="font-semibold">{r.label}</span> — {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-gray-400">
            Generated by AzFIT · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </footer>
      </div>
    </div>
  );
}
