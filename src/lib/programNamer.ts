/* ═══════════════════════════════════════════════════════════════
   Phase 66 Item 2b — goal/method-aware program name generator.
   Pattern: "<Goal/Method-derived word> <DD/MM/YY>". The word bank is
   keyed by goal so a cardio selection can never produce a
   hypertrophy-flavored name; repeated clicks cycle the variants.
   ═══════════════════════════════════════════════════════════════ */

const GOAL_WORD_BANK: Record<string, string[]> = {
  strength: ["Strength Cycle", "Strength Block", "Force Block"],
  hypertrophy: ["Hypertrophy Block", "Muscle Builder", "Size Cycle"],
  fatloss: ["Shred Block", "Cut Cycle", "Fat-Loss Phase"],
  endurance: ["Engine Builder", "Engine Block", "Cardio Base"],
  rehab: ["Rebuild Block", "Recovery Cycle", "Reset Block"],
  power: ["Power Block", "Explosive Cycle", "Speed Block"],
};

/** '01/09/26' — day/month/2-digit-year, zero-padded. */
export function dateStampDdMmYy(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function methodWord(methodName: string | null): string | null {
  if (!methodName) return null;
  const short = methodName.replace(/\s*\([^)]*\)\s*/g, "").trim().split(/\s+/).slice(0, 3).join(" ");
  return short ? `${short} Block` : null;
}

/**
 * Ordered name variants for the wizard's Randomize button:
 * primary-goal word bank first, then the method-derived word, then any
 * custom-goal name. Empty everything → 'Program'.
 */
export function programNameVariants(
  goals: string[],
  customGoalNames: string[] = [],
  methodName: string | null = null,
): string[] {
  const out: string[] = [];
  const primary = goals[0];
  if (primary && GOAL_WORD_BANK[primary]) out.push(...GOAL_WORD_BANK[primary]);
  const mw = methodWord(methodName);
  if (mw) out.push(mw);
  if (customGoalNames.length > 0 && customGoalNames[0].trim()) out.push(`${customGoalNames[0].trim()} Block`);
  if (out.length === 0) out.push("Program");
  return out;
}

/** The name for click N (variant cycles deterministically through the list). */
export function randomProgramName(
  goals: string[],
  customGoalNames: string[],
  methodName: string | null,
  variant: number,
  date: Date = new Date(),
): string {
  const variants = programNameVariants(goals, customGoalNames, methodName);
  const word = variants[((variant % variants.length) + variants.length) % variants.length];
  return `${word} ${dateStampDdMmYy(date)}`;
}
