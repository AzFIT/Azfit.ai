/* ═══════════════════════════════════════════════════════════════
   blueprintTraining (Phase 99c Item 1) — taxonomy-driven session
   builder for the Plan Summary. Replaces the hardcoded GBC templates
   (planBlueprint.buildGbcPlan) whenever the 52B exercise taxonomy is
   available, giving every generated summary real exercise VARIETY:
   no exercise repeats across sessions, equipment access gates what
   can appear, injury keywords exclude flagged patterns, and solo
   sessions are Beginner-only with basic, safe movements.

   Pure + deterministic (seeded PRNG, default seed 42). Rule-based
   ONLY — every exercise name traces to exercise_library.
   Falls back (returns null) when the taxonomy is empty so the caller
   keeps the legacy hardcoded plan, marked varied:false.
   ═══════════════════════════════════════════════════════════════ */

import type { EquipmentAccess } from "./planBlueprintInput";
import { EQUIPMENT_TIERS, parseInjuries, type LibraryExercise } from "./planSummaryExtras";
import type { GbcBlock, GbcSession } from "./planBlueprint";

/* ── Seeded PRNG (same mulberry32 as trainingEditor — copied small,
   not refactored, to keep this module standalone & pure) ─────── */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Muscle → movement family ──────────────────────────────────
   Live primary_muscle labels include compounds ("Quads/Glutes",
   "Back/Biceps", "Chest/Triceps") — split on "/" and map each part.
   Unmapped parts contribute no family (never throws on odd data). */
export type MoveFamily = "legs" | "hinge" | "glutes" | "push" | "pull" | "core" | "full";

const MUSCLE_FAMILY: Record<string, MoveFamily> = {
  quadriceps: "legs",
  quads: "legs",
  legs: "legs",
  adductors: "legs",
  shins: "legs",
  calves: "legs",
  tibialis: "legs",
  "posterior chain": "hinge",
  hamstrings: "hinge",
  "lower back": "hinge",
  spinal: "hinge",
  erectors: "hinge",
  glutes: "glutes",
  butt: "glutes",
  chest: "push",
  "upper chest": "push",
  "lower chest": "push",
  shoulders: "push",
  delts: "push",
  deltoids: "push",
  triceps: "push",
  serratus: "push",
  back: "pull",
  "upper back": "pull",
  lats: "pull",
  traps: "pull",
  "rear delts": "pull",
  biceps: "pull",
  forearms: "pull",
  grip: "pull",
  "rotator cuff": "pull",
  abs: "core",
  core: "core",
  obliques: "core",
  "spinal flexibility": "core",
  "full body": "full",
  cardio: "full",
  power: "full",
  "shoulder mobility": "full",
};

/** Families of every mapped muscle part in a primary_muscle label. */
export function familiesOf(primaryMuscle: string | null): MoveFamily[] {
  if (!primaryMuscle) return [];
  const out = new Set<MoveFamily>();
  for (const part of primaryMuscle.split("/")) {
    const fam = MUSCLE_FAMILY[part.trim().toLowerCase()];
    if (fam) out.add(fam);
  }
  return [...out];
}

/* ── Input / output ──────────────────────────────────────────── */
export interface VariedTrainingInput {
  trainerSessionsPerWeek: number;
  soloSessionsPerWeek: number;
  equipmentAccess: EquipmentAccess | null;
  injuriesNotes: string;
  isFatLoss: boolean;
}

export interface TaxonomyExerciseLike extends LibraryExercise {
  difficulty?: string | null;
}

export interface VariedTrainingResult {
  varied: true;
  seed: number;
  sessions: GbcSession[];
  /** honest builder notes surfaced in the report (injury filters,
   *  pool-size warnings, difficulty fallbacks) */
  notes: string[];
}

type SlotType = "compound" | "isolation";
type SlotFamily = MoveFamily | "legs_iso" | "arms_iso";

interface SlotSpec {
  family: SlotFamily;
  type: SlotType;
}

/** Trainer-session templates: 2 antagonist compound pairs + an
 *  isolation pair. Focuses rotate deterministically per session. */
const FOCUS_TEMPLATES: { name: string; slots: [SlotSpec, SlotSpec][] }[] = [
  {
    name: "Full Body",
    slots: [
      [{ family: "legs", type: "compound" }, { family: "push", type: "compound" }],
      [{ family: "hinge", type: "compound" }, { family: "pull", type: "compound" }],
      [{ family: "core", type: "isolation" }, { family: "push", type: "isolation" }],
    ],
  },
  {
    name: "Lower Emphasis",
    slots: [
      [{ family: "legs", type: "compound" }, { family: "pull", type: "compound" }],
      [{ family: "hinge", type: "compound" }, { family: "push", type: "compound" }],
      [{ family: "legs_iso", type: "isolation" }, { family: "core", type: "isolation" }],
    ],
  },
  {
    name: "Upper Emphasis",
    slots: [
      [{ family: "push", type: "compound" }, { family: "legs", type: "compound" }],
      [{ family: "pull", type: "compound" }, { family: "hinge", type: "compound" }],
      [{ family: "push", type: "isolation" }, { family: "pull", type: "isolation" }],
    ],
  },
];

