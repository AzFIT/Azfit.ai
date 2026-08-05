import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UtensilsCrossed, Check, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { logPlanItems, planDayForWeekday, type LoggablePlanItem } from "@/lib/logFromPlan";
import { MEAL_ORDER, type FoodInput, type MealType } from "@/lib/mealPlan";
import { CollapsibleSection } from "./shared/CollapsibleSection";

/* ═══════════════════════════════════════════════════════════════════
   Today's Meals (Phase 43, Item 6) — client dashboard card showing
   the saved meal-plan day for TODAY's weekday (Mon=day1 … Sun=day7,
   shorter plans wrap modulo their length — documented in logFromPlan).
   Per-meal one-tap Log reuses the Phase 38 insert path (own logs only).
   Honest absence: no plan → a plain muted line, no card chrome.
   ═══════════════════════════════════════════════════════════════════ */

interface PlanItem extends LoggablePlanItem {
  meal: MealType;
  day?: number;
  calories?: number;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function TodaysMealsCard({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [planDays, setPlanDays] = useState(0);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(new Set());
  const [loggingMeal, setLoggingMeal] = useState<string | null>(null);

  const weekday = ((new Date().getDay() + 6) % 7) + 1; // Mon=1 … Sun=7
  const planDay = planDayForWeekday(weekday, Math.max(1, planDays));

  const loadLogged = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from("nutrition_logs")
      .select("meal_type")
      .eq("user_id", uid)
      .eq("logged_date", todayLocal());
    setLoggedMeals(new Set((data || []).map((r) => r.meal_type as string)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: plan } = await supabase
        .from("meal_plans")
        .select("items")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const planItems = (plan?.items as unknown as PlanItem[]) || [];
      setItems(planItems);
      setPlanDays(
        planItems.length > 0 ? Math.max(...planItems.map((i) => i.day ?? 1)) : 0,
      );
      setLoading(false);
      loadLogged();
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, loadLogged]);

  const handleLog = async (meal: MealType, mealItems: PlanItem[]) => {
    if (loggingMeal) return;
    setLoggingMeal(meal);
    try {
      const { data: foods } = await supabase
        .from("foods_cache")
        .select("id, name, brand, category, serving_size_g, calories, protein, carbs, fats, source")
        .order("source", { ascending: false })
        .limit(500);
      const { logged, skipped } = await logPlanItems(
        mealItems,
        meal,
        todayLocal(),
        (foods as FoodInput[]) || [],
      );
      if (logged > 0) {
        toast.success(`Logged ${logged} items to ${MEAL_LABELS[meal]} ✅`);
        setLoggedMeals((prev) => new Set(prev).add(meal));
      }
      if (skipped > 0) toast.warning(`${skipped} skipped — not in food database`);
      if (logged === 0) toast.error("No items matched the food database — nothing logged");
    } catch (err) {
      toast.error("Couldn't log: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoggingMeal(null);
    }
  };

  // Honest absence: no plan at all → a plain muted line, no card chrome
  if (loading) return null;
  if (planDays === 0) {
    return (
      <p className="mb-6 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
        Your coach hasn&apos;t saved a meal plan yet.
      </p>
    );
  }

  const dayItems = items.filter((i) => (i.day ?? 1) === planDay);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6"
    >
      <CollapsibleSection
        title={`Today's Meals — Day ${planDay} of your plan`}
        icon={<UtensilsCrossed className="h-4 w-4" />}
        defaultExpanded
        accentColor="#8B5CF6"
      >
        {dayItems.length === 0 ? (
          <div className="py-2 text-center">
            <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
              Day {planDay} has no meals in this plan.
            </p>
            <p className="mt-1 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
              {Array.from({ length: planDays }, (_, d) => d + 1)
                .map((d) => `Day ${d}: ${items.filter((i) => (i.day ?? 1) === d).length} items`)
                .join(" · ")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {MEAL_ORDER.map((meal) => {
              const mealItems = dayItems.filter((i) => i.meal === meal);
              if (mealItems.length === 0) return null;
              const kcal = mealItems.reduce((s, i) => s + (i.calories ?? 0), 0);
              return (
                <div key={meal}>
                  <div className="mb-1 flex items-center justify-between">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--light-text-muted)" }}
                    >
                      {MEAL_LABELS[meal]}
                    </p>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                        {kcal} kcal
                      </span>
                      {loggedMeals.has(meal) && (
                        <span
                          className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                        >
                          <Check size={9} />
                          Logged
                        </span>
                      )}
                      <button
                        onClick={() => handleLog(meal, mealItems)}
                        disabled={loggingMeal !== null}
                        className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                        style={{
                          backgroundColor: "rgba(0,174,239,0.12)",
                          color: "var(--azfit-primary)",
                        }}
                        title={`Log all ${mealItems.length} items to today's ${MEAL_LABELS[meal]}`}
                      >
                        <ClipboardList size={10} />
                        {loggingMeal === meal
                          ? "Logging…"
                          : loggedMeals.has(meal)
                            ? "Log again"
                            : "Log"}
                      </button>
                    </span>
                  </div>
                  <div className="space-y-1">
                    {mealItems.map((item, idx) => (
                      <div
                        key={`${item.meal}-${item.name}-${idx}`}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5"
                        style={{ backgroundColor: "var(--light-elevated)" }}
                      >
                        <span className="truncate text-xs" style={{ color: "var(--page-text)" }}>
                          {item.name}
                        </span>
                        <span
                          className="shrink-0 text-[10px]"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          {item.serving_g}g{typeof item.calories === "number" ? ` • ${item.calories} kcal` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </motion.div>
  );
}
