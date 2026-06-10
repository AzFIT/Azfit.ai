import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Dumbbell,
  Apple,
  Check,
  X,
  Download,
  CloudCheck,
  Star,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabId = 'daily' | 'workouts' | 'nutrition';

interface CellCoord {
  row: number;
  col: number;
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const dailyData = [
  { date: '2026-06-10', weight: 82.5, sleep: 7.5, mood: 4, workout: true, notes: 'Feeling strong, good recovery' },
  { date: '2026-06-09', weight: 82.8, sleep: 6.5, mood: 3, workout: true, notes: 'Sore from leg day' },
  { date: '2026-06-08', weight: 83.1, sleep: 8.0, mood: 5, workout: true, notes: 'PR on bench!' },
  { date: '2026-06-07', weight: 83.0, sleep: 7.0, mood: 4, workout: true, notes: 'Solid session' },
  { date: '2026-06-06', weight: 83.2, sleep: 7.5, mood: 4, workout: false, notes: 'Rest day, walked 8k steps' },
  { date: '2026-06-05', weight: 83.0, sleep: 6.0, mood: 3, workout: true, notes: 'Tired but pushed through' },
  { date: '2026-06-04', weight: 82.9, sleep: 7.5, mood: 5, workout: true, notes: 'Great energy today' },
  { date: '2026-06-03', weight: 83.2, sleep: 6.5, mood: 2, workout: false, notes: 'Sick, took a rest day' },
  { date: '2026-06-02', weight: 83.0, sleep: 8.0, mood: 4, workout: true, notes: 'Good workout, felt strong' },
  { date: '2026-06-01', weight: 83.3, sleep: 7.0, mood: 3, workout: true, notes: 'Back to routine' },
];

const workoutData = [
  { exercise: 'Squat', sets: 5, reps: 5, weight: 100, rpe: 8, rest: 180 },
  { exercise: 'Bench Press', sets: 4, reps: 8, weight: 80, rpe: 7, rest: 150 },
  { exercise: 'Deadlift', sets: 3, reps: 5, weight: 140, rpe: 9, rest: 240 },
  { exercise: 'Overhead Press', sets: 4, reps: 6, weight: 50, rpe: 7, rest: 120 },
  { exercise: 'Barbell Row', sets: 4, reps: 10, weight: 60, rpe: 6, rest: 90 },
  { exercise: 'Pull-up', sets: 4, reps: 8, weight: 0, rpe: 7, rest: 120 },
  { exercise: 'Leg Press', sets: 3, reps: 12, weight: 200, rpe: 6, rest: 60 },
  { exercise: 'Dumbbell Curl', sets: 3, reps: 10, weight: 16, rpe: 6, rest: 60 },
  { exercise: 'Tricep Dip', sets: 3, reps: 10, weight: 10, rpe: 7, rest: 90 },
  { exercise: 'Lat Pulldown', sets: 4, reps: 10, weight: 55, rpe: 6, rest: 90 },
  { exercise: 'Leg Curl', sets: 3, reps: 12, weight: 45, rpe: 6, rest: 60 },
  { exercise: 'Calf Raise', sets: 4, reps: 15, weight: 80, rpe: 5, rest: 45 },
];

const nutritionData = [
  { meal: 'Breakfast', protein: 45, carbs: 60, fats: 12, calories: 468 },
  { meal: 'Mid-Morning Snack', protein: 25, carbs: 15, fats: 8, calories: 212 },
  { meal: 'Lunch', protein: 55, carbs: 75, fats: 18, calories: 582 },
  { meal: 'Pre-Workout', protein: 30, carbs: 40, fats: 5, calories: 305 },
  { meal: 'Post-Workout', protein: 40, carbs: 50, fats: 10, calories: 410 },
  { meal: 'Dinner', protein: 50, carbs: 65, fats: 20, calories: 560 },
  { meal: 'Evening Snack', protein: 15, carbs: 20, fats: 15, calories: 275 },
  { meal: 'Breakfast', protein: 42, carbs: 58, fats: 14, calories: 454 },
  { meal: 'Lunch', protein: 60, carbs: 80, fats: 16, calories: 604 },
  { meal: 'Snack', protein: 20, carbs: 25, fats: 10, calories: 250 },
  { meal: 'Dinner', protein: 48, carbs: 62, fats: 18, calories: 546 },
  { meal: 'Protein Shake', protein: 30, carbs: 10, fats: 3, calories: 167 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const colLabel = (idx: number) => {
  let label = '';
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  } while (n > 0);
  return label;
};

const formatDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const rpeColor = (rpe: number) => {
  if (rpe <= 3) return { bg: '#84CC16', fill: '30%' };
  if (rpe <= 6) return { bg: '#0D9488', fill: '60%' };
  if (rpe <= 8) return { bg: '#F59E0B', fill: '80%' };
  return { bg: '#F87171', fill: '100%' };
};

const moodStars = (mood: number) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={12}
        className={i <= mood ? 'fill-current' : ''}
        style={{ opacity: i <= mood ? 1 : 0.25 }}
      />
    );
  }
  return stars;
};

const moodColor = (mood: number) => {
  if (mood <= 2) return '#F87171';
  if (mood === 3) return '#F59E0B';
  return '#84CC16';
};

