 
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, X, Trash2, Coffee, Sun, Moon, Cookie,
  Droplets, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProgressRing from '@/components/ProgressRing';

/* ── Types & Data ──────────────────────────────────────── */

interface FoodItem {
  id: string;
  name: string;
  category: string;
  servingSize: number;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

interface MealEntry {
  foodId: string;
  quantity: number;
}

interface Meal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: MealEntry[];
}

interface DailyLog {
  date: string;
  meals: Meal[];
  waterIntake: number;
}

const FOOD_DB: FoodItem[] = [
  { id: '1', name: 'Chicken Breast', category: 'Protein', servingSize: 100, calories: 165, protein: 31, fats: 3.6, carbs: 0 },
  { id: '2', name: 'Rice (white, cooked)', category: 'Grains', servingSize: 100, calories: 130, protein: 2.7, fats: 0.3, carbs: 28 },
  { id: '3', name: 'Eggs (whole)', category: 'Protein', servingSize: 50, calories: 72, protein: 6.3, fats: 5, carbs: 0.4 },
  { id: '4', name: 'Salmon', category: 'Protein', servingSize: 100, calories: 208, protein: 20, fats: 13, carbs: 0 },
  { id: '5', name: 'Broccoli', category: 'Vegetables', servingSize: 100, calories: 34, protein: 2.8, fats: 0.4, carbs: 7 },
  { id: '6', name: 'Oats', category: 'Grains', servingSize: 40, calories: 150, protein: 5, fats: 2.5, carbs: 27 },
  { id: '7', name: 'Greek Yogurt', category: 'Dairy', servingSize: 170, calories: 100, protein: 17, fats: 0.7, carbs: 6 },
  { id: '8', name: 'Banana', category: 'Fruits', servingSize: 118, calories: 105, protein: 1.3, fats: 0.4, carbs: 27 },
  { id: '9', name: 'Almonds', category: 'Nuts', servingSize: 28, calories: 164, protein: 6, fats: 14, carbs: 6 },
  { id: '10', name: 'Sweet Potato', category: 'Vegetables', servingSize: 100, calories: 86, protein: 1.6, fats: 0.1, carbs: 20 },
  { id: '11', name: 'Tuna (canned)', category: 'Protein', servingSize: 100, calories: 116, protein: 26, fats: 1, carbs: 0 },
  { id: '12', name: 'Avocado', category: 'Fats', servingSize: 100, calories: 160, protein: 2, fats: 15, carbs: 9 },
  { id: '13', name: 'Pasta (cooked)', category: 'Grains', servingSize: 100, calories: 131, protein: 5, fats: 1.1, carbs: 25 },
  { id: '14', name: 'Protein Shake', category: 'Supplements', servingSize: 30, calories: 120, protein: 24, fats: 1, carbs: 3 },
  { id: '15', name: 'Olive Oil', category: 'Fats', servingSize: 15, calories: 120, protein: 0, fats: 14, carbs: 0 },
];

const MEAL_TYPES = [
  { type: 'breakfast' as const, label: 'Breakfast', icon: Coffee },
  { type: 'lunch' as const, label: 'Lunch', icon: Sun },
  { type: 'dinner' as const, label: 'Dinner', icon: Moon },
  { type: 'snack' as const, label: 'Snacks', icon: Cookie },
];

const STORAGE_KEY = 'azfit_nutrition_log';
const PLAN_KEY = 'azfit_nutrition_plan';

function getLog(date: string): DailyLog {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, DailyLog>;
    return all[date] || { date, meals: MEAL_TYPES.map((m) => ({ type: m.type, foods: [] })), waterIntake: 0 };
  } catch { return { date, meals: MEAL_TYPES.map((m) => ({ type: m.type, foods: [] })), waterIntake: 0 }; }
}

