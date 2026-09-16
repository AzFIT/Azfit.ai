// ═══════════════════════════════════════════════════════════════
// quickLog (Phase 97a) — PURE quick-log parser + the shared intent
// contract for the client AI Log.
//
// Two producers feed the SAME contract:
//  1. The AI path (ai-chat edge function, json_object mode) — output
//     validated by validateQuickLogJson below.
//  2. The on-device rule parser (parseQuickLog below) — used when no
//     AI key is configured, or as an honest fallback when the AI
//     provider errors mid-conversation.
//
// HONEST DATA (permanent): the parser NEVER guesses a number it could
// not find. Missing/ambiguous required values → { status: "clarify" }
// with ONE question. Nothing is written on clarify.
// ═══════════════════════════════════════════════════════════════

export type QuickIntent = "meal" | "training" | "water" | "sleep" | "weight";

export const QUICK_INTENTS: QuickIntent[] = ["meal", "training", "water", "sleep", "weight"];

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface MealData {
  name: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fats_g?: number;
  meal_type?: MealType;
}
export interface TrainingData {
  summary: string;
  duration_min?: number;
}
export interface WaterData {
  liters: number;
}
export interface SleepData {
  hours: number;
}
export interface WeightData {
  kg: number;
}

export type IntentData = MealData | TrainingData | WaterData | SleepData | WeightData;

export type QuickLogResult =
  | { status: "ok"; intent: QuickIntent; data: IntentData }
  | { status: "clarify"; question: string };

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** "78,5" → 78.5 (comma decimals), strips stray spaces. */
function toNum(raw: string): number | null {
  const n = Number(raw.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ── Per-intent field parsers ─────────────────────────────────── */

const KG_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kgs)/i;
const LB_RE = /(\d+(?:[.,]\d+)?)\s*(lbs?|pounds?)/i;
const NUM_RE = /(\d+(?:[.,]\d+)?)/;

export function parseWeight(text: string): number | null {
  let m = text.match(KG_RE);
  if (m) {
    const n = toNum(m[1]);
    return n === null ? null : round2(n);
  }
  m = text.match(LB_RE);
  if (m) {
    const n = toNum(m[1]);
    return n === null ? null : round2(n * 0.45359237);
  }
  // Unitless number in an explicit weight context → assume kg.
  if (/weight|weigh/i.test(text)) {
    m = text.match(NUM_RE);
    if (m) {
      const n = toNum(m[1]);
      return n === null ? null : round2(n);
    }
  }
  return null;
}

const WATER_RE = /(\d+(?:[.,]\d+)?)\s*(lit(?:er|re)?s?|l|ml|millilit(?:er|re)?s?|glass(?:es)?|cup(?:s)?)/i;

export function parseWaterLiters(text: string): number | null {
  const m = text.match(WATER_RE);
  if (m) {
    const n = toNum(m[1]);
    if (n === null) return null;
    const unit = m[2].toLowerCase();
    if (unit.startsWith("ml") || unit.startsWith("milli")) return round2(n / 1000);
    if (unit.startsWith("glass")) return round2(n * 0.25);
    if (unit.startsWith("cup")) return round2(n * 0.24);
    return round2(n); // l / liter / litre
  }
  // Unitless number in an explicit water context: >10 → ml, else liters.
  if (/water|hydrat|drank|drink|drunk/i.test(text)) {
    const nm = text.match(NUM_RE);
    if (nm) {
      const n = toNum(nm[1]);
      if (n === null) return null;
      return n > 10 ? round2(n / 1000) : round2(n);
    }
  }
  return null;
}

const SLEEP_RE = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;

export function parseSleepHours(text: string): number | null {
  const m = text.match(SLEEP_RE);
  if (m) {
    const n = toNum(m[1]);
    if (n === null) return null;
    const unit = m[2].toLowerCase();
    if (unit.startsWith("m")) return round2(n / 60);
    return round2(n);
  }
  if (/sleep|slept|bed/i.test(text)) {
    const nm = text.match(NUM_RE);
    if (nm) {
      const n = toNum(nm[1]);
      if (n === null || n > 24) return null;
      return round2(n);
    }
  }
  return null;
}

const DURATION_RE = /(\d+)\s*(minutes?|mins?)\b/i;

export function parseTraining(text: string): TrainingData | null {
  if (!/(train|workout|gym|lift|cardio|run|running|ran|swim|swam|cycl|ride|walk|hike|yoga|pilates|sport|football|tennis|padel|boxing|hiit|spin|row)/i.test(text)) {
    return null;
  }
  let durationMin: number | undefined;
  let summary = text;
  const dm = text.match(DURATION_RE);
  if (dm) {
    durationMin = Number(dm[1]);
    summary = summary.replace(dm[0], " ");
  }
  const STOP = new Set([
    "i", "did", "a", "an", "the", "my", "today", "yesterday", "this", "morning",
    "evening", "afternoon", "for", "of", "at", "in", "on", "min", "mins",
    "minutes", "trained", "training", "didnt", "didn't", "was", "it",
  ]);
  const words = summary
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  const cleaned = words.join(" ").replace(/\s{2,}/g, " ").trim();
  if (!cleaned && durationMin === undefined) return null;
  return { summary: cleaned || "Training session", duration_min: durationMin };
}

const CAL_RE = /(\d+(?:[.,]\d+)?)\s*(?:kcal|cal(?:ories)?|cals)\b/i;

/** Macro extraction: "40g protein", "protein 40", "40p 50c 20f". */
export function parseMeal(text: string): MealData | null {
  const caloriesM = text.match(CAL_RE);
  const calories = caloriesM ? toNum(caloriesM[1]) : null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fats: number | null = null;
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(protein|carbs?|fats?)\b|(\d+)\s*(p|c|f)\b/gi)) {
    const n = toNum(m[1] ?? m[3] ?? "");
    if (n === null) continue;
    const key = (m[2] ?? m[4] ?? "").toLowerCase();
    if (key.startsWith("p")) protein = n;
    else if (key.startsWith("c")) carbs = n;
    else if (key.startsWith("f")) fats = n;
  }
  const hasMacro = calories !== null || protein !== null || carbs !== null || fats !== null;
  if (!hasMacro) return null; // honest: a bare food name is not enough to log

  // Meal name: strip numbers/units/macro tokens and stopwords.
  let name = text
    .replace(CAL_RE, " ")
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(protein|carbs?|fats?)\b/gi, " ")
    .replace(/(\d+)\s*(p|c|f)\b/gi, " ")
    .replace(/[0-9]+([.,][0-9]+)?/g, " ");
  const STOP = new Set([
    "i", "had", "have", "has", "ate", "eaten", "eating", "a", "an", "the",
    "some", "my", "for", "me", "about", "roughly", "around", "just", "logged",
    "log", "record", "add", "adding", "with", "and", "of", "it", "was",
    "g", "gm", "grams", "today", "yesterday", "this", "that",
  ]);
  const words = name.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  name = words.join(" ").replace(/\s{2,}/g, " ").trim();
  if (!name) name = "Meal";

  const meal_type = inferMealType(text, new Date());
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    ...(calories !== null ? { calories } : {}),
    ...(protein !== null ? { protein_g: protein } : {}),
    ...(carbs !== null ? { carbs_g: carbs } : {}),
    ...(fats !== null ? { fats_g: fats } : {}),
    meal_type,
  };
}