const formatRest = (seconds: number) => {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${seconds}s`;
};

/* ------------------------------------------------------------------ */
/*  Star Rating Cell                                                   */
/* ------------------------------------------------------------------ */

function StarCell({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          className="transition-transform duration-100 hover:scale-110"
          type="button"
        >
          <Star
            size={14}
            className={(onChange ? (i <= hover) : (i <= value)) ? 'fill-current' : ''}
            style={{
              color: (onChange ? (i <= hover) : (i <= value))
                ? moodColor(onChange ? hover : value)
                : 'var(--light-text-muted)',
              opacity: (onChange ? (i <= hover) : (i <= value)) ? 1 : 0.25,
            }}
          />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RPE Bar Cell                                                       */
/* ------------------------------------------------------------------ */

function RpeCell({ value }: { value: number }) {
  const colors = rpeColor(value);
  return (
    <div className="flex items-center justify-center">
      <div
        className="relative h-2 w-10 overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--light-border)' }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
          style={{ width: colors.fill, backgroundColor: colors.bg }}
        />
      </div>
      <span className="ml-1.5 text-[11px] font-medium" style={{ color: colors.bg }}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Checkbox Cell                                                      */
/* ------------------------------------------------------------------ */

function CheckboxCell({ checked, onChange }: { checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange?.(!checked)}
      className="flex w-full items-center justify-center transition-transform duration-100 active:scale-90"
      type="button"
    >
      {checked ? (
        <CheckSquare size={18} style={{ color: 'var(--azfit-primary)' }} />
      ) : (
        <Square size={18} style={{ color: 'var(--light-text-muted)' }} />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Editable Cell                                                      */
/* ------------------------------------------------------------------ */

interface EditableCellProps {
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  align?: 'left' | 'center' | 'right';
  onSelect: () => void;
  onEdit: () => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  formulaError?: boolean;
  colSpan?: number;
}

function EditableCell({
  value,
  isSelected,
  isEditing,
  align = 'left',
  onSelect,
  onEdit,
  onSave,
  onCancel,
  formulaError,
  colSpan,
}: EditableCellProps) {
  const [editVal, setEditVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditVal(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    onSave(editVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave(editVal);
    if (e.key === 'Escape') onCancel();
  };

  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  if (isEditing) {
    return (
      <td
        colSpan={colSpan}
        className={`h-11 min-w-[80px] border-b border-r p-0 lg:min-w-[100px] ${alignClass}`}
        style={{
          backgroundColor: 'var(--light-surface)',
          borderColor: 'rgba(226,232,240,0.3)',
        }}
      >
        <input
          ref={inputRef}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-full w-full bg-transparent px-3 font-mono text-sm outline-none"
          style={{ color: 'var(--page-text)', cursor: 'text' }}
        />
      </td>
    );
  }

  return (
    <td
      colSpan={colSpan}
      onClick={onSelect}
      onDoubleClick={onEdit}
      className={`h-11 min-w-[80px] cursor-pointer border-b border-r px-3 font-mono text-sm transition-all duration-100 lg:min-w-[100px] ${alignClass} ${formulaError ? 'border-[#F87171]' : ''}`}
      style={{
        backgroundColor: isSelected ? 'rgba(13,148,136,0.08)' : 'transparent',
        borderColor: formulaError ? '#F87171' : isSelected ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
        boxShadow: isSelected ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
        color: value.startsWith('=') ? 'var(--azfit-primary)' : 'var(--page-text)',
        position: 'relative',
        zIndex: isSelected ? 10 : 1,
      }}
      title={formulaError ? 'Invalid formula' : undefined}
    >
      <span
        className="block truncate"
        style={{
          textShadow: 'var(--text-shadow-dark)',
        }}
      >
        {value}
      </span>
    </td>
  );
}

/* ------------------------------------------------------------------ */
/*  Totals Row                                                         */
/* ------------------------------------------------------------------ */

function TotalsRow({ children }: { children: React.ReactNode }) {
  return (
    <tr
      className="sticky bottom-0 z-20 font-mono text-sm font-semibold"
      style={{
        backgroundColor: 'var(--light-elevated)',
        borderTop: '2px solid var(--light-border)',
      }}
    >
      {children}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface SheetsPanelProps {
  onExportCsv?: (tab: TabId) => void;
}

export function SheetsPanel({ onExportCsv }: SheetsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('daily');
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(null);
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [formulaValue, setFormulaValue] = useState('');
  const [lastSaved, setLastSaved] = useState('2 min ago');
  const [formulaError, setFormulaError] = useState(false);

  /* ---- editable data copies ---- */
  const [dailyRows, setDailyRows] = useState(dailyData);
  const [workoutRows, setWorkoutRows] = useState(workoutData);
  const [nutritionRows, setNutritionRows] = useState(nutritionData);

  /* ---- derived headers ---- */
  const dailyHeaders = ['Date', 'Weight (kg)', 'Sleep', 'Mood', 'Workout', 'Notes'];
  const workoutHeaders = ['Exercise', 'Sets', 'Reps', 'Weight (kg)', 'RPE', 'Rest'];
  const nutritionHeaders = ['Meal', 'Protein (g)', 'Carbs (g)', 'Fats (g)', 'Calories'];

  /* ---- cell reference string ---- */
  const cellRef = useMemo(() => {
    if (!selectedCell) return '';
    const col = colLabel(selectedCell.col);
    const row = selectedCell.row + 1;
    return `${col}${row}`;
  }, [selectedCell]);

  /* ---- formula bar value ---- */
  const currentCellValue = useMemo(() => {
    if (!selectedCell) return '';
    const { row, col } = selectedCell;
    let data: (string | number | boolean)[][] = [];

    switch (activeTab) {
      case 'daily':
        data = dailyRows.map((r) => [formatDate(r.date), r.weight.toString(), `${r.sleep}h`, r.mood.toString(), r.workout ? 'Yes' : 'No', r.notes]);
        break;
      case 'workouts':
        data = workoutRows.map((r) => [r.exercise, r.sets.toString(), r.reps.toString(), r.weight === 0 ? 'BW' : `${r.weight}`, r.rpe.toString(), formatRest(r.rest)]);
        break;
      case 'nutrition':
        data = nutritionRows.map((r) => [r.meal, r.protein.toString(), r.carbs.toString(), r.fats.toString(), r.calories.toString()]);
        break;
    }

    if (data[row] && data[row][col] !== undefined) {
      return String(data[row][col]);
    }
    return '';
  }, [selectedCell, activeTab, dailyRows, workoutRows, nutritionRows]);

  useEffect(() => {
    setFormulaValue(currentCellValue);
    setFormulaError(false);
  }, [currentCellValue]);

  /* ---- cell interaction ---- */
  const handleSelectCell = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setEditingCell(null);
  }, []);

  const handleEditCell = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setEditingCell({ row, col });
  }, []);

  const handleSaveEdit = useCallback((val: string) => {
    if (!editingCell) return;
    const { row, col } = editingCell;

    switch (activeTab) {
      case 'daily': {
        const updated = [...dailyRows];
        const r = { ...updated[row] };
        if (col === 1) r.weight = parseFloat(val) || r.weight;
        if (col === 2) r.sleep = parseFloat(val) || r.sleep;
        if (col === 3) r.mood = parseInt(val) || r.mood;
        if (col === 4) r.workout = val.toLowerCase() === 'yes' || val === 'true' || val === '1';
        if (col === 5) r.notes = val;
        updated[row] = r;
        setDailyRows(updated);
        break;
      }
      case 'workouts': {
        const updated = [...workoutRows];
        const r = { ...updated[row] };
        if (col === 0) r.exercise = val;
        if (col === 1) r.sets = parseInt(val) || r.sets;
        if (col === 2) r.reps = parseInt(val) || r.reps;
        if (col === 3) r.weight = val === 'BW' ? 0 : parseFloat(val) || r.weight;
        if (col === 4) r.rpe = parseInt(val) || r.rpe;
        if (col === 5) r.rest = parseInt(val) || r.rest;
        updated[row] = r;
        setWorkoutRows(updated);
        break;
      }
      case 'nutrition': {
        const updated = [...nutritionRows];
        const r = { ...updated[row] };
        if (col === 0) r.meal = val;
        if (col === 1) r.protein = parseInt(val) || r.protein;
        if (col === 2) r.carbs = parseInt(val) || r.carbs;
        if (col === 3) r.fats = parseInt(val) || r.fats;
        if (col === 4) r.calories = parseInt(val) || r.calories;
        updated[row] = r;
        setNutritionRows(updated);
        break;
      }
    }

    setEditingCell(null);
    setLastSaved('just now');
    setTimeout(() => setLastSaved('2 min ago'), 3000);
  }, [editingCell, activeTab, dailyRows, workoutRows, nutritionRows]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setFormulaValue(currentCellValue);
  }, [currentCellValue]);

  /* ---- formula bar confirm ---- */
  const handleFormulaConfirm = () => {
    if (selectedCell && editingCell) {
      handleSaveEdit(formulaValue);
    }
  };

  /* ---- export ---- */
  const handleExport = () => {
    onExportCsv?.(activeTab);
    let csv = '';
    switch (activeTab) {
      case 'daily': {
        csv = 'Date,Weight (kg),Sleep (h),Mood,Workout Done,Notes\n' +
          dailyRows.map((r) => `${r.date},${r.weight},${r.sleep},${r.mood},${r.workout ? 'Yes' : 'No'},${r.notes}`).join('\n');
        break;
      }
      case 'workouts': {
        csv = 'Exercise,Sets,Reps,Weight (kg),RPE,Rest (sec)\n' +
          workoutRows.map((r) => `${r.exercise},${r.sets},${r.reps},${r.weight},${r.rpe},${r.rest}`).join('\n');
        break;
      }
      case 'nutrition': {
        csv = 'Meal,Protein (g),Carbs (g),Fats (g),Calories\n' +
          nutritionRows.map((r) => `${r.meal},${r.protein},${r.carbs},${r.fats},${r.calories}`).join('\n');
        break;
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azfit-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- totals ---- */
  const dailyTotals = useMemo(() => {
    const avgWeight = (dailyRows.reduce((s, r) => s + r.weight, 0) / dailyRows.length).toFixed(1);
    const avgSleep = (dailyRows.reduce((s, r) => s + r.sleep, 0) / dailyRows.length).toFixed(1);
    const avgMood = Math.round(dailyRows.reduce((s, r) => s + r.mood, 0) / dailyRows.length);
    const workoutCount = dailyRows.filter((r) => r.workout).length;
    return { avgWeight, avgSleep, avgMood, workoutCount };
  }, [dailyRows]);

  const nutritionTotals = useMemo(() => {
    const totalProtein = nutritionRows.reduce((s, r) => s + r.protein, 0);
    const totalCarbs = nutritionRows.reduce((s, r) => s + r.carbs, 0);
    const totalFats = nutritionRows.reduce((s, r) => s + r.fats, 0);
    const totalCalories = nutritionRows.reduce((s, r) => s + r.calories, 0);
    return { totalProtein, totalCarbs, totalFats, totalCalories };
  }, [nutritionRows]);

  /* ---- autofill hover state (per-cell) ---- */
  // const [, setDragOverCell] = useState<CellCoord | null>(null);

  /* ---- common animation ---- */
  const tabContentAnim = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
      className="flex flex-col"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      {/* ====== Formula Bar ====== */}
      <div
        className="flex h-12 items-center gap-3 border-b px-4"
        style={{
          backgroundColor: 'var(--light-elevated)',
          borderColor: 'var(--light-border)',
        }}
      >
        {/* Cell reference */}
        <div
          className="flex h-8 w-16 items-center justify-center rounded font-mono text-xs font-semibold"
          style={{
            backgroundColor: 'var(--light-surface)',
            border: '1px solid var(--light-border)',
            color: 'var(--page-text)',
          }}
        >
          {cellRef || '—'}
        </div>

        {/* Formula input */}
        <input
          value={formulaValue}
          onChange={(e) => {
            setFormulaValue(e.target.value);
            if (e.target.value.startsWith('=') && e.target.value.length > 1) {
              try {
                const expr = e.target.value.slice(1);
                Function('"use strict"; return (' + expr + ')')();
                setFormulaError(false);
              } catch {
                setFormulaError(true);
              }
            } else {
              setFormulaError(false);
            }
          }}
          onFocus={() => {
            if (selectedCell) setEditingCell(selectedCell);
          }}
          onBlur={handleFormulaConfirm}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFormulaConfirm();
            if (e.key === 'Escape') handleCancelEdit();
          }}
          placeholder="Enter value or formula..."
          disabled={!selectedCell}
          className="font-mono text-sm outline-none disabled:opacity-40 flex-1 rounded px-3 py-1.5"
          style={{
            backgroundColor: 'var(--light-surface)',
            border: selectedCell
              ? formulaError
                ? '1px solid #F87171'
                : editingCell
                  ? '1px solid var(--azfit-primary)'
                  : '1px solid var(--light-border)'
              : '1px solid var(--light-border)',
            boxShadow: editingCell && !formulaError ? '0 0 0 3px rgba(13,148,136,0.15)' : 'none',
            color: 'var(--page-text)',
            textShadow: 'var(--text-shadow-dark)',
          }}
        />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleFormulaConfirm}
            className="flex h-8 w-8 items-center justify-center rounded transition-transform duration-100 active:scale-[0.92]"
            style={{ color: 'var(--azfit-primary)' }}
            type="button"
          >
            <Check size={18} />
          </button>
          <button
            onClick={handleCancelEdit}
            className="flex h-8 w-8 items-center justify-center rounded transition-transform duration-100 active:scale-[0.92]"
            style={{ color: 'var(--light-text-muted)' }}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ====== Tab Navigation ====== */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabId); setSelectedCell(null); setEditingCell(null); }} className="w-full">
        <div
          className="sticky top-0 z-30 border-b"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--light-border)',
          }}
        >
          <TabsList className="w-full h-11 rounded-none bg-transparent p-0 gap-0">
            <TabsTrigger
              value="daily"
              className="flex-1 rounded-none border-b-[2.5px] border-transparent bg-transparent px-4 py-0 font-mono text-xs font-semibold data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-[var(--azfit-primary)] data-[state=active]:text-[var(--azfit-primary)]"
              style={{ color: 'var(--light-text-muted)' }}
            >
              <Calendar size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Daily Tracking</span>
              <span className="sm:hidden">Daily</span>
            </TabsTrigger>
            <TabsTrigger
              value="workouts"
              className="flex-1 rounded-none border-b-[2.5px] border-transparent bg-transparent px-4 py-0 font-mono text-xs font-semibold data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-[var(--azfit-secondary)] data-[state=active]:text-[var(--azfit-secondary)]"
              style={{ color: 'var(--light-text-muted)' }}
            >
              <Dumbbell size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Workouts</span>
              <span className="sm:hidden">Workouts</span>
            </TabsTrigger>
            <TabsTrigger
              value="nutrition"
              className="flex-1 rounded-none border-b-[2.5px] border-transparent bg-transparent px-4 py-0 font-mono text-xs font-semibold data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-[var(--azfit-accent)] data-[state=active]:text-[var(--azfit-accent)]"
              style={{ color: 'var(--light-text-muted)' }}
            >
              <Apple size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Nutrition</span>
              <span className="sm:hidden">Nutrition</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ====== Tab: Daily Tracking ====== */}
        <TabsContent value="daily" className="mt-0">
          <AnimatePresence mode="wait">
            {activeTab === 'daily' && (
              <motion.div key="daily" {...tabContentAnim} className="overflow-auto" style={{ maxHeight: 'calc(100dvh - 14rem)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      className="sticky top-0 z-10 h-10 font-mono text-xs font-semibold uppercase"
                      style={{
                        backgroundColor: 'var(--light-elevated)',
                        color: 'var(--light-text-secondary)',
                        borderBottom: '2px solid var(--light-border)',
                      }}
                    >
                      <th className="w-10 border-r px-2 text-center" style={{ borderColor: 'var(--light-border)' }} />
                      {dailyHeaders.map((h) => (
                        <th
                          key={h}
                          className="min-w-[80px] border-r px-3 text-left lg:min-w-[100px]"
                          style={{ borderColor: 'var(--light-border)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="h-11 transition-colors duration-100"
                        style={{
                          backgroundColor: ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        }}
                      >
                        {/* Row number */}
                        <td
                          className="sticky left-0 z-10 w-10 border-r px-2 text-center font-mono text-xs"
                          style={{
                            backgroundColor: 'var(--light-elevated)',
                            color: 'var(--light-text-muted)',
                            borderColor: 'var(--light-border)',
                          }}
                        >
                          {ri + 1}
                        </td>
                        {/* Date */}
                        <EditableCell
                          value={formatDate(row.date)}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 0}
                          isEditing={editingCell?.row === ri && editingCell?.col === 0}
                          onSelect={() => handleSelectCell(ri, 0)}
                          onEdit={() => handleEditCell(ri, 0)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        {/* Weight */}
                        <EditableCell
                          value={row.weight.toFixed(1)}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 1}
                          isEditing={editingCell?.row === ri && editingCell?.col === 1}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 1)}
                          onEdit={() => handleEditCell(ri, 1)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        {/* Sleep */}
                        <EditableCell
                          value={`${row.sleep}h`}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 2}
                          isEditing={editingCell?.row === ri && editingCell?.col === 2}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 2)}
                          onEdit={() => handleEditCell(ri, 2)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        {/* Mood */}
                        <td
                          onClick={() => handleSelectCell(ri, 3)}
                          onDoubleClick={() => handleEditCell(ri, 3)}
                          className="h-11 min-w-[80px] cursor-pointer border-b border-r px-3 transition-all duration-100 lg:min-w-[100px]"
                          style={{
                            backgroundColor: selectedCell?.row === ri && selectedCell?.col === 3 ? 'rgba(13,148,136,0.08)' : ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                            borderColor: selectedCell?.row === ri && selectedCell?.col === 3 ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
                            boxShadow: selectedCell?.row === ri && selectedCell?.col === 3 ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            position: 'relative',
                            zIndex: selectedCell?.row === ri && selectedCell?.col === 3 ? 10 : 1,
                          }}
                        >
                          {editingCell?.row === ri && editingCell?.col === 3 ? (
                            <StarCell
                              value={row.mood}
                              onChange={(v) => {
                                const updated = [...dailyRows];
                                updated[ri] = { ...updated[ri], mood: v };
                                setDailyRows(updated);
                                setEditingCell(null);
                                setLastSaved('just now');
                              }}
                            />
                          ) : (
                            <div className="flex items-center justify-center" style={{ color: moodColor(row.mood) }}>
                              {moodStars(row.mood)}
                            </div>
                          )}
                        </td>
                        {/* Workout Done */}
                        <td
                          onClick={() => handleSelectCell(ri, 4)}
                          className="h-11 min-w-[60px] cursor-pointer border-b border-r px-3 transition-all duration-100"
                          style={{
                            backgroundColor: selectedCell?.row === ri && selectedCell?.col === 4 ? 'rgba(13,148,136,0.08)' : ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                            borderColor: selectedCell?.row === ri && selectedCell?.col === 4 ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
                            boxShadow: selectedCell?.row === ri && selectedCell?.col === 4 ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            position: 'relative',
                            zIndex: selectedCell?.row === ri && selectedCell?.col === 4 ? 10 : 1,
                          }}
                        >
                          <CheckboxCell
                            checked={row.workout}
                            onChange={(v) => {
                              const updated = [...dailyRows];
                              updated[ri] = { ...updated[ri], workout: v };
                              setDailyRows(updated);
                              setLastSaved('just now');
                            }}
                          />
                        </td>
                        {/* Notes */}
                        <EditableCell
                          value={row.notes}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 5}
                          isEditing={editingCell?.row === ri && editingCell?.col === 5}
                          onSelect={() => handleSelectCell(ri, 5)}
                          onEdit={() => handleEditCell(ri, 5)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                      </tr>
                    ))}
                    {/* Totals row */}
                    <TotalsRow>
                      <td className="w-10 border-r px-2" style={{ borderColor: 'var(--light-border)' }} />
                      <td className="min-w-[100px] border-r px-3" style={{ borderColor: 'var(--light-border)', color: 'var(--light-text-secondary)' }}>Avg / Total</td>
                      <td className="min-w-[80px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--page-text)' }}>{dailyTotals.avgWeight}</td>
                      <td className="min-w-[70px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--page-text)' }}>{dailyTotals.avgSleep}h</td>
                      <td className="min-w-[60px] border-r px-3 text-center" style={{ borderColor: 'var(--light-border)', color: moodColor(dailyTotals.avgMood) }}>
                        <div className="flex items-center justify-center gap-0.5">
                          {moodStars(dailyTotals.avgMood)}
                        </div>
                      </td>
                      <td className="min-w-[50px] border-r px-3 text-center" style={{ borderColor: 'var(--light-border)', color: 'var(--azfit-primary)' }}>
                        {dailyTotals.workoutCount}/{dailyRows.length}
                      </td>
                      <td className="min-w-[200px] px-3" style={{ color: 'var(--light-text-muted)' }} />
                    </TotalsRow>
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ====== Tab: Workouts ====== */}
        <TabsContent value="workouts" className="mt-0">
          <AnimatePresence mode="wait">
            {activeTab === 'workouts' && (
              <motion.div key="workouts" {...tabContentAnim} className="overflow-auto" style={{ maxHeight: 'calc(100dvh - 14rem)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      className="sticky top-0 z-10 h-10 font-mono text-xs font-semibold uppercase"
                      style={{
                        backgroundColor: 'var(--light-elevated)',
                        color: 'var(--light-text-secondary)',
                        borderBottom: '2px solid var(--light-border)',
                      }}
                    >
                      <th className="w-10 border-r px-2 text-center" style={{ borderColor: 'var(--light-border)' }} />
                      {workoutHeaders.map((h) => (
                        <th
                          key={h}
                          className="min-w-[80px] border-r px-3 text-left lg:min-w-[100px]"
                          style={{ borderColor: 'var(--light-border)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workoutRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="h-11 transition-colors duration-100"
                        style={{
                          backgroundColor: ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        }}
                      >
                        <td
                          className="sticky left-0 z-10 w-10 border-r px-2 text-center font-mono text-xs"
                          style={{
                            backgroundColor: 'var(--light-elevated)',
                            color: 'var(--light-text-muted)',
                            borderColor: 'var(--light-border)',
                          }}
                        >
                          {ri + 1}
                        </td>
                        <EditableCell
                          value={row.exercise}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 0}
                          isEditing={editingCell?.row === ri && editingCell?.col === 0}
                          onSelect={() => handleSelectCell(ri, 0)}
                          onEdit={() => handleEditCell(ri, 0)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        <EditableCell
                          value={row.sets.toString()}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 1}
                          isEditing={editingCell?.row === ri && editingCell?.col === 1}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 1)}
                          onEdit={() => handleEditCell(ri, 1)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        <EditableCell
                          value={row.reps.toString()}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 2}
                          isEditing={editingCell?.row === ri && editingCell?.col === 2}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 2)}
                          onEdit={() => handleEditCell(ri, 2)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        <EditableCell
                          value={row.weight === 0 ? 'BW' : `${row.weight}`}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 3}
                          isEditing={editingCell?.row === ri && editingCell?.col === 3}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 3)}
                          onEdit={() => handleEditCell(ri, 3)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        <td
                          onClick={() => handleSelectCell(ri, 4)}
                          className="h-11 min-w-[50px] cursor-pointer border-b border-r px-3 transition-all duration-100"
                          style={{
                            backgroundColor: selectedCell?.row === ri && selectedCell?.col === 4 ? 'rgba(13,148,136,0.08)' : ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                            borderColor: selectedCell?.row === ri && selectedCell?.col === 4 ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
                            boxShadow: selectedCell?.row === ri && selectedCell?.col === 4 ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            position: 'relative',
                            zIndex: selectedCell?.row === ri && selectedCell?.col === 4 ? 10 : 1,
                          }}
                        >
                          <RpeCell value={row.rpe} />
                        </td>
                        <EditableCell
                          value={formatRest(row.rest)}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 5}
                          isEditing={editingCell?.row === ri && editingCell?.col === 5}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 5)}
                          onEdit={() => handleEditCell(ri, 5)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                      </tr>
                    ))}
                    {/* Totals */}
                    <TotalsRow>
                      <td className="w-10 border-r px-2" style={{ borderColor: 'var(--light-border)' }} />
                      <td className="min-w-[160px] border-r px-3" style={{ borderColor: 'var(--light-border)', color: 'var(--light-text-secondary)' }}>Totals</td>
                      <td className="min-w-[60px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--page-text)' }}>
                        {workoutRows.reduce((s, r) => s + r.sets, 0)}
                      </td>
                      <td className="min-w-[60px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--page-text)' }}>
                        {workoutRows.reduce((s, r) => s + r.reps, 0)}
                      </td>
                      <td className="min-w-[90px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--azfit-primary)' }}>
                        {Math.max(...workoutRows.map((r) => r.weight))} max
                      </td>
                      <td className="min-w-[50px] border-r px-3" style={{ borderColor: 'var(--light-border)' }}>
                        <RpeCell value={Math.round(workoutRows.reduce((s, r) => s + r.rpe, 0) / workoutRows.length)} />
                      </td>
                      <td className="min-w-[70px] px-3 text-right" style={{ color: 'var(--page-text)' }}>
                        {formatRest(workoutRows.reduce((s, r) => s + r.rest, 0))}
                      </td>
                    </TotalsRow>
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ====== Tab: Nutrition ====== */}
        <TabsContent value="nutrition" className="mt-0">
          <AnimatePresence mode="wait">
            {activeTab === 'nutrition' && (
              <motion.div key="nutrition" {...tabContentAnim} className="overflow-auto" style={{ maxHeight: 'calc(100dvh - 14rem)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      className="sticky top-0 z-10 h-10 font-mono text-xs font-semibold uppercase"
                      style={{
                        backgroundColor: 'var(--light-elevated)',
                        color: 'var(--light-text-secondary)',
                        borderBottom: '2px solid var(--light-border)',
                      }}
                    >
                      <th className="w-10 border-r px-2 text-center" style={{ borderColor: 'var(--light-border)' }} />
                      {nutritionHeaders.map((h) => (
                        <th
                          key={h}
                          className="min-w-[85px] border-r px-3 text-left lg:min-w-[100px]"
                          style={{ borderColor: 'var(--light-border)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nutritionRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="h-11 transition-colors duration-100"
                        style={{
                          backgroundColor: ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        }}
                      >
                        <td
                          className="sticky left-0 z-10 w-10 border-r px-2 text-center font-mono text-xs"
                          style={{
                            backgroundColor: 'var(--light-elevated)',
                            color: 'var(--light-text-muted)',
                            borderColor: 'var(--light-border)',
                          }}
                        >
                          {ri + 1}
                        </td>
                        <EditableCell
                          value={row.meal}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 0}
                          isEditing={editingCell?.row === ri && editingCell?.col === 0}
                          onSelect={() => handleSelectCell(ri, 0)}
                          onEdit={() => handleEditCell(ri, 0)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                        {/* Protein */}
                        <td
                          onClick={() => handleSelectCell(ri, 1)}
                          onDoubleClick={() => handleEditCell(ri, 1)}
                          className="h-11 min-w-[85px] cursor-pointer border-b border-r px-3 text-right font-mono text-sm transition-all duration-100 lg:min-w-[100px]"
                          style={{
                            backgroundColor: selectedCell?.row === ri && selectedCell?.col === 1 ? 'rgba(13,148,136,0.08)' : ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                            borderColor: selectedCell?.row === ri && selectedCell?.col === 1 ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
                            boxShadow: selectedCell?.row === ri && selectedCell?.col === 1 ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            color: 'var(--azfit-primary)',
                            position: 'relative',
                            zIndex: selectedCell?.row === ri && selectedCell?.col === 1 ? 10 : 1,
                            textShadow: 'var(--text-shadow-dark)',
                          }}
                        >
                          {editingCell?.row === ri && editingCell?.col === 1 ? (
                            <input
                              autoFocus
                              defaultValue={row.protein}
                              onBlur={(e) => handleSaveEdit(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(e.currentTarget.value); if (e.key === 'Escape') handleCancelEdit(); }}
                              className="w-full bg-transparent text-right font-mono text-sm outline-none"
                              style={{ color: 'var(--azfit-primary)' }}
                            />
                          ) : (
                            `${row.protein}g`
                          )}
                        </td>
                        {/* Carbs */}
                        <td
                          onClick={() => handleSelectCell(ri, 2)}
                          onDoubleClick={() => handleEditCell(ri, 2)}
                          className="h-11 min-w-[85px] cursor-pointer border-b border-r px-3 text-right font-mono text-sm transition-all duration-100 lg:min-w-[100px]"
                          style={{
                            backgroundColor: selectedCell?.row === ri && selectedCell?.col === 2 ? 'rgba(13,148,136,0.08)' : ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                            borderColor: selectedCell?.row === ri && selectedCell?.col === 2 ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
                            boxShadow: selectedCell?.row === ri && selectedCell?.col === 2 ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            color: 'var(--azfit-secondary)',
                            position: 'relative',
                            zIndex: selectedCell?.row === ri && selectedCell?.col === 2 ? 10 : 1,
                            textShadow: 'var(--text-shadow-dark)',
                          }}
                        >
                          {editingCell?.row === ri && editingCell?.col === 2 ? (
                            <input
                              autoFocus
                              defaultValue={row.carbs}
                              onBlur={(e) => handleSaveEdit(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(e.currentTarget.value); if (e.key === 'Escape') handleCancelEdit(); }}
                              className="w-full bg-transparent text-right font-mono text-sm outline-none"
                              style={{ color: 'var(--azfit-secondary)' }}
                            />
                          ) : (
                            `${row.carbs}g`
                          )}
                        </td>
                        {/* Fats */}
                        <td
                          onClick={() => handleSelectCell(ri, 3)}
                          onDoubleClick={() => handleEditCell(ri, 3)}
                          className="h-11 min-w-[85px] cursor-pointer border-b border-r px-3 text-right font-mono text-sm transition-all duration-100 lg:min-w-[100px]"
                          style={{
                            backgroundColor: selectedCell?.row === ri && selectedCell?.col === 3 ? 'rgba(13,148,136,0.08)' : ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                            borderColor: selectedCell?.row === ri && selectedCell?.col === 3 ? 'var(--azfit-primary)' : 'rgba(226,232,240,0.3)',
                            boxShadow: selectedCell?.row === ri && selectedCell?.col === 3 ? '0 0 0 2px var(--azfit-primary), 0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            color: 'var(--warning)',
                            position: 'relative',
                            zIndex: selectedCell?.row === ri && selectedCell?.col === 3 ? 10 : 1,
                            textShadow: 'var(--text-shadow-dark)',
                          }}
                        >
                          {editingCell?.row === ri && editingCell?.col === 3 ? (
                            <input
                              autoFocus
                              defaultValue={row.fats}
                              onBlur={(e) => handleSaveEdit(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(e.currentTarget.value); if (e.key === 'Escape') handleCancelEdit(); }}
                              className="w-full bg-transparent text-right font-mono text-sm outline-none"
                              style={{ color: 'var(--warning)' }}
                            />
                          ) : (
                            `${row.fats}g`
                          )}
                        </td>
                        {/* Calories */}
                        <EditableCell
                          value={row.calories.toString()}
                          isSelected={selectedCell?.row === ri && selectedCell?.col === 4}
                          isEditing={editingCell?.row === ri && editingCell?.col === 4}
                          align="right"
                          onSelect={() => handleSelectCell(ri, 4)}
                          onEdit={() => handleEditCell(ri, 4)}
                          onSave={(v) => handleSaveEdit(v)}
                          onCancel={handleCancelEdit}
                        />
                      </tr>
                    ))}
                    {/* Totals */}
                    <TotalsRow>
                      <td className="w-10 border-r px-2" style={{ borderColor: 'var(--light-border)' }} />
                      <td className="min-w-[160px] border-r px-3" style={{ borderColor: 'var(--light-border)', color: 'var(--light-text-secondary)' }}>Totals</td>
                      <td className="min-w-[85px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--azfit-primary)', fontWeight: 700 }}>
                        {nutritionTotals.totalProtein}g
                      </td>
                      <td className="min-w-[85px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--azfit-secondary)', fontWeight: 700 }}>
                        {nutritionTotals.totalCarbs}g
                      </td>
                      <td className="min-w-[85px] border-r px-3 text-right" style={{ borderColor: 'var(--light-border)', color: 'var(--warning)', fontWeight: 700 }}>
                        {nutritionTotals.totalFats}g
                      </td>
                      <td className="min-w-[90px] px-3 text-right" style={{ color: 'var(--page-text)', fontWeight: 700 }}>
                        {nutritionTotals.totalCalories.toLocaleString()}
                      </td>
                    </TotalsRow>
                  </tbody>
                </table>

                {/* Macro ratio bar */}
                <div className="px-4 py-3" style={{ backgroundColor: 'var(--light-elevated)' }}>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-xs" style={{ color: 'var(--light-text-muted)' }}>
                    <span>Macro Ratio</span>
                    <span>
                      P {Math.round((nutritionTotals.totalProtein * 4 / nutritionTotals.totalCalories) * 100)}%
                      {' / '}
                      C {Math.round((nutritionTotals.totalCarbs * 4 / nutritionTotals.totalCalories) * 100)}%
                      {' / '}
                      F {Math.round((nutritionTotals.totalFats * 9 / nutritionTotals.totalCalories) * 100)}%
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full">
                    <div
                      style={{
                        width: `${Math.round((nutritionTotals.totalProtein * 4 / nutritionTotals.totalCalories) * 100)}%`,
                        backgroundColor: 'var(--azfit-primary)',
                      }}
                    />
                    <div
                      style={{
                        width: `${Math.round((nutritionTotals.totalCarbs * 4 / nutritionTotals.totalCalories) * 100)}%`,
                        backgroundColor: 'var(--azfit-secondary)',
                      }}
                    />
                    <div
                      style={{
                        width: `${Math.round((nutritionTotals.totalFats * 9 / nutritionTotals.totalCalories) * 100)}%`,
                        backgroundColor: 'var(--warning)',
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>
      </Tabs>

      {/* ====== Status Bar ====== */}
      <div
        className="flex h-8 items-center justify-between border-t px-4"
        style={{
          backgroundColor: 'var(--light-elevated)',
          borderColor: 'var(--light-border)',
        }}
      >
        <span className="font-mono text-[11px]" style={{ color: 'var(--light-text-muted)' }}>
          {editingCell ? `Editing ${cellRef}` : selectedCell ? `Selected ${cellRef}` : 'Ready'}
        </span>
        <span className="hidden font-mono text-[11px] sm:inline" style={{ color: 'var(--light-text-muted)' }}>
          {activeTab === 'daily' && `${dailyRows.length} rows x ${dailyHeaders.length} cols`}
          {activeTab === 'workouts' && `${workoutRows.length} rows x ${workoutHeaders.length} cols`}
          {activeTab === 'nutrition' && `${nutritionRows.length} rows x ${nutritionHeaders.length} cols`}
        </span>
        <div className="flex items-center gap-1.5">
          <CloudCheck size={14} style={{ color: 'var(--success)' }} />
          <span className="font-mono text-[11px]" style={{ color: 'var(--light-text-muted)' }}>
            Last saved: {lastSaved}
          </span>
        </div>
      </div>

      {/* ====== Export Button ====== */}
      <button
        onClick={handleExport}
        className="absolute right-4 top-14 z-20 flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-all duration-200 hover:bg-[var(--azfit-primary)] hover:text-white active:scale-[0.97]"
        style={{
          borderColor: 'var(--azfit-primary)',
          color: 'var(--azfit-primary)',
          backgroundColor: 'var(--card-bg)',
          textShadow: 'var(--text-shadow-dark)',
        }}
        type="button"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Export CSV</span>
      </button>
    </motion.div>
  );
}
