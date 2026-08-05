/* ═══════════════════════════════════════════════════════════════════
   Log-from-plan shared helpers (Phase 43, Item 6).
   logPlanItems = the Phase 38 one-tap insert path, extracted so
   MealPlanCard and the client dashboard Today's Meals card share it.
   planDayForWeekday = weekday → plan-day mapping (documented):
   Mon=day 1 … Sun=day 7; plans shorter than 7 days wrap MODULO the
   plan length (a 5-day plan maps Sat→1, Sun→2).
   ═══════════════════════════════════════════════════════════════════ */

import { resolvePlanFood, type FoodInput } from "@/lib/mealPlan";
import { addFoodToLog } from "@/lib/foodApi";

export interface LoggablePlanItem {
  name: string;
  serving_g: number;
}

/** weekday: 1=Mon … 7=Sun (client-local). planDays: 1..7. */
export function planDayForWeekday(weekday: number, planDays: number): number {
  const days = Math.max(1, Math.min(7, Math.floor(planDays)));
  const wd = Math.max(1, Math.min(7, Math.floor(weekday)));
  return ((wd - 1) % days) + 1;
}

/**
 * Insert one nutrition_logs row per item that resolves to a real food
 * (exact name match via resolvePlanFood — never guesses). Returns
 * { logged, skipped } for the caller's toast.
 */
export async function logPlanItems(
  items: LoggablePlanItem[],
  mealType: "breakfast" | "lunch" | "dinner" | "snacks",
  date: string,
  foods: FoodInput[],
): Promise<{ logged: number; skipped: number }> {
  let logged = 0;
  let skipped = 0;
  for (const it of items) {
    const food = resolvePlanFood(it.name, foods);
    if (!food) {
      skipped++;
      continue;
    }
    await addFoodToLog(mealType, food.id, it.serving_g, date);
    logged++;
  }
  return { logged, skipped };
}
