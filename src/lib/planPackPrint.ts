/* ═══════════════════════════════════════════════════════════════
   Phase 54 — Plan Pack pure mappers (unit-tested; the print page
   queries Supabase and renders what these return — no logic in JSX).
   ═══════════════════════════════════════════════════════════════ */

import { MEAL_ORDER } from "./mealPlan";
import { wizardGoalToClientGoal } from "./trialIntake";

/* ── Goal keys for supplement filtering ─────────────────────────
   client_goals rows win; when none exist, fall back to the client's
   fitness_goal free-text (which may be wizard vocab OR goal_type
   vocab depending on which path wrote it). */
const GOAL_TYPE_KEYS = ["lose_weight", "build_muscle", "reduce_body_fat", "increase_strength", "improve_fitness"];

export function goalKeysForSupplements(
  goalRows: { goal_type: string }[],
  fitnessGoal: string | null | undefined,
): string[] {
  const types = goalRows.map((g) => g.goal_type).filter(Boolean);
  if (types.length) return types;
  if (!fitnessGoal) return [];
  if (GOAL_TYPE_KEYS.includes(fitnessGoal)) return [fitnessGoal];
  return [wizardGoalToClientGoal(fitnessGoal).goal_type];
}

/* ── Program week derivation ────────────────────────────────────
   week 0  → start_date is in the future ("Starts <date>")
   null    → no start_date ("Not started")
   else    → 1-based week, clamped to durationWeeks */
export function programWeek(
  startDate: string | null | undefined,
  durationWeeks: number,
  today: Date,
): { week: number; total: number } | null {
  if (!startDate) return null;
  const start = new Date(startDate.length === 10 ? `${startDate}T00:00:00` : startDate);
  if (isNaN(start.getTime())) return null;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((todayMidnight.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return { week: 0, total: durationWeeks };
  const week = Math.min(Math.max(1 + Math.floor(diffDays / 7), 1), Math.max(durationWeeks, 1));
  return { week, total: durationWeeks };
}

/* ── Meal plan grouping ─────────────────────────────────────────
   Tolerant read-shape (V1 items lack `day` → treated as day 1). */
export interface PlanPackItem {
  day?: number;
  meal?: string;
  name: string;
  serving_g?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export interface MealGroup {
  meal: string;
  items: PlanPackItem[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
}

export interface DayPlan {
  day: number;
  meals: MealGroup[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
}

const emptyTotals = () => ({ calories: 0, protein: 0, carbs: 0, fats: 0 });

export function mealPlanDays(items: PlanPackItem[]): DayPlan[] {
  const byDay = new Map<number, PlanPackItem[]>();
  for (const it of items) {
    const d = typeof it.day === "number" && it.day >= 1 ? it.day : 1;
    byDay.set(d, [...(byDay.get(d) ?? []), it]);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, dayItems]) => {
      const meals: MealGroup[] = [];
      const dayTotals = emptyTotals();
      const byMeal = new Map<string, PlanPackItem[]>();
      for (const it of dayItems) {
        const m = it.meal || "snacks";
        byMeal.set(m, [...(byMeal.get(m) ?? []), it]);
        dayTotals.calories += it.calories ?? 0;
        dayTotals.protein += it.protein ?? 0;
        dayTotals.carbs += it.carbs ?? 0;
        dayTotals.fats += it.fats ?? 0;
      }
      const mealKeys = [...byMeal.keys()].sort((a, b) => {
        const ia = (MEAL_ORDER as string[]).indexOf(a);
        const ib = (MEAL_ORDER as string[]).indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      for (const m of mealKeys) {
        const mItems = byMeal.get(m)!;
        const totals = emptyTotals();
        for (const it of mItems) {
          totals.calories += it.calories ?? 0;
          totals.protein += it.protein ?? 0;
          totals.carbs += it.carbs ?? 0;
          totals.fats += it.fats ?? 0;
        }
        meals.push({ meal: m, items: mItems, totals });
      }
      return { day, meals, totals: dayTotals };
    });
}

/* ── Steps / sleep "only if set" ────────────────────────────────
   No canonical steps/sleep target exists (nutrition_targets has no
   such columns) — the only stored signal is a free-text active habit.
   Surface the habit's own text verbatim, never a parsed/fabricated
   number. Returns nulls when nothing matches. */
export interface HabitLike {
  name: string;
  target_frequency: string | null;
  active: boolean;
}

export function stepsSleepFromHabits(
  habits: HabitLike[],
): { steps: string | null; sleep: string | null } {
  const active = habits.filter((h) => h.active);
  const stepsHabit = active.find((h) => /step/i.test(h.name));
  const sleepHabit = active.find((h) => /sleep/i.test(h.name));
  const fmt = (h: HabitLike | undefined) =>
    h ? (h.target_frequency ? `${h.name} — ${h.target_frequency}` : h.name) : null;
  return { steps: fmt(stepsHabit), sleep: fmt(sleepHabit) };
}
