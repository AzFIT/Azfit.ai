#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   Phase 52B — taxonomy backfill generator.
   Reads scripts/data/AzFIT_Database_Restructured.xlsx (EQUIPMENT +
   MUSCLE_GROUPS sheets) + the LIVE exercise_library via the local
   .temp/apply-sql.mjs helper, and emits supabase/seed-taxonomy.sql:
     1. equipment_types seed (46 rows from the Excel EQUIPMENT sheet)
     2. exercise_library_equipment backfill (library equipment text
        → equipment_types, slash-combos split into multiple rows)
     3. exercise_library_muscles backfill (primary_muscle → is_primary
        true, secondary_muscle → false; names validated against the
        Excel MUSCLE_GROUPS list — unknowns reported, never forced)
   All inserts are WHERE-NOT-EXISTS guarded: re-runs change zero rows.
   Regenerate: node scripts/seed-taxonomy.mjs
   (requires the dev-only xlsx package: npm i --no-save xlsx)
   ═══════════════════════════════════════════════════════════════ */

import { writeFileSync } from "fs";
import { execSync } from "child_process";
import xlsx from "xlsx";

const XLSX = "scripts/data/AzFIT_Database_Restructured.xlsx";
const OUT = "supabase/seed-taxonomy.sql";

const sql = (q) => execSync(`node .temp/apply-sql.mjs "" "${q.replace(/"/g, '\\"')}"`, { encoding: "utf8" }).trim();
const rowsOf = (q) => JSON.parse(sql(q));

/* ── normalization helpers ── */
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const normSingular = (s) => norm(s).replace(/s$/, "");

/* ── Excel sources ── */
const wb = xlsx.readFile(XLSX);
const eqRows = xlsx.utils.sheet_to_json(wb.Sheets["EQUIPMENT"]);
const mgRows = xlsx.utils.sheet_to_json(wb.Sheets["MUSCLE_GROUPS"]);
const equipmentTypes = eqRows.map((r) => ({ name: String(r.Equipment_Name).trim(), category: String(r.Category ?? "").trim() }));
const muscleList = [...new Set(mgRows.map((r) => String(r.Muscle_Name ?? r.Name ?? Object.values(r)[1]).trim()))];
const muscleByNorm = new Map(muscleList.map((m) => [norm(m), m]));

/* documented aliases: live text → canonical Excel muscle name */
const MUSCLE_ALIASES = {
  quadriceps: "Quads",
  spinemobility: "Spinal Flexibility",
};
const resolveMuscle = (raw) => {
  const n = norm(raw);
  if (muscleByNorm.has(n)) return muscleByNorm.get(n);
  if (MUSCLE_ALIASES[n] && muscleByNorm.has(norm(MUSCLE_ALIASES[n]))) return MUSCLE_ALIASES[n];
  return null;
};

/* ── live library ── */
const lib = rowsOf("select id, equipment, primary_muscle, secondary_muscle from exercise_library order by code;");

/* ── equipment mapping ── */
const eqByNorm = new Map();
for (const e of equipmentTypes) {
  eqByNorm.set(norm(e.name), e.name);
  if (!eqByNorm.has(normSingular(e.name))) eqByNorm.set(normSingular(e.name), e.name);
}
const mapEquipmentPart = (part) => eqByNorm.get(norm(part)) ?? eqByNorm.get(normSingular(part)) ?? null;

