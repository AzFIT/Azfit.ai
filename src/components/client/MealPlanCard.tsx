import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChefHat, RefreshCw, Save, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  generateMealPlan,
  filterFoods,
  MEAL_ORDER,
  type FoodInput,
  type GeneratedPlan,
  type MealPlanItem,
} from "@/lib/mealPlan";
import type { MacroTotals } from "@/lib/foodApi";
import type { Database, Json } from "@/types/supabase";

type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];

interface MealPlanCardProps {
  clientId: string; // clients.id
  targets: MacroTotals; // normalized in both profile modes
  restrictions: string[]; // intake restrictions + allergies
  diet?: string;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export default function MealPlanCard({ clientId, targets, restrictions, diet }: MealPlanCardProps) {
  const { user } = useAuth();
  const [savedPlan, setSavedPlan] = useState<MealPlanRow | null>(null);
  const [draft, setDraft] = useState<GeneratedPlan | null>(null);
  const [foods, setFoods] = useState<FoodInput[]>([]);
  const [seed, setSeed] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const ensureFoods = useCallback(async (): Promise<FoodInput[]> => {
    if (foods.length > 0) return foods;
    const { data, error } = await supabase
      .from("foods_cache")
      .select("id, name, brand, category, serving_size_g, calories, protein, carbs, fats")
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
        {displayItems && (
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
                    {mealTotals && (
                      <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                        {mealTotals.calories} kcal
                      </span>
                    )}
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
                            <button
                              onClick={() => handleSwap(globalIdx)}
                              className="p-1 rounded hover:opacity-80"
                              title="Swap this item"
                            >
                              <Shuffle size={11} style={{ color: "var(--azfit-primary)" }} />
                            </button>
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
              {draft && (
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