/** Meal-type inference: explicit words first, else the current local hour. */
export function inferMealType(text: string, now: Date): MealType {
  const t = text.toLowerCase();
  if (/breakfast|morning/.test(t)) return "breakfast";
  if (/lunch|noon|midday|afternoon/.test(t)) return "lunch";
  if (/dinner|evening|tonight|night|supper/.test(t)) return "dinner";
  const h = now.getHours();
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 11 && h < 14) return "lunch";
  if (h >= 17 && h < 21) return "dinner";
  return "snacks";
}

/* ── Top-level rule parser ────────────────────────────────────── */

/**
 * Parse free text into the quick-log contract.
 * `hint` (a tapped chip) forces the intent; without it the parser
 * detects from content, defaulting to meal.
 */
export function parseQuickLog(raw: string, hint: QuickIntent | null): QuickLogResult {
  const text = raw.trim();
  if (!text) return { status: "clarify", question: "What would you like to log?" };

  const intent: QuickIntent = hint ?? detectIntent(text);

  switch (intent) {
    case "weight": {
      let kg = parseWeight(text);
      if (kg === null) {
        // Chip flow: user typed just the number (e.g. "78.5") — treat as kg.
        const bare = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*\.?\s*$/i);
        if (bare) kg = toNum(bare[1]);
      }
      if (kg === null || kg <= 0 || kg > 700) {
        return { status: "clarify", question: "What was your weight? (e.g. “78.5 kg” or “173 lb”)" };
      }
      return { status: "ok", intent, data: { kg } satisfies WeightData };
    }
    case "water": {
      const liters = parseWaterLiters(text);
      if (liters === null || liters <= 0 || liters > 20) {
        return { status: "clarify", question: "How much water? (e.g. “500 ml”, “2 glasses”, “1.5 l”)" };
      }
      return { status: "ok", intent, data: { liters } satisfies WaterData };
    }
    case "sleep": {
      const hours = parseSleepHours(text);
      if (hours === null || hours <= 0 || hours > 24) {
        return { status: "clarify", question: "How many hours did you sleep? (e.g. “7.5 hours”)" };
      }
      return { status: "ok", intent, data: { hours } satisfies SleepData };
    }
    case "training": {
      const t = parseTraining(text);
      if (!t) {
        return { status: "clarify", question: "What did you train? (e.g. “Upper body workout, 45 min”)" };
      }
      return { status: "ok", intent, data: t };
    }
    case "meal": {
      const m = parseMeal(text);
      if (!m) {
        return {
          status: "clarify",
          question: "Roughly how many calories (or protein/carbs/fat grams) was that? (e.g. “chicken rice 550 cal 40p”)",
        };
      }
      return { status: "ok", intent, data: m };
    }
  }
}

