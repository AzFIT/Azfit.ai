/* ═══════════════════════════════════════════════════════════════
   trainingEditor (Phase 81 Item 1) — pure, deterministic editing of
   a Plan Summary GbcSession (Phase 61 training module). Documented
   choice: NEW file (the 61 engine + 80 extras stay untouched).

   Rules enforced here (unit-tested):
   · regenerateSession re-rolls ONLY the exercise names from real
     exercise_library rows, matched by each slot's taxonomy pattern
     (primary muscle → pattern via exerciseTaxonomy). Superset
     labels/structure/setsReps/tempo/rest are byte-identical; zero
     duplicate names within the session; unknown exercises keep
     their slot with an honest note.
   · Pair ops work on PAIRS (A1/A2 …) — never an orphaned single
     row. Numeric-labeled solo circuits (Phase 61 Session C) have
     NO pair structure → pair ops are unsupported there (honest
     null, the UI disables the buttons with a note).
   · updateRow validates tempo/rest/setsReps formats. Tempo allows
     [0-9Xx]{4} because the 61 template itself uses "40X0".
   ═══════════════════════════════════════════════════════════════ */

import type { GbcSession, GbcBlock } from "./planBlueprint";
import { patternForExercise, type MusclePattern, type TaxonomyExercise } from "./exerciseTaxonomy";

/* ── Label parsing ───────────────────────────────────────────── */

export interface PairKey {
  letter: string; // 'A' | 'B' | 'C' …
  num: number; // 1 | 2
}

export function parsePairKey(label: string): PairKey | null {
  const m = /^([A-Z])(\d)$/.exec(label.trim());
  return m ? { letter: m[1], num: Number(m[2]) } : null;
}

/** Pair-labeled sessions (A1/A2 …) support pair ops; numeric solo
 *  circuits return null (honest: no pair structure to edit). */
export function sessionSupportsPairs(session: GbcSession): boolean {
  return session.blocks.length > 0 && session.blocks.every((b) => parsePairKey(b.label) !== null);
}

export interface SessionPair {
  letter: string;
  blocks: [GbcBlock, GbcBlock];
}

export function pairsOf(session: GbcSession): SessionPair[] | null {
  if (!sessionSupportsPairs(session)) return null;
  const out: SessionPair[] = [];
  for (let i = 0; i < session.blocks.length; i += 2) {
    const a = session.blocks[i];
    const b = session.blocks[i + 1];
    if (!a || !b) return null;
    out.push({ letter: parsePairKey(a.label)!.letter, blocks: [a, b] });
  }
  return out;
}

const LETTERS = "ABCDEFGHIJ";

function relabel(blocks: GbcBlock[]): GbcBlock[] {
  return blocks.map((b, i) => ({
    ...b,
    label: `${LETTERS[Math.floor(i / 2)]}${(i % 2) + 1}`,
  }));
}

/* ── insert / remove ─────────────────────────────────────────── */

/** Insert a fresh pair AFTER the pair containing afterLabel. New
 *  rows start with EMPTY exercises (honest placeholder — save-time
 *  validation requires the trainer to pick real exercises). */
export function insertPair(session: GbcSession, afterLabel: string): GbcSession | null {
  const pairs = pairsOf(session);
  if (!pairs) return null;
  const key = parsePairKey(afterLabel);
  if (!key) return null;
  const idx = pairs.findIndex((p) => p.letter === key.letter);
  if (idx === -1) return null;
  const fresh: SessionPair = {
    letter: "_",
    blocks: [
      { label: "_1", exercises: "", setsReps: "3 × 10–12", tempo: "3010", rest: "30s" },
      { label: "_2", exercises: "", setsReps: "3 × 10–12", tempo: "3010", rest: "60s" },
    ],
  };
  const next = [...pairs];
  next.splice(idx + 1, 0, fresh);
  return { ...session, blocks: relabel(next.flatMap((p) => p.blocks)) };
}

/** Remove a whole pair by its letter; relabels subsequent pairs.
 *  Guard: a session always keeps ≥1 pair (removing the last pair
 *  returns null — the UI confirms before calling). */
export function removePair(session: GbcSession, letter: string): GbcSession | null {
  const pairs = pairsOf(session);
  if (!pairs) return null;
  if (pairs.length <= 1) return null;
  const next = pairs.filter((p) => p.letter !== letter);
  if (next.length === pairs.length) return null;
  return { ...session, blocks: relabel(next.flatMap((p) => p.blocks)) };
}

/* ── updateRow ───────────────────────────────────────────────── */

export interface RowPatch {
  exercises?: string;
  setsReps?: string;
  tempo?: string;
  rest?: string;
}

export interface RowValidation {
  valid: boolean;
  errors: string[];
}

