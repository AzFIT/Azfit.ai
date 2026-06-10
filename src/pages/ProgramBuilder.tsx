import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Save, Plus, Trash2, Copy, ChevronRight, Dumbbell,
  Clock, RotateCcw, CheckCircle2, ArrowLeft, FileSpreadsheet
} from 'lucide-react';
import { ExerciseSelector } from '@/components/ExerciseSelector';
import {
  getSlotCategory,
  getDefaultSlotExercise,
  getCategoryById,
  EXERCISE_CATEGORIES,
} from '@/data/exerciseDatabase';
import { MASTER_PROGRAMS } from '@/data/masterWorkouts';
import { getProgramTemplates, saveProgramTemplate, type ProgramTemplate } from '@/lib/storage';
import { useNavigate } from 'react-router';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface SlotExercise {
  order: string;
  exercise: string;
  categoryId: string;
  sets: number;
  reps: string;
  tempo: string;
  restSeconds: number;
}

interface WorkoutDay {
  id: string;
  name: string;
  dayNumber: number;
  slots: SlotExercise[];
}



// ═══════════════════════════════════════════════════════════════
// DEFAULT GBC TEMPLATE (Phase 1 Accumulation)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SLOTS: SlotExercise[] = [
  { order: 'A1', exercise: '', categoryId: 'pulling', sets: 2, reps: '10-12', tempo: '4010', restSeconds: 60 },
  { order: 'A2', exercise: '', categoryId: 'unilateral_quad', sets: 2, reps: '10-12', tempo: '3110', restSeconds: 60 },
  { order: 'B1', exercise: '', categoryId: 'pressing', sets: 2, reps: '10-12', tempo: '4010', restSeconds: 60 },
  { order: 'B2', exercise: '', categoryId: 'posterior', sets: 2, reps: '10-12', tempo: '3110', restSeconds: 60 },
  { order: 'C1', exercise: '', categoryId: 'delt_scap', sets: 2, reps: '12-15', tempo: '3010', restSeconds: 45 },
  { order: 'C2', exercise: '', categoryId: 'biceps', sets: 2, reps: '10-12', tempo: '3011', restSeconds: 45 },
  { order: 'C3', exercise: '', categoryId: 'bracing', sets: 2, reps: '45s', tempo: 'N/A', restSeconds: 45 },
  { order: 'D', exercise: '', categoryId: 'metcon_bracing', sets: 1, reps: '10-15 min', tempo: 'N/A', restSeconds: 0 },
];