/** Content-based intent detection (free text, no chip hint). Exported
 *  for the AI path — the system prompt is built per detected intent. */
export function detectIntent(text: string): QuickIntent {
  if (KG_RE.test(text) || LB_RE.test(text) || /weigh/i.test(text)) return "weight";
  if (WATER_RE.test(text) || /water|hydrat|drank|drunk/i.test(text)) return "water";
  // Training before sleep: "ran 5k in 30 minutes" is a duration, not sleep.
  if (parseTraining(text) !== null) return "training";
  if (SLEEP_RE.test(text) || /slept|sleep/i.test(text)) return "sleep";
  return "meal";
}

/* ── AI-output validator (same contract, strict) ──────────────── */

/** Validate a parsed AI json_object against the intent contract.
 *  Invalid/missing values → clarify (never a guessed write). */
export function validateQuickLogJson(raw: unknown): QuickLogResult {
  if (typeof raw !== "object" || raw === null) {
    return { status: "clarify", question: "I couldn't read that — could you rephrase what you logged?" };
  }
  const o = raw as Record<string, unknown>;
  const intent = o.intent;
  const data = o.data;
  if (intent === "clarify" || o.status === "clarify") {
    const q = typeof o.question === "string" && o.question.trim() ? o.question.trim() : "Could you tell me a bit more?";
    return { status: "clarify", question: q };
  }
  if (typeof intent !== "string" || !QUICK_INTENTS.includes(intent as QuickIntent)) {
    return { status: "clarify", question: "Was that a meal, training, water, sleep, or weight?" };
  }
  if (typeof data !== "object" || data === null) {
    return { status: "clarify", question: "Could you tell me a bit more?" };
  }
  const d = data as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

  switch (intent as QuickIntent) {
    case "weight": {
      const kg = num(d.kg);
      if (kg === null || kg <= 0 || kg > 700) return { status: "clarify", question: "What was your weight in kg?" };
      return { status: "ok", intent: "weight", data: { kg: round2(kg) } };
    }
    case "water": {
      const liters = num(d.liters);
      if (liters === null || liters <= 0 || liters > 20) return { status: "clarify", question: "How much water in liters?" };
      return { status: "ok", intent: "water", data: { liters: round2(liters) } };
    }
    case "sleep": {
      const hours = num(d.hours);
      if (hours === null || hours <= 0 || hours > 24) return { status: "clarify", question: "How many hours did you sleep?" };
      return { status: "ok", intent: "sleep", data: { hours: round2(hours) } };
    }
    case "training": {
      const summary = typeof d.summary === "string" ? d.summary.trim() : "";
      const duration = d.duration_min === undefined ? undefined : num(d.duration_min);
      if (!summary && duration === undefined) return { status: "clarify", question: "What did you train?" };
      return { status: "ok", intent: "training", data: { summary: summary || "Training session", ...(duration !== undefined && duration !== null ? { duration_min: Math.round(duration) } : {}) } };
    }
    case "meal": {
      const name = typeof d.name === "string" ? d.name.trim() : "";
      const calories = d.calories === undefined ? undefined : num(d.calories);
      const protein = d.protein_g === undefined ? undefined : num(d.protein_g);
      const carbs = d.carbs_g === undefined ? undefined : num(d.carbs_g);
      const fats = d.fats_g === undefined ? undefined : num(d.fats_g);
      if (!name && calories === undefined && protein === undefined && carbs === undefined && fats === undefined) {
        return { status: "clarify", question: "What did you eat, roughly how many calories?" };
      }
      const mt = d.meal_type;
      const meal_type: MealType =
        mt === "breakfast" || mt === "lunch" || mt === "dinner" || mt === "snacks" ? mt : inferMealType(name, new Date());
      return {
        status: "ok",
        intent: "meal",
        data: {
          name: name || "Meal",
          ...(calories !== undefined && calories !== null ? { calories } : {}),
          ...(protein !== undefined && protein !== null ? { protein_g: protein } : {}),
          ...(carbs !== undefined && carbs !== null ? { carbs_g: carbs } : {}),
          ...(fats !== undefined && fats !== null ? { fats_g: fats } : {}),
          meal_type,
        },
      };
    }
  }
}
