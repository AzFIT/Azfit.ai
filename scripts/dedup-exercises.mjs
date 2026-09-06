#!/usr/bin/env node
/**
 * Phase 72 — Exercise library dedup: SAFE-tier merge only.
 *
 * Parses the AUTHORITATIVE "## SAFE to auto-merge" table from
 * docs/exercise-dedup-report.md (do not re-derive duplicates), validates every
 * pair against the LIVE database (both codes must exist and names must match
 * the report — a disagreement skips the pair, never forces it), then emits
 * supabase/dedup-exercises.sql: one transaction, one existence-guarded DO
 * block per pair (idempotent — a second run is a no-op).
 *
 * Per pair (keep <- absorb):
 *   a) metadata merge: fill NULL/empty keep content columns from the absorb
 *      row (never overwrite existing keep content);
 *   b) junction merge: copy absorb's muscle/equipment tags to keep
 *      (ON CONFLICT DO NOTHING — composite PKs dedupe);
 *   c) repoint trial_assessment_items to keep;
 *   d) delete the absorb row (its remaining junction rows cascade).
 *
 * USAGE
 *   DEDUP_PG_URL="postgresql://user:pass@host:5432/postgres" \
 *     node scripts/dedup-exercises.mjs
 *   → writes supabase/dedup-exercises.sql + prints a per-pair report.
 *
 * The script NEVER applies the SQL itself — apply via the pooler runner.
 * No secrets in this file.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_FILE = join(ROOT, "docs/exercise-dedup-report.md");
const OUT_FILE = join(ROOT, "supabase/dedup-exercises.sql");

/* ── Parse the SAFE table from the report ──────────────────── */

function parseSafePairs(md) {
  const section = md.split("## SAFE to auto-merge")[1]?.split("## ")[0];
  if (!section) throw new Error("SAFE section not found in report");
  const pairs = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("| EX")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // ['', 'EX0018 Dips', 'EX0267 Dips', 'canon name', 'notes', '']
    const keepMatch = cells[1].match(/^(EX\d{4})\s+(.+)$/);
    const absorbMatch = cells[2].match(/^(EX\d{4})\s+(.+)$/);
    if (!keepMatch || !absorbMatch) continue;
    pairs.push({
      keepCode: keepMatch[1],
      keepName: keepMatch[2],
      absorbCode: absorbMatch[1],
      absorbName: absorbMatch[2],
      canon: cells[3],
    });
  }
  return pairs;
}

/* ── Live validation ───────────────────────────────────────── */

async function validatePairs(pairs, client) {
  const codes = [...new Set(pairs.flatMap((p) => [p.keepCode, p.absorbCode]))];
  const { rows } = await client.query(
    "SELECT code, name FROM public.exercise_library WHERE code = ANY($1)",
    [codes],
  );
  const live = new Map(rows.map((r) => [r.code, r.name]));

  const valid = [];
  const skipped = [];
  for (const p of pairs) {
    const keepLive = live.get(p.keepCode);
    const absorbLive = live.get(p.absorbCode);
    if (keepLive === undefined || absorbLive === undefined) {
      skipped.push({ ...p, reason: `missing row (keep ${keepLive === undefined ? "absent" : "ok"}, absorb ${absorbLive === undefined ? "absent" : "ok"})` });
    } else if (keepLive !== p.keepName || absorbLive !== p.absorbName) {
      skipped.push({ ...p, reason: `name mismatch (report "${p.keepName}"/"${p.absorbName}", live "${keepLive}"/"${absorbLive}")` });
    } else {
      valid.push(p);
    }
  }
  return { valid, skipped };
}

/* ── SQL emission ──────────────────────────────────────────── */