export function validateRowPatch(patch: RowPatch): RowValidation {
  const errors: string[] = [];
  if (patch.exercises !== undefined && patch.exercises.trim().length === 0) {
    errors.push("Exercise is required");
  }
  if (patch.setsReps !== undefined && patch.setsReps.trim().length === 0) {
    errors.push("Sets × reps is required");
  }
  if (patch.tempo !== undefined && !/^[0-9x]{4}$|^(controlled|slow)$/i.test(patch.tempo.trim())) {
    errors.push("Tempo: 4 chars (e.g. 3010, 40X0) or 'controlled'/'slow'");
  }
  if (patch.rest !== undefined && !/^\d+s$|^—$/.test(patch.rest.trim())) {
    errors.push("Rest: seconds like '30s' or '—'");
  }
  return { valid: errors.length === 0, errors };
}

export function updateRow(session: GbcSession, label: string, patch: RowPatch): GbcSession | null {
  const v = validateRowPatch(patch);
  if (!v.valid) return null;
  const idx = session.blocks.findIndex((b) => b.label === label);
  if (idx === -1) return null;
  const blocks = session.blocks.map((b, i) =>
    i === idx
      ? {
          ...b,
          exercises: patch.exercises !== undefined ? patch.exercises.trim() : b.exercises,
          setsReps: patch.setsReps !== undefined ? patch.setsReps.trim() : b.setsReps,
          tempo: patch.tempo !== undefined ? patch.tempo.trim() : b.tempo,
          rest: patch.rest !== undefined ? patch.rest.trim() : b.rest,
        }
      : b,
  );
  return { ...session, blocks };
}

/* ── regenerateSession ───────────────────────────────────────── */

/** Deterministic PRNG (mulberry32) — seedable for tests. */
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

export interface RegenerateResult {
  session: GbcSession;
  notes: string[];
}

/** Re-roll every slot's exercise from exercise_library rows whose
 *  taxonomy pattern matches the CURRENT slot exercise. Structure
 *  (labels/setsReps/tempo/rest/finisher) is preserved byte-for-byte;
 *  no duplicate names; slots whose current exercise isn't in the
 *  library keep their value with an honest note. */
export function regenerateSession(
  session: GbcSession,
  taxonomy: TaxonomyExercise[],
  opts: { seed?: number } = {},
): RegenerateResult {
  const rand = mulberry32(opts.seed ?? 42);
  const byName = new Map(taxonomy.map((e) => [e.name.trim().toLowerCase(), e]));
  const byPattern = new Map<MusclePattern, TaxonomyExercise[]>();
  for (const e of taxonomy) {
    const p = patternForExercise(e.primary_muscle, e.secondary_muscle);
    const list = byPattern.get(p) ?? [];
    list.push(e);
    byPattern.set(p, list);
  }

  const used = new Set<string>();
  const notes: string[] = [];
  const blocks = session.blocks.map((b) => {
    const current = byName.get(b.exercises.trim().toLowerCase());
    if (!current) {
      if (b.exercises.trim().length > 0) {
        notes.push(`'${b.exercises}' (${b.label}) isn't in the exercise library — kept as-is.`);
      }
      return b; // unknown or empty slot: keep (empty stays empty — validation flags it on save)
    }
    const pattern = patternForExercise(current.primary_muscle, current.secondary_muscle);
    // match the slot's muscle ROLE: same primary muscle preferred,
    // same taxonomy pattern as fallback (documented in the header)
    const sameMuscle = taxonomy.filter(
      (e) =>
        e.primary_muscle === current.primary_muscle &&
        !used.has(e.name) &&
        e.name !== b.exercises,
    );
    const samePattern = (byPattern.get(pattern) ?? []).filter(
      (e) => !used.has(e.name) && e.name !== b.exercises,
    );
    const pool = sameMuscle.length > 0 ? sameMuscle : samePattern;
    if (pool.length === 0) {
      notes.push(`No unused ${pattern} exercises left for ${b.label} — kept '${b.exercises}'.`);
      used.add(b.exercises);
      return b;
    }
    const pick = pool[Math.floor(rand() * pool.length)];
    used.add(pick.name);
    return { ...b, exercises: pick.name };
  });

  return { session: { ...session, blocks }, notes };
}

/* ── save-time validation (the whole session) ────────────────── */

export function validateSession(session: GbcSession): RowValidation {
  const errors: string[] = [];
  for (const b of session.blocks) {
    const v = validateRowPatch({
      exercises: b.exercises,
      setsReps: b.setsReps,
      tempo: b.tempo,
      rest: b.rest,
    });
    for (const e of v.errors) errors.push(`${b.label}: ${e}`);
  }
  const names = session.blocks.map((b) => b.exercises.trim().toLowerCase()).filter(Boolean);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length > 0) errors.push(`Duplicate exercise in this session: ${dupes[0]}`);
  return { valid: errors.length === 0, errors };
}