const esc = (s) => s.replace(/'/g, "''");
const unmappedEq = new Map(); // part → count
const unmappedMuscles = new Map(); // name → count
const junctionEq = []; // [libraryId, typeName]
const junctionMuMap = new Map(); // `${libId}|${muscle}` → isPrimary (PK is (exercise_library_id, muscle_name) — primary wins on collision)

for (const row of lib) {
  const raw = String(row.equipment ?? "").trim();
  // whole-string match FIRST — the Excel taxonomy contains combo rows
  // ("Band/Stick", "Barbell/EZ", "Dumbbell/KB") that must not be split
  const whole = raw ? mapEquipmentPart(raw) : null;
  if (whole) {
    junctionEq.push([row.id, whole]);
  } else {
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const typeName = mapEquipmentPart(part);
      if (typeName) junctionEq.push([row.id, typeName]);
      else unmappedEq.set(part, (unmappedEq.get(part) ?? 0) + 1);
    }
  }
  const pm = row.primary_muscle ? resolveMuscle(row.primary_muscle) : null;
  if (pm) junctionMuMap.set(`${row.id}|${pm}`, true);
  else if (row.primary_muscle) unmappedMuscles.set(row.primary_muscle, (unmappedMuscles.get(row.primary_muscle) ?? 0) + 1);
  const sm = row.secondary_muscle ? resolveMuscle(row.secondary_muscle) : null;
  // secondary never downgrades a primary entry for the same muscle
  if (sm && !junctionMuMap.has(`${row.id}|${sm}`)) junctionMuMap.set(`${row.id}|${sm}`, false);
  else if (!sm && row.secondary_muscle) unmappedMuscles.set(row.secondary_muscle, (unmappedMuscles.get(row.secondary_muscle) ?? 0) + 1);
}
const junctionMu = [...junctionMuMap.entries()].map(([k, isPrimary]) => {
  const [libId, muscle] = k.split("|");
  return [libId, muscle, isPrimary];
});
// equipment junction: defensive dedupe (composite PK on (library, type))
const eqSeen = new Set();
const junctionEqDedup = junctionEq.filter(([l, t]) => {
  const k = `${l}|${t}`;
  if (eqSeen.has(k)) return false;
  eqSeen.add(k);
  return true;
});
junctionEq.length = 0;
junctionEq.push(...junctionEqDedup);

/* ── emit SQL ── */
const L = [];
L.push(`-- ============================================================`);
L.push(`-- Phase 52B — taxonomy backfill. GENERATED by scripts/seed-taxonomy.mjs`);
L.push(`-- (${new Date().toISOString().slice(0, 10)}) — regenerate, don't hand-edit.`);
L.push(`-- equipment_types: ${equipmentTypes.length} | library_equipment rows: ${junctionEq.length} | library_muscles rows: ${junctionMu.length}`);
L.push(`-- All inserts WHERE-NOT-EXISTS guarded (re-runs change zero rows).`);
L.push(`-- ============================================================`);
L.push("");
L.push("BEGIN;");
L.push("");
L.push("-- 1. equipment_types seed (Excel EQUIPMENT sheet)");
for (const e of equipmentTypes) {
  L.push(`INSERT INTO equipment_types (name, description) SELECT '${esc(e.name)}', '${esc(e.category)}' WHERE NOT EXISTS (SELECT 1 FROM equipment_types WHERE name = '${esc(e.name)}');`);
}
L.push("");
L.push("-- 2. exercise_library_equipment backfill (split slash-combos)");
for (const [libId, typeName] of junctionEq) {
  L.push(`INSERT INTO exercise_library_equipment (exercise_library_id, equipment_type_id) SELECT '${libId}', (SELECT id FROM equipment_types WHERE name = '${esc(typeName)}') WHERE NOT EXISTS (SELECT 1 FROM exercise_library_equipment WHERE exercise_library_id = '${libId}' AND equipment_type_id = (SELECT id FROM equipment_types WHERE name = '${esc(typeName)}'));`);
}
L.push("");
L.push("-- 3. exercise_library_muscles backfill (primary + secondary; PK is (exercise, muscle) — primary wins on collision)");
for (const [libId, muscle, isPrimary] of junctionMu) {
  L.push(`INSERT INTO exercise_library_muscles (exercise_library_id, muscle_name, is_primary) SELECT '${libId}', '${esc(muscle)}', ${isPrimary} WHERE NOT EXISTS (SELECT 1 FROM exercise_library_muscles WHERE exercise_library_id = '${libId}' AND muscle_name = '${esc(muscle)}');`);
}
L.push("");
L.push("COMMIT;");
L.push("");

writeFileSync(OUT, L.join("\n"));

console.log(`Wrote ${OUT}`);
console.log(`  equipment_types seed rows:      ${equipmentTypes.length}`);
console.log(`  library_equipment junctions:    ${junctionEq.length}`);
console.log(`  library_muscles junctions:      ${junctionMu.length}`);
console.log(`  UNMAPPED equipment parts:       ${JSON.stringify(Object.fromEntries(unmappedEq))}`);
console.log(`  UNMAPPED muscle names:          ${JSON.stringify(Object.fromEntries(unmappedMuscles))}`);
