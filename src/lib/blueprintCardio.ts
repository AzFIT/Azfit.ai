/* ═══════════════════════════════════════════════════════════════
   blueprintCardio (Phase 99c Item 2) — rule-based cardio
   prescriptions for the Plan Summary. Machines are gated by the
   client's equipment access; every row carries a difficulty label,
   an intensity prescription (RPE + talk test), a time/distance
   basis, and a 4-week progression. Pure + deterministic — no DB.
   ═══════════════════════════════════════════════════════════════ */

import type { EquipmentAccess } from "./planBlueprintInput";
import { isFatLossGoal } from "./planBlueprint";

export type CardioGoalKind = "fat_loss" | "strength" | "fitness";

export interface CardioRow {
  machine: string;
  protocol: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  /** honest intensity prescription — RPE scale + talk test */
  intensity: string;
  /** time or distance basis, e.g. "25–30 min" / "6 × 200 m" */
  basis: string;
  schedule: string;
  progression: { label: string; prescription: string }[];
}

export interface CardioPlan {
  rows: CardioRow[];
  weeklyMinutes: number;
  stepNote: string;
  notes: string[];
}

/* ── Machine availability by equipment access (rule-based) ───── */
const MACHINE_POOL: { machine: string; access: EquipmentAccess[]; kinds: CardioGoalKind[] }[] = [
  { machine: "Treadmill (incline walk)", access: ["full_gym", "home_gym_bb_db"], kinds: ["fat_loss", "fitness", "strength"] },
  { machine: "Exercise bike", access: ["full_gym", "home_gym_bb_db", "dumbbells_only"], kinds: ["fat_loss", "fitness", "strength"] },
  { machine: "Rowing machine", access: ["full_gym", "home_gym_bb_db"], kinds: ["fitness", "fat_loss"] },
  { machine: "Stair climber", access: ["full_gym"], kinds: ["fat_loss", "fitness"] },
  { machine: "Elliptical", access: ["full_gym"], kinds: ["strength", "fat_loss", "fitness"] },
  { machine: "Outdoor walk / brisk walk", access: ["full_gym", "home_gym_bb_db", "dumbbells_only", "bodyweight_only"], kinds: ["fat_loss", "fitness", "strength"] },
  { machine: "Sprints / hill repeats (outdoor)", access: ["full_gym", "home_gym_bb_db", "dumbbells_only", "bodyweight_only"], kinds: ["fitness", "fat_loss"] },
  { machine: "Swimming", access: ["full_gym"], kinds: ["fitness", "fat_loss", "strength"] },
];

const LISS_RPE = "RPE 4–5 · can hold a full conversation";
const MOD_RPE = "RPE 6–7 · short sentences only";
const HARD_RPE = "RPE 8–9 · a few words at a time";

/** Beginners: durations scaled to 75% and capped one difficulty tier
 *  lower — progression stays honest, never jumps a level. */
function scale(min: number, beginner: boolean): number {
  return beginner ? Math.round(min * 0.75) : min;
}

function lissRow(machine: string, minutes: number, beginner: boolean, schedule: string): CardioRow {
  const m = scale(minutes, beginner);
  const diff: CardioRow["difficulty"] = beginner ? "Beginner" : "Intermediate";
  return {
    machine,
    protocol: "LISS — steady-state low intensity",
    difficulty: diff,
    intensity: LISS_RPE,
    basis: `${m}–${m + 5} min`,
    schedule,
    progression: [
      { label: "Weeks 1–2", prescription: `${m} min, flat or low incline` },
      { label: "Weeks 3–4", prescription: `${m + 5} min or add a small incline` },
      { label: "Weeks 5–6", prescription: `${m + 10} min / incline up 1–2 levels` },
      { label: "Weeks 7+", prescription: `Hold ${m + 10} min; add load before speed` },
    ],
  };
}

function intervalRow(machine: string, reps: number, workSec: number, restSec: number, beginner: boolean, schedule: string): CardioRow {
  const r = beginner ? Math.max(4, Math.round(reps * 0.75)) : reps;
  const w = beginner ? Math.max(15, workSec - 5) : workSec;
  return {
    machine,
    protocol: "Intervals — high-intensity repeats",
    difficulty: beginner ? "Beginner" : "Advanced",
    intensity: `${w}s work: ${HARD_RPE} · ${restSec}s recovery: ${LISS_RPE}`,
    basis: `${r} × ${w}s on / ${restSec}s off`,
    schedule,
    progression: [
      { label: "Weeks 1–2", prescription: `${Math.max(4, r - 2)} × ${w}s / ${restSec}s` },
      { label: "Weeks 3–4", prescription: `${r} × ${w}s / ${restSec}s` },
      { label: "Weeks 5–6", prescription: `${r} × ${w + 5}s / ${restSec}s` },
      { label: "Weeks 7+", prescription: `${r + 1} × ${w + 5}s / ${restSec - 10}s` },
    ],
  };
}

