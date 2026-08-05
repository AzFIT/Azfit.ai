/* ═══════════════════════════════════════════════════════════════════
   Method prescription defaults (Phase 48) — pure parsing + mappings.
   The 30A wizard, 42 manual builder, and the Programs-tab badge all
   consume methods.defaults jsonb through these helpers — never raw.
   ═══════════════════════════════════════════════════════════════════ */

export interface MethodDefaults {
  goalTag: string;
  intensityColor: "green" | "red" | "blue";
  setsReps: string;
  loadPct: string;
  rest: string;
  tempo: string;
  notation: "straight" | "superset" | "triset" | "complex";
  notes: string;
  durationWeeks: number;
  frequencyPerWeek: number;
  idealFor: string[];
  contraindications: string[];
  description?: string;
  periodizationPairings: string[];
  preferredCategories: string[];
}

const INTENSITY_COLORS = new Set(["green", "red", "blue"]);
const NOTATIONS = new Set(["straight", "superset", "triset", "complex"]);

/** Validate + normalize a defaults jsonb value. Returns null when the
 * shape is unusable — callers render as "no defaults" (never fabricate). */
export function parseMethodDefaults(raw: unknown): MethodDefaults | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (
    typeof d.goalTag !== "string" ||
    typeof d.setsReps !== "string" ||
    typeof d.tempo !== "string" ||
    typeof d.rest !== "string" ||
    typeof d.loadPct !== "string" ||
    !INTENSITY_COLORS.has(d.intensityColor as string) ||
    !NOTATIONS.has(d.notation as string) ||
    typeof d.durationWeeks !== "number" ||
    typeof d.frequencyPerWeek !== "number"
  ) {
    return null;
  }
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    goalTag: d.goalTag,
    intensityColor: d.intensityColor as MethodDefaults["intensityColor"],
    setsReps: d.setsReps,
    loadPct: d.loadPct,
    rest: d.rest,
    tempo: d.tempo,
    notation: d.notation as MethodDefaults["notation"],
    notes: typeof d.notes === "string" ? d.notes : "",
    durationWeeks: d.durationWeeks,
    frequencyPerWeek: d.frequencyPerWeek,
    idealFor: strArr(d.idealFor),
    contraindications: strArr(d.contraindications),
    ...(typeof d.description === "string" ? { description: d.description } : {}),
    periodizationPairings: strArr(d.periodizationPairings),
    preferredCategories: strArr(d.preferredCategories),
  };
}

/** Map defaults.notation → the 30C pairing style (supersets.ts):
 * superset → pairs, triset → triples, straight/complex → no auto-pairs.
 * (complex currently falls back to no auto-pairs — documented.) */
export function notationToPairing(
  notation: MethodDefaults["notation"],
): "pairs" | "triples" | null {
  if (notation === "superset") return "pairs";
  if (notation === "triset") return "triples";
  return null;
}

/** Load guidance when no 1RM is known: rep range → RPE window
 * (documented mapping: ≤6 reps → RPE 8–9; 7–10 → 7–8; 11–15 → 6–7; 16+ → 5–6). */
export function rpeForRepRange(reps: string): string {
  const m = reps.match(/(\d+)/g);
  const top = m ? Math.max(...m.map(Number)) : 12;
  if (top <= 6) return "RPE 8–9";
  if (top <= 10) return "RPE 7–8";
  if (top <= 15) return "RPE 6–7";
  return "RPE 5–6";
}

/** The Step-6 load hint: %1RM when the defaults carry one, else the RPE
 * fallback derived from the rep range (unknown-1RM case). */
export function loadHint(d: MethodDefaults, has1RM: boolean): string {
  if (has1RM && /%/.test(d.loadPct)) return `start ~${d.loadPct} 1RM`;
  return `${rpeForRepRange(d.setsReps)} · rest ${d.rest}`;
}

/** Accent color per intensity (theme-safe in both modes — same accents
 * already used app-wide). */
export const INTENSITY_HEX: Record<MethodDefaults["intensityColor"], string> = {
  green: "#22C55E",
  red: "#EF4444",
  blue: "#00AEEF",
};

export interface ExercisePrefill {
  sets: number;
  reps: string;
  tempo: string;
  rest: string; // m:ss
}

/** Best-effort exercise defaults from a method's setsReps text (wizard
 * add-exercise + manual builder prefill). Only simple parseable forms
 * produce a prefill — "ladder", "variable", "to failure" etc. return
 * null and the caller keeps its existing defaults (never fabricated).
 * Supported: "N×M" (10×10), "A–B × C–D" (4–6 × 8–12), "A–B circuits of
 * C–D" (GBC), "N exercises × C–D" (trisets → 3 rounds). */
export function deriveExerciseDefaults(d: MethodDefaults): ExercisePrefill | null {
  const rest = restToMmSs(d.rest);
  const simple = d.setsReps.match(/(\d+)\s*[×x]\s*(\d+)$/);
  if (simple) return { sets: Number(simple[1]), reps: simple[2], tempo: d.tempo, rest };
  const exercisesForm = d.setsReps.match(/(\d+)\s*exercises?\s*×\s*(\d+)–(\d+)/i);
  if (exercisesForm) {
    return { sets: 3, reps: `${exercisesForm[2]}-${exercisesForm[3]}`, tempo: d.tempo, rest };
  }
  const range = d.setsReps.match(/(\d+)–(\d+)\D+(\d+)–(\d+)/);
  if (range) {
    return { sets: Number(range[1]), reps: `${range[3]}-${range[4]}`, tempo: d.tempo, rest };
  }
  return null;
}

/** "60–90s" → "1:00" (low end), "2–3 min" → "2:00", unparseable → "2:00". */
function restToMmSs(rest: string): string {
  const sec = rest.match(/(\d+)\s*(?:–\d+\s*)?s\b/);
  if (sec) {
    const s = Number(sec[1]);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  const min = rest.match(/(\d+)\s*(?:–\s*\d+\s*)?min/);
  if (min) return `${min[1]}:00`;
  return "2:00";
}
