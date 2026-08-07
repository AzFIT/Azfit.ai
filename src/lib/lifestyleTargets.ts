/* ═══════════════════════════════════════════════════════════════
   Phase 55 — lifestyle targets (steps / sleep / water) pure helpers.
   Storage: clients.lifestyle_targets jsonb — all keys optional.
   ═══════════════════════════════════════════════════════════════ */

import { formatNumber } from "./utils";

export interface LifestyleTargets {
  steps?: number;
  sleep_hours?: number;
  water_ml?: number;
}

/** Sane ranges keep junk out of the jsonb (fat-finger guard, not validation theatre). */
const RANGES: Record<keyof LifestyleTargets, { min: number; max: number }> = {
  steps: { min: 0, max: 100000 },
  sleep_hours: { min: 0, max: 24 },
  water_ml: { min: 0, max: 20000 },
};

function clean(key: keyof LifestyleTargets, v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || !isFinite(n)) return undefined;
  if (n <= RANGES[key].min || n > RANGES[key].max) return undefined;
  return n;
}

/** Tolerant read of the jsonb — junk/missing keys simply don't appear. */
export function parseLifestyleTargets(json: unknown): LifestyleTargets {
  const out: LifestyleTargets = {};
  if (typeof json !== "object" || json === null) return out;
  const j = json as Record<string, unknown>;
  const steps = clean("steps", j.steps);
  const sleep = clean("sleep_hours", j.sleep_hours);
  const water = clean("water_ml", j.water_ml);
  if (steps !== undefined) out.steps = steps;
  if (sleep !== undefined) out.sleep_hours = sleep;
  if (water !== undefined) out.water_ml = water;
  return out;
}

/**
 * Merge an editor patch into existing targets. Patch semantics:
 * positive finite number → set; null/undefined/NaN/0/negative → REMOVE
 * the key (an emptied input means "no target", not zero).
 */
export function mergeLifestyleTargets(
  existing: LifestyleTargets,
  patch: Partial<Record<keyof LifestyleTargets, number | null>>,
): LifestyleTargets {
  const out: LifestyleTargets = { ...existing };
  for (const key of Object.keys(patch) as (keyof LifestyleTargets)[]) {
    const v = clean(key, patch[key]);
    if (v === undefined) delete out[key];
    else out[key] = v;
  }
  return out;
}

export function hasLifestyleTargets(t: LifestyleTargets): boolean {
  return t.steps !== undefined || t.sleep_hours !== undefined || t.water_ml !== undefined;
}

/** Display chips: ["8,000 steps", "7.5h sleep", "2,500 ml water"] in a fixed order. */
export function lifestyleChips(t: LifestyleTargets): string[] {
  const chips: string[] = [];
  if (t.steps !== undefined) chips.push(`${formatNumber(t.steps)} steps`);
  if (t.sleep_hours !== undefined) chips.push(`${formatNumber(t.sleep_hours, t.sleep_hours % 1 ? 1 : 0)}h sleep`);
  if (t.water_ml !== undefined) chips.push(`${formatNumber(t.water_ml)} ml water`);
  return chips;
}

/* ── Weekly compliance ring math ────────────────────────────────
   completed can exceed planned (extra sessions) → cap at 100.
   planned = 0 → null (no basis — the UI shows an honest note). */
export function compliancePct(completed: number, planned: number): number | null {
  if (planned <= 0) return null;
  if (completed <= 0) return 0;
  return Math.min(100, Math.round((completed / planned) * 100));
}
