import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChefHat, Check, ClipboardList, RefreshCw, Save, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  generateMealPlan,
  filterFoods,
  resolvePlanFood,
  MEAL_ORDER,
  type FoodInput,
  type GeneratedPlan,
  type MealPlanItem,
  type MealType,
} from "@/lib/mealPlan";
import { addFoodToLog, type MacroTotals } from "@/lib/foodApi";
import type { Database, Json } from "@/types/supabase";

type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];

interface MealPlanCardProps {
  clientId: string; // clients.id
  targets: MacroTotals; // normalized in both profile modes
  restrictions: string[]; // intake restrictions + allergies
  diet?: string;
  /** Phase 38: show per-meal "Log" actions that insert nutrition_logs
   * for the SIGNED-IN user. Only pass true on the client's own
   * Nutrition page — RLS allows inserting own logs only, so the
   * trainer view never gets this (documented deviation). */
  canLog?: boolean;
  /** Called after a successful log so the parent can refresh its day view */
  onLogged?: () => void;
}

/** Client-local today as YYYY-MM-DD (toISOString would be UTC). */
function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export default function MealPlanCard({ clientId, targets, restrictions, diet, canLog = false, onLogged }: MealPlanCardProps) {
  const { user } = useAuth();
  const [savedPlan, setSavedPlan] = useState<MealPlanRow | null>(null);
  const [draft, setDraft] = useState<GeneratedPlan | null>(null);
  const [foods, setFoods] = useState<FoodInput[]>([]);
  const [seed, setSeed] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(new Set());
  const [loggingMeal, setLoggingMeal] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) setSavedPlan(data as MealPlanRow);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadPlan();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlan]);

  // Phase 38: which plan meals already have logs today (own view only)
  useEffect(() => {
    if (!canLog) return;
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("nutrition_logs")
        .select("meal_type")
        .eq("user_id", uid)
        .eq("logged_date", todayLocal());
      if (cancelled || !data) return;
      setLoggedMeals(new Set(data.map((r) => r.meal_type as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [canLog]);

  const ensureFoods = useCallback(async (): Promise<FoodInput[]> => {
    if (foods.length > 0) return foods;
    const { data, error } = await supabase
      .from("foods_cache")
      .select("id, name, brand, category, serving_size_g, calories, protein, carbs, fats, source")
      // Phase 39: 'seed-staples' sorts last alphabetically — descending puts
      // staples first so the 500-row cap can never crowd them out.
      .order("source", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Failed to load foods: " + error.message);
      return [];
    }
    const rows = (data as FoodInput[]) || [];
    setFoods(rows);
    return rows;
  }, [foods]);

  const handleGenerate = useCallback(async () => {
    const pool = await ensureFoods();
    if (pool.length === 0) {
      toast.error("No foods in the database yet — log some food first");
      return;
    }
    const plan = generateMealPlan(pool, targets, { restrictions, diet, seed });
    if (plan.items.length === 0) {
      toast.error("No suitable foods after applying restrictions/diet");
      return;
    }
    setDraft(plan);
  }, [ensureFoods, targets, restrictions, diet, seed]);

  const handleRegenerate = useCallback(async () => {
    const next = seed + 1;
    setSeed(next);
    const pool = await ensureFoods();
    const plan = generateMealPlan(pool, targets, { restrictions, diet, seed: next });
    if (plan.items.length > 0) setDraft(plan);
  }, [ensureFoods, targets, restrictions, diet, seed]);

  const handleSwap = useCallback(
    async (index: number) => {
      if (!draft) {
        // Swapping in the saved view converts it into a draft first
        if (!savedPlan) return;
        const items = savedPlan.items as unknown as MealPlanItem[];
        const rebuilt: GeneratedPlan = {
          items,
          byMeal: draftTotals(items).byMeal,
          totals: draftTotals(items).totals,
        };
        setDraft(rebuilt);
        return;
      }
      const pool = await ensureFoods();
      const current = draft.items[index];
      const candidates = shuffleFree(
        filterFoods(pool, restrictions, diet).filter(
          (f) => !draft.items.some((it) => it.name.startsWith(f.name)),
        ),
        index + seed,
      );
      if (candidates.length === 0) {
        toast.error("No alternative foods left for this slot");
        return;
      }
      const replacement = candidates[0];
      const serving = Math.max(
        15,
        Math.round(((current.calories / replacement.calories) * replacement.serving_size_g) / 5) * 5,
      );
      const ratio = serving / replacement.serving_size_g;
      const newItem: MealPlanItem = {
        meal: current.meal,
        name: replacement.brand ? `${replacement.name} (${replacement.brand})` : replacement.name,
        serving_g: serving,
        calories: Math.round(replacement.calories * ratio),
        protein: Math.round(replacement.protein * ratio * 10) / 10,
        carbs: Math.round(replacement.carbs * ratio * 10) / 10,
        fats: Math.round(replacement.fats * ratio * 10) / 10,
      };
      const items = draft.items.map((it, i) => (i === index ? newItem : it));
      setDraft({ items, ...draftTotals(items) });
    },
    [draft, savedPlan, ensureFoods, restrictions, diet, seed],
  );

  const handleSave = useCallback(async () => {
    if (!draft || saving) return;
    if (savedPlan && !window.confirm("Overwrite the saved meal plan for this client?")) return;
    setSaving(true);
    try {
      const targetsSnapshot = { ...targets } as unknown as Json;
      const itemsJson = draft.items as unknown as Json;
      if (savedPlan) {
        const { error } = await supabase
          .from("meal_plans")
          .update({ targets: targetsSnapshot, items: itemsJson, updated_at: new Date().toISOString() })
          .eq("id", savedPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_plans").insert({
          client_id: clientId,
          targets: targetsSnapshot,
          items: itemsJson,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
      toast.success("Meal plan saved");
      setDraft(null);
      await loadPlan();
    } catch (err) {
      toast.error("Failed to save plan: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }, [draft, savedPlan, saving, targets, clientId, user?.id, loadPlan]);

  // Phase 38, Item 1 — log a whole plan meal into today's nutrition_logs.
  // Items store no food id: resolve names via resolvePlanFood (exact
  // match only), skip + report anything unmatched, never insert garbage.
  const handleLogMeal = useCallback(
    async (meal: MealType, items: MealPlanItem[]) => {
      if (loggingMeal) return;
      setLoggingMeal(meal);
      try {
        const pool = await ensureFoods();
        let logged = 0;
        let skipped = 0;
        for (const it of items) {
          const food = resolvePlanFood(it.name, pool);
          if (!food) {
            skipped++;
            continue;
          }
          await addFoodToLog(meal, food.id, it.serving_g, todayLocal());
          logged++;
        }
        if (logged > 0) {
          toast.success(`Logged ${logged} items to ${MEAL_LABELS[meal]} ✅`);
          setLoggedMeals((prev) => new Set(prev).add(meal));
          onLogged?.();
        }
        if (skipped > 0) {
          toast.warning(`${skipped} skipped — not in food database`);
        }
        if (logged === 0) {
          toast.error("No items matched the food database — nothing logged");
        }
      } catch (err) {
        toast.error(
          "Failed to log meal: " + (err instanceof Error ? err.message : "Unknown error"),
        );
      } finally {
        setLoggingMeal(null);
      }
    },
    [loggingMeal, ensureFoods, onLogged],
  );

  // What to display: draft wins, else saved
  const displayItems: MealPlanItem[] | null = draft
    ? draft.items
    : savedPlan
      ? (savedPlan.items as unknown as MealPlanItem[])
      : null;
  const displayTotals = draft
    ? draft.totals
    : savedPlan
      ? draftTotals((savedPlan.items as unknown as MealPlanItem[]) || []).totals
      : null;
  const byMeal = draft
    ? draft.byMeal
    : savedPlan
      ? draftTotals((savedPlan.items as unknown as MealPlanItem[]) || []).byMeal
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 }}
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={16} style={{ color: "#8B5CF6" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Meal Plan
          </span>
          {savedPlan && !draft && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22C55E" }}
            >
              saved
            </span>
          )}
          {draft && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
            >
              draft
            </span>
          )}
        </div>
        {displayItems && !canLog && (
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ color: "var(--azfit-primary)" }}
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl" style={{ backgroundColor: "var(--light-elevated)" }} />
      ) : !displayItems ? (
        canLog ? (
          <p className="py-4 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
            No meal plan yet — your trainer can create one from your Nutrition tab.
          </p>
        ) : (
        <div className="flex flex-col items-center py-4">
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            No meal plan yet — generate one from {targets.calories} kcal of targets.
          </p>
          <button
            onClick={handleGenerate}
            className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--azfit-primary)" }}
          >
            <ChefHat size={14} />
            Generate meal plan
          </button>
        </div>
        )
      ) : (
        <>
          <div className="space-y-3">
            {MEAL_ORDER.map((meal) => {
              const items = displayItems.filter((i) => i.meal === meal);
              if (items.length === 0) return null;
              const mealTotals = byMeal?.[meal];
              return (
                <div key={meal}>
                  <div className="flex items-center justify-between mb-1">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--light-text-muted)" }}
                    >
                      {MEAL_LABELS[meal]}
                    </p>
                    <span className="flex items-center gap-2">
                      {mealTotals && (
                        <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                          {mealTotals.calories} kcal
                        </span>
                      )}
                      {canLog && !draft && (
                        <>
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
                            onClick={() => handleLogMeal(meal, items)}
                            disabled={loggingMeal !== null}
                            className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                            style={{
                              backgroundColor: "rgba(0,174,239,0.12)",
                              color: "var(--azfit-primary)",
                            }}
                            title={`Log all ${items.length} items to today's ${MEAL_LABELS[meal]}`}
                          >
                            <ClipboardList size={10} />
                            {loggingMeal === meal
                              ? "Logging…"
                              : loggedMeals.has(meal)
                                ? "Log again"
                                : "Log"}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const globalIdx = displayItems.indexOf(item);
                      return (
                        <div
                          key={`${item.meal}-${item.name}-${globalIdx}`}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5"
                          style={{ backgroundColor: "var(--light-elevated)" }}
                        >
                          <span className="text-xs truncate" style={{ color: "var(--page-text)" }}>
                            {item.name}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                              {item.serving_g}g • {item.calories} kcal
                            </span>
                            {!canLog && (
                              <button
                                onClick={() => handleSwap(globalIdx)}
                                className="p-1 rounded hover:opacity-80"
                                title="Swap this item"
                              >
                                <Shuffle size={11} style={{ color: "var(--azfit-primary)" }} />
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {displayTotals && (
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2"
              style={{ borderColor: "var(--card-border)" }}
            >
              <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                Day: <strong style={{ color: "var(--page-text)" }}>{displayTotals.calories}</strong>/{targets.calories} kcal
                {" • "}P {displayTotals.protein}/{targets.protein}g
                {" • "}C {displayTotals.carbs}/{targets.carbs}g
                {" • "}F {displayTotals.fats}/{targets.fats}g
              </p>
              {draft && !canLog && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
                >
                  <Save size={12} />
                  {saving ? "Saving…" : savedPlan ? "Overwrite plan" : "Save plan"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function draftTotals(items: MealPlanItem[]): Pick<GeneratedPlan, "byMeal" | "totals"> {
  const zero = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const byMeal: GeneratedPlan["byMeal"] = {
    breakfast: { ...zero },
    lunch: { ...zero },
    dinner: { ...zero },
    snacks: { ...zero },
  };
  const totals = { ...zero };
  for (const it of items) {
    byMeal[it.meal].calories += it.calories;
    byMeal[it.meal].protein += it.protein;
    byMeal[it.meal].carbs += it.carbs;
    byMeal[it.meal].fats += it.fats;
    totals.calories += it.calories;
    totals.protein += it.protein;
    totals.carbs += it.carbs;
    totals.fats += it.fats;
  }
  for (const m of MEAL_ORDER) {
    byMeal[m].protein = Math.round(byMeal[m].protein * 10) / 10;
    byMeal[m].carbs = Math.round(byMeal[m].carbs * 10) / 10;
    byMeal[m].fats = Math.round(byMeal[m].fats * 10) / 10;
  }
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fats = Math.round(totals.fats * 10) / 10;
  return { byMeal, totals };
}

function shuffleFree<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let a = seed >>> 0 || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    a = (a * 1664525 + 1013904223) >>> 0;
    const j = a % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