function distanceRow(machine: string, distanceM: number, beginner: boolean, schedule: string): CardioRow {
  const d = beginner ? Math.round(distanceM * 0.75) : distanceM;
  return {
    machine,
    protocol: "Tempo — controlled hard distance",
    difficulty: beginner ? "Beginner" : "Intermediate",
    intensity: MOD_RPE,
    basis: `${d} m continuous`,
    schedule,
    progression: [
      { label: "Weeks 1–2", prescription: `${d} m at steady pace` },
      { label: "Weeks 3–4", prescription: `${d} m, 5% faster split` },
      { label: "Weeks 5–6", prescription: `${Math.round(d * 1.15)} m` },
      { label: "Weeks 7+", prescription: `${Math.round(d * 1.3)} m or faster split` },
    ],
  };
}

export function buildCardioPlan(input: {
  goalType: string;
  equipmentAccess: EquipmentAccess | null;
  sessionsPerWeek: number;
  stepTarget: number;
  experience: "beginner" | "intermediate" | "advanced";
}): CardioPlan {
  const notes: string[] = [];
  const beginner = input.experience === "beginner";
  const kind: CardioGoalKind = isFatLossGoal(input.goalType) ? "fat_loss" : input.goalType === "improve_fitness" ? "fitness" : "strength";

  const available = MACHINE_POOL.filter(
    (m) => (!input.equipmentAccess || m.access.includes(input.equipmentAccess)) && m.kinds.includes(kind),
  );
  if (available.length === 0) {
    notes.push("No machines match this equipment access and goal — cardio defaults to brisk walking.");
    available.push(MACHINE_POOL.find((m) => m.machine.startsWith("Outdoor walk"))!);
  }

  const rows: CardioRow[] = [];
  const at = (i: number) => available[i % available.length].machine;

  if (kind === "fat_loss") {
    rows.push(lissRow(at(0), 30, beginner, "2×/week — after lifting or on rest days"));
    if (available.length > 1) rows.push(lissRow(at(1), 25, beginner, "1×/week — active recovery day"));
    rows.push(intervalRow(at(available.length > 2 ? 2 : 0), 8, 30, 60, beginner, "1×/week — separate from lifting"));
  } else if (kind === "fitness") {
    rows.push(intervalRow(at(0), 10, 30, 60, beginner, "2×/week"));
    rows.push(distanceRow(at(available.length > 1 ? 1 : 0), 2000, beginner, "1×/week"));
    if (available.length > 2) rows.push(lissRow(at(2), 20, beginner, "1×/week — recovery"));
  } else {
    // strength / muscle: cardio supports recovery, never interferes
    rows.push(lissRow(at(0), 20, beginner, "1–2×/week — away from leg days"));
    if (available.length > 1) rows.push(lissRow(at(1), 15, beginner, "optional — rest-day flush"));
    notes.push("Strength goal: cardio is deliberately low-intensity to protect recovery and progress.");
  }

  // Weekly minutes from the time-based rows (intervals ≈ reps × (work+rest) + warmup)
  const weeklyMinutes = rows.reduce((sum, r) => {
    const range = r.basis.match(/(\d+)–(\d+) min/);
    if (range) return sum + (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2 * (r.schedule.startsWith("2×") ? 2 : 1);
    const reps = r.basis.match(/(\d+) × (\d+)s/);
    if (reps) return sum + Math.ceil((parseInt(reps[1], 10) * (parseInt(reps[2], 10) + 60) + 600) / 60);
    return sum;
  }, 0);

  const stepNote = `Daily steps: ${input.stepTarget.toLocaleString()} — walking counts as cardio; hit the target before adding more machine work.`;

  if (input.sessionsPerWeek <= 2) {
    notes.push("Low training frequency — keep cardio after sessions rather than adding extra days.");
  }
  return { rows, weeklyMinutes: Math.round(weeklyMinutes), stepNote, notes };
}
