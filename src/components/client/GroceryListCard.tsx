import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Printer, Check } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  buildGroceryList,
  applyMultiplier,
  formatQuantity,
  sinkChecked,
  mergeCheckedState,
  categoryLabel,
  CATEGORY_ORDER,
  type GroceryItem,
  type PlanItemLike,
} from "@/lib/groceryList";
import type { FoodInput } from "@/lib/mealPlan";
import type { Json } from "@/types/supabase";

/* ═══════════════════════════════════════════════════════════════════
   GroceryListCard (Phase 51) — a saved meal plan as a shopping list.
   Shared state lives on meal_plans.grocery_state (trainer writes).
   DEVIATION (verified + documented): meal_plans has NO client UPDATE
   policy and the brief says don't widen — client toggles persist
   locally (localStorage overlay) on top of the shared state.
   ═══════════════════════════════════════════════════════════════════ */

interface GroceryState {
  checked: string[];
  multiplier: number;
  days: number | null; // null = all days
}

interface Props {
  planId: string;
  items: PlanItemLike[];
  initialState: GroceryState | null;
  /** trainer (can write the shared row) vs client (local overlay) */
  canWriteShared: boolean;
}

const MULTIPLIERS = [1, 2, 4] as const;

export default function GroceryListCard({ planId, items, initialState, canWriteShared }: Props) {
  const navigate = useNavigate();
  const [foods, setFoods] = useState<FoodInput[]>([]);
  const [checked, setChecked] = useState<string[]>(() => {
    const base = initialState?.checked ?? [];
    if (canWriteShared) return base;
    // Client role: merge the device-local overlay over the shared state
    try {
      const local = JSON.parse(localStorage.getItem(`azfit_grocery_${planId}`) || "[]");
      if (Array.isArray(local)) {
        return [...new Set([...base, ...local.filter((x): x is string => typeof x === "string")])];
      }
    } catch {
      /* ignore */
    }
    return base;
  });
  const [multiplier, setMultiplier] = useState(initialState?.multiplier ?? 1);
  const [days, setDays] = useState<number | null>(initialState?.days ?? null);
  const planDays = useMemo(
    () => Math.max(1, ...items.map((i) => i.day ?? 1)),
    [items],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("foods_cache")
        .select("id, name, brand, category, serving_size_g, calories, protein, carbs, fats, source")
        .order("source", { ascending: false })
        .limit(500);
      if (!cancelled && data) setFoods(data as FoodInput[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const baseList = useMemo(
    () => buildGroceryList(items, foods, days ? Array.from({ length: Math.min(days, planDays) }, (_, i) => i + 1) : null),
    [items, foods, days, planDays],
  );
  const list = useMemo(() => applyMultiplier(baseList, multiplier), [baseList, multiplier]);
  const checkedSet = useMemo(() => new Set(checked), [checked]);
  const doneCount = list.filter((i) => checkedSet.has(i.key)).length;

  const persist = (next: GroceryState) => {
    if (canWriteShared) {
      supabase
        .from("meal_plans")
        .update({ grocery_state: next as unknown as Json })
        .eq("id", planId)
        .then(({ error }) => {
          if (error) toast.error("Couldn't save the list state");
        });
    } else {
      try {
        const local = JSON.parse(localStorage.getItem(`azfit_grocery_${planId}`) || "[]");
        const merged = [...new Set([...(Array.isArray(local) ? local : []), ...next.checked])];
        localStorage.setItem(`azfit_grocery_${planId}`, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
    }
  };

  const toggleItem = (item: GroceryItem) => {
    const on = !checkedSet.has(item.key);
    const nextChecked = mergeCheckedState(checked, item.key, on);
    setChecked(nextChecked);
    persist({ checked: nextChecked, multiplier, days });
  };

  const changeMultiplier = (m: number) => {
    setMultiplier(m);
    persist({ checked, multiplier: m, days });
  };

  const changeDays = (d: number | null) => {
    setDays(d);
    persist({ checked, multiplier, days: d });
  };

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
        Save a meal plan first —{" "}
        <button
          onClick={() => navigate("/nutrition")}
          className="font-semibold underline"
          style={{ color: "var(--azfit-primary)" }}
        >
          open Nutrition
        </button>
      </p>
    );
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: sinkChecked(list.filter((i) => i.category === cat), checkedSet),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={days ?? "all"}
          onChange={(e) => changeDays(e.target.value === "all" ? null : Number(e.target.value))}
          className="rounded-lg border px-2 py-1 text-[11px]"
          style={{ backgroundColor: "var(--light-elevated)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
          title="Days included"
        >
          <option value="all">All {planDays} days</option>
          {planDays >= 3 && <option value={3}>First 3 days</option>}
          {planDays >= 5 && <option value={5}>First 5 days</option>}
        </select>
        <div className="flex items-center gap-1">
          {MULTIPLIERS.map((m) => (
            <button
              key={m}
              onClick={() => changeMultiplier(m)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold transition"
              style={
                multiplier === m
                  ? { background: "linear-gradient(135deg, #00AEEF, #8B5CF6)", color: "#fff" }
                  : { backgroundColor: "var(--light-elevated)", color: "var(--light-text-muted)" }
              }
            >
              ×{m}
            </button>
          ))}
        </div>
        <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
          {doneCount} of {list.length} items
        </span>
        <button
          onClick={() => navigate(`/print/grocery/${planId}`)}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
          style={{ color: "var(--azfit-primary)" }}
          title="Print the grocery list"
        >
          <Printer size={12} />
          Print
        </button>
      </div>

      {/* Sections */}
      {list.length === 0 ? (
        <p className="py-3 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
          No items in this range.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ cat, items: catItems }) => (
            <div key={cat}>
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: cat === "unmatched" ? "#F59E0B" : "var(--light-text-muted)" }}
              >
                {categoryLabel(cat)}
              </p>
              <div className="space-y-1">
                {catItems.map((item) => {
                  const isChecked = checkedSet.has(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggleItem(item)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition"
                      style={{
                        backgroundColor: "var(--light-elevated)",
                        opacity: isChecked ? 0.55 : 1,
                      }}
                      title={`${item.name} — ${Math.round(item.kcal)} kcal · P ${Math.round(item.protein)}g · C ${Math.round(item.carbs)}g · F ${Math.round(item.fats)}g`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                          style={{
                            borderColor: isChecked ? "#22C55E" : "var(--card-border)",
                            backgroundColor: isChecked ? "rgba(34,197,94,0.15)" : "transparent",
                          }}
                        >
                          {isChecked && <Check size={11} style={{ color: "#22C55E" }} />}
                        </span>
                        <span
                          className="truncate text-xs"
                          style={{
                            color: "var(--page-text)",
                            textDecoration: isChecked ? "line-through" : "none",
                          }}
                        >
                          {item.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                        {formatQuantity(item.grams)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {grouped.some((g) => g.cat === "unmatched") && (
        <p className="mt-2 text-[10px]" style={{ color: "#F59E0B" }}>
          Some items couldn't be matched to the food catalog — shown as-is at the bottom.
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
        <ShoppingCart size={10} />
        Quantities are the plan's servings totalled across the selected days.
      </div>
    </div>
  );
}
