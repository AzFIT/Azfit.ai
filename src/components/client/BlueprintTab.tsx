/* ═══════════════════════════════════════════════════════════════
   BlueprintTab (Phase 79 Item 2) — the "Smart Blueprint" INPUT
   panel on the client profile (trainer view). Captures deep client
   context into client_plan_blueprints (one row per client). This
   phase is input + persistence ONLY — no plan generation.
   Food chips come from foods_cache (source='seed-staples' — the
   repo's own seeded staple list, reused per the phase brief).
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Save, LoaderCircle, CircleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ArcSlider from "@/components/ui/ArcSlider";
import { cn } from "@/lib/utils";
import {
  EMPTY_BLUEPRINT,
  EQUIPMENT_OPTIONS,
  DIET_OPTIONS,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  blueprintFromRow,
  blueprintToPayload,
  toggleInList,
  type MealCategory,
  type PlanBlueprintInput,
  type BlueprintRow,
} from "@/lib/planBlueprintInput";

interface StapleFood {
  name: string;
  category: string;
}

const CATEGORY_ORDER = ["protein", "carbs", "fats", "vegetables", "fruit", "dairy", "snacks"];
const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins",
  carbs: "Carbs",
  fats: "Fats",
  vegetables: "Vegetables",
  fruit: "Fruit",
  dairy: "Dairy",
  snacks: "Snacks",
};

const selectCls =
  "w-full rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] px-3 py-2 text-sm text-[var(--page-text)] focus:border-[var(--azfit-primary)] focus:outline-none";

function Chip({
  label,
  selected,
  tone,
  onToggle,
}: {
  label: string;
  selected: boolean;
  tone: "include" | "exclude";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        selected
          ? tone === "include"
            ? "border-[var(--azfit-primary)] bg-[color-mix(in_srgb,var(--azfit-primary)_15%,transparent)] text-[var(--azfit-primary)]"
            : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]"
          : "border-[var(--card-border)] bg-[var(--page-bg)] text-[var(--light-text-secondary)] hover:border-[var(--azfit-primary)]/40",
      )}
    >
      {label}
    </button>
  );
}

function FoodGroups({
  foods,
  selected,
  tone,
  onToggle,
}: {
  foods: StapleFood[];
  selected: string[];
  tone: "include" | "exclude";
  onToggle: (name: string) => void;
}) {
  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map((cat) => {
        const group = foods.filter((f) => f.category === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--light-text-muted)]">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.map((f) => (
                <Chip
                  key={f.name}
                  label={f.name}
                  selected={selected.includes(f.name)}
                  tone={tone}
                  onToggle={() => onToggle(f.name)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BlueprintTab({ clientId }: { clientId: string }) {
  const [blueprint, setBlueprint] = useState<PlanBlueprintInput>(EMPTY_BLUEPRINT);
  const [loaded, setLoaded] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [foods, setFoods] = useState<StapleFood[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openMeals, setOpenMeals] = useState<MealCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [bpRes, foodsRes] = await Promise.all([
        supabase
          .from("client_plan_blueprints")
          .select("*")
          .eq("client_id", clientId)
          .maybeSingle(),
        supabase
          .from("foods_cache")
          .select("name, category")
          .eq("source", "seed-staples")
          .order("category")
          .order("name"),
      ]);
      if (cancelled) return;
      if (bpRes.data) {
        setBlueprint(blueprintFromRow(bpRes.data as unknown as BlueprintRow));
        setHasExisting(true);
      }
      setFoods((foodsRes.data as StapleFood[] | null) ?? []);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const patch = useCallback((p: Partial<PlanBlueprintInput>) => {
    setBlueprint((prev) => ({ ...prev, ...p }));
  }, []);

  const patchMeals = useCallback((cat: MealCategory, list: string[]) => {
    setBlueprint((prev) => ({
      ...prev,
      dietPreferences: {
        ...prev.dietPreferences,
        meals: { ...prev.dietPreferences.meals, [cat]: list },
      },
    }));
  }, []);

  const toggleMealSection = (cat: MealCategory) =>
    setOpenMeals((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = blueprintToPayload(blueprint);
      const { error } = await supabase
        .from("client_plan_blueprints")
        .upsert({ client_id: clientId, ...payload }, { onConflict: "client_id" });
      if (error) throw error;
      setHasExisting(true);
      toast.success("Blueprint saved");
      setSaving(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const mealCount = useMemo(
    () => MEAL_CATEGORIES.reduce((n, c) => n + blueprint.dietPreferences.meals[c].length, 0),
    [blueprint.dietPreferences.meals],
  );

  if (!loaded) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!hasExisting && (
        <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--light-text-secondary)]">
          No blueprint saved yet — fill in what you know and hit Save. Everything here feeds the
          Plan Summary in a later phase; nothing is pre-filled.
        </p>
      )}

      {/* Training context */}
      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--page-text)]">Training Context</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--light-text-secondary)]">Equipment Access</label>
            <select
              className={selectCls}
              value={blueprint.equipmentAccess ?? ""}
              onChange={(e) => patch({ equipmentAccess: (e.target.value || null) as PlanBlueprintInput["equipmentAccess"] })}
            >
              <option value="">Select equipment…</option>
              {EQUIPMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--light-text-secondary)]">Injuries & Limitations</label>
            <textarea
              value={blueprint.injuriesNotes}
              onChange={(e) => patch({ injuriesNotes: e.target.value })}
              rows={3}
              placeholder="e.g. Left knee — avoid deep flexion; lower-back sensitivity on loaded hinges"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] px-3 py-2 text-sm text-[var(--page-text)] placeholder:text-[var(--light-text-muted)] focus:border-[var(--azfit-primary)] focus:outline-none"
            />
          </div>
          {/* stacked on mobile (2× 200px dials side-by-side would
              overflow 390px — caught by the smoke), 2-col ≥ sm */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--light-text-secondary)]">Stress Level (1–10)</label>
              <ArcSlider
                value={blueprint.stressLevel}
                min={1}
                max={10}
                step={1}
                unit="/ 10"
                onChange={(v) => patch({ stressLevel: v })}
                aria-label="Stress level"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--light-text-secondary)]">Sleep Quality (1–10)</label>
              <ArcSlider
                value={blueprint.sleepQuality}
                min={1}
                max={10}
                step={1}
                unit="/ 10"
                onChange={(v) => patch({ sleepQuality: v })}
                aria-label="Sleep quality"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Diet */}
      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--page-text)]">Diet</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--light-text-secondary)]">Dietary Restrictions</label>
            <select
              className={selectCls}
              value={blueprint.dietaryRestriction ?? ""}
              onChange={(e) => patch({ dietaryRestriction: (e.target.value || null) as PlanBlueprintInput["dietaryRestriction"] })}
            >
              <option value="">Select restriction…</option>
              {DIET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--light-text-secondary)]">
              Foods to Include
              {blueprint.dietPreferences.included.length > 0 && (
                <span className="ml-1 text-[var(--azfit-primary)]">({blueprint.dietPreferences.included.length})</span>
              )}
            </p>
            <FoodGroups
              foods={foods}
              selected={blueprint.dietPreferences.included}
              tone="include"
              onToggle={(name) =>
                patch({
                  dietPreferences: {
                    ...blueprint.dietPreferences,
                    included: toggleInList(blueprint.dietPreferences.included, name),
                  },
                })
              }
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--light-text-secondary)]">
              Foods to Exclude
              {blueprint.dietPreferences.excluded.length > 0 && (
                <span className="ml-1 text-[var(--danger)]">({blueprint.dietPreferences.excluded.length})</span>
              )}
            </p>
            <FoodGroups
              foods={foods}
              selected={blueprint.dietPreferences.excluded}
              tone="exclude"
              onToggle={(name) =>
                patch({
                  dietPreferences: {
                    ...blueprint.dietPreferences,
                    excluded: toggleInList(blueprint.dietPreferences.excluded, name),
                  },
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Meal preferences */}
      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <h3 className="mb-1 text-sm font-semibold text-[var(--page-text)]">Meal Preferences</h3>
        <p className="mb-3 text-xs text-[var(--light-text-muted)]">
          {mealCount > 0 ? `${mealCount} foods picked across meals` : "Pick foods per meal occasion (optional)"}
        </p>
        <div className="space-y-2">
          {MEAL_CATEGORIES.map((cat) => {
            const open = openMeals.includes(cat);
            const count = blueprint.dietPreferences.meals[cat].length;
            return (
              <div key={cat} className="rounded-xl border border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => toggleMealSection(cat)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-xs font-semibold text-[var(--page-text)]">
                    {MEAL_CATEGORY_LABELS[cat]}
                    {count > 0 && <span className="ml-1.5 text-[var(--azfit-primary)]">({count})</span>}
                  </span>
                  <ChevronDown size={14} className={cn("text-[var(--light-text-muted)] transition-transform", open && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[var(--card-border)] px-3 py-3">
                        <FoodGroups
                          foods={foods}
                          selected={blueprint.dietPreferences.meals[cat]}
                          tone="include"
                          onToggle={(name) => patchMeals(cat, toggleInList(blueprint.dietPreferences.meals[cat], name))}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Save */}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))" }}
      >
        <Save size={16} />
        {hasExisting ? "Save Changes" : "Save Blueprint"}
      </button>

      {/* Phase 66-style blocking save overlay */}
      <AnimatePresence>
        {(saving || saveError) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-xs rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center shadow-2xl">
              {saving && !saveError ? (
                <>
                  <LoaderCircle className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--azfit-primary)]" />
                  <p className="text-sm font-medium text-[var(--page-text)]">Saving blueprint…</p>
                </>
              ) : (
                <>
                  <CircleAlert className="mx-auto mb-3 h-8 w-8 text-[var(--danger)]" />
                  <p className="text-sm font-medium text-[var(--page-text)]">Couldn't save</p>
                  <p className="mt-1 text-xs text-[var(--light-text-muted)]">{saveError}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setSaveError(null)}
                      className="flex-1 rounded-lg border border-[var(--card-border)] py-2 text-xs font-semibold text-[var(--page-text)]"
                    >
                      Back to editing
                    </button>
                    <button
                      onClick={save}
                      className="flex-1 rounded-lg py-2 text-xs font-semibold text-white"
                      style={{ backgroundColor: "var(--azfit-primary)" }}
                    >
                      Retry
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
