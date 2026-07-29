#!/usr/bin/env node
/**
 * Seed exercise_library from the in-code EXERCISE_CATEGORIES (Phase 31A).
 * ~458 unique exercises across 11 categories.
 *
 * USAGE
 *   Emit idempotent SQL (preferred — apply via pooler/migration runner):
 *     node scripts/seed-exercise-library.mjs --emit-sql > supabase/seed-exercise-library.sql
 *   Upsert via Supabase REST (needs env, NO secrets in this file):
 *     SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
 *       node scripts/seed-exercise-library.mjs
 *
 * IDEMPOTENT: upsert on slug (ON CONFLICT (slug) DO UPDATE) — safe to run twice.
 *
 * MAPPING (documented per the phase brief)
 *   code/exercise_code : 'EX' + zero-padded index — stable order: category
 *                        (file order), then exercises, then alternatives,
 *                        alphabetical within each list.
 *   slug               : slugified name; collisions get -2, -3, …
 *   primary_muscle     : per-category map (PRIMARY_MUSCLE below).
 *   secondary_muscle   : pressing→Triceps, pulling→Biceps, posterior→Glutes,
 *                        delt_scap→Upper Back, everything else NULL.
 *   equipment          : the 30D inferEquipment regexes, copied here on purpose
 *                        (no app-code imports in a runnable script).
 *   difficulty         : 'Beginner' on the generator's beginner-friendly regex,
 *                        'Advanced' on the extreme-variation regex, else 'Intermediate'.
 *   exercise_type      : Isolation (biceps/triceps/delt_scap/target_areas),
 *                        Compound (pressing/pulling/bilateral_quad/unilateral_quad/posterior),
 *                        Core (bracing/metcon_bracing).
 *   safety_notes       : 'Contraindicated: <limitation>' when the name hits an
 *                        'exclude'-severity row from src/data/exerciseSafety.ts
 *                        (keyword lists copied: Lower back pain, Cardiovascular condition).
 *   description/youtube_url/image_url/met_value : NULL (honest — not available).
 *   exercise_library_muscles / exercise_library_equipment joins: SKIPPED in v1
 *   (flat columns satisfy all constraints; equipment_types has 0 rows).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = join(ROOT, "src/data/exerciseDatabase.ts");

/* ── Category → muscle maps (documented) ───────────────────── */
const PRIMARY_MUSCLE = {
  pressing: "Chest",
  pulling: "Back",
  bilateral_quad: "Quadriceps",
  unilateral_quad: "Quadriceps",
  posterior: "Posterior Chain",
  delt_scap: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  bracing: "Core",
  metcon_bracing: "Core",
  target_areas: "Full Body",
};
const SECONDARY_MUSCLE = {
  pressing: "Triceps",
  pulling: "Biceps",
  posterior: "Glutes",
  delt_scap: "Upper Back",
};
const EXERCISE_TYPE = {
  biceps: "Isolation",
  triceps: "Isolation",
  delt_scap: "Isolation",
  target_areas: "Isolation",
  pressing: "Compound",
  pulling: "Compound",
  bilateral_quad: "Compound",
  unilateral_quad: "Compound",
  posterior: "Compound",
  bracing: "Core",
  metcon_bracing: "Core",
};

/** 'exclude'-severity contraindications (copied from src/data/exerciseSafety.ts). */
const EXCLUDE_CONTRAINDICATIONS = [
  { limitation: "lower back pain", keywords: ["deadlift", "good morning", "bent over row", "back squat", "overhead press"] },
  { limitation: "cardiovascular condition", keywords: ["hiit", "sprint", "burpee", "sled"] },
];

const BEGINNER_RE = /machine|smith|chest press|leg press|lat pulldown|seated row|leg curl|leg extension|calf raise|plank/i;
const ADVANCED_RE = /chain|band|fat grip|from pins|lockout|board|slingshot/i;

/* ── Equipment inference (copied from src/lib/previewMetrics.ts) ── */
function inferEquipment(name) {
  const n = name.toLowerCase();
  if (/dumbbell|\bdb\b/.test(n)) return "Dumbbells";
  if (/barbell|\bbb\b/.test(n)) return "Barbell";
  if (/cable/.test(n)) return "Cable";
  if (/machine|smith|leg press|hack/.test(n)) return "Machines";
  if (/pull[- ]?up|chin|push[- ]?up|plank|dip\b|bear crawl/.test(n)) return "Bodyweight/Rack";
  return "Other";
}

