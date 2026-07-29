/**
 * Superset / circuit pairing engine (Phase 30C) — pure + unit-testable.
 * Method-aware pairing styles applied at the WIZARD layer after generation
 * (the generator stays method-agnostic). Group letters A–H.
 */

export type PairingStyle = "pairs" | "triples" | "circuit";

/**
 * Documented method → pairing-style map (30A catalog names/slugs,
 * template names, legacy ids — regexes are hyphen-tolerant).
 * Supersets/GBC/GVT → pairs; Trisets → triples; Circuits/Giant Sets → circuit.
 */
const PAIRING_MAP: Array<[RegExp, PairingStyle]> = [
  [/triset/i, "triples"],
  [/circuit|giant[ -]?set/i, "circuit"],
  [/superset|gbc|german[ -]?body|german[ -]?volume|10x10|gvt/i, "pairs"],
];

/** Pairing style for a method name/slug, or null when the method has none. */
export function pairingStyleForMethod(methodNameOrSlug: string): PairingStyle | null {
  if (!methodNameOrSlug) return null;
  for (const [re, style] of PAIRING_MAP) {
    if (re.test(methodNameOrSlug)) return style;
  }
  return null;
}

export const MAX_GROUP_LETTER = "H"; // groups run A..H

/** Letter for a group index, capped at H (0 → 'A', 7+ → 'H'). */
export function groupLetter(index: number): string {
  return String.fromCharCode(65 + Math.min(Math.max(index, 0), 7));
}

/**
 * Assign supersetGroup letters in order:
 * pairs → A,A,B,B,…; triples → A,A,A,B,B,B,…; circuit → every exercise 'A'.
 * Returns a NEW array; items keep all other fields.
 */
export function assignPairGroups<T extends object>(
  exercises: T[],
  style: PairingStyle
): (T & { supersetGroup: string })[] {
  const size = style === "pairs" ? 2 : style === "triples" ? 3 : 1;
  return exercises.map((e, i) => ({
    ...e,
    supersetGroup: style === "circuit" ? "A" : groupLetter(Math.floor(i / size)),
  }));
}

/** Remove supersetGroup from every exercise (new array). */
export function stripPairing<T extends { supersetGroup?: string }>(exercises: T[]): T[] {
  return exercises.map((e) => {
    if (!("supersetGroup" in e)) return e;
    const copy = { ...e };
    delete copy.supersetGroup;
    return copy;
  });
}