const SOLO_FAMILIES: SlotFamily[] = ["legs", "push", "pull", "hinge", "core"];
const BARBELL_RE = /barbell/i;
const EXCLUDED_TYPES = /olympic|plyo/i;

function specMatches(ex: TaxonomyExerciseLike, spec: SlotSpec): boolean {
  const fams = familiesOf(ex.primary_muscle);
  const familyOk =
    spec.family === "legs_iso"
      ? fams.some((f) => f === "legs" || f === "hinge" || f === "glutes")
      : spec.family === "arms_iso"
        ? fams.includes("push") || fams.includes("pull")
        : fams.includes(spec.family);
  if (!familyOk) return false;
  const type = (ex.exercise_type ?? "").toLowerCase();
  if (EXCLUDED_TYPES.test(type)) return false;
  return spec.type === "compound" ? type === "compound" : type !== "compound";
}

export function buildVariedSessions(
  input: VariedTrainingInput,
  taxonomy: TaxonomyExerciseLike[],
  opts: { seed?: number } = {},
): VariedTrainingResult | null {
  const pool = taxonomy.filter((ex) => ex.name && ex.name.trim().length > 0);
  if (pool.length === 0) return null;

  const seed = opts.seed ?? 42;
  const rng = mulberry32(seed);
  const notes: string[] = [];

  const gate = input.equipmentAccess ? EQUIPMENT_TIERS[input.equipmentAccess] : null;
  const eligible = pool.filter((ex) => !gate || gate(ex.equipment));

  const injury = parseInjuries(input.injuriesNotes ?? "");
  const flaggedFamilies = new Set<MoveFamily>();
  for (const m of injury.flaggedMuscles) {
    const fam = MUSCLE_FAMILY[m.trim().toLowerCase()];
    if (fam) flaggedFamilies.add(fam);
    else notes.push(`Injury note "${m}" isn't a mapped muscle group — exercises naming it were still excluded.`);
  }
  const injurySafe = eligible.filter((ex) => {
    const fams = familiesOf(ex.primary_muscle);
    return !fams.some((f) => flaggedFamilies.has(f));
  });
  if (injury.matchedKeywords.length > 0) {
    notes.push(
      `Injury keywords detected (${injury.matchedKeywords.join(", ")}) — exercises loading those patterns were excluded; review the selections against the client's clearance.`,
    );
  }
  if (injury.unrecognizedNote) notes.push(injury.unrecognizedNote);
  if (injurySafe.length < eligible.length) {
    notes.push(`${eligible.length - injurySafe.length} library exercises filtered out by the injury gate.`);
  }

  const used = new Set<string>();
  const key = (ex: TaxonomyExerciseLike) => ex.id || ex.name;

  /* Widening order: unused same-slot match → unused other exercise →
   * reuse (with an honest note). Deterministic: candidates sorted by
   * name, index picked via the seeded rng. */
  function pick(spec: SlotSpec, soloSafeOnly: boolean): { name: string; reused: boolean } {
    const candidates = injurySafe
      .filter((ex) => specMatches(ex, spec))
      .filter((ex) => !soloSafeOnly || !BARBELL_RE.test(ex.equipment ?? ""));
    const fresh = candidates.filter((ex) => !used.has(key(ex))).sort((a, b) => a.name.localeCompare(b.name));
    if (fresh.length === 0) {
      const anyFresh = injurySafe.filter((ex) => !used.has(key(ex))).sort((a, b) => a.name.localeCompare(b.name));
      if (anyFresh.length > 0) {
        const ex = anyFresh[Math.floor(rng() * anyFresh.length)];
        used.add(key(ex));
        notes.push(`Small equipment/injury pool — "${ex.name}" was selected outside its target pattern.`);
        return { name: ex.name, reused: false };
      }
      const reusedPool = candidates.length > 0 ? candidates : injurySafe;
      const ex = reusedPool[Math.floor(rng() * reusedPool.length)];
      notes.push(`Library too small for full variety — "${ex.name}" repeats across sessions.`);
      return { name: ex.name, reused: true };
    }
    const ex = fresh[Math.floor(rng() * fresh.length)];
    used.add(key(ex));
    return { name: ex.name, reused: false };
  }

  const sessions: GbcSession[] = [];

  for (let i = 0; i < Math.max(0, input.trainerSessionsPerWeek); i++) {
    const tpl = FOCUS_TEMPLATES[i % FOCUS_TEMPLATES.length];
    const rotation = i >= FOCUS_TEMPLATES.length ? ` (rotation ${Math.floor(i / FOCUS_TEMPLATES.length) + 1})` : "";
    const labels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const blocks: GbcBlock[] = [];
    tpl.slots.forEach(([s1, s2], pairIdx) => {
      const first = pairIdx < 2;
      blocks.push({
        label: labels[pairIdx * 2],
        exercises: pick(s1, false).name,
        setsReps: first ? "3 × 10–12" : "2 × 12–15",
        tempo: first ? (s1.family === "legs" || s1.family === "hinge" ? "4010" : "3010") : "2010",
        rest: first ? "30s" : "30s",
      });
      blocks.push({
        label: labels[pairIdx * 2 + 1],
        exercises: pick(s2, false).name,
        setsReps: first ? "3 × 10–12" : "2 × 12–15",
        tempo: first ? (s2.family === "legs" || s2.family === "hinge" ? "4010" : "3010") : "2010",
        rest: first ? "60s" : "60s",
      });
    });
    sessions.push({
      name: `Session ${String.fromCharCode(65 + i)} — ${tpl.name} (trainer)${rotation}`,
      kind: "trainer",
      blocks,
      finisher: pickFinisher(input, rng, notes),
    });
  }

  for (let i = 0; i < Math.max(0, input.soloSessionsPerWeek); i++) {
    const labels = ["1", "2", "3", "4", "5"];
    const beginnerPool = injurySafe.filter(
      (ex) => (ex.difficulty ?? "") === "Beginner" && !BARBELL_RE.test(ex.equipment ?? "") && !EXCLUDED_TYPES.test(ex.exercise_type ?? ""),
    );
    const soloPool = beginnerPool.length >= SOLO_FAMILIES.length ? beginnerPool : null;
    if (!soloPool) {
      notes.push(
        "Not enough Beginner-only exercises for a fully safe solo circuit — some Intermediate non-barbell moves were included. Review before the client trains alone.",
      );
    }
    const local = soloPool ?? injurySafe.filter((ex) => !BARBELL_RE.test(ex.equipment ?? ""));
    const blocks: GbcBlock[] = SOLO_FAMILIES.map((fam, idx) => {
      const spec: SlotSpec = { family: fam, type: fam === "core" ? "isolation" : "compound" };
      const candidates = local
        .filter((ex) => specMatches(ex, spec) || (fam === "hinge" && specMatches(ex, { family: "glutes", type: "compound" })))
        .filter((ex) => (soloPool ? true : (ex.difficulty ?? "") !== "Advanced"))
        .sort((a, b) => a.name.localeCompare(b.name));
      const fresh = candidates.filter((ex) => !used.has(key(ex)));
      const pool2 = fresh.length > 0 ? fresh : candidates;
      const chosen = pool2.length > 0 ? pool2[Math.floor(rng() * pool2.length)] : null;
      if (chosen) used.add(key(chosen));
      const repsByFamily: Record<string, string> = { legs: "× 12", push: "× 8–12", pull: "× 10/side", hinge: "× 15", core: "× 8/side" };
      if (!chosen) notes.push(`No safe solo exercise found for the "${fam}" pattern in this equipment/injury setup — the coach should hand-pick this slot.`);
      return {
        label: labels[idx],
        exercises: chosen?.name ?? "— coach to select —",
        setsReps: repsByFamily[fam] ?? "× 12",
        tempo: "controlled",
        rest: "—",
      };
    });
    sessions.push({
      name: `Solo Circuit — basic & safe (${input.equipmentAccess === "bodyweight_only" ? "home, bodyweight" : "home/gym"})${i > 0 ? ` ${i + 1}` : ""}`,
      kind: "solo",
      blocks,
      finisher: "10-min easy incline walk to finish",
      rounds: "3 rounds · 60–75s between rounds",
    });
  }

  if (notes.length === 0) notes.push("Sessions built from the exercise library — no repeats within this plan.");
  return { varied: true, seed, sessions, notes };
}

/* ── Finishers ───────────────────────────────────────────────── */
const FINISHERS = {
  inclineWalk: "Incline walk — 10 min, conversational pace",
  sled: "Sled push — 6 × 30s on / 60s off",
  farmer: "Farmer's carry — 2 × 40 m",
  bike: "Air bike — 8 × 20s hard / 70s easy",
} as const;

function pickFinisher(input: VariedTrainingInput, rng: () => number, notes: string[]): string {
  const options: string[] = [FINISHERS.inclineWalk];
  if (input.equipmentAccess === "full_gym") options.push(FINISHERS.sled, FINISHERS.bike);
  if (input.equipmentAccess === "dumbbells_only" || input.equipmentAccess === "home_gym_bb_db" || input.equipmentAccess === "full_gym")
    options.push(FINISHERS.farmer);
  if (input.equipmentAccess === "bodyweight_only") options.push(FINISHERS.bike);
  if (!input.equipmentAccess) notes.push("No equipment access on file — finishers default to the safest options.");
  // Fat-loss plans bias toward the incline walk; otherwise rotate.
  if (input.isFatLoss) return FINISHERS.inclineWalk;
  return options[Math.floor(rng() * options.length)];
}