/* ── Parse EXERCISE_CATEGORIES out of the TS source (deterministic state machine) ── */
function parseCategories(src) {
  const lines = src.split("\n").map((l) => l.replace(/\r$/, ""));
  const categories = [];
  let current = null;
  let listName = null;
  for (const line of lines) {
    const idMatch = line.match(/^\s*id: '([a-z_]+)',/);
    if (idMatch) {
      current = { id: idMatch[1], exercises: [], alternatives: [] };
      categories.push(current);
      listName = null;
      continue;
    }
    if (!current) continue;
    if (/^\s*exercises: \[\]$/.test(line)) continue;
    if (/^\s*exercises: \[$/.test(line)) { listName = "exercises"; continue; }
    if (/^\s*alternatives: \[\]$/.test(line)) { listName = null; continue; }
    if (/^\s*alternatives: \[$/.test(line)) { listName = "alternatives"; continue; }
    if (listName && /^\s*\],?$/.test(line)) { listName = null; continue; }
    if (listName) {
      const nameMatch = line.match(/^\s*'(.*)',?\s*$/);
      if (nameMatch) current[listName].push(nameMatch[1]);
    }
  }
  return categories;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildRows(categories) {
  const rows = [];
  const slugCounts = new Map();
  let index = 0;
  for (const cat of categories) {
    const ordered = [
      ...[...cat.exercises].sort(),
      ...[...cat.alternatives].sort(),
    ];
    for (const name of ordered) {
      index += 1;
      const base = slugify(name);
      const seen = (slugCounts.get(base) ?? 0) + 1;
      slugCounts.set(base, seen);
      const slug = seen === 1 ? base : `${base}-${seen}`;
      const code = `EX${String(index).padStart(4, "0")}`;
      const lower = name.toLowerCase();
      const contra = EXCLUDE_CONTRAINDICATIONS.filter((c) =>
        c.keywords.some((k) => lower.includes(k))
      );
      rows.push({
        code,
        exercise_code: code,
        slug,
        name,
        equipment: inferEquipment(name),
        primary_muscle: PRIMARY_MUSCLE[cat.id] ?? "Other",
        secondary_muscle: SECONDARY_MUSCLE[cat.id] ?? null,
        difficulty: BEGINNER_RE.test(name) ? "Beginner" : ADVANCED_RE.test(name) ? "Advanced" : "Intermediate",
        exercise_type: EXERCISE_TYPE[cat.id] ?? "Other",
        safety_notes: contra.length > 0 ? contra.map((c) => `Contraindicated: ${c.limitation}`).join("; ") : null,
        is_active: true,
      });
    }
  }
  return rows;
}

/* ── Output: idempotent SQL ────────────────────────────────── */
function emitSql(rows) {
  const esc = (v) => (v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
  const values = rows
    .map(
      (r) =>
        `  (${esc(r.code)}, ${esc(r.exercise_code)}, ${esc(r.slug)}, ${esc(r.name)}, ${esc(r.equipment)}, ${esc(r.primary_muscle)}, ${esc(r.secondary_muscle)}, ${esc(r.difficulty)}, ${esc(r.exercise_type)}, ${esc(r.safety_notes)}, ${r.is_active})`
    )
    .join(",\n");
  return `-- ============================================================
-- Phase 31A: seed exercise_library from EXERCISE_CATEGORIES (${rows.length} rows)
-- Generated by scripts/seed-exercise-library.mjs --emit-sql
-- Idempotent: upsert on slug — safe to apply more than once.
-- ============================================================

INSERT INTO public.exercise_library
  (code, exercise_code, slug, name, equipment, primary_muscle, secondary_muscle, difficulty, exercise_type, safety_notes, is_active)
VALUES
${values}
ON CONFLICT (slug) DO UPDATE SET
  code = EXCLUDED.code,
  exercise_code = EXCLUDED.exercise_code,
  name = EXCLUDED.name,
  equipment = EXCLUDED.equipment,
  primary_muscle = EXCLUDED.primary_muscle,
  secondary_muscle = EXCLUDED.secondary_muscle,
  difficulty = EXCLUDED.difficulty,
  exercise_type = EXCLUDED.exercise_type,
  safety_notes = EXCLUDED.safety_notes,
  is_active = EXCLUDED.is_active;
`;
}

/* ── Output: REST upsert (env-keyed) ───────────────────────── */
async function upsertRest(rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required for REST mode");
    process.exit(1);
  }
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${url}/rest/v1/exercise_library?on_conflict=slug`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`REST upsert failed at chunk ${i / CHUNK + 1}: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log(`upserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
}

/* ── Main ──────────────────────────────────────────────────── */
const categories = parseCategories(readFileSync(DB_FILE, "utf8"));
const rows = buildRows(categories);

// sanity guards (fail loudly rather than seeding garbage)
const dupSlugs = rows.length - new Set(rows.map((r) => r.slug)).size;
const dupCodes = rows.length - new Set(rows.map((r) => r.code)).size;
const empties = rows.filter((r) => !r.code || !r.slug || !r.name || !r.equipment || !r.primary_muscle);
if (categories.length === 0 || dupSlugs > 0 || dupCodes > 0 || empties.length > 0) {
  console.error("guard failed", { categories: categories.length, dupSlugs, dupCodes, empties: empties.length });
  process.exit(1);
}

const perCategory = categories
  .map((c) => `${c.id}=${c.exercises.length + c.alternatives.length}`)
  .join(", ");

if (process.argv.includes("--emit-sql")) {
  process.stdout.write(emitSql(rows));
  console.error(`emitted ${rows.length} rows (${perCategory})`);
} else {
  console.log(`seeding ${rows.length} rows (${perCategory})`);
  await upsertRest(rows);
  console.log("done");
}
