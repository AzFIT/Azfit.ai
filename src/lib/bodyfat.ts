export type SkinfoldProtocol = "jp3" | "jp7" | "poliquin12";
export type Gender = "male" | "female";

export const SKINFOLD_SITES = [
  "chin",
  "cheek",
  "pec",
  "mid_axillary",
  "umbilical",
  "supra_iliac",
  "subscapular",
  "triceps",
  "knee",
  "medial_calf",
  "mid_thigh",
  "hamstring",
] as const;

export type SkinfoldSite = (typeof SKINFOLD_SITES)[number];

export const PROTOCOL_SITES: Record<SkinfoldProtocol, SkinfoldSite[]> = {
  jp7: ["pec", "mid_axillary", "triceps", "subscapular", "umbilical", "supra_iliac", "mid_thigh"],
  jp3: ["pec", "umbilical", "mid_thigh"],
  poliquin12: [...SKINFOLD_SITES],
};

export const PROTOCOL_DESCRIPTIONS: Record<SkinfoldProtocol, string> = {
  jp3: "Jackson-Pollock 3-site — quickest estimate",
  jp7: "Jackson-Pollock 7-site — more accurate",
  poliquin12: "Poliquin 12-site — comprehensive caliper map",
};

export const SITE_HINTS: Record<SkinfoldSite, string> = {
  chin: "front of the chin, midline",
  cheek: "over the cheekbone, below the eye",
  pec: "mid-chest, diagonal fold",
  mid_axillary: "mid-line of the side of the torso",
  umbilical: "2 cm right of the navel",
  supra_iliac: "diagonal fold above the hip bone",
  subscapular: "1 cm below the bottom tip of the shoulder blade",
  triceps: "mid-back of the upper arm",
  knee: "above the kneecap, midline",
  medial_calf: "inner side of the calf at the widest point",
  mid_thigh: "front of the thigh, midway between hip and knee",
  hamstring: "back of the thigh, midway between hip and knee",
};

export interface BodyFatResult {
  sumMm: number;
  bodyDensity: number | null;
  bodyFatPct: number | null;
}

/**
 * Jackson-Pollock 7-site body density.
 * S = sum of the 7 sites in mm.
 */
export function calculateJP7(sumMm: number, age: number, gender: Gender): number {
  if (gender === "male") {
    return 1.112 - 0.00043499 * sumMm + 0.00000055 * sumMm * sumMm - 0.00028826 * age;
  }
  return 1.097 - 0.00046971 * sumMm + 0.00000056 * sumMm * sumMm - 0.00012828 * age;
}

/**
 * Jackson-Pollock 3-site body density.
 * S = sum of the 3 sites in mm.
 */
export function calculateJP3(sumMm: number, age: number, gender: Gender): number {
  if (gender === "male") {
    return 1.10938 - 0.0008267 * sumMm + 0.0000016 * sumMm * sumMm - 0.0002574 * age;
  }
  return 1.0994921 - 0.0009929 * sumMm + 0.0000023 * sumMm * sumMm - 0.0001392 * age;
}

/** Siri equation: body fat % from body density. */
export function siriBodyFatPct(bodyDensity: number): number {
  return 495 / bodyDensity - 450;
}

export function calculateBodyFat(
  protocol: SkinfoldProtocol,
  sumMm: number,
  age: number,
  gender: Gender
): BodyFatResult {
  if (protocol === "poliquin12") {
    return { sumMm, bodyDensity: null, bodyFatPct: null };
  }

  const bodyDensity = protocol === "jp7" ? calculateJP7(sumMm, age, gender) : calculateJP3(sumMm, age, gender);
  const bodyFatPct = siriBodyFatPct(bodyDensity);

  return {
    sumMm,
    bodyDensity,
    bodyFatPct: Math.max(0, bodyFatPct),
  };
}

/** Katch-McArdle BMR using body fat percentage and weight. */
export function calculateBMRKatchMcArdle(bodyFatPct: number, weightKg: number): number {
  return 370 + 21.6 * (weightKg * (1 - bodyFatPct / 100));
}

/** Round a number to a fixed number of decimal places without trailing zeros. */
export function fmt(n: number | null, digits = 2): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

/** Compute the sum of a partial sites record, filling missing sites with 0. */
export function sumSites(sites: Partial<Record<SkinfoldSite, number>>, protocol: SkinfoldProtocol): number {
  const required = PROTOCOL_SITES[protocol];
  return required.reduce((sum, site) => sum + (sites[site] ?? 0), 0);
}