function saveLog(log: DailyLog) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, DailyLog>;
    all[log.date] = log;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function getTargets() {
  try {
    const plan = JSON.parse(localStorage.getItem(PLAN_KEY) || '{}');
    return {
      calories: plan.calorieGoal || 2000,
      protein: plan.proteinGrams || 150,
      fats: plan.fatsGrams || 70,
      carbs: plan.carbsGrams || 200,
      water: plan.waterGoal || 2500,
    };
  } catch { return { calories: 2000, protein: 150, fats: 70, carbs: 200, water: 2500 }; }
}

/* ── Main Component ────────────────────────────────────── */

export default function NutritionPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [log, setLog] = useState<DailyLog>(() => getLog(date));
  const [showFoodSearch, setShowFoodSearch] = useState<string | null>(null);
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({
    breakfast: true, lunch: true, dinner: true, snack: true,
  });

  const targets = useMemo(() => getTargets(), []);

  const totals = useMemo(() => {
    let calories = 0, protein = 0, fats = 0, carbs = 0;
    log.meals.forEach((meal) => {
      meal.foods.forEach((entry) => {
        const food = FOOD_DB.find((f) => f.id === entry.foodId);
        if (food) {
          const ratio = entry.quantity / food.servingSize;
          calories += food.calories * ratio;
          protein += food.protein * ratio;
          fats += food.fats * ratio;
          carbs += food.carbs * ratio;
        }
      });
    });
    return { calories: Math.round(calories), protein: Math.round(protein), fats: Math.round(fats), carbs: Math.round(carbs) };
  }, [log]);

  const updateLog = useCallback((newLog: DailyLog) => {
    setLog(newLog);
    saveLog(newLog);
  }, []);

  const addFood = (mealType: string, foodId: string, quantity: number) => {
    const newLog = {
      ...log,
      meals: log.meals.map((m) =>
        m.type === mealType ? { ...m, foods: [...m.foods, { foodId, quantity }] } : m
      ),
    };
    updateLog(newLog);
    setShowFoodSearch(null);
  };

  const removeFood = (mealType: string, index: number) => {
    const newLog = {
      ...log,
      meals: log.meals.map((m) =>
        m.type === mealType ? { ...m, foods: m.foods.filter((_, i) => i !== index) } : m
      ),
    };
    updateLog(newLog);
  };

  const addWater = (amount: number) => {
    updateLog({ ...log, waterIntake: Math.max(0, log.waterIntake + amount) });
  };

  return (
    <div className="min-h-[100dvh] pb-32" style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Nutrition Tracker</h1>

        {/* Date + Macro Rings */}
        <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLog(getLog(e.target.value)); }} className="mb-4" />
          <div className="grid grid-cols-4 gap-2">
            <MacroRing label="Cal" current={totals.calories} target={targets.calories} color="#00AEEF" />
            <MacroRing label="Protein" current={totals.protein} target={targets.protein} color="#0D9488" />
            <MacroRing label="Fats" current={totals.fats} target={targets.fats} color="#F59E0B" />
            <MacroRing label="Carbs" current={totals.carbs} target={targets.carbs} color="#22C55E" />
          </div>
        </div>

        {/* Meals */}
        <div className="space-y-3">
          {MEAL_TYPES.map((mealType) => {
            const meal = log.meals.find((m) => m.type === mealType.type);
            const isExpanded = expandedMeals[mealType.type];
            const mealTotals = meal?.foods.reduce((sum, entry) => {
              const food = FOOD_DB.find((f) => f.id === entry.foodId);
              if (!food) return sum;
              const ratio = entry.quantity / food.servingSize;
              return { calories: sum.calories + food.calories * ratio, protein: sum.protein + food.protein * ratio };
            }, { calories: 0, protein: 0 });

            return (
              <div key={mealType.type} className="rounded-2xl border" style={{ borderColor: 'var(--card-border)' }}>
                <button
                  onClick={() => setExpandedMeals((prev) => ({ ...prev, [mealType.type]: !prev[mealType.type] }))}
                  className="flex w-full items-center justify-between p-4"
                >
                  <div className="flex items-center gap-2">
                    <mealType.icon className="h-4 w-4" style={{ color: '#00AEEF' }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{mealType.label}</span>
                    {mealTotals && mealTotals.calories > 0 && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {Math.round(mealTotals.calories)} kcal
                      </span>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--card-border)' }}>
                        {/* Food List */}
                        {meal?.foods.map((entry, idx) => {
                          const food = FOOD_DB.find((f) => f.id === entry.foodId);
                          if (!food) return null;
                          const ratio = entry.quantity / food.servingSize;
                          return (
                            <div key={idx} className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{food.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {Math.round(entry.quantity)}g • {Math.round(food.calories * ratio)} kcal
                                </p>
                              </div>
                              <button onClick={() => removeFood(mealType.type, idx)} className="rounded-lg p-1 hover:bg-red-500/10">
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Add Food Button */}
                        <button
                          onClick={() => setShowFoodSearch(mealType.type)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed py-2 text-sm font-medium transition-colors"
                          style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}
                        >
                          <Plus className="h-4 w-4" /> Add Food
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Water */}
        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5" style={{ color: '#00AEEF' }} />
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Water</span>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{log.waterIntake} / {targets.water} ml</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (log.waterIntake / targets.water) * 100)}%`, backgroundColor: '#00AEEF' }}
            />
          </div>
          <div className="mt-2 flex gap-2">
            {[250, 500].map((amt) => (
              <button key={amt} onClick={() => addWater(amt)} className="rounded-lg px-3 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--light-elevated)', color: '#00AEEF' }}>
                +{amt}ml
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Food Search Modal */}
      <AnimatePresence>
        {showFoodSearch && (
          <FoodSearchModal
            mealType={showFoodSearch}
            onAdd={(foodId, qty) => addFood(showFoodSearch, foodId, qty)}
            onClose={() => setShowFoodSearch(null)}
          />
        )}
      </AnimatePresence>

      {/* Sticky Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur-xl dark:bg-slate-950/95 lg:left-[280px]">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-2">
          <MacroBar label="P" current={totals.protein} target={targets.protein} color="#0D9488" />
          <MacroBar label="F" current={totals.fats} target={targets.fats} color="#F59E0B" />
          <MacroBar label="C" current={totals.carbs} target={targets.carbs} color="#22C55E" />
          <MacroBar label="Kcal" current={totals.calories} target={targets.calories} color="#00AEEF" />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function MacroRing({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="flex flex-col items-center">
      <ProgressRing percentage={pct} size={64} strokeWidth={5} color={color} label={label} value={`${current}`} />
      <span className="mt-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-[10px]" style={{ color }}>{current}/{target}</span>
    </div>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[10px]">
        <span style={{ color }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{current}/{target}</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function FoodSearchModal({ mealType: _mealType, onAdd, onClose }: { mealType: string; onAdd: (foodId: string, qty: number) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(100);

  const filtered = useMemo(() =>
    FOOD_DB.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg rounded-t-2xl p-6 lg:rounded-2xl"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Food</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-800"><X className="h-5 w-5" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        {!selectedFood ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search foods..."
                className="pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filtered.map((food) => (
                <button
                  key={food.id}
                  onClick={() => { setSelectedFood(food); setQuantity(food.servingSize); }}
                  className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-slate-800"
                  style={{ borderColor: 'var(--card-border)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{food.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{food.category} • {food.calories} kcal per {food.servingSize}g</p>
                  </div>
                  <ChevronDown className="h-4 w-4 rotate-[-90deg]" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--card-border)' }}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedFood.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>P: {selectedFood.protein}g • F: {selectedFood.fats}g • C: {selectedFood.carbs}g per {selectedFood.servingSize}g</p>
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Quantity (grams)</label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedFood(null)} className="flex-1">Back</Button>
              <Button onClick={() => onAdd(selectedFood.id, quantity)} className="flex-1" style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}>
                Add
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