function emitPairBlock(p) {
  return `
DO $$
DECLARE
  keep_id uuid;
  absorb_id uuid;
BEGIN
  SELECT id INTO keep_id FROM public.exercise_library WHERE code = '${p.keepCode}';
  SELECT id INTO absorb_id FROM public.exercise_library WHERE code = '${p.absorbCode}';
  IF keep_id IS NULL OR absorb_id IS NULL THEN
    RAISE NOTICE 'dedup72: SKIP ${p.keepCode}/${p.absorbCode} (row missing — already merged or renamed)';
    RETURN;
  END IF;

  -- (a) metadata merge: fill NULL/empty keep content columns from absorb; never overwrite
  UPDATE public.exercise_library k
  SET
    primary_muscle   = COALESCE(NULLIF(k.primary_muscle, ''), a.primary_muscle),
    secondary_muscle = COALESCE(NULLIF(k.secondary_muscle, ''), a.secondary_muscle),
    equipment        = COALESCE(NULLIF(k.equipment, ''), a.equipment),
    difficulty       = COALESCE(k.difficulty, a.difficulty),
    exercise_type    = COALESCE(NULLIF(k.exercise_type, ''), a.exercise_type),
    type             = COALESCE(NULLIF(k.type, ''), a.type),
    met_value        = COALESCE(k.met_value, a.met_value),
    description      = COALESCE(NULLIF(k.description, ''), a.description),
    safety_notes     = COALESCE(NULLIF(k.safety_notes, ''), a.safety_notes),
    youtube_url      = COALESCE(NULLIF(k.youtube_url, ''), a.youtube_url),
    image_url        = COALESCE(NULLIF(k.image_url, ''), a.image_url),
    updated_at       = now()
  FROM public.exercise_library a
  WHERE k.id = keep_id AND a.id = absorb_id;

  -- (b) junction merge: unique absorb tags survive (composite PKs dedupe)
  INSERT INTO public.exercise_library_muscles (exercise_library_id, muscle_name, is_primary)
  SELECT keep_id, m.muscle_name, m.is_primary
  FROM public.exercise_library_muscles m
  WHERE m.exercise_library_id = absorb_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.exercise_library_equipment (exercise_library_id, equipment_type_id)
  SELECT keep_id, e.equipment_type_id
  FROM public.exercise_library_equipment e
  WHERE e.exercise_library_id = absorb_id
  ON CONFLICT DO NOTHING;

  -- (c) repoint non-junction FK references
  UPDATE public.trial_assessment_items
  SET exercise_library_id = keep_id
  WHERE exercise_library_id = absorb_id;

  -- (d) delete absorb row (its remaining junction rows cascade)
  DELETE FROM public.exercise_library WHERE id = absorb_id;
  RAISE NOTICE 'dedup72: merged ${p.absorbCode} -> ${p.keepCode} (${p.canon})';
END $$;`;
}

function emitSql(pairs) {
  const header = `-- Phase 72: exercise library dedup — SAFE-tier auto-merge
-- Generated by scripts/dedup-exercises.mjs from docs/exercise-dedup-report.md
-- ("## SAFE to auto-merge" table, ${pairs.length} validated pairs).
-- One transaction: any error rolls the whole run back.
-- Idempotent: every pair is existence-guarded; a second run is a no-op.
-- Referencing tables handled (discovered via pg_constraint, Phase 72 Step 1):
--   exercise_library_muscles / exercise_library_equipment (composite-PK junctions,
--   ON DELETE CASCADE) and trial_assessment_items (repointed before delete).
-- workout_log_entries.exercise_id references public.exercises (program rows),
-- NOT exercise_library — verified; name snapshots stay valid (exact-name pairs).
BEGIN;
`;
  return header + pairs.map(emitPairBlock).join("\n") + "\nCOMMIT;\n";
}

/* ── Main ──────────────────────────────────────────────────── */

const run = async () => {
  const url = process.env.DEDUP_PG_URL;
  if (!url) throw new Error("DEDUP_PG_URL env var required (read-only validation only)");

  const md = readFileSync(REPORT_FILE, "utf8");
  const pairs = parseSafePairs(md);
  console.log(`Parsed ${pairs.length} SAFE pairs from the report`);

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { valid, skipped } = await validatePairs(pairs, client);

  // Capture absorb ids before the merge (for post-run reference-integrity checks)
  const absorbCodes = valid.map((p) => p.absorbCode);
  const { rows: absorbIds } = await client.query(
    "SELECT code, id FROM public.exercise_library WHERE code = ANY($1) ORDER BY code",
    [absorbCodes],
  );
  const { rows: beforeCount } = await client.query(
    "SELECT count(*)::int AS n FROM public.exercise_library",
  );
  await client.end();

  writeFileSync(OUT_FILE, emitSql(valid), "utf8");

  console.log(`\nValidated: ${valid.length} pairs → ${OUT_FILE}`);
  for (const s of skipped) {
    console.log(`  SKIP ${s.keepCode}/${s.absorbCode}: ${s.reason}`);
  }
  console.log(`\nLibrary rows before: ${beforeCount[0].n}`);
  console.log(`Absorb ids (${absorbIds.length}):`);
  console.log(absorbIds.map((r) => `${r.code}=${r.id}`).join("\n"));
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
