import { getAllExercisesFlat, findCategoryForExercise } from "@/data/exerciseDatabase";

export interface SwapCandidate {
  name: string;
  score: number;
  reason: string;
  equipment: string[];
}

export interface SwapOptions {
  reason?: string;
  excluded?: string[];
}

const EQUIPMENT_PATTERNS = [
  { tag: "barbell", regex: /\b(bb|barbell)\b/ },
  { tag: "dumbbell", regex: /\b(db|dumbbell)\b/ },
  { tag: "cable", regex: /\bcable\b/ },
  { tag: "machine", regex: /\b(machine|smith)\b/ },
  { tag: "bands", regex: /\b(band|banded)\b/ },
  { tag: "kettlebell", regex: /\b(kb|kettlebell)\b/ },
  { tag: "bodyweight", regex: /\b(bodyweight|bw)\b/ },
  { tag: "trx", regex: /\btrx\b/ },
  { tag: "landmine", regex: /\blandmine\b/ },
  { tag: "trap bar", regex: /\btrap bar\b/ },
  { tag: "safety bar", regex: /\bsafety bar\b/ },
  { tag: "football bar", regex: /\bfootball bar\b/ },
  { tag: "ez bar", regex: /\bez bar\b/ },
  { tag: "sled", regex: /\b(sled|prowler)\b/ },
  { tag: "cardio", regex: /\b(run|bike|sprint|dyne|deadmill|row|assault)\b/ },
];