const DEFAULT_DAYS: WorkoutDay[] = [
  { id: 'day-1', name: 'Full Body 1', dayNumber: 1, slots: structuredClone(DEFAULT_SLOTS) },
  { id: 'day-2', name: 'Full Body 2', dayNumber: 2, slots: structuredClone(DEFAULT_SLOTS) },
  { id: 'day-3', name: 'Upper Focus', dayNumber: 3, slots: structuredClone(DEFAULT_SLOTS) },
  { id: 'day-4', name: 'Custom 1', dayNumber: 4, slots: structuredClone(DEFAULT_SLOTS) },
  { id: 'day-5', name: 'Custom 2', dayNumber: 5, slots: structuredClone(DEFAULT_SLOTS) },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ProgramBuilderPage() {
  const navigate = useNavigate();
  const [program, setProgram] = useState<ProgramTemplate>({
    id: crypto.randomUUID(),
    name: 'New Program',
    category: 'German Body Composition',
    description: 'Custom GBC program',
    weeks: 4,
    days: structuredClone(DEFAULT_DAYS),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [activeDay, setActiveDay] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);

  const updateSlot = useCallback((dayIndex: number, slotIndex: number, updates: Partial<SlotExercise>) => {
    setProgram((prev) => {
      const next = { ...prev };
      next.days = next.days.map((d, di) => {
        if (di !== dayIndex) return d;
        return {
          ...d,
          slots: d.slots.map((s, si) => (si === slotIndex ? { ...s, ...updates } : s)),
        };
      });
      return next;
    });
    setSaved(false);
  }, []);

  const autoFillDay = useCallback((dayIndex: number) => {
    setProgram((prev) => {
      const next = { ...prev };
      next.days = next.days.map((d, di) => {
        if (di !== dayIndex) return d;
        return {
          ...d,
          slots: d.slots.map((slot) => ({
            ...slot,
            exercise: getDefaultSlotExercise(slot.order),
          })),
        };
      });
      return next;
    });
    setSaved(false);
  }, []);

  const handleSave = () => {
    const toSave = { ...program, updatedAt: new Date().toISOString() };
    saveProgramTemplate(toSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadFromMaster = (programId: string) => {
    const master = MASTER_PROGRAMS.find((p) => p.id === programId);
    if (!master) return;
    const days: ProgramTemplate['days'] = master.phases[0]?.workouts.map((w, i) => ({
      id: `day-${i + 1}`,
      name: w.name,
      dayNumber: w.dayNumber,
      slots: w.exercises.map((ex) => ({
        order: ex.order,
        exercise: ex.name,
        categoryId: ex.category,
        sets: ex.sets,
        reps: ex.reps,
        tempo: ex.tempo,
        restSeconds: ex.rest,
      })),
    })) || [];
    setProgram({
      id: crypto.randomUUID(),
      name: master.name,
      category: master.category,
      description: master.description,
      weeks: master.phases[0]?.weeks || 4,
      days,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setActiveDay(0);
    setShowLoadTemplate(false);
  };

  const currentDay = program.days[activeDay];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/coach')}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Program Builder</h1>
              <p className="text-xs text-slate-400">Design workouts with exercise database</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLoadTemplate(!showLoadTemplate)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700
                text-sm text-slate-300 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Load Template
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                }`}
            >
              {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save Program'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Program Info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Program Name</label>
              <input
                type="text"
                value={program.name}
                onChange={(e) => setProgram({ ...program, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
                  text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
              <input
                type="text"
                value={program.category}
                onChange={(e) => setProgram({ ...program, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
                  text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Weeks</label>
              <input
                type="number"
                min={1}
                max={12}
                value={program.weeks}
                onChange={(e) => setProgram({ ...program, weeks: parseInt(e.target.value) || 4 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
                  text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </motion.div>

        {/* Template Loader */}
        {showLoadTemplate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Load from Master Templates</h3>
            <div className="flex gap-2 flex-wrap">
              {MASTER_PROGRAMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadFromMaster(p.id)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700
                    rounded-lg text-sm text-slate-300 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Day Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          {program.days.map((day, i) => (
            <button
              key={day.id}
              onClick={() => setActiveDay(i)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                whitespace-nowrap transition-all
                ${activeDay === i
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-800 hover:border-slate-700'
                }`}
            >
              <span className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-xs font-bold">
                {day.dayNumber}
              </span>
              {day.name}
              {day.slots.some((s) => s.exercise) && (
                <span className="w-2 h-2 rounded-full bg-teal-400" />
              )}
            </button>
          ))}
        </div>

        {/* Day Editor */}
        <motion.div
          key={activeDay}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={currentDay.name}
                onChange={(e) => {
                  const next = { ...program };
                  next.days = next.days.map((d, i) =>
                    i === activeDay ? { ...d, name: e.target.value } : d
                  );
                  setProgram(next);
                }}
                className="bg-transparent text-xl font-bold text-white focus:outline-none
                  border-b border-transparent focus:border-teal-500/50 pb-1"
              />
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">
                {currentDay.slots.filter((s) => s.exercise).length} / {currentDay.slots.length} exercises
              </span>
            </div>
            <button
              onClick={() => autoFillDay(activeDay)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700
                text-xs text-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Auto-Fill Defaults
            </button>
          </div>

          {/* Slots Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[60px_1fr_100px_80px_80px_80px_60px] gap-2 px-4 py-3
              bg-slate-800/50 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Order</span>
              <span>Exercise</span>
              <span>Sets</span>
              <span>Reps</span>
              <span>Tempo</span>
              <span>Rest</span>
              <span></span>
            </div>

            {currentDay.slots.map((slot, slotIndex) => {
              const category = getCategoryById(slot.categoryId);
              return (
                <div
                  key={slot.order}
                  className="grid grid-cols-[60px_1fr_100px_80px_80px_80px_60px] gap-2 px-4 py-3
                    border-b border-slate-800/50 items-center hover:bg-slate-800/20 transition-colors"
                >
                  {/* Order */}
                  <span className="text-sm font-bold text-teal-400">{slot.order}</span>

                  {/* Exercise Selector */}
                  <div className="min-w-0">
                    <ExerciseSelector
                      value={slot.exercise}
                      onChange={(exercise, catId) =>
                        updateSlot(activeDay, slotIndex, { exercise, categoryId: catId })
                      }
                      categoryFilter={slot.categoryId}
                      placeholder={`Select ${category?.label.toLowerCase() || 'exercise'}...`}
                    />
                  </div>

                  {/* Sets */}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={slot.sets}
                    onChange={(e) =>
                      updateSlot(activeDay, slotIndex, { sets: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg
                      text-sm text-white text-center focus:outline-none focus:border-teal-500"
                  />

                  {/* Reps */}
                  <input
                    type="text"
                    value={slot.reps}
                    onChange={(e) =>
                      updateSlot(activeDay, slotIndex, { reps: e.target.value })
                    }
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg
                      text-sm text-white text-center focus:outline-none focus:border-teal-500"
                  />

                  {/* Tempo */}
                  <input
                    type="text"
                    value={slot.tempo}
                    onChange={(e) =>
                      updateSlot(activeDay, slotIndex, { tempo: e.target.value })
                    }
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg
                      text-sm text-white text-center focus:outline-none focus:border-teal-500"
                  />

                  {/* Rest */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      step={5}
                      value={slot.restSeconds}
                      onChange={(e) =>
                        updateSlot(activeDay, slotIndex, { restSeconds: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg
                        text-sm text-white text-center focus:outline-none focus:border-teal-500"
                    />
                    <span className="text-xs text-slate-500">s</span>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => updateSlot(activeDay, slotIndex, { exercise: '' })}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Category Legend */}
          <div className="mt-4 flex flex-wrap gap-2">
            {EXERCISE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 border border-slate-800
                  rounded-lg text-xs text-slate-400"
              >
                <Dumbbell className="w-3 h-3 text-teal-400" />
                <span className="font-medium text-slate-300">{cat.label}</span>
                <span className="text-slate-500">({cat.exercises.length})</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
