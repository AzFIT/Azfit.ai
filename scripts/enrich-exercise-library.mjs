#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Phase 52A — exercise_library enrichment from the owner's Excel.
   Reads scripts/data/AzFIT_Database_Restructured.xlsx (EXERCISES sheet
   only) and emits supabase/seed-exercise-enrichment.sql:
   - MATCHED rows (exact/normalized, then equipment-stripped unique):
     per-field UPDATE … WHERE the field IS NULL — never overwrites.
   - UNMATCHED rows: INSERT new rows (EX#### continuing the max, slug
     collision-suffixed) with ON CONFLICT (slug) DO NOTHING — reruns
     insert nothing.
   - Is_Active=false rows are skipped entirely (0 in this file).
   Live state is read via the local .temp/apply-sql.mjs helper (keeps
   credentials out of this committed script). Regenerate with:
     node scripts/enrich-exercise-library.mjs
   (requires the dev-only `xlsx` package: npm i --no-save xlsx)
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import xlsx from "xlsx";

const XLSX = "scripts/data/AzFIT_Database_Restructured.xlsx";
const OUT = "supabase/seed-exercise-enrichment.sql";

const sql = (q) => execSync(`node .temp/apply-sql.mjs "" "${q.replace(/"/g, '\\"')}"`, { encoding: "utf8" }).trim();
const rowsOf = (q) => JSON.parse(sql(q));

/* ── live library state ── */
const libRows = rowsOf("select id, code, slug, name from exercise_library order by code;");
const maxCode = libRows.reduce((m, r) => Math.max(m, Number(String(r.code).replace(/^EX/, "")) || 0), 0);
const slugs = new Set(libRows.map((r) => r.slug));

const norm = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const canon = (s) =>
  norm(s)
    .replace(/\bbarbell\b/g, "bb")
    .replace(/\bdumbbells?\b/g, "db")
    .replace(/\bkettlebell\b/g, "kb")
    .replace(/\bbodyweight\b/g, "bw")
    .trim();
const STRIP_RE = /^(bb|db|kb|cable|machine)\s+/;
const stripEquip = (s) => canon(s).replace(STRIP_RE, "");

const byCanon = new Map();
const byStripped = new Map();
for (const r of libRows) {
  for (const [map, key] of [[byCanon, canon(r.name)], [byStripped, stripEquip(r.name)]]) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
}

/* ── Excel ── */
const wb = xlsx.read(readFileSync(XLSX));
const sheet = wb.Sheets["EXERCISES"];
if (!sheet) throw new Error("EXERCISES sheet not found");
const excel = xlsx.utils.sheet_to_json(sheet);

const slugify = (name) => {
  const base = norm(name).replace(/\s+/g, "-");
  let s = base;
  for (let i = 2; slugs.has(s); i++) s = `${base}-${i}`;
  slugs.add(s);
  return s;
};

const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;
const orNull = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? "null" : esc(s);
};
const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== "" ? String(n) : "null";
};

const matched = [];
const inserted = [];
const ambiguous = [];
const skippedInactive = [];
const statements = [];

const FILL_FIELDS = [
  ["description", "Description", esc],
  ["safety_notes", "Safety_Notes", esc],
  ["youtube_url", "Video_URL", esc],
  ["met_value", "MET_Value", numOrNull],
  ["secondary_muscle", "Secondary_Muscle", esc],
  ["exercise_type", "Type", esc],
  ["primary_muscle", "Primary_Muscle", esc],
  ["equipment", "Equipment", esc],
  ["difficulty", "Difficulty", esc],
];
// difficulty is a USER-DEFINED enum (difficulty_level) — btrim() doesn't
// apply to enums, so its NULL check is is-null only (text fields also
// accept empty-string as empty).
const ENUM_COLS = new Set(["difficulty", "met_value"]);

for (const r of excel) {
  const name = String(r.Name ?? "").trim();
  if (!name) continue;
  if (String(r.Is_Active ?? "").toLowerCase() === "false") {
    skippedInactive.push(name);
    continue;
  }

  let hits = byCanon.get(canon(name)) || [];
  if (hits.length === 0) {
    const k = stripEquip(name);
    const stripped = byStripped.get(k) || [];
    const excelShare = excel.filter((x) => stripEquip(String(x.Name ?? "").trim()) === k).length;
    if (stripped.length === 1 && excelShare === 1) hits = stripped;
  }

  if (hits.length > 1) {
    ambiguous.push(name);
    continue;
  }

  if (hits.length === 1) {
    // matched → per-field NULL-fill UPDATE by id (never overwrites)
    const id = hits[0].id;
    for (const [col, xKey, fmt] of FILL_FIELDS) {
      const val = fmt(r[xKey]);
      if (val === "null") continue;
      const nullCond = ENUM_COLS.has(col) ? `${col} is null` : `(${col} is null or btrim(${col}) = '')`;
      statements.push(
        `update public.exercise_library set ${col} = ${val} where id = '${id}' and ${nullCond};`,
      );
    }
    matched.push(`${name} → ${hits[0].name}`);
    continue;
  }

  // unmatched → insert (idempotent via slug conflict guard)
  const slug = slugify(name);
  const code = `EX${String(maxCode + inserted.length + 1).padStart(4, "0")}`;
  statements.push(
    `insert into public.exercise_library (code, exercise_code, slug, name, equipment, primary_muscle, secondary_muscle, difficulty, exercise_type, met_value, description, safety_notes, youtube_url, is_active)\n` +
      `select ${esc(code)}, ${esc(code)}, ${esc(slug)}, ${esc(name)}, ${orNull(r.Equipment)}, ${orNull(r.Primary_Muscle)}, ${orNull(r.Secondary_Muscle)}, ${orNull(r.Difficulty)}, ${orNull(r.Type)}, ${numOrNull(r.MET_Value)}, ${orNull(r.Description)}, ${orNull(r.Safety_Notes)}, ${orNull(r.Video_URL)}, true\n` +
      `where not exists (select 1 from public.exercise_library where slug = ${esc(slug)});`,
  );
  inserted.push(name);
}

const sqlOut = `-- Phase 52A — exercise_library enrichment from AzFIT_Database_Restructured.xlsx.
-- Generated by scripts/enrich-exercise-library.mjs — regenerate, don't hand-edit.
-- NULL-fill only (never overwrites); inserts guarded by slug existence.
-- Matched ${matched.length} · inserted ${inserted.length} · ambiguous skipped ${ambiguous.length} · inactive-in-Excel skipped ${skippedInactive.length}.

${statements.join("\n\n")}
`;

writeFileSync(OUT, sqlOut);
console.log(`wrote ${OUT}`);
console.log(`matched+fill: ${matched.length} · inserted: ${inserted.length} · ambiguous: ${ambiguous.length} · inactive: ${skippedInactive.length}`);
console.log(`statements: ${statements.length}`);
