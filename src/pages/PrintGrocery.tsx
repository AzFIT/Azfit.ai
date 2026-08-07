import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buildGroceryList,
  applyMultiplier,
  formatQuantity,
  categoryLabel,
  CATEGORY_ORDER,
  type PlanItemLike,
} from "@/lib/groceryList";
import type { FoodInput } from "@/lib/mealPlan";

/* ═══════════════════════════════════════════════════════════════════
   PrintGrocery (Phase 51) — ink-friendly A4 grocery sheet for a saved
   meal plan. Same print pattern as PrintProgram (34): @page rules,
   .no-print toolbar, black-on-white only.
   ═══════════════════════════════════════════════════════════════════ */

export default function PrintGrocery() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<{
    planName: string;
    clientName: string;
    days: number;
    multiplier: number;
    checked: Set<string>;
    groups: { cat: string; items: { key: string; name: string; grams: number }[] }[];
    unmatched: number;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      const { data: plan } = await supabase
        .from("meal_plans")
        .select("id, name, items, grocery_state, client_id")
        .eq("id", planId)
        .maybeSingle();
      if (!plan) {
        if (!cancelled) setError(true);
        return;
      }
      const [{ data: foods }, { data: clientRow }] = await Promise.all([
        supabase
          .from("foods_cache")
          .select("id, name, brand, category, serving_size_g, calories, protein, carbs, fats, source")
          .order("source", { ascending: false })
          .limit(500),
        supabase.from("clients").select("full_name").eq("id", plan.client_id).maybeSingle(),
      ]);
      if (cancelled) return;

      const gs = (plan.grocery_state as { checked?: string[]; multiplier?: number; days?: number | null } | null) ?? null;
      const items = (plan.items as unknown as PlanItemLike[]) || [];
      const planDays = Math.max(1, ...items.map((i) => i.day ?? 1));
      const dayFilter = gs?.days
        ? Array.from({ length: Math.min(gs.days, planDays) }, (_, i) => i + 1)
        : null;
      const mult = gs?.multiplier ?? 1;
      const list = applyMultiplier(
        buildGroceryList(items, (foods as FoodInput[]) || [], dayFilter),
        mult,
      );
      setState({
        planName: plan.name || "Meal Plan",
        clientName: clientRow?.full_name ?? "",
        days: gs?.days ?? planDays,
        multiplier: mult,
        checked: new Set(gs?.checked ?? []),
        groups: CATEGORY_ORDER.map((cat) => ({ cat, items: list.filter((i) => i.category === cat) })).filter(
          (g) => g.items.length > 0,
        ),
        unmatched: list.filter((i) => !i.matched).length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .grocery-section { page-break-inside: avoid; }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
        >
          <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-[190mm] px-6 py-6">
        {error ? (
          <p className="py-16 text-center text-sm text-gray-500">Meal plan not found.</p>
        ) : !state ? (
          <p className="py-16 text-center text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <header className="border-b-2 border-gray-900 pb-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">AzFIT</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight">
                Grocery List — {state.planName}
              </h1>
              <p className="mt-1 text-[11px] text-gray-600">
                {state.clientName && <><span className="font-semibold text-gray-900">{state.clientName}</span> · </>}
                {state.days} day{state.days !== 1 ? "s" : ""}{state.multiplier > 1 && ` · ×${state.multiplier} servings`}
                {" · "}Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </header>

            {state.groups.map(({ cat, items }) => (
              <section key={cat} className="grocery-section mt-4">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {categoryLabel(cat)}
                </h2>
                <ul className="mt-1.5 divide-y divide-gray-100">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-center gap-3 py-1.5">
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 border border-gray-400"
                        style={{
                          backgroundColor: state.checked.has(item.key) ? "#d1d5db" : "transparent",
                        }}
                      />
                      <span className="flex-1 text-[12px] font-medium text-gray-900">{item.name}</span>
                      <span className="text-[11px] font-semibold text-gray-600">{formatQuantity(item.grams)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {state.unmatched > 0 && (
              <p className="mt-4 text-[10px] text-gray-500">
                {state.unmatched} item{state.unmatched !== 1 ? "s" : ""} couldn't be matched to the food catalog — listed under Unmatched.
              </p>
            )}

            <footer className="mt-6 border-t border-gray-200 pt-2 text-[10px] text-gray-400">
              Generated by AzFIT · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
