export interface MacroPreset {
  name: string;
  protein: number;
  fats: number;
  carbs: number;
  description: string;
}

export const macroPresets: MacroPreset[] = [
  {
    name: "Balance",
    protein: 30,
    fats: 35,
    carbs: 35,
    description: "Balanced diet for general fitness",
  },
  {
    name: "Low Carbs",
    protein: 40,
    fats: 40,
    carbs: 20,
    description: "Low carb, high protein for fat loss",
  },
  {
    name: "High Carbs",
    protein: 30,
    fats: 20,
    carbs: 50,
    description: "High carb for muscle building",
  },
];

export function calculateMacros(
  weight: number,
  height: number,
  age: number,
  gender: "male" | "female",
  activityLevel: string,
  preset: MacroPreset,
): { protein: number; fats: number; carbs: number; tdee: number; bmr: number } {
  // BMR calculation (Mifflin-St Jeor equation)
  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  // TDEE calculation
  const multiplier = activityLevelMultiplier(activityLevel);
  const tdee = bmr * multiplier;

  // Calculate macros in grams
  const protein = (tdee * (preset.protein / 100)) / 4;
  const fats = (tdee * (preset.fats / 100)) / 9;
  const carbs = (tdee * (preset.carbs / 100)) / 4;

  return { protein, fats, carbs, tdee, bmr };
}

function activityLevelMultiplier(level: string): number {
  switch (level) {
    case "sedentary":
      return 1.2;
    case "lightly_active":
      return 1.375;
    case "moderately_active":
      return 1.55;
    case "very_active":
      return 1.725;
    case "extra_active":
      return 1.9;
    default:
      return 1.55;
  }
}

// BioPrint connection: suggest preset based on body fat %
export function suggestPresetByBodyFat(bodyFatPercentage: number): MacroPreset {
  if (bodyFatPercentage > 25) {
    return macroPresets[1]; // Low Carbs
  } else if (bodyFatPercentage >= 15) {
    return macroPresets[0]; // Balance
  } else {
    return macroPresets[2]; // High Carbs
  }
}