const CATEGORY_MUSCLES: Record<string, string[]> = {
  pressing: ["chest", "shoulders", "triceps"],
  pulling: ["back", "lats", "biceps"],
  bilateral_quad: ["quads", "glutes"],
  unilateral_quad: ["quads", "glutes", "calves"],
  posterior: ["hamstrings", "glutes", "back"],
  target_areas: [],
  metcon_bracing: ["core", "conditioning"],
  bracing: ["core"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  delt_scap: ["shoulders", "upper back"],
};

const MOVEMENT_KEYWORDS = [
  "benchpress",
  "inclinepress",
  "declinepress",
  "floorpress",
  "shoulderpress",
  "militarypress",
  "overheadpress",
  "landminepress",
  "press",
  "bentoverrow",
  "cablerow",
  "seatedrow",
  "meadowsrow",
  "tbarrow",
  "row",
  "latpulldown",
  "pulldown",
  "pullup",
  "chinup",
  "pullover",
  "deadlift",
  "rdl",
  "goodmorning",
  "backsquat",
  "frontsquat",
  "gobletsquat",
  "boxsquat",
  "squat",
  "legpress",
  "lunge",
  "splitsquat",
  "stepup",
  "walkinglunges",
  "hipthrust",
  "glutebridge",
  "legcurl",
  "legextension",
  "bicepcurl",
  "hammercurl",
  "preachercurl",
  "scottcurl",
  "curl",
  "tricepextension",
  "frenchpress",
  "extension",
  "cablefly",
  "fly",
  "lateralraise",
  "reardeltfly",
  "raise",
  "facepull",
  "dip",
  "pushup",
  "plank",
  "crunch",
  "legraise",
  "deadbug",
  "palofpress",
  "carry",
  "farmerswalk",
  "yoke",
  "sled",
  "run",
  "bike",
  "sprint",
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractEquipment(name: string): string[] {
  const n = name.toLowerCase();
  const tags = new Set<string>();
  for (const { tag, regex } of EQUIPMENT_PATTERNS) {
    if (regex.test(n)) tags.add(tag);
  }
  return Array.from(tags);
}

function extractMuscles(name: string, categoryId: string | null): string[] {
  const muscles = new Set<string>(CATEGORY_MUSCLES[categoryId || ""] || []);
  const n = name.toLowerCase();

  if (n.includes("chest") || n.includes("pec") || n.includes("fly") || n.includes("dip")) muscles.add("chest");
  if (n.includes("shoulder") || n.includes("military") || n.includes("overhead") || n.includes("lateral raise") || n.includes("rear delt") || n.includes("delt")) muscles.add("shoulders");
  if (n.includes("tricep") || n.includes("extension") || n.includes("french press")) muscles.add("triceps");
  if (n.includes("bicep") || n.includes("curl") || n.includes("hammer curl")) muscles.add("biceps");
  if (n.includes("back") || n.includes("row") || n.includes("pulldown") || n.includes("pull up") || n.includes("chin up") || n.includes("deadlift") || n.includes("rack pull")) muscles.add("back");
  if (n.includes("lat") || n.includes("pullover")) muscles.add("lats");
  if (n.includes("quad") || n.includes("squat") || n.includes("leg press") || n.includes("leg extension") || n.includes("lunge") || n.includes("step up")) muscles.add("quads");
  if (n.includes("hamstring") || n.includes("rdl") || n.includes("good morning") || n.includes("leg curl")) muscles.add("hamstrings");
  if (n.includes("glute") || n.includes("hip thrust") || n.includes("glute bridge")) muscles.add("glutes");
  if (n.includes("calf") || n.includes("tibialis")) muscles.add("calves");
  if (n.includes("core") || n.includes("ab") || n.includes("plank") || n.includes("crunch") || n.includes("leg raise") || n.includes("deadbug") || n.includes("palof") || n.includes("carry") || n.includes("walk") || n.includes("yoke") || n.includes("farmers")) muscles.add("core");
  if (n.includes("cardio") || n.includes("run") || n.includes("bike") || n.includes("sprint") || n.includes("dyne") || n.includes("prowler") || n.includes("sled")) muscles.add("conditioning");

  return Array.from(muscles);
}

function extractNameKeywords(name: string): string[] {
  const normalized = normalize(name);
  const found = new Set<string>();
  for (const kw of MOVEMENT_KEYWORDS) {
    if (normalized.includes(kw)) found.add(kw);
  }
  return Array.from(found);
}

function parseLimitations(reason?: string): string[] {
  if (!reason) return [];
  const lower = reason.toLowerCase();
  const limits: string[] = [];
  if (lower.includes("no barbell") || lower.includes("no bb")) limits.push("barbell");
  if (lower.includes("no dumbbell") || lower.includes("no db")) limits.push("dumbbell");
  if (lower.includes("no cable")) limits.push("cable");
  if (lower.includes("no machine") || lower.includes("no smith")) limits.push("machine");
  if (lower.includes("no band") || lower.includes("no bands")) limits.push("bands");
  if (lower.includes("no kettlebell") || lower.includes("no kb")) limits.push("kettlebell");
  if (lower.includes("no landmine")) limits.push("landmine");
  if (lower.includes("no trap bar")) limits.push("trap bar");
  if (lower.includes("no ez bar")) limits.push("ez bar");
  if (lower.includes("no safety bar")) limits.push("safety bar");
  if (lower.includes("no football bar")) limits.push("football bar");
  return limits;
}

function intersect<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

function buildReason(target: TargetProfile, candidate: TargetProfile): string {
  const parts: string[] = [];
  if (target.categoryId && candidate.categoryId === target.categoryId) {
    parts.push("same movement pattern");
  } else {
    const sharedKw = intersect(target.keywords, candidate.keywords);
    if (sharedKw.length > 0) parts.push(`similar ${sharedKw[0]} focus`);
    else parts.push("alternative exercise");
  }

  const sharedEq = intersect(target.equipment, candidate.equipment);
  if (sharedEq.length > 0) parts.push("same equipment");
  else if (candidate.equipment.length > 0) parts.push(`${candidate.equipment[0]} option`);

  return parts.join(", ");
}

interface TargetProfile {
  name: string;
  categoryId: string | null;
  equipment: string[];
  muscles: string[];
  keywords: string[];
}

function buildProfile(name: string): TargetProfile {
  const categoryId = findCategoryForExercise(name);
  return {
    name,
    categoryId,
    equipment: extractEquipment(name),
    muscles: extractMuscles(name, categoryId),
    keywords: extractNameKeywords(name),
  };
}

export function findExerciseSubstitutions(
  currentExercise: string,
  options: SwapOptions = {}
): SwapCandidate[] {
  const all = getAllExercisesFlat();
  const target = buildProfile(currentExercise);
  const limitations = parseLimitations(options.reason);
  const excluded = new Set(options.excluded || []);
  excluded.add(currentExercise);

  const candidates: SwapCandidate[] = [];

  for (const name of all) {
    if (excluded.has(name)) continue;
    const profile = buildProfile(name);

    let score = 0;

    if (profile.categoryId && profile.categoryId === target.categoryId) {
      score += 40;
    }

    const sharedEquipment = intersect(target.equipment, profile.equipment);
    if (sharedEquipment.length > 0) score += 25;

    const sharedMuscles = intersect(target.muscles, profile.muscles);
    score += sharedMuscles.length * 10;

    const sharedKeywords = intersect(target.keywords, profile.keywords);
    score += sharedKeywords.length * 15;

    const limited = intersect(profile.equipment, limitations);
    if (limited.length > 0) score -= 30;

    if (score <= 0) continue;

    candidates.push({
      name,
      score,
      equipment: profile.equipment,
      reason: buildReason(target, profile),
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function findExerciseNameInInput(input: string): string | null {
  const all = getAllExercisesFlat();
  const lower = input.toLowerCase();
  let best: string | null = null;
  for (const name of all) {
    if (lower.includes(name.toLowerCase())) {
      if (!best || name.length > best.length) best = name;
    }
  }
  return best;
}

export { extractEquipment };
