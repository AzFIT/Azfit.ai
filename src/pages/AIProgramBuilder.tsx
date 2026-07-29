// ═══════════════════════════════════════════════════════════════════════
// AI Program Builder — All-in-One Program Creator
// Ported from legacy azfit-client-portal AllInOneProgramPage.tsx
// Wired to current generateProgram() backend.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Bot, Save, RotateCcw, Check,
  Dumbbell, TrendingUp, Flame, Wind, HeartPulse, Pencil, Trash2,
  Plus, Eye, BarChart3, Download, X, Target, Award, Sparkles,
  AlertTriangle, Layers, Calendar, Users, Play, ArrowLeft, Upload, ShieldAlert, Loader2, Copy, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateProgram, saveGeneratedProgram,
  type GeneratedProgram, type GeneratedWorkout, type GeneratedExercise, type ClientProfile,
} from '@/lib/aiProgramGenerator';
import {
  collectClientLimitations, evaluateProgramSafety, type SafetyFlag,
} from '@/lib/programSafety';
import {
  bestMappedId,
  parseTemplateTags,
  templateTagLabels,
  TEMPLATE_GOAL_MAP,
  TEMPLATE_METHOD_MAP,
} from '@/lib/programTemplates';
import {
  rankMethods,
  groupByCategory,
  resolveMethodName,
  WIZARD_GOAL_TO_DB,
  type DbMethod,
  type DbMethodCategory,
  type RankedMethod,
} from '@/lib/methodCatalog';
import { suggestPhasesForMethod } from '@/lib/phaseSuggestions';
import { pairingStyleForMethod, assignPairGroups } from '@/lib/supersets';
import {
  PROGRESSION_PRESETS,
  progressionNoteForWeek,
  type ProgressionRule,
} from '@/lib/progression';
import {
  setsPerMuscleGroup,
  equipmentChecklist,
  estimateSessionMinutes,
} from '@/lib/previewMetrics';
import { setActiveSession, type WorkoutLog, type LoggedExercise, type LoggedSet } from '@/lib/storage';
import {
  buildProgramInsert,
  buildWorkoutRows,
  buildExerciseRows,
  programDataFromDb,
  clientContextFromClientFields,
  type DbExerciseInsert,
} from '@/lib/aiProgramMapper';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// TYPES
export interface ClientContext { ageRange: string; experience: string; bodyType: string; availability: string; limitations: string[]; otherLimitation: string; }
export interface ProgramPhase { id: string; name: string; weeks: number; focus: string; color: string; active: boolean; intensityTarget?: string; volumeTarget?: string; }
export interface ProgramSplit { day: string; active: boolean; workout: string; dbId?: string; }
export interface ProgramExercise { code: string; name: string; sets: number; reps: string; pct1RM: string; tempo: string; rest: string; dbId?: string; isSubstituted?: boolean; safetyNote?: string; supersetGroup?: string; }
export interface ProgramData { id?: string; goal: string; method: string; clientContext: ClientContext; phases: ProgramPhase[]; weeklyHours: number; split: ProgramSplit[]; exercises: ProgramExercise[]; workoutExercises?: Record<number, ProgramExercise[]>; progressionRules: ProgressionRule[]; programName: string; description: string; tags: string[]; isPublic: boolean; assignedClient: string; }
export interface SavedProgram { id: string; createdAt: string; updatedAt: string; data: ProgramData; }
interface StepProps { data: ProgramData; updateData: (partial: Partial<ProgramData> | ((prev: ProgramData) => Partial<ProgramData>)) => void; onSave?: () => void; onSaveAndAssign?: () => void; program?: GeneratedProgram | null; clientName?: string; clients?: ClientRow[]; saving?: boolean; limitations?: string[]; dbMethods?: DbMethod[]; methodCategories?: DbMethodCategory[]; goalScores?: { method_id: string; score: number }[]; methodsLoading?: boolean; methodsError?: string | null; }

type ClientRow = Database['public']['Tables']['clients']['Row'];
type ProgramRow = Database['public']['Tables']['programs']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];
type ExerciseRow = Database['public']['Tables']['exercises']['Row'];

const PROGRAMS_STORAGE_KEY = 'azfit-programs';

interface LegacySavedProgram { id: string; createdAt: string; updatedAt: string; data: ProgramData; }

async function loadSavedPrograms(trainerId: string): Promise<SavedProgram[]> {
  const { data: programsData, error: programsError } = await supabase
    .from('programs')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('updated_at', { ascending: false });
  if (programsError || !programsData) return [];

  const programs = programsData as ProgramRow[];
  if (programs.length === 0) return [];

  const programIds = programs.map((p) => p.id);
  const { data: workoutsData, error: workoutsError } = await supabase
    .from('workouts')
    .select('*')
    .in('program_id', programIds)
    .order('day_of_week', { ascending: true });
  if (workoutsError || !workoutsData) return [];

  const workouts = workoutsData as WorkoutRow[];
  const workoutIds = workouts.map((w) => w.id);
  let exercises: ExerciseRow[] = [];
  if (workoutIds.length > 0) {
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .in('workout_id', workoutIds)
      .order('order_index', { ascending: true });
    if (!exercisesError && exercisesData) exercises = exercisesData as ExerciseRow[];
  }

  const workoutsByProgram = new Map<string, WorkoutRow[]>();
  const exercisesByWorkout = new Map<string, ExerciseRow[]>();
  for (const w of workouts) {
    const list = workoutsByProgram.get(w.program_id) || [];
    list.push(w);
    workoutsByProgram.set(w.program_id, list);
  }
  for (const e of exercises) {
    const list = exercisesByWorkout.get(e.workout_id) || [];
    list.push(e);
    exercisesByWorkout.set(e.workout_id, list);
  }

  return programs.map((p) => {
    const pWorkouts = workoutsByProgram.get(p.id) || [];
    const pExercises = pWorkouts.flatMap((w) => exercisesByWorkout.get(w.id) || []);
    return {
      id: p.id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      data: programDataFromDb(p, pWorkouts, pExercises),
    };
  });
}

async function saveProgramToSupabase(
  data: ProgramData,
  trainerId: string,
  assignedClientId: string | null
): Promise<ProgramData | null> {
  const programPayload = buildProgramInsert(data, trainerId, assignedClientId);
  let programId = data.id;

  if (programId) {
    // Editing an existing program: preserve start_date/status/assignment,
    // recompute end_date from the preserved start if the duration changed.
    const { data: existing } = await supabase
      .from('programs')
      .select('start_date, status, client_id')
      .eq('id', programId)
      .single();
    if (existing) {
      programPayload.start_date = existing.start_date;
      programPayload.end_date = existing.start_date
        ? new Date(
            new Date(existing.start_date).getTime() +
              programPayload.duration_weeks * 7 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0]
        : null;
      if (!assignedClientId) {
        programPayload.status = existing.status as 'draft' | 'active';
        programPayload.client_id = existing.client_id;
      }
    }
    const { error } = await supabase
      .from('programs')
      .update(programPayload)
      .eq('id', programId);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await supabase
      .from('programs')
      .insert(programPayload)
      .select('id, created_at, updated_at')
      .single();
    if (error || !inserted) throw error;
    programId = inserted.id;
  }

  // ── Workouts: diff by id (keeps workout_logs.workout_id links intact) ──
  const { data: existingWorkouts, error: ewError } = await supabase
    .from('workouts')
    .select('id')
    .eq('program_id', programId);
  if (ewError) throw ewError;

  const desiredWorkouts = buildWorkoutRows(data);
  if (desiredWorkouts.length === 0) {
    desiredWorkouts.push({ name: 'Workout', day_of_week: 1, week_number: 1, notes: null });
  }

  const keepWorkoutIds = new Set(desiredWorkouts.filter((w) => w.id).map((w) => w.id));
  const deleteWorkoutIds = ((existingWorkouts as { id: string }[]) || [])
    .filter((w) => !keepWorkoutIds.has(w.id))
    .map((w) => w.id);
  if (deleteWorkoutIds.length > 0) {
    const { error } = await supabase.from('workouts').delete().in('id', deleteWorkoutIds);
    if (error) throw error;
  }

  const dayToWorkoutId = new Map<number, string>();
  for (const w of desiredWorkouts) {
    if (w.id) {
      const { error } = await supabase
        .from('workouts')
        .update({ name: w.name, day_of_week: w.day_of_week, week_number: w.week_number, notes: w.notes })
        .eq('id', w.id);
      if (error) throw error;
      dayToWorkoutId.set(w.day_of_week, w.id);
    } else {
      const insertRow = { ...w };
      delete insertRow.id;
      const { data: insertedW, error } = await supabase
        .from('workouts')
        .insert({ ...insertRow, program_id: programId! })
        .select('id')
        .single();
      if (error || !insertedW) throw error;
      dayToWorkoutId.set(w.day_of_week, insertedW.id);
    }
  }

  // ── Exercises: diff by id across all workouts (per-day lists win) ──
  const allWorkoutIds = [...dayToWorkoutId.values()];
  let existingExercises: { id: string; workout_id: string }[] = [];
  if (allWorkoutIds.length > 0) {
    const { data: exRows, error: eeError } = await supabase
      .from('exercises')
      .select('id, workout_id')
      .in('workout_id', allWorkoutIds);
    if (eeError) throw eeError;
    existingExercises = (exRows as { id: string; workout_id: string }[]) || [];
  }

  const desiredByWorkout = new Map<string, (Omit<DbExerciseInsert, 'workout_id'> & { id?: string })[]>();
  const keepExerciseIds = new Set<string>();
  for (const [dayIdx, workoutId] of dayToWorkoutId) {
    const list = data.workoutExercises?.[dayIdx] ?? data.exercises;
    const rows = buildExerciseRows(list);
    desiredByWorkout.set(workoutId, rows);
    for (const r of rows) if (r.id) keepExerciseIds.add(r.id);
  }

  const deleteExerciseIds = existingExercises
    .filter((e) => !keepExerciseIds.has(e.id))
    .map((e) => e.id);
  if (deleteExerciseIds.length > 0) {
    const { error } = await supabase.from('exercises').delete().in('id', deleteExerciseIds);
    if (error) throw error;
  }

  for (const [workoutId, rows] of desiredByWorkout) {
    for (const r of rows) {
      if (r.id) {
        const updateRow = { ...r };
        delete updateRow.id;
        const { error } = await supabase
          .from('exercises')
          .update({ ...updateRow, workout_id: workoutId })
          .eq('id', r.id);
        if (error) throw error;
      } else {
        const insertRow = { ...r };
        delete insertRow.id;
        const { error } = await supabase
          .from('exercises')
          .insert({ ...insertRow, workout_id: workoutId });
        if (error) throw error;
      }
    }
  }

  const { data: programRow, error: fetchError } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single();
  if (fetchError || !programRow) throw fetchError;

  const { data: savedWorkouts, error: fetchWError } = await supabase
    .from('workouts')
    .select('*')
    .eq('program_id', programId);
  if (fetchWError || !savedWorkouts) throw fetchWError;

  const savedWorkoutIds = savedWorkouts.map((w) => w.id);
  let savedExercises: ExerciseRow[] = [];
  if (savedWorkoutIds.length > 0) {
    const { data: exData, error: exError } = await supabase
      .from('exercises')
      .select('*')
      .in('workout_id', savedWorkoutIds);
    if (!exError && exData) savedExercises = exData as ExerciseRow[];
  }

  return programDataFromDb(programRow as ProgramRow, savedWorkouts as WorkoutRow[], savedExercises);
}

function loadClientProfile(): ClientProfile | null { try { const raw = localStorage.getItem('azfit_client_profile'); if (!raw) return null; const profile = JSON.parse(raw); return { trainingFrequency: profile.trainingFrequency || 3, trainingExperience: profile.trainingExperience || 'intermediate', primaryGoal: profile.primaryGoal || 'build_muscle', availableEquipment: profile.availableEquipment || ['Full Gym'], preferredStyle: profile.preferredStyle || ['Free Weights'], injuries: profile.injuries || '' }; } catch { return null; } }

// Client-aware auto-generate: build a ClientProfile from a clients row's
// intake_profile (Phase 16) + fitness_goal/experience_level. localStorage is
// only a fallback when no client is selected and no intake_profile exists.
const GOAL_SLUG_MAP: Record<string, string> = { lose_weight: 'lose_fat', build_muscle: 'build_muscle', strength: 'strength', endurance: 'general_health', athletic_performance: 'performance', rehab_mobility: 'recomposition', general_fitness: 'general_health' };
const DEFAULT_PROFILE: ClientProfile = { trainingFrequency: 3, trainingExperience: 'intermediate', primaryGoal: 'build_muscle', availableEquipment: ['Full Gym'], preferredStyle: ['Free Weights'] };
function profileFromClient(client: ClientRow): ClientProfile {
  const ip = (client.intake_profile as Record<string, unknown> | null) || {};
  const equipment = Array.isArray(ip.equipment) && ip.equipment.length > 0 ? (ip.equipment as string[]) : ['Full Gym'];
  return {
    trainingFrequency: (ip.sessions_per_week as number) || 3,
    trainingExperience: client.experience_level || 'intermediate',
    primaryGoal: GOAL_SLUG_MAP[client.fitness_goal || ''] || 'general_health',
    availableEquipment: equipment,
    preferredStyle: ['Free Weights'],
    injuries: (ip.injuries as string) || '',
  };
}

const GOAL_MAP: Record<string, string> = { lose_fat: 'fatloss', build_muscle: 'hypertrophy', strength: 'strength', recomposition: 'fatloss', performance: 'power', general_health: 'endurance' };
// Auto-generate fallback: goal → default method id. Phase 30A note: the five
// legacy ids (german-volume/5x5/hiit/conjugate/triphasic) keep their current
// behavior everywhere (LEGACY_METHODS labels/details, resolveMethodName).
// Methods selected from the live DB catalog are stored as their slug and are
// metadata only — the generator never consumes data.method (documented in
// src/lib/methodCatalog.ts), so no further mapping is needed.
const METHOD_MAP: Record<string, string> = { strength: '5x5', hypertrophy: 'german-volume', fatloss: 'hiit', power: 'triphasic', endurance: 'hiit', rehab: 'triphasic' };
const PCT_MAP: Record<string, string> = { strength: '82.5%', hypertrophy: '75%', fatloss: '65%', power: '70%', endurance: '60%', rehab: '50%' };
// eslint-disable-next-line react-refresh/only-export-components
export function mapGeneratedToProgramData(gen: GeneratedProgram, profile: ClientProfile | null): ProgramData { const genGoal = GOAL_MAP[gen.goal] || 'hypertrophy'; const genMethod = METHOD_MAP[genGoal] || 'german-volume'; const activeWorkouts = gen.phases[0]?.workouts || []; const totalWeeks = gen.totalWeeks || 4; let phases: ProgramPhase[]; if (totalWeeks >= 12) { const w1 = Math.round(totalWeeks * 0.33); const w2 = Math.round(totalWeeks * 0.33); const w3 = totalWeeks - w1 - w2; phases = [{ id: 'p1', name: 'Accumulation', weeks: w1, focus: 'Build work capacity and aerobic base with higher volume', color: '#F59E0B', active: true }, { id: 'p2', name: 'Intensification', weeks: w2, focus: 'Increase intensity with moderate volume reduction', color: '#EF4444', active: true }, { id: 'p3', name: 'Realization', weeks: w3, focus: 'Peak intensity with sport-specific demands', color: '#22C55E', active: true }]; } else { phases = [{ id: 'p1', name: 'Adaptation', weeks: totalWeeks, focus: 'Build foundational fitness and work capacity', color: '#00AEEF', active: true }]; } const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; const split: ProgramSplit[] = dayNames.map((day, idx) => { const workout = activeWorkouts[idx]; return { day, active: !!workout, workout: workout ? `${workout.name} — ${workout.focus}` : 'Rest Day' }; }); const toProgramExercise = (ex: GeneratedExercise): ProgramExercise => { const restMins = Math.floor(ex.restSeconds / 60); const restSecs = ex.restSeconds % 60; return { code: ex.order, name: ex.name, sets: ex.sets, reps: ex.reps, pct1RM: PCT_MAP[genGoal] || 'N/A', tempo: ex.tempo, rest: `${restMins}:${String(restSecs).padStart(2, '0')}` }; }; // Phase 29A: each generated day keeps its OWN exercise list (workouts are day-indexed: Mon idx 0 → key 1 … Sun idx 6 → key 7)
const workoutExercises: Record<number, ProgramExercise[]> = {}; activeWorkouts.forEach((workout, idx) => { if (workout && workout.exercises?.length) workoutExercises[idx + 1] = workout.exercises.map(toProgramExercise); }); const firstDayList = Object.values(workoutExercises)[0]; const exercises: ProgramExercise[] = firstDayList ? firstDayList.map((e) => ({ ...e })) : []; const clientContext: ClientContext = profile ? { ageRange: '', experience: profile.trainingExperience === 'beginner' ? '<1 year' : profile.trainingExperience === 'advanced' ? '5-10 years' : '1-3 years', bodyType: 'Mesomorph', availability: `${profile.trainingFrequency} days`, limitations: profile.injuries ? ['Other'] : ['None (healthy)'], otherLimitation: profile.injuries || '' } : { ageRange: '', experience: '', bodyType: '', availability: '', limitations: [], otherLimitation: '' }; return { goal: genGoal, method: genMethod, clientContext, phases, weeklyHours: 4.5, split, exercises, workoutExercises, progressionRules: [], programName: gen.name, description: gen.description, tags: ['AI Generated', GOALS.find((g) => g.id === genGoal)?.name || 'Custom'], isPublic: false, assignedClient: '' }; }

function createEmptySet(setNumber: number, restSeconds: number): LoggedSet { return { setNumber, load: 0, reps: 0, rpe: 0, done: false, restSeconds, type: 'Normal' }; }
function workoutToSession(workout: GeneratedWorkout, programId: string): WorkoutLog { const exercises: LoggedExercise[] = workout.exercises.map((ex) => ({ order: ex.order, name: ex.name, category: ex.category, targetSets: ex.sets, targetReps: ex.reps, targetLoad: 0, tempo: ex.tempo, sets: Array.from({ length: ex.sets }, (_, i) => createEmptySet(i + 1, ex.restSeconds)), notes: '' })); const totalSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0); return { id: crypto.randomUUID(), programId, clientId: 'self', clientName: 'You', workoutName: workout.name, phaseName: 'Phase 1: Adaptation', weekNumber: 1, dayNumber: workout.dayNumber, exercises, startTime: new Date().toISOString(), durationSeconds: 0, totalVolume: totalSets * 10 * 20, totalSets, completedSets: 0, avgRpe: 0, status: 'in_progress', createdAt: new Date().toISOString() }; }

const GOALS = [
  { id: 'strength', name: 'Strength', icon: Dumbbell, color: '#00AEEF', desc: 'Maximize force production and absolute strength' },
  { id: 'hypertrophy', name: 'Hypertrophy', icon: TrendingUp, color: '#8B5CF6', desc: 'Build muscle size and aesthetic proportions' },
  { id: 'fatloss', name: 'Fat Loss', icon: Flame, color: '#22C55E', desc: 'Reduce body fat while preserving lean mass' },
  { id: 'endurance', name: 'Endurance', icon: Wind, color: '#F59E0B', desc: 'Improve aerobic capacity and muscular endurance' },
  { id: 'rehab', name: 'Rehab', icon: HeartPulse, color: '#6B7280', desc: 'Recover from injury and rebuild movement patterns' },
  { id: 'power', name: 'Power', icon: Zap, color: '#EAB308', desc: 'Develop explosive speed and rate of force' },
];
// Legacy hardcoded method list (pre-30A) — kept ONLY as a display/detail
// fallback for old saved values and the METHOD_MAP auto-generate defaults.
// Step 2 renders the live DB catalog instead (see Step2Method).
const LEGACY_METHODS = [
  { id: 'german-volume', name: 'German Volume Training', category: 'Hypertrophy', desc: '10 sets of 10 reps for massive muscle growth', score: 95, structure: '10x10 @ 60% 1RM', progression: '+5% load/week', targetAudience: 'Intermediate+' },
  { id: '5x5', name: '5x5 Stronglifts', category: 'Strength', desc: 'Classic compound lift protocol for raw strength', score: 92, structure: '5x5 compounds', progression: 'Linear +2.5kg', targetAudience: 'Beginner-Advanced' },
  { id: 'hiit', name: 'HIIT Metabolic', category: 'Fat Loss', desc: 'High-intensity intervals for maximum calorie burn', score: 88, structure: 'Work:Rest intervals', progression: 'Reduce rest periods', targetAudience: 'All levels' },
  { id: 'conjugate', name: 'Conjugate Method', category: 'Strength', desc: 'Max Effort / Dynamic Effort wave periodization', score: 90, structure: 'ME/DE rotation', progression: '3-week waves', targetAudience: 'Advanced' },
  { id: 'triphasic', name: 'Triphasic Training', category: 'Power', desc: 'Eccentric-Isometric-Concentric focused blocks', score: 87, structure: 'Block periodization', progression: 'Phase transitions', targetAudience: 'Advanced' },
];
const PHASES_DEFAULT: ProgramPhase[] = [
  { id: 'p1', name: 'Accumulation', weeks: 4, focus: 'Build work capacity and aerobic base with higher volume', color: '#F59E0B', active: true },
  { id: 'p2', name: 'Intensification', weeks: 4, focus: 'Increase intensity with moderate volume reduction', color: '#EF4444', active: true },
  { id: 'p3', name: 'Realization', weeks: 4, focus: 'Peak intensity with sport-specific demands', color: '#22C55E', active: true },
];
const DEFAULT_EXERCISES: ProgramExercise[] = [
  { code: 'A1', name: 'Back Squat', sets: 5, reps: '5', pct1RM: '82.5%', tempo: '3-0-1-0', rest: '3:00' },
  { code: 'A2', name: 'Bench Press', sets: 5, reps: '5', pct1RM: '82.5%', tempo: '3-0-1-0', rest: '3:00' },
  { code: 'B1', name: 'Romanian Deadlift', sets: 4, reps: '8', pct1RM: '75%', tempo: '3-1-1-0', rest: '2:30' },
  { code: 'B2', name: 'Pull-Up', sets: 4, reps: '8', pct1RM: 'BW+10kg', tempo: '3-0-2-0', rest: '2:30' },
  { code: 'C1', name: 'Walking Lunge', sets: 3, reps: '10/leg', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '2:00' },
  { code: 'C2', name: 'Overhead Press', sets: 3, reps: '10', pct1RM: '67.5%', tempo: '2-0-1-1', rest: '2:00' },
];
const SPLIT_DEFAULTS: Record<string, ProgramSplit[]> = {
  'Upper/Lower': [{ day: 'Mon', active: true, workout: 'Upper — Push Focus' }, { day: 'Tue', active: true, workout: 'Lower — Squat Focus' }, { day: 'Wed', active: false, workout: 'Rest Day' }, { day: 'Thu', active: true, workout: 'Upper — Pull Focus' }, { day: 'Fri', active: true, workout: 'Lower — Hinge Focus' }, { day: 'Sat', active: false, workout: 'Rest Day' }, { day: 'Sun', active: false, workout: 'Rest Day' }],
  'Push/Pull/Legs': [{ day: 'Mon', active: true, workout: 'Push — Chest/Shoulders/Tris' }, { day: 'Tue', active: true, workout: 'Pull — Back/Biceps' }, { day: 'Wed', active: true, workout: 'Legs — Quads/Hams/Calves' }, { day: 'Thu', active: false, workout: 'Rest Day' }, { day: 'Fri', active: true, workout: 'Push — Chest/Shoulders/Tris' }, { day: 'Sat', active: true, workout: 'Pull — Back/Biceps' }, { day: 'Sun', active: true, workout: 'Legs — Quads/Hams/Calves' }],
  'Full Body': [{ day: 'Mon', active: true, workout: 'Full Body A' }, { day: 'Tue', active: false, workout: 'Rest Day' }, { day: 'Wed', active: true, workout: 'Full Body B' }, { day: 'Thu', active: false, workout: 'Rest Day' }, { day: 'Fri', active: true, workout: 'Full Body C' }, { day: 'Sat', active: false, workout: 'Rest Day' }, { day: 'Sun', active: false, workout: 'Rest Day' }],
  'Bro Split': [{ day: 'Mon', active: true, workout: 'Chest Day' }, { day: 'Tue', active: true, workout: 'Back Day' }, { day: 'Wed', active: true, workout: 'Shoulders Day' }, { day: 'Thu', active: true, workout: 'Legs Day' }, { day: 'Fri', active: true, workout: 'Arms Day' }, { day: 'Sat', active: false, workout: 'Rest Day' }, { day: 'Sun', active: false, workout: 'Rest Day' }],
  'Custom': [{ day: 'Mon', active: true, workout: 'Workout A' }, { day: 'Tue', active: false, workout: 'Rest Day' }, { day: 'Wed', active: true, workout: 'Workout B' }, { day: 'Thu', active: false, workout: 'Rest Day' }, { day: 'Fri', active: true, workout: 'Workout C' }, { day: 'Sat', active: false, workout: 'Rest Day' }, { day: 'Sun', active: false, workout: 'Rest Day' }],
};
const LIMITATIONS = ['None (healthy)', 'Lower back issues', 'Shoulder injury', 'Knee/Hip limitations', 'Wrist/Elbow pain', 'Neck/Upper back', 'Cardiovascular condition', 'Other'];
const TAGS = ['Strength', 'Hypertrophy', 'Fat Loss', 'Endurance', 'Power', 'Rehab', 'Beginner', 'Advanced'];
// Client dropdown is now populated live from the trainer's clients table.
const STEPS = [
  { title: 'Goal Selection', component: Step1Goal },
  { title: 'Method Selection', component: Step2Method },
  { title: 'Client Context', component: Step3Context },
  { title: 'Phase Configuration', component: Step4Phases },
  { title: 'Weekly Split Designer', component: Step5Split },
  { title: 'Exercise Review', component: Step6Exercises },
  { title: 'Program Preview', component: Step7Preview },
  { title: 'Save & Assign', component: Step8Save },
];
const defaultData: ProgramData = { goal: '', method: '', clientContext: { ageRange: '', experience: '', bodyType: '', availability: '', limitations: [], otherLimitation: '' }, phases: PHASES_DEFAULT.map((p) => ({ ...p })), weeklyHours: 4.5, split: SPLIT_DEFAULTS['Upper/Lower'].map((d) => ({ ...d })), exercises: DEFAULT_EXERCISES.map((e) => ({ ...e })), progressionRules: [], programName: '', description: '', tags: [], isPublic: false, assignedClient: '' };

function Step1Goal({ data, updateData }: StepProps) {
  const [dropdownGoal, setDropdownGoal] = useState(data.goal || '');
  const selectGoal = useCallback((goalId: string) => updateData({ goal: goalId }), [updateData]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GOALS.map((goal) => { const Icon = goal.icon; const isSelected = data.goal === goal.id; return (
          <motion.button key={goal.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => selectGoal(goal.id)} className={cn('relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left', isSelected ? 'border-[#00AEEF] bg-[#00AEEF]/5 shadow-lg shadow-[#00AEEF]/10' : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--azfit-primary)]/50 hover:bg-[var(--page-bg)]')}>
            <div className="flex items-center justify-between w-full mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${goal.color}20`, border: `1px solid ${goal.color}40` }}><Icon className="w-5 h-5" style={{ color: goal.color }} /></div>
              <div className={cn('w-5 h-5 rounded border flex items-center justify-center transition-colors', isSelected ? 'bg-[#00AEEF] border-[#00AEEF]' : 'border-[var(--card-border)] bg-[var(--page-bg)]')}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
            </div>
            <h4 className="text-[var(--page-text)] font-semibold text-sm mb-1">{goal.name}</h4>
            <p className="text-[var(--page-text)]/60 text-xs leading-relaxed">{goal.desc}</p>
          </motion.button>
        ); })}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[var(--page-text)]/60 text-sm">Or select from dropdown:</span>
        <select value={dropdownGoal} onChange={(e) => { setDropdownGoal(e.target.value); if (e.target.value) selectGoal(e.target.value); }} className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00AEEF]">
          <option value="">— Select Goal —</option>
          {GOALS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => selectGoal('hypertrophy')} className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs"><Bot className="w-3.5 h-3.5 mr-1" />Recommend</Button>
      </div>
    </div>
  );
}

function Step2Method({ data, updateData, dbMethods = [], methodCategories = [], goalScores = [], methodsLoading, methodsError }: StepProps) {
  const [drawerMethod, setDrawerMethod] = useState<RankedMethod | null>(null);
  const ranked = useMemo(() => rankMethods(dbMethods, goalScores), [dbMethods, goalScores]);
  const groups = useMemo(() => groupByCategory(ranked, methodCategories), [ranked, methodCategories]);
  const best = useMemo(() => ranked.find((m) => m.score != null) ?? null, [ranked]);
  const goalName = GOALS.find((g) => g.id === data.goal)?.name || '';
  const selectMethod = useCallback(
    (m: DbMethod) =>
      updateData((prev) => ({
        method: m.slug,
        // replace the 'AI Generated' placeholder tag with the method name (Phase 30A)
        tags: prev.tags.map((t) => (t === 'AI Generated' ? m.name : t)),
      })),
    [updateData]
  );
  return (
    <div className="space-y-4">
      {methodsLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#00AEEF]" /></div>
      ) : methodsError ? (
        <div className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-xs text-[#EF4444]">
          Couldn't load the method catalog ({methodsError}). Check your connection and reopen this step.
        </div>
      ) : (
        <>
          {best && (
            <div className="bg-[#22C55E]/5 border border-[#22C55E]/30 rounded-xl p-3 flex items-center gap-3">
              <Award className="w-5 h-5 text-[#22C55E] shrink-0" />
              <div>
                <span className="text-[#22C55E] text-xs font-semibold">Best Match{goalName ? ` for ${goalName}` : ''}</span>
                <span className="text-[var(--page-text)] text-sm ml-2">{best.name} ({best.score?.toFixed(1)})</span>
              </div>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.category}>
              <h4 className="text-[var(--page-text)]/60 text-xs font-semibold uppercase tracking-wider mb-2">{group.category}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {group.methods.map((method) => {
                  const isSelected = data.method === method.slug;
                  const isBest = best?.id === method.id;
                  const labels = templateTagLabels(method.tags);
                  return (
                    <motion.button key={method.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDrawerMethod(method)} className={cn('flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left', isSelected ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 shadow-lg shadow-[#8B5CF6]/10' : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--azfit-primary)]/50')}>
                      <div className="flex items-center justify-between w-full mb-2 gap-2">
                        <Badge variant="outline" className="text-[10px] border-[var(--card-border)] text-[var(--page-text)]/60 truncate">{method.category}</Badge>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isBest && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/40">Best Match</span>}
                          <div className={cn('w-5 h-5 rounded border flex items-center justify-center transition-colors', isSelected ? 'bg-[#8B5CF6] border-[#8B5CF6]' : 'border-[var(--card-border)] bg-[var(--page-bg)]')}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                        </div>
                      </div>
                      <h4 className="text-[var(--page-text)] font-semibold text-sm mb-1">{method.name}</h4>
                      {method.description && <p className="text-[var(--page-text)]/60 text-xs mb-2 line-clamp-2">{method.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-auto pt-1">
                        {labels.slice(0, 3).map((l) => (
                          <span key={l} className="px-1.5 py-0.5 rounded-full text-[9px] border border-[var(--card-border)] text-[var(--page-text)]/50">{l}</span>
                        ))}
                      </div>
                      {method.score != null && (
                        <span className="text-[10px] mt-1.5 font-mono text-[#00AEEF]">{method.score.toFixed(1)} match</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Method detail drawer */}
      <AnimatePresence>
        {drawerMethod && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerMethod(null)}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-[var(--card-bg)] border-l border-[var(--card-border)] p-5 overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-[var(--page-text)] text-lg font-bold">{drawerMethod.name}</h3>
                  <p className="text-[var(--page-text)]/60 text-xs mt-0.5">{drawerMethod.category}</p>
                </div>
                <button onClick={() => setDrawerMethod(null)} className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"><X className="w-4 h-4" /></button>
              </div>
              {drawerMethod.score != null && (
                <p className="text-xs mb-3"><span className="text-[var(--page-text)]/60">Score{goalName ? ` for ${goalName}` : ''}: </span><span className="font-mono text-[#00AEEF] font-bold">{drawerMethod.score.toFixed(1)}</span></p>
              )}
              {drawerMethod.description ? (
                <p className="text-[var(--page-text)]/80 text-sm leading-relaxed mb-4">{drawerMethod.description}</p>
              ) : (
                <p className="text-[var(--page-text)]/40 text-xs italic mb-4">No description in the catalog yet.</p>
              )}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {templateTagLabels(drawerMethod.tags).map((l) => (
                  <span key={l} className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--card-border)] text-[var(--page-text)]/60">{l}</span>
                ))}
              </div>
              <Button onClick={() => { selectMethod(drawerMethod); setDrawerMethod(null); }} className="w-full bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6] text-white font-semibold">
                Select This Method
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step3Context({ data, updateData }: StepProps) {
  const toggleLimitation = useCallback((limitation: string) => { updateData((prev) => { const current = prev.clientContext.limitations; const next = current.includes(limitation) ? current.filter((l) => l !== limitation) : [...current, limitation]; return { clientContext: { ...prev.clientContext, limitations: next } }; }); }, [updateData]);
  const updateContextField = useCallback((field: keyof ClientContext, value: string) => updateData((prev) => ({ clientContext: { ...prev.clientContext, [field]: value } })), [updateData]);
  const aiRiskScore = useMemo(() => { const { limitations } = data.clientContext; if (limitations.includes('None (healthy)')) return 2; if (limitations.includes('Cardiovascular condition')) return 85; if (limitations.includes('Other')) return 60; return Math.min(limitations.length * 15, 75); }, [data.clientContext]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Age Range', field: 'ageRange' as const, options: ['', '18-25', '26-35', '36-45', '46-55', '55+'] },
          { label: 'Training Experience', field: 'experience' as const, options: ['', '<1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'] },
          { label: 'Body Type', field: 'bodyType' as const, options: ['', 'Ectomorph', 'Mesomorph', 'Endomorph', 'Mixed'] },
          { label: 'Weekly Availability', field: 'availability' as const, options: ['', '2 days', '3 days', '4 days', '5 days', '6 days'] },
        ].map((f) => (
          <div key={f.field}>
            <label className="text-[var(--page-text)]/60 text-xs font-medium mb-1.5 block">{f.label}</label>
            <select value={data.clientContext[f.field]} onChange={(e) => updateContextField(f.field, e.target.value)} className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00AEEF]">
              {f.options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label className="text-[var(--page-text)]/60 text-xs font-medium mb-2 block">Limitations & Considerations</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LIMITATIONS.map((limitation) => (
            <label key={limitation} className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] cursor-pointer hover:border-[var(--azfit-primary)]/50 transition-colors">
              <input type="checkbox" checked={data.clientContext.limitations.includes(limitation)} onChange={() => toggleLimitation(limitation)} className="w-4 h-4 rounded border-[var(--card-border)] accent-[#00AEEF]" />
              <span className="text-[var(--page-text)] text-xs">{limitation}</span>
            </label>
          ))}
        </div>
        {data.clientContext.limitations.includes('Other') && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
            <Input placeholder="Describe other limitation..." value={data.clientContext.otherLimitation} onChange={(e) => updateContextField('otherLimitation', e.target.value)} className="bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)] text-sm" />
          </motion.div>
        )}
      </div>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 space-y-3">
        <h4 className="text-[var(--page-text)] text-sm font-semibold">Context Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-[var(--page-text)]/60">Age: <span className="text-[var(--page-text)]">{data.clientContext.ageRange || '—'}</span></div>
          <div className="text-[var(--page-text)]/60">Experience: <span className="text-[var(--page-text)]">{data.clientContext.experience || '—'}</span></div>
          <div className="text-[var(--page-text)]/60">Body Type: <span className="text-[var(--page-text)]">{data.clientContext.bodyType || '—'}</span></div>
          <div className="text-[var(--page-text)]/60">Availability: <span className="text-[var(--page-text)]">{data.clientContext.availability || '—'}</span></div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--card-border)]">
          <AlertTriangle className={cn('w-4 h-4', aiRiskScore > 50 ? 'text-[#EF4444]' : 'text-[#22C55E]')} />
          <span className="text-[var(--page-text)]/60 text-xs">AI Risk Score:</span>
          <div className="flex-1 bg-[var(--page-bg)] rounded-full h-2"><motion.div initial={{ width: 0 }} animate={{ width: `${aiRiskScore}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: aiRiskScore > 50 ? '#EF4444' : aiRiskScore > 25 ? '#F59E0B' : '#22C55E' }} /></div>
          <span className="text-xs font-mono font-bold" style={{ color: aiRiskScore > 50 ? '#EF4444' : aiRiskScore > 25 ? '#F59E0B' : '#22C55E' }}>{aiRiskScore}%</span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => updateData({ clientContext: { ageRange: '26-35', experience: '1-3 years', bodyType: 'Mesomorph', availability: '4 days', limitations: ['None (healthy)'], otherLimitation: '' } })} className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs"><Bot className="w-3.5 h-3.5 mr-1" />Recommend Context</Button>
    </div>
  );
}

const PHASE_COLORS = ['#F59E0B', '#EF4444', '#22C55E', '#00AEEF', '#8B5CF6', '#EAB308'];

function Step4Phases({ data, updateData }: StepProps) {
  const [editingPhase, setEditingPhase] = useState<ProgramPhase | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const togglePhase = useCallback((phaseId: string) => updateData((prev) => ({ phases: prev.phases.map((p) => (p.id === phaseId ? { ...p, active: !p.active } : p)) })), [updateData]);
  const removePhase = useCallback((phaseId: string) => updateData((prev) => ({ phases: prev.phases.filter((p) => p.id !== phaseId) })), [updateData]);
  const addPhase = useCallback(() => updateData((prev) => ({ phases: [...prev.phases, { id: `p${Date.now()}`, name: 'New Phase', weeks: 3, focus: 'Custom focus', color: '#00AEEF', active: true }] })), [updateData]);
  const duplicatePhase = useCallback((phase: ProgramPhase) => updateData((prev) => {
    const idx = prev.phases.findIndex((p) => p.id === phase.id);
    const copy: ProgramPhase = { ...phase, id: `p${Date.now()}`, name: `${phase.name} (copy)` };
    const phases = [...prev.phases];
    phases.splice(idx + 1, 0, copy);
    return { phases };
  }), [updateData]);
  const saveEditedPhase = useCallback(() => {
    if (!editingPhase) return;
    const trimmed = { ...editingPhase, name: editingPhase.name.trim() || 'Phase', weeks: Math.min(16, Math.max(1, editingPhase.weeks || 1)) };
    updateData((prev) => ({ phases: prev.phases.map((p) => (p.id === trimmed.id ? trimmed : p)) }));
    setEditingPhase(null);
  }, [editingPhase, updateData]);
  // Method-aware phase suggestion (Phase 30B) — null when the method has no map
  const suggestion = useMemo(() => suggestPhasesForMethod(data.method), [data.method]);
  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    updateData({ phases: suggestion.map((s, i) => ({ ...s, id: `p${Date.now()}-${i}`, active: true })) });
    setSuggestionDismissed(true);
  }, [suggestion, updateData]);
  const totalWeeks = useMemo(() => data.phases.filter((p) => p.active).reduce((sum, p) => sum + p.weeks, 0), [data.phases]);
  return (
    <div className="space-y-5">
      {suggestion && !suggestionDismissed && (
        <div className="rounded-xl border border-[#00AEEF]/40 bg-[#00AEEF]/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <Sparkles className="w-4 h-4 text-[#00AEEF] shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-[var(--page-text)]">
            Suggested for this method: <span className="font-semibold text-[#00AEEF]">{suggestion.map((s) => `${s.name} (${s.weeks}w)`).join(' → ')}</span>
          </p>
          <Button size="sm" onClick={acceptSuggestion} className="bg-[#00AEEF] hover:bg-[#0099D1] text-[#0B1120] text-xs font-bold">Accept</Button>
          <button onClick={() => setSuggestionDismissed(true)} className="p-1 rounded-lg text-[var(--page-text)]/50 hover:text-[var(--page-text)]"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <div className="space-y-3">
        {data.phases.map((phase) => (
          <motion.div key={phase.id} layout className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={phase.active} onChange={() => togglePhase(phase.id)} className="w-5 h-5 rounded accent-[#00AEEF]" />
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={cn('text-sm font-semibold', phase.active ? 'text-[var(--page-text)]' : 'text-[var(--page-text)]/40 line-through')}>{phase.name}</h4>
                  <Badge variant="outline" className="text-[10px] border-[var(--card-border)] text-[var(--page-text)]/60">{phase.weeks} weeks</Badge>
                  {phase.intensityTarget && <Badge variant="outline" className="text-[10px] border-[#F59E0B]/40 text-[#F59E0B]">{phase.intensityTarget}</Badge>}
                  {phase.volumeTarget && <Badge variant="outline" className="text-[10px] border-[#8B5CF6]/40 text-[#8B5CF6]">{phase.volumeTarget}</Badge>}
                </div>
                <p className={cn('text-xs mt-0.5', phase.active ? 'text-[var(--page-text)]/60' : 'text-[var(--page-text)]/40')}>{phase.focus}</p>
              </div>
              <button onClick={() => setEditingPhase({ ...phase })} className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => duplicatePhase(phase)} className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"><Copy className="w-4 h-4" /></button>
              <button onClick={() => removePhase(phase.id)} className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-[var(--page-text)]/60 hover:text-[#EF4444] transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[var(--page-text)] text-sm font-semibold">Weekly Training Hours</label>
          <span className="text-[#00AEEF] font-mono text-sm font-bold">{data.weeklyHours}h</span>
        </div>
        <Slider value={[data.weeklyHours]} onValueChange={([v]) => updateData({ weeklyHours: v })} min={2} max={10} step={0.5} className="w-full" />
        <div className="flex justify-between text-[10px] text-[var(--page-text)]/60 mt-1"><span>2h</span><span>10h</span></div>
      </div>
      <div>
        <label className="text-[var(--page-text)]/60 text-xs font-medium mb-2 block">Phase Timeline ({totalWeeks} weeks)</label>
        <div className="flex h-8 rounded-xl overflow-hidden bg-[var(--page-bg)] border border-[var(--card-border)]">
          {data.phases.filter((p) => p.active).map((phase) => (
            <motion.div key={phase.id} initial={{ width: 0 }} animate={{ width: `${(phase.weeks / totalWeeks) * 100}%` }} transition={{ duration: 0.5 }} className="h-full flex items-center justify-center" style={{ backgroundColor: `${phase.color}30`, borderRight: `2px solid ${phase.color}` }}>
              <span className="text-[10px] font-bold truncate px-1" style={{ color: phase.color }}>{phase.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addPhase} className="border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] text-xs"><Plus className="w-3.5 h-3.5 mr-1" />Add Phase</Button>
      </div>

      {/* Phase edit dialog (Phase 30B) */}
      <AnimatePresence>
        {editingPhase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditingPhase(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-md p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[var(--page-text)] text-base font-bold">Edit Phase</h3>
                <button onClick={() => setEditingPhase(null)} className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[var(--page-text)]/60 text-xs mb-1 block">Name</label>
                  <Input value={editingPhase.name} onChange={(e) => setEditingPhase({ ...editingPhase, name: e.target.value })} className="bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
                </div>
                <div>
                  <label className="text-[var(--page-text)]/60 text-xs mb-1 block">Weeks (1–16)</label>
                  <Input type="number" min={1} max={16} value={editingPhase.weeks} onChange={(e) => setEditingPhase({ ...editingPhase, weeks: parseInt(e.target.value) || 1 })} className="bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
                </div>
                <div>
                  <label className="text-[var(--page-text)]/60 text-xs mb-1 block">Focus</label>
                  <Input value={editingPhase.focus} onChange={(e) => setEditingPhase({ ...editingPhase, focus: e.target.value })} className="bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--page-text)]/60 text-xs mb-1 block">Intensity target</label>
                    <Input value={editingPhase.intensityTarget ?? ''} placeholder="e.g. RPE 7-8" onChange={(e) => setEditingPhase({ ...editingPhase, intensityTarget: e.target.value || undefined })} className="bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
                  </div>
                  <div>
                    <label className="text-[var(--page-text)]/60 text-xs mb-1 block">Volume target</label>
                    <Input value={editingPhase.volumeTarget ?? ''} placeholder="e.g. MEV range" onChange={(e) => setEditingPhase({ ...editingPhase, volumeTarget: e.target.value || undefined })} className="bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
                  </div>
                </div>
                <div>
                  <label className="text-[var(--page-text)]/60 text-xs mb-1.5 block">Color</label>
                  <div className="flex gap-2">
                    {PHASE_COLORS.map((c) => (
                      <button key={c} onClick={() => setEditingPhase({ ...editingPhase, color: c })} className={cn('w-7 h-7 rounded-full border-2 transition-all', editingPhase.color === c ? 'border-white scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button variant="outline" onClick={() => setEditingPhase(null)} className="flex-1 border-[var(--card-border)] text-[var(--page-text)]">Cancel</Button>
                <Button onClick={saveEditedPhase} className="flex-1 bg-[#00AEEF] hover:bg-[#0099D1] text-[#0B1120] font-bold">Save Phase</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function muscleTagsFor(workout: string): string[] {
  const w = workout.toLowerCase();
  if (w.includes('push')) return ['Chest', 'Shoulders', 'Triceps'];
  if (w.includes('pull')) return ['Back', 'Biceps', 'Rear Delts'];
  if (w.includes('squat') || w.includes('legs') || w.includes('quad')) return ['Quads', 'Glutes', 'Calves'];
  if (w.includes('hinge') || w.includes('deadlift') || w.includes('ham')) return ['Hamstrings', 'Glutes', 'Lower Back'];
  if (w.includes('upper')) return ['Chest', 'Back', 'Shoulders'];
  if (w.includes('lower')) return ['Quads', 'Glutes', 'Hamstrings'];
  if (w.includes('full')) return ['Full Body'];
  if (w.includes('chest')) return ['Chest', 'Triceps'];
  if (w.includes('back')) return ['Back', 'Biceps'];
  if (w.includes('shoulder')) return ['Shoulders', 'Triceps'];
  if (w.includes('arm')) return ['Biceps', 'Triceps'];
  return ['General'];
}

function Step5Split({ data, updateData }: StepProps) {
  const [splitType, setSplitType] = useState('Upper/Lower');
  const toggleDay = useCallback((dayIdx: number) => updateData((prev) => ({ split: prev.split.map((d, i) => (i === dayIdx ? { ...d, active: !d.active } : d)) })), [updateData]);
  const updateDayWorkout = useCallback((dayIdx: number, value: string) => updateData((prev) => ({ split: prev.split.map((d, i) => (i === dayIdx ? { ...d, workout: value } : d)) })), [updateData]);
  const applySplit = useCallback((type: string) => { setSplitType(type); if (SPLIT_DEFAULTS[type]) updateData({ split: SPLIT_DEFAULTS[type].map((d) => ({ ...d })) }); }, [updateData]);

  const activeDays = useMemo(() => data.split.filter((d) => d.active).length, [data.split]);
  const restDays = useMemo(() => data.split.filter((d) => !d.active).length, [data.split]);
  const perDayExercises = data.exercises.length;
  const weeklyVolume = perDayExercises * activeDays;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_240px]">
      {/* Left: split type + day cards */}
      <div className="space-y-4">
        <div>
          <label className="text-[var(--page-text)]/60 text-xs font-medium mb-1.5 block">Split Type</label>
          <select value={splitType} onChange={(e) => applySplit(e.target.value)} className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00AEEF]">
            {Object.keys(SPLIT_DEFAULTS).map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {data.split.map((day, idx) => {
            const active = day.active;
            const tags = active ? muscleTagsFor(day.workout) : [];
            return (
              <motion.div
                key={day.day}
                layout
                className={cn('rounded-xl border overflow-hidden transition-all',
                  active
                    ? 'border-l-4 border-l-[#00AEEF] border-[var(--card-border)] bg-[var(--card-bg)]'
                    : 'border-[var(--card-border)] bg-[var(--page-bg)] opacity-60')}
              >
                <div className="flex items-center justify-between px-3 pt-3">
                  <span className={cn('text-sm font-bold', active ? 'text-[var(--page-text)]' : 'text-[var(--page-text)]/40')}>{day.day.toUpperCase()}</span>
                  <input type="checkbox" checked={day.active} onChange={() => toggleDay(idx)} className="w-4 h-4 rounded accent-[#00AEEF]" />
                </div>
                {active ? (
                  <div className="px-3 pb-3 pt-1">
                    <textarea
                      value={day.workout}
                      onChange={(e) => updateDayWorkout(idx, e.target.value)}
                      rows={1}
                      className="w-full bg-transparent border-none outline-none resize-none text-xs font-semibold text-[#00AEEF]"
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="rounded-md bg-[var(--page-bg)] border border-[var(--card-border)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--page-text)]/70">{perDayExercises} exercises</span>
                      {tags.map((t) => (
                        <span key={t} className="rounded-md bg-[#00AEEF]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#00AEEF]">{t}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-xs text-[var(--page-text)]/40">Rest Day</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={() => applySplit('Upper/Lower')} className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs"><Bot className="w-3.5 h-3.5 mr-1" />Recommend Split</Button>
      </div>

      {/* Right: Split Summary panel (below grid on mobile) */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 h-fit lg:sticky lg:top-4">
        <h4 className="text-[var(--page-text)] text-sm font-bold mb-3">Split Summary</h4>
        <p className="text-xs text-[var(--page-text)]/70">{activeDays} Training Days / {restDays} Rest Days</p>
        <p className="text-xs text-[var(--page-text)]/70 mt-0.5">Weekly Volume: <span className="text-[#00AEEF] font-bold">{weeklyVolume} exercises</span></p>
        {/* Mini bar chart of exercises per day (styled divs) */}
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {data.split.map((day) => {
            const count = day.active ? perDayExercises : 0;
            const max = Math.max(perDayExercises, 1);
            const pct = day.active ? (count / max) * 100 : 0;
            return (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-full w-full items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, day.active ? 12 : 0)}%` }}
                    transition={{ duration: 0.4 }}
                    className={cn('w-full rounded-t', day.active ? 'bg-[#00AEEF]' : 'bg-[var(--card-border)]')}
                    style={{ height: day.active ? undefined : '6%' }}
                  />
                </div>
                <span className="text-[9px] text-[var(--page-text)]/50">{day.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SPLIT_DAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function Step6Exercises({ data, updateData, limitations }: StepProps) {
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({});
  const perDay = data.workoutExercises != null;
  const activeDays = data.split.filter((d) => d.active);
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    activeDays[0] ? SPLIT_DAY_INDEX[activeDays[0].day] || 1 : 1
  );

  // In per-day mode (loaded from DB) each active day owns its exercise list;
  // a day without a list yet falls back to the shared `exercises` template.
  const list = perDay
    ? (data.workoutExercises![selectedDay] ?? data.exercises)
    : data.exercises;

  const setList = useCallback(
    (fn: (prev: ProgramExercise[]) => ProgramExercise[]) =>
      updateData((prev) =>
        perDay
          ? {
              workoutExercises: {
                ...(prev.workoutExercises || {}),
                [selectedDay]: fn(prev.workoutExercises?.[selectedDay] ?? prev.exercises),
              },
            }
          : { exercises: fn(prev.exercises) }
      ),
    [updateData, perDay, selectedDay]
  );

  const updateExercise = useCallback(
    (idx: number, field: keyof ProgramExercise, value: string | number) =>
      setList((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e))),
    [setList]
  );
  const deleteExercise = useCallback(
    (idx: number) => setList((prev) => prev.filter((_, i) => i !== idx)),
    [setList]
  );
  const addExercise = useCallback(
    () =>
      setList((prev) => [
        ...prev,
        { code: `B${prev.length + 1}`, name: 'New Exercise', sets: 3, reps: '10', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '2:00' },
      ]),
    [setList]
  );
  const handleAutoFill = useCallback(() => setList(() => DEFAULT_EXERCISES.map((e) => ({ ...e }))), [setList]);
  const toggleRow = useCallback((idx: number) => setOpenRows((prev) => ({ ...prev, [idx]: !prev[idx] })), []);

  // Phase 30C — superset group badges + per-exercise pair control
  const groupLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of list) {
      if (!e.supersetGroup || m.has(e.supersetGroup)) continue;
      const members = list.filter((x) => x.supersetGroup === e.supersetGroup);
      if (members.length > 1) m.set(e.supersetGroup, members.map((x) => x.code).join(' ↔ '));
    }
    return m;
  }, [list]);
  const handlePairChange = useCallback(
    (idx: number, group: string) =>
      setList((prev) => prev.map((e, i) => (i === idx ? { ...e, supersetGroup: group || undefined } : e))),
    [setList]
  );

  // Phase 28D — safety flags for the current day list
  const flagsByIdx = useMemo(() => {
    const m = new Map<number, SafetyFlag>();
    for (const f of evaluateProgramSafety(list, limitations ?? [])) m.set(f.exerciseIndex, f);
    return m;
  }, [list, limitations]);
  const [resolvedFlags, setResolvedFlags] = useState<Record<string, 'swap' | 'keep'>>({});
  const flagKey = useCallback((idx: number) => `${selectedDay}:${idx}`, [selectedDay]);
  const unresolved = useMemo(
    () => [...flagsByIdx.values()].filter((f) => !resolvedFlags[flagKey(f.exerciseIndex)]),
    [flagsByIdx, resolvedFlags, flagKey]
  );
  const handleSwap = useCallback(
    (idx: number, flag: SafetyFlag, altName: string) => {
      setList((prev) => prev.map((e, i) => (i === idx ? {
        ...e,
        name: altName,
        isSubstituted: true,
        safetyNote: `Swapped from ${flag.exerciseName} — ${flag.limitation}`,
      } : e)));
      setResolvedFlags((prev) => ({ ...prev, [flagKey(idx)]: 'swap' }));
      toast.success('Swapped for safety');
    },
    [setList, flagKey]
  );
  const handleKeepOriginal = useCallback(
    (idx: number, flag: SafetyFlag) => {
      setList((prev) => prev.map((e, i) => (i === idx ? {
        ...e,
        safetyNote: `Trainer override: kept despite ${flag.limitation}`,
      } : e)));
      setResolvedFlags((prev) => ({ ...prev, [flagKey(idx)]: 'keep' }));
    },
    [setList, flagKey]
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleAutoFill} className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs"><Sparkles className="w-3.5 h-3.5 mr-1" />AI Auto-Fill</Button>
        <Button variant="outline" size="sm" onClick={addExercise} className="border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] text-xs"><Plus className="w-3.5 h-3.5 mr-1" />Add Exercise</Button>
      </div>

      {perDay && activeDays.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeDays.map((d) => {
            const idx = SPLIT_DAY_INDEX[d.day] || 1;
            const isSelected = idx === selectedDay;
            return (
              <button
                key={d.day}
                onClick={() => setSelectedDay(idx)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                  isSelected
                    ? 'border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10'
                    : 'border-[var(--card-border)] text-[var(--page-text)]/60 hover:border-[#00AEEF]/50'
                )}
              >
                {d.day} · {d.workout.split('—')[0].trim() || 'Workout'}
              </button>
            );
          })}
        </div>
      )}
      {unresolved.length > 0 && (
        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium',
          unresolved.some((f) => f.severity === 'exclude')
            ? 'border-[#EF4444]/40 bg-[#EF4444]/15 text-[#EF4444]'
            : 'border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#F59E0B]'
        )}>
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {unresolved.length} exercise{unresolved.length > 1 ? 's' : ''} conflict{unresolved.length > 1 ? '' : 's'} with client limitations — expand a flagged row to review.
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        <div className="grid grid-cols-9 gap-1 px-3 py-2 bg-[var(--page-bg)] border-b border-[var(--card-border)] text-[10px] text-[var(--page-text)]/60 font-semibold uppercase tracking-wider">
          <span>Code</span><span className="col-span-2">Exercise</span><span>Sets</span><span>Reps</span><span>%1RM</span><span>Tempo</span><span>Rest</span><span className="text-right">Actions</span>
        </div>
        <AnimatePresence>
          {list.map((exercise, idx) => {
            const flag = flagsByIdx.get(idx);
            const activeFlag = flag && !resolvedFlags[flagKey(idx)] ? flag : null;
            const groupBadge = exercise.supersetGroup ? groupLabels.get(exercise.supersetGroup) : undefined;
            const isLastOfGroup = !!exercise.supersetGroup && (idx === list.length - 1 || list[idx + 1]?.supersetGroup !== exercise.supersetGroup);
            return (
            <motion.div key={`${exercise.code}-${idx}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={cn(
              "border-b border-[var(--card-border)] last:border-b-0",
              activeFlag && (activeFlag.severity === 'exclude' ? 'border-l-2 border-l-[#EF4444]' : 'border-l-2 border-l-[#F59E0B]')
            )}>
              <div className="grid grid-cols-9 gap-1 px-3 py-2 items-center text-xs">
                <span className="text-[#00AEEF] font-mono font-bold">{exercise.code}</span>
                <span className="col-span-2 text-[var(--page-text)] font-medium truncate flex items-center gap-1">
                  {activeFlag && <ShieldAlert className={cn('w-3 h-3 shrink-0', activeFlag.severity === 'exclude' ? 'text-[#EF4444]' : 'text-[#F59E0B]')} />}
                  <span className="truncate">{exercise.name}</span>
                  {groupBadge && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-[#8B5CF6]/50 text-[#8B5CF6] text-[9px] font-bold shrink-0">
                      <Link2 className="w-2.5 h-2.5" />{groupBadge}
                    </span>
                  )}
                </span>
                <span className="text-[var(--page-text)]/60">{exercise.sets}</span>
                <span className="text-[var(--page-text)]/60">{exercise.reps}</span>
                <span className="text-[var(--page-text)]/60 font-mono">{exercise.pct1RM}</span>
                <span className="text-[#8B5CF6] font-mono">{exercise.tempo}</span>
                <span className="text-[#F59E0B] font-mono">
                  {exercise.rest}
                  {isLastOfGroup && groupBadge && <span className="block text-[8px] font-sans">Rest after group</span>}
                </span>
                <div className="flex justify-end gap-1">
                  <button onClick={() => toggleRow(idx)} className="p-1 rounded hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => deleteExercise(idx)} className="p-1 rounded hover:bg-[#EF4444]/10 text-[var(--page-text)]/60 hover:text-[#EF4444] transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <AnimatePresence>
                {openRows[idx] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {activeFlag && (
                      <div className={cn(
                        'mx-3 mt-1 mb-2 rounded-lg border px-3 py-2 text-xs space-y-2',
                        activeFlag.severity === 'exclude' ? 'border-[#EF4444]/40 bg-[#EF4444]/10' : 'border-[#F59E0B]/40 bg-[#F59E0B]/10'
                      )}>
                        <p className="flex items-center gap-1.5 font-semibold text-[var(--page-text)]">
                          <ShieldAlert className={cn('w-3.5 h-3.5 shrink-0', activeFlag.severity === 'exclude' ? 'text-[#EF4444]' : 'text-[#F59E0B]')} />
                          {activeFlag.limitation}
                          <span className="font-normal text-[var(--page-text)]/60">— {activeFlag.note}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeFlag.alternatives.map((alt) => (
                            <button
                              key={alt.name}
                              onClick={() => handleSwap(idx, activeFlag, alt.name)}
                              className="px-2 py-1 rounded-lg border border-[#00AEEF]/50 text-[#00AEEF] hover:bg-[#00AEEF]/10 text-[11px] font-medium transition-colors"
                            >
                              Swap → {alt.name}
                            </button>
                          ))}
                          <button
                            onClick={() => handleKeepOriginal(idx, activeFlag)}
                            className="px-2 py-1 rounded-lg border border-[var(--card-border)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] text-[11px] font-medium transition-colors"
                          >
                            Keep Original
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-3 pb-3 bg-[var(--page-bg)]">
                      {[
                        { label: 'Exercise Name', field: 'name' as const, type: 'text' },
                        { label: 'Sets', field: 'sets' as const, type: 'number' },
                        { label: 'Reps', field: 'reps' as const, type: 'text' },
                        { label: '%1RM', field: 'pct1RM' as const, type: 'text' },
                        { label: 'Tempo', field: 'tempo' as const, type: 'text' },
                        { label: 'Rest', field: 'rest' as const, type: 'text' },
                      ].map((f) => (
                        <div key={f.field}>
                          <label className="text-[10px] text-[var(--page-text)]/60">{f.label}</label>
                          <Input type={f.type} value={exercise[f.field]} onChange={(e) => updateExercise(idx, f.field, f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)} className="h-7 text-xs bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
                        </div>
                      ))}
                      <div>
                        <label className="text-[10px] text-[var(--page-text)]/60">Superset Group</label>
                        <select
                          value={exercise.supersetGroup ?? ''}
                          onChange={(e) => handlePairChange(idx, e.target.value)}
                          className="h-7 w-full text-xs rounded-md bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)]"
                        >
                          <option value="">None</option>
                          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            );
          })}
        </AnimatePresence>
        {list.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-[var(--page-text)]/50">
            No exercises on this day yet — use Add Exercise.
          </p>
        )}
      </div>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3">
        <h5 className="text-[var(--page-text)] text-xs font-semibold mb-1.5">Tempo Legend (Poliquin Notation)</h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div className="text-[var(--page-text)]/60"><span className="text-[#8B5CF6] font-mono font-bold">Eccentric</span> — Lowering</div>
          <div className="text-[var(--page-text)]/60"><span className="text-[#8B5CF6] font-mono font-bold">Pause Bottom</span> — Hold</div>
          <div className="text-[var(--page-text)]/60"><span className="text-[#8B5CF6] font-mono font-bold">Concentric</span> — Lifting</div>
          <div className="text-[var(--page-text)]/60"><span className="text-[#8B5CF6] font-mono font-bold">Pause Top</span> — Squeeze</div>
        </div>
        <p className="text-[var(--page-text)]/40 text-[10px] mt-1.5">Example: 4-0-1-0 = 4s down, no pause, 1s up, no pause</p>
      </div>

      {/* Progression rules editor (Phase 30D) */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 space-y-2.5">
        <h5 className="text-[var(--page-text)] text-xs font-semibold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#00AEEF]" />Progression Rules</h5>
        <div className="flex flex-wrap gap-1.5">
          {PROGRESSION_PRESETS.map((preset) => {
            const active = data.progressionRules.some((r) => r.id === preset.id);
            return (
              <button
                key={preset.id}
                onClick={() => updateData((prev) => ({
                  progressionRules: active
                    ? prev.progressionRules.filter((r) => r.id !== preset.id)
                    : [...prev.progressionRules, { ...preset }],
                }))}
                className={cn(
                  'px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all',
                  active
                    ? 'border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10'
                    : 'border-[var(--card-border)] text-[var(--page-text)]/60 hover:border-[#00AEEF]/50'
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {data.progressionRules.length > 0 && (
          <ul className="space-y-1.5">
            {data.progressionRules.map((rule, idx) => (
              <li key={`${rule.id ?? 'custom'}-${idx}`} className="flex items-start gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] px-2.5 py-1.5">
                {rule.id ? (
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[var(--page-text)]">{rule.label}</span>
                    <p className="text-[11px] text-[var(--page-text)]/60">{rule.text}</p>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      value={rule.label}
                      onChange={(e) => updateData((prev) => ({ progressionRules: prev.progressionRules.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)) }))}
                      className="h-6 text-xs bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)]"
                    />
                    <Input
                      value={rule.text}
                      onChange={(e) => updateData((prev) => ({ progressionRules: prev.progressionRules.map((r, i) => (i === idx ? { ...r, text: e.target.value } : r)) }))}
                      className="h-6 text-[11px] bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)]"
                    />
                  </div>
                )}
                <button
                  onClick={() => updateData((prev) => ({ progressionRules: prev.progressionRules.filter((_, i) => i !== idx) }))}
                  className="p-1 rounded hover:bg-[#EF4444]/10 text-[var(--page-text)]/50 hover:text-[#EF4444] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => updateData((prev) => ({ progressionRules: [...prev.progressionRules, { label: 'Custom Rule', text: 'Edit me' }] }))}
          className="text-[11px] font-medium text-[#00AEEF] hover:opacity-80 transition"
        >
          + Add custom rule
        </button>
      </div>
    </div>
  );
}

function Step7Preview({ data, program, clientName, dbMethods = [], clients = [] }: StepProps) {
  const navigate = useNavigate();
  const totalWeeks = useMemo(() => data.phases.filter((p) => p.active).reduce((s, p) => s + p.weeks, 0), [data.phases]);
  // Per-day lists (loaded programs) are the source of truth when present.
  const allExercises = useMemo(
    () => (data.workoutExercises ? Object.values(data.workoutExercises).flat() : data.exercises),
    [data.workoutExercises, data.exercises]
  );
  const totalExercises = allExercises.length;
  const substitutionCount = useMemo(() => allExercises.filter((e) => e.isSubstituted).length, [allExercises]);
  const totalSets = allExercises.reduce((sum, e) => sum + (e.sets || 0), 0);
  const activeDays = data.split.filter((d) => d.active).length;
  const restDays = data.split.filter((d) => !d.active).length;
  const intensity = useMemo(() => { const avgPct = allExercises.reduce((sum, e) => { const num = parseFloat(e.pct1RM); return sum + (isNaN(num) ? 70 : num); }, 0) / totalExercises || 70; return Math.round(avgPct); }, [allExercises, totalExercises]);
  const avgRest = useMemo(() => { const rests = allExercises.map((e) => parseInt(e.rest) || 90); return Math.round(rests.reduce((a, b) => a + b, 0) / rests.length); }, [allExercises]);
  const aiConfidence = useMemo(() => { let score = 70; if (data.goal) score += 10; if (data.method) score += 10; if (data.clientContext.ageRange) score += 5; if (data.phases.length > 0) score += 5; return Math.min(score, 98); }, [data]);
  const goalName = GOALS.find((g) => g.id === data.goal)?.name || '—';
  const methodName = resolveMethodName(data.method, dbMethods);
  const methodData = LEGACY_METHODS.find((m) => m.id === data.method);
  const splitName = data.split.filter((d) => d.active).length > 0 ? `${activeDays}-Day Split` : '—';
  const handleStartWorkout = (workout: GeneratedWorkout) => { if (!program) return; const session = workoutToSession(workout, program.id); setActiveSession(session); navigate(`/sheets?session=${session.id}`); };

  // Phase 30D — derived preview metrics (summary vs week-by-week)
  const [previewTab, setPreviewTab] = useState<'summary' | 'weeks'>('summary');
  const dayLists = useMemo(
    () =>
      data.split
        .filter((d) => d.active)
        .map((d) => {
          const idx = SPLIT_DAY_INDEX[d.day] || 1;
          return { day: d.day, workout: d.workout, exercises: data.workoutExercises?.[idx] ?? data.exercises };
        }),
    [data.split, data.workoutExercises, data.exercises]
  );
  const muscleRows = useMemo(() => setsPerMuscleGroup(allExercises), [allExercises]);
  const clientEquipment = useMemo(() => {
    const row = clients.find((c) => c.id === data.assignedClient);
    const eq = (row?.intake_profile as Record<string, unknown> | null)?.equipment;
    return Array.isArray(eq) && eq.length > 0 ? (eq as string[]) : null;
  }, [clients, data.assignedClient]);
  const equipmentRows = useMemo(() => equipmentChecklist(allExercises, clientEquipment), [allExercises, clientEquipment]);
  const weekCards = useMemo(
    () =>
      Array.from({ length: totalWeeks }, (_, i) => ({
        week: i + 1,
        note: progressionNoteForWeek(i + 1, data.progressionRules),
        isDeload: data.progressionRules.some((r) => r.id === 'deload') && (i + 1) % 4 === 0,
      })),
    [totalWeeks, data.progressionRules]
  );
  return (
    <div className="space-y-5">
      <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[var(--page-text)] text-xl font-bold">{data.programName || 'Untitled Program'}</h3>
            <p className="text-[var(--page-text)]/60 text-sm mt-1">{goalName} — {methodName} — {totalWeeks} weeks — {activeDays} days/week</p>
            <p className="text-[var(--page-text)]/80 text-sm mt-1 font-medium">Built for: {clientName || 'Unassigned'}</p>
            {substitutionCount > 0 && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] font-medium">
                <ShieldAlert className="w-3 h-3" />{substitutionCount} safety substitution{substitutionCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-[var(--page-text)]/60 text-[10px]">AI Confidence</div>
            <div className="text-lg font-bold font-mono" style={{ color: aiConfidence > 85 ? '#22C55E' : aiConfidence > 60 ? '#F59E0B' : '#EF4444' }}>{aiConfidence}%</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[{ v: `${intensity}%`, l: 'Avg Intensity', c: '#EF4444' }, { v: totalSets, l: 'Total Sets / Week', c: '#00AEEF' }, { v: totalExercises, l: 'Exercises', c: '#F59E0B' }, { v: `${data.weeklyHours}h`, l: 'Weekly Time', c: '#8B5CF6' }].map((s) => (
            <div key={s.l} className="bg-[var(--page-bg)] border border-[var(--card-border)] rounded-lg p-3 text-center">
              <div className="text-lg font-bold font-mono" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[var(--page-text)]/60 text-[10px]">{s.l}</div>
            </div>
          ))}
        </div>
        {data.description && <p className="text-[var(--page-text)]/60 text-sm mb-4 leading-relaxed">{data.description}</p>}
        {data.tags.length > 0 && <div className="flex flex-wrap gap-2 mb-4">{data.tags.map((tag) => <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--page-text)]">{tag}</span>)}</div>}
        <div className="mb-4">
          <div className="text-[var(--page-text)]/60 text-xs mb-2 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />Program Timeline — {totalWeeks} Weeks</div>
          <div className="flex h-8 rounded-lg overflow-hidden bg-[var(--page-bg)] border border-[var(--card-border)]">
            {data.phases.filter((p) => p.active).map((phase) => (
              <motion.div key={phase.id} initial={{ width: 0 }} animate={{ width: `${(phase.weeks / totalWeeks) * 100}%` }} transition={{ duration: 0.5 }} className="h-full flex items-center justify-center relative" style={{ backgroundColor: phase.color + '30', borderRight: `2px solid ${phase.color}` }}>
                <span className="text-[10px] font-semibold text-[var(--page-text)] truncate px-1">{phase.name}</span>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--page-text)]/60 mt-1"><span>Week 1</span><span>Week {totalWeeks}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ i: Eye, l: 'Preview Workout' }, { i: BarChart3, l: 'Analytics' }, { i: Download, l: 'Export PDF' }].map((b) => <Button key={b.l} variant="outline" size="sm" className="border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] text-xs"><b.i className="w-3.5 h-3.5 mr-1" />{b.l}</Button>)}
        </div>
      </Card>

      {/* Phase 30D — derived preview metrics */}
      <div className="flex gap-2">
        {(['summary', 'weeks'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setPreviewTab(tab)}
            className={cn(
              'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
              previewTab === tab
                ? 'border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10'
                : 'border-[var(--card-border)] text-[var(--page-text)]/60 hover:border-[#00AEEF]/50'
            )}
          >
            {tab === 'summary' ? 'Summary' : 'Week-by-Week'}
          </button>
        ))}
      </div>

      {previewTab === 'summary' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Sets per muscle group */}
          <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
            <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#00AEEF]" />Sets per Muscle Group</h4>
            <div className="space-y-2">
              {muscleRows.map((row) => (
                <div key={row.category}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-[var(--page-text)]">{row.label}</span>
                    <span className="text-[var(--page-text)]/60 font-mono">{row.sets} · {row.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--page-bg)] overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${row.pct}%` }} transition={{ duration: 0.5 }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #00AEEF, #8B5CF6)' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Equipment checklist */}
          <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
            <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Dumbbell className="w-4 h-4 text-[#8B5CF6]" />Equipment Checklist</h4>
            {clientEquipment == null && (
              <p className="text-[10px] text-[var(--page-text)]/50 mb-2">No client equipment profile — Full Gym assumed.</p>
            )}
            <ul className="space-y-1.5">
              {equipmentRows.map((row) => (
                <li key={row.item} className="flex items-center gap-2 text-xs">
                  <span>{row.covered === null ? '➖' : row.covered ? '✅' : '⚠️'}</span>
                  <span className="text-[var(--page-text)]">{row.item}</span>
                  {row.covered === false && <span className="text-[10px] text-[#F59E0B]">not in client setup</span>}
                </li>
              ))}
            </ul>
          </Card>

          {/* Time per session + progression rules */}
          <div className="space-y-5">
            <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
              <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#F59E0B]" />Estimated Time per Session</h4>
              <ul className="space-y-1.5">
                {dayLists.map((d) => (
                  <li key={d.day} className="flex justify-between text-xs">
                    <span className="text-[var(--page-text)]">{d.day} · {d.workout.split('—')[0].trim() || 'Workout'}</span>
                    <span className="font-mono text-[#00AEEF]">~{estimateSessionMinutes(d.exercises)} min</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-[var(--page-text)]/40 mt-2">sets × 40s + rest periods</p>
            </Card>
            {data.progressionRules.length > 0 && (
              <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
                <h4 className="text-[var(--page-text)] text-sm font-bold mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#22C55E]" />Progression Rules</h4>
                <ul className="space-y-1.5">
                  {data.progressionRules.map((r, i) => (
                    <li key={i} className="text-xs">
                      <span className="text-[var(--page-text)] font-medium">{r.label}</span>
                      <span className="text-[var(--page-text)]/60"> — {r.text}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {weekCards.map((card) => (
            <Card key={card.week} className={cn('bg-[var(--card-bg)] border p-4', card.isDeload ? 'border-[#F59E0B]/40' : 'border-[var(--card-border)]')}>
              <h4 className={cn('text-sm font-bold mb-2', card.isDeload ? 'text-[#F59E0B]' : 'text-[var(--page-text)]')}>Week {card.week}</h4>
              <ul className="space-y-1 mb-2">
                {dayLists.map((d) => (
                  <li key={d.day} className="text-[11px] text-[var(--page-text)]/70">{d.day} · {d.exercises.length} exercises</li>
                ))}
              </ul>
              {card.note && (
                <p className={cn('text-[10px] leading-snug', card.isDeload ? 'text-[#F59E0B]' : 'text-[var(--page-text)]/50')}>{card.note}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
          <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-[#00AEEF]" />Training Method</h4>
          <div className="space-y-2 text-sm">
            {[{ k: 'Method', v: methodName, bold: true }, { k: 'Goal', v: goalName }, { k: 'Structure', v: methodData?.structure || '—' }, { k: 'Progression', v: methodData?.progression || '—' }, { k: 'Target Audience', v: methodData?.targetAudience || '—' }].map((r) => (
              <div key={r.k} className="flex justify-between"><span className="text-[var(--page-text)]/60">{r.k}</span><span className={r.bold ? 'text-[var(--page-text)] font-medium' : 'text-[var(--page-text)]'}>{r.v}</span></div>
            ))}
          </div>
        </Card>
        <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
          <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-[#22C55E]" />Client Context</h4>
          <div className="space-y-2 text-sm">
            {[{ k: 'Age Range', v: data.clientContext.ageRange }, { k: 'Experience', v: data.clientContext.experience }, { k: 'Body Type', v: data.clientContext.bodyType }, { k: 'Availability', v: data.clientContext.availability }].map((r) => (
              <div key={r.k} className="flex justify-between"><span className="text-[var(--page-text)]/60">{r.k}</span><span className="text-[var(--page-text)]">{r.v || '—'}</span></div>
            ))}
            {data.clientContext.limitations.length > 0 && (
              <div className="pt-1">
                <span className="text-[var(--page-text)]/60 text-xs">Limitations:</span>
                <div className="flex flex-wrap gap-1 mt-1">{data.clientContext.limitations.map((lim) => <span key={lim} className="text-[10px] px-1.5 py-0.5 rounded bg-[#EF4444]/10 text-[#EF4444]">{lim}</span>)}</div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
        <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#F59E0B]" />Weekly Split — {splitName}</h4>
        <div className="grid grid-cols-7 gap-2">
          {data.split.map((day) => (
            <div key={day.day} className={`rounded-lg p-2.5 text-center border ${day.active ? 'bg-[var(--page-bg)] border-[var(--card-border)]' : 'bg-[var(--page-bg)]/50 border-[var(--card-border)]/50 opacity-60'}`}>
              <div className={`text-[10px] font-bold ${day.active ? 'text-[var(--page-text)]' : 'text-[var(--page-text)]/40'}`}>{day.day}</div>
              <div className={`text-[10px] mt-1 ${day.active ? 'text-[#00AEEF]' : 'text-[var(--page-text)]/40'}`}>{day.active ? day.workout || 'Workout' : 'Rest'}</div>
              {day.active && <div className="w-1.5 h-1.5 rounded-full bg-[#00AEEF] mx-auto mt-1" />}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-[var(--page-text)]/60"><span>{activeDays} training days</span><span>{restDays} rest days</span><span>{data.weeklyHours}h/week</span><span>~{Math.round((data.weeklyHours / activeDays) * 60)}min/session</span></div>
      </Card>

      {program && program.phases[0]?.workouts.length > 0 && (
        <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
          <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Dumbbell className="w-4 h-4 text-[#00AEEF]" />Workouts</h4>
          <div className="space-y-2">
            {program.phases[0].workouts.map((workout) => (
              <div key={workout.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--card-border)]">
                <div>
                  <div className="text-[var(--page-text)] text-sm font-semibold">{workout.name}</div>
                  <div className="text-[var(--page-text)]/60 text-xs">{workout.exercises.length} exercises • ~{workout.estimatedMinutes} min</div>
                </div>
                <Button size="sm" onClick={() => handleStartWorkout(workout)} className="bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] text-xs font-semibold"><Play className="w-3.5 h-3.5 mr-1 fill-current" />Start</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
        <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Dumbbell className="w-4 h-4 text-[#8B5CF6]" />Exercise Breakdown — {totalExercises} exercises, {totalSets} sets/week</h4>
        <div className="grid grid-cols-12 gap-2 text-[10px] text-[var(--page-text)]/60 font-semibold border-b border-[var(--card-border)] pb-2 mb-2">
          <div className="col-span-1">Code</div><div className="col-span-4">Exercise</div><div className="col-span-1 text-center">Sets</div><div className="col-span-1 text-center">Reps</div><div className="col-span-2 text-center">%1RM</div><div className="col-span-1 text-center">Tempo</div><div className="col-span-1 text-center">Rest</div>{!data.workoutExercises && <div className="col-span-1 text-center">Sets/Wk</div>}
        </div>
        {(data.workoutExercises ? data.split.filter((d) => d.active) : [null]).map((dayEntry) => {
          const dayList = dayEntry
            ? (data.workoutExercises![SPLIT_DAY_INDEX[dayEntry.day] || 1] ?? [])
            : data.exercises;
          if (dayList.length === 0 && dayEntry) return null;
          return (
            <div key={dayEntry ? dayEntry.day : 'shared'} className="space-y-1.5 mb-3 last:mb-0">
              {dayEntry && (
                <p className="text-[11px] font-semibold text-[#00AEEF] mt-2">
                  {dayEntry.day} — {dayEntry.workout || 'Workout'}
                </p>
              )}
              {dayList.map((ex) => (
                <div key={`${dayEntry?.day || 'shared'}-${ex.code}`} className="grid grid-cols-12 gap-2 text-xs items-center py-1.5 border-b border-[var(--card-border)]/50 last:border-0">
                  <div className="col-span-1 text-[var(--page-text)] font-mono font-bold">{ex.code}</div>
                  <div className="col-span-4 text-[var(--page-text)]">{ex.name}</div>
                  <div className="col-span-1 text-center text-[var(--page-text)]/60">{ex.sets}</div>
                  <div className="col-span-1 text-center text-[var(--page-text)]/60">{ex.reps}</div>
                  <div className="col-span-2 text-center text-[#EF4444] font-mono">{ex.pct1RM}</div>
                  <div className="col-span-1 text-center text-[#8B5CF6] font-mono text-[10px]">{ex.tempo}</div>
                  <div className="col-span-1 text-center text-[var(--page-text)]/60">{ex.rest}s</div>
                  {!data.workoutExercises && <div className="col-span-1 text-center text-[#00AEEF] font-mono">{ex.sets * activeDays}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </Card>

      <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
        <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-[#EF4444]" />Phase Breakdown</h4>
        <div className="space-y-3">
          {data.phases.filter((p) => p.active).map((phase, i) => (
            <div key={phase.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--card-border)]">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: phase.color }}>{i + 1}</div>
              <div className="flex-1"><div className="text-[var(--page-text)] text-sm font-semibold">{phase.name}</div><div className="text-[var(--page-text)]/60 text-xs">{phase.focus}</div></div>
              <div className="text-right"><div className="text-[var(--page-text)] font-mono font-bold text-sm">{phase.weeks}w</div><div className="text-[var(--page-text)]/60 text-[10px]">{Math.round((phase.weeks / totalWeeks) * 100)}% of program</div></div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-[var(--card-bg)] border-[var(--card-border)] p-5">
        <h4 className="text-[var(--page-text)] text-sm font-bold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#00AEEF]" />Summary Statistics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[{ l: 'Total Weeks', v: totalWeeks, c: 'text-[var(--page-text)]' }, { l: 'Training Days', v: `${activeDays}/wk`, c: 'text-[var(--page-text)]' }, { l: 'Total Sets', v: `${totalSets * activeDays}/wk`, c: 'text-[#00AEEF]' }, { l: 'Avg Rest', v: `${avgRest}s`, c: 'text-[#F59E0B]' }, { l: 'Est. Duration', v: `~${Math.round(totalWeeks * activeDays * (data.weeklyHours / activeDays))}h`, c: 'text-[#8B5CF6]' }].map((s) => (
            <div key={s.l} className="bg-[var(--page-bg)] rounded-lg p-3 border border-[var(--card-border)]">
              <div className="text-[var(--page-text)]/60 text-[10px]">{s.l}</div>
              <div className={cn('font-mono font-bold text-lg', s.c)}>{s.v}</div>
            </div>
          ))}
        </div>
      </Card>

      <Button variant="outline" size="sm" className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs"><Sparkles className="w-3.5 h-3.5 mr-1" />Recommend Adjustments</Button>
    </div>
  );
}

function Step8Save({ data, updateData, onSave, clients, saving, dbMethods = [] }: StepProps) {
  const [showDetails, setShowDetails] = useState(true);
  const toggleTag = useCallback((tag: string) => updateData((prev) => { const next = prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag]; return { tags: next }; }), [updateData]);
  const selectedClient = clients?.find((c) => c.id === data.assignedClient);

  const totalWeeks = useMemo(() => data.phases.filter((p) => p.active).reduce((s, p) => s + p.weeks, 0), [data.phases]);
  const activeDays = useMemo(() => data.split.filter((d) => d.active).length, [data.split]);
  const totalExercises = data.workoutExercises
    ? Object.values(data.workoutExercises).flat().length
    : data.exercises.length;
  const substitutionCount = useMemo(() => {
    const lists = data.workoutExercises ? Object.values(data.workoutExercises) : [data.exercises];
    return lists.flat().filter((e) => e.isSubstituted).length;
  }, [data.workoutExercises, data.exercises]);
  const goalName = GOALS.find((g) => g.id === data.goal)?.name || '—';
  const methodName = resolveMethodName(data.method, dbMethods);
  const clientName = selectedClient?.full_name || data.clientContext.experience || 'Unassigned';
  const activePhases = data.phases.filter((p) => p.active);
  const splitSummary = data.split
    .map((d) => `${d.day} ${d.active ? (d.workout.split('—')[0].trim() || 'Workout') : 'Rest'}`)
    .join(' • ');

  return (
    <div className="space-y-5">
      {/* Final Review */}
      <div>
        <h3 className="text-[var(--page-text)] text-base font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#00AEEF]" />Final Review</h3>

        {/* Program Details collapsible */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden mb-3">
          <button onClick={() => setShowDetails((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-sm font-semibold text-[var(--page-text)]">Program Details</span>
            <ChevronDownLocal open={showDetails} />
          </button>
          {showDetails && (
            <div className="border-t border-[var(--card-border)] px-4 py-2">
              {[
                { k: 'Goal', v: goalName },
                { k: 'Method', v: methodName },
                { k: 'Client', v: clientName },
                { k: 'Duration', v: `${totalWeeks} Weeks` },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between py-2 border-b border-[var(--card-border)]/50 last:border-0">
                  <span className="text-xs text-[var(--page-text)]/60">{r.k}</span>
                  <span className="text-xs font-medium text-[#00AEEF]">{r.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phase Overview */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 mb-3">
          <span className="text-xs text-[var(--page-text)]/60 block mb-1.5">Phase Overview</span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {activePhases.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1.5">
                <span style={{ color: p.color }}>{p.name}</span>
                {i < activePhases.length - 1 && <span className="text-[var(--page-text)]/40">→</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Progression rules (read-only, Phase 30D) */}
        {data.progressionRules.length > 0 && (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 mb-3">
            <span className="text-xs text-[var(--page-text)]/60 block mb-1.5">Progression Rules</span>
            <ul className="space-y-1">
              {data.progressionRules.map((r, i) => (
                <li key={i} className="text-xs">
                  <span className="text-[var(--page-text)] font-medium">{r.label}</span>
                  <span className="text-[var(--page-text)]/60"> — {r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weekly Split summary */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 mb-4">
          <span className="text-xs text-[var(--page-text)]/60 block mb-1.5">Weekly Split</span>
          <p className="text-xs text-[var(--page-text)]/80 leading-relaxed">{splitSummary}</p>
        </div>

        {substitutionCount > 0 && (
          <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2.5 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <span className="text-xs font-medium text-[#F59E0B]">
              {substitutionCount} safety substitution{substitutionCount > 1 ? 's' : ''} — exercises swapped to respect client limitations
            </span>
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { v: totalExercises, l: 'Exercises' },
            { v: activeDays, l: 'Days/Week' },
            { v: totalWeeks, l: 'Weeks Total' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)] p-3 text-center">
              <div className="text-xl font-bold font-mono text-[#00AEEF]">{s.v}</div>
              <div className="text-[10px] text-[var(--page-text)]/60 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Editable fields (kept) */}
      <div>
        <label className="text-[var(--page-text)] text-sm font-semibold mb-1.5 block">Program Name</label>
        <Input value={data.programName} onChange={(e) => updateData({ programName: e.target.value })} placeholder="e.g., 12-Week Hypertrophy Block" className="bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)]" />
      </div>
      <div>
        <label className="text-[var(--page-text)] text-sm font-semibold mb-1.5 block">Description</label>
        <Textarea value={data.description} onChange={(e) => updateData({ description: e.target.value })} placeholder="Describe the program goals, target audience, and expected outcomes..." className="bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)] min-h-[80px]" />
      </div>
      <div>
        <label className="text-[var(--page-text)] text-sm font-semibold mb-2 block">Tags</label>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => { const isSelected = data.tags.includes(tag); return (
            <button key={tag} onClick={() => toggleTag(tag)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all', isSelected ? 'bg-[#00AEEF]/10 border-[#00AEEF] text-[#00AEEF]' : 'bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)]/60 hover:border-[var(--azfit-primary)]/50')}>
              {isSelected && <Check className="w-3 h-3 inline mr-1" />}{tag}
            </button>
          ); })}
        </div>
      </div>
      <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] cursor-pointer hover:border-[var(--azfit-primary)]/50 transition-colors">
        <input type="checkbox" checked={data.isPublic} onChange={(e) => updateData({ isPublic: e.target.checked })} className="w-5 h-5 rounded accent-[#00AEEF]" />
        <div><span className="text-[var(--page-text)] text-sm font-medium">Make public template</span><p className="text-[var(--page-text)]/60 text-xs">Other trainers can view and use this program</p></div>
      </label>
      <div>
        <label className="text-[var(--page-text)] text-sm font-semibold mb-1.5 block">Assign to Client</label>
        <select value={data.assignedClient} onChange={(e) => {
          const clientId = e.target.value;
          const client = clients?.find((c) => c.id === clientId);
          const ctx = client
            ? clientContextFromClientFields({
                date_of_birth: client.date_of_birth,
                experience_level: client.experience_level,
              })
            : {};
          updateData((prev) => ({ assignedClient: clientId, clientContext: { ...prev.clientContext, ...ctx } }));
        }} className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00AEEF]">
          <option value="">— Unassigned —</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>)}
        </select>
        {selectedClient && (
          <p className="text-[var(--page-text)]/60 text-xs mt-2">Selected client: <span className="text-[var(--page-text)] font-medium">{selectedClient.full_name}</span></p>
        )}
      </div>

      {/* Secondary draft save (Save & Assign is the wizard's primary action) */}
      <div className="pt-2">
        <Button variant="outline" onClick={onSave} disabled={saving} className="border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] font-semibold disabled:opacity-50"><Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save Program (draft)'}</Button>
      </div>
    </div>
  );
}

function ChevronDownLocal({ open }: { open: boolean }) {
  return (
    <svg className={cn('w-4 h-4 text-[var(--page-text)]/60 transition-transform', open ? 'rotate-180' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
  );
}

export default function AIProgramBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<ProgramData>(defaultData);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [savedList, setSavedList] = useState<SavedProgram[]>([]);
  const [saveFlash, setSaveFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [buildForClient, setBuildForClient] = useState('');
  const [legacySaved, setLegacySaved] = useState<LegacySavedProgram[]>(() => {
    try {
      const raw = localStorage.getItem(PROGRAMS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LegacySavedProgram[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore malformed localStorage
    }
    return [];
  });

  const updateData = useCallback((partial: Partial<ProgramData> | ((prev: ProgramData) => Partial<ProgramData>)) => setData((prev) => ({ ...prev, ...(typeof partial === 'function' ? partial(prev) : partial) })), []);
  const selectedClient = useMemo(() => clients.find((c) => c.id === data.assignedClient), [clients, data.assignedClient]);
  const selectedClientName = selectedClient?.full_name || 'Unassigned';
  const buildForClientRow = useMemo(() => clients.find((c) => c.id === buildForClient), [clients, buildForClient]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data: rows, error } = await supabase
        .from('clients')
        .select('id, full_name, email, date_of_birth, experience_level, fitness_goal, intake_profile')
        .eq('trainer_id', user.id)
        .neq('status', 'archived')
        .order('full_name', { ascending: true });
      if (!cancelled && !error && rows) setClients(rows as unknown as ClientRow[]);
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    loadSavedPrograms(user.id).then(setSavedList).catch((err) => console.error('Failed to load saved programs:', err));
  }, [user]);

  // Phase 30A — live method catalog + goals for the Step 2 browser
  const [dbMethods, setDbMethods] = useState<DbMethod[]>([]);
  const [methodCategories, setMethodCategories] = useState<DbMethodCategory[]>([]);
  const [dbGoals, setDbGoals] = useState<{ id: string; name: string }[]>([]);
  const [goalScores, setGoalScores] = useState<{ method_id: string; score: number }[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMethodsLoading(true);
      setMethodsError(null);
      const [mRes, cRes, gRes] = await Promise.all([
        supabase.from('methods').select('id, name, slug, category, category_id, description, tags, display_order').eq('is_active', true).order('display_order'),
        supabase.from('method_categories').select('id, name, display_order').order('display_order'),
        supabase.from('goals').select('id, name'),
      ]);
      if (cancelled) return;
      if (mRes.error) setMethodsError(mRes.error.message);
      else setDbMethods((mRes.data as DbMethod[] | null) ?? []);
      if (!cRes.error) setMethodCategories((cRes.data as DbMethodCategory[] | null) ?? []);
      if (!gRes.error) setDbGoals((gRes.data as { id: string; name: string }[] | null) ?? []);
      setMethodsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Rank the catalog by the selected goal's pre-computed scores (Phase 30A).
  // Graceful degradation: any failure leaves an empty list → unranked alphabetical.
  const selectedGoal = data.goal;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const names = WIZARD_GOAL_TO_DB[selectedGoal] ?? [];
      const ids = dbGoals.filter((g) => names.includes(g.name)).map((g) => g.id);
      if (ids.length === 0) {
        if (!cancelled) setGoalScores([]);
        return;
      }
      const { data: rows, error } = await supabase.from('goal_method_scores').select('method_id, score').in('goal_id', ids);
      if (cancelled) return;
      setGoalScores(error ? [] : ((rows as { method_id: string; score: number }[] | null) ?? []));
    })();
    return () => { cancelled = true; };
  }, [selectedGoal, dbGoals]);

  // Pre-select a client when arriving via /ai-program-builder?clientId=…
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get('clientId');
  useEffect(() => {
    if (!presetClientId) return;
    let cancelled = false;
    (async () => {
      const client = clients.find((c) => c.id === presetClientId);
      if (!client || cancelled) return;
      setBuildForClient(presetClientId);
      updateData((prev) =>
        prev.assignedClient
          ? {}
          : {
              assignedClient: presetClientId,
              clientContext: {
                ...prev.clientContext,
                ...clientContextFromClientFields({
                  date_of_birth: client.date_of_birth,
                  experience_level: client.experience_level,
                }),
              },
            }
      );
    })();
    return () => { cancelled = true; };
  }, [presetClientId, clients, updateData]);

  const generationProfile = useMemo<ClientProfile>(() => {
    if (buildForClientRow) return profileFromClient(buildForClientRow);
    return loadClientProfile() || DEFAULT_PROFILE;
  }, [buildForClientRow]);

  // Phase 28D — merged wizard + intake limitations for the Step 6 safety engine
  const clientContext = data.clientContext;
  const wizardLimitations = useMemo(
    () => collectClientLimitations({ clientContext }, generationProfile),
    [clientContext, generationProfile]
  );

  const handleAutoGenerate = useCallback(() => {
    setGenerating(true);
    const p = generationProfile;
    const selectedMethod = data.method; // 30A selection — mapGeneratedToProgramData overwrites it
    setTimeout(() => {
      const generated = generateProgram(p);
      setProgram(generated);
      const mapped = mapGeneratedToProgramData(generated, p);
      // Phase 30C: method-aware superset pairing, applied at the wizard layer
      const style = pairingStyleForMethod(selectedMethod);
      if (style) {
        setData({
          ...mapped,
          exercises: assignPairGroups(mapped.exercises, style),
          ...(mapped.workoutExercises
            ? {
                workoutExercises: Object.fromEntries(
                  Object.entries(mapped.workoutExercises).map(([day, list]) => [day, assignPairGroups(list, style)])
                ),
              }
            : {}),
        });
        toast.success(`Supersets configured for ${resolveMethodName(selectedMethod, dbMethods)}`);
      } else {
        setData(mapped);
      }
      setGenerating(false);
      setCurrentStep(6);
      setMaxStep((s) => Math.max(s, 6));
      saveGeneratedProgram(generated);
    }, 1500);
  }, [generationProfile, data.method, dbMethods]);

  const handleReset = useCallback(() => { setData(defaultData); setProgram(null); setCurrentStep(0); setMaxStep(0); }, []);
  const handleSave = useCallback(async () => {
    if (!user?.id || saving) return;
    const assignedClientId = data.assignedClient || null;
    setSaving(true);
    try {
      const saved = await saveProgramToSupabase(data, user.id, assignedClientId);
      if (saved) {
        setData(saved);
        setSavedList(await loadSavedPrograms(user.id));
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 1200);
        toast.success(assignedClientId ? 'Program assigned to client' : 'Program saved as draft');
      } else {
        toast.error('Failed to save program');
      }
    } catch (err) {
      console.error('Save program failed:', err);
      toast.error('Failed to save program');
    } finally {
      setSaving(false);
    }
  }, [data, user, saving]);
  const handleSaveAndAssign = useCallback(async () => {
    if (!user?.id || saving) return;
    const assignedClientId = data.assignedClient || null;
    if (!assignedClientId) {
      toast.error('Please select a client before assigning');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveProgramToSupabase(data, user.id, assignedClientId);
      if (saved) {
        setData(saved);
        setSavedList(await loadSavedPrograms(user.id));
        toast.success('Program assigned to client');
        navigate('/dashboard');
      } else {
        toast.error('Failed to assign program');
      }
    } catch (err) {
      console.error('Assign program failed:', err);
      toast.error('Failed to assign program');
    } finally {
      setSaving(false);
    }
  }, [data, user, navigate, saving]);
  const handleImportLegacy = useCallback(async () => {
    if (!user?.id || legacySaved.length === 0) return;
    let imported = 0;
    let failed = 0;
    for (const p of legacySaved) {
      try {
        await saveProgramToSupabase(p.data, user.id, p.data.assignedClient || null);
        imported++;
      } catch {
        failed++;
      }
    }
    localStorage.removeItem(PROGRAMS_STORAGE_KEY);
    setLegacySaved([]);
    setSavedList(await loadSavedPrograms(user.id));
    toast.success(`Imported ${imported} of ${legacySaved.length} legacy programs${failed > 0 ? ` (${failed} failed)` : ''}`);
  }, [legacySaved, user]);
  const dismissLegacy = useCallback(() => { localStorage.removeItem(PROGRAMS_STORAGE_KEY); setLegacySaved([]); }, []);
  const loadSavedProgram = useCallback((saved: SavedProgram) => { setData(saved.data); setCurrentStep(6); setMaxStep((s) => Math.max(s, 6)); }, []);

  // Open a specific program in the editor via /ai-program-builder?load=<id>
  const loadId = searchParams.get('load');
  const loadHandled = useRef(false);
  useEffect(() => {
    if (!loadId || !user?.id || loadHandled.current) return;
    let cancelled = false;
    (async () => {
      const list = await loadSavedPrograms(user.id);
      if (cancelled) return;
      const found = list.find((p) => p.id === loadId);
      if (found) {
        loadSavedProgram(found);
      } else {
        toast.error('Program not found — starting a new wizard');
      }
      loadHandled.current = true;
    })();
    return () => { cancelled = true; };
  }, [loadId, user, loadSavedProgram]);

  // Open a library template via /ai-program-builder?template=<id> (Phase 28F).
  // Templates carry no exercise content — prefill name/description/tags and
  // best-effort goal/method from the pre-computed score tables; the trainer
  // then generates/edits/assigns via the existing flow.
  const templateId = searchParams.get('template');
  const templateHandled = useRef(false);
  useEffect(() => {
    if (!templateId || templateHandled.current) return;
    let cancelled = false;
    (async () => {
      const { data: tpl } = await supabase
        .from('program_templates')
        .select('id, name, tags')
        .eq('id', templateId)
        .maybeSingle();
      if (cancelled) return;
      if (!tpl) {
        toast.error('Template not found — starting a new wizard');
        templateHandled.current = true;
        return;
      }
      const [{ data: gs }, { data: ms }] = await Promise.all([
        supabase
          .from('goal_program_template_scores')
          .select('score, goals(name)')
          .eq('program_template_id', templateId)
          .order('score', { ascending: false })
          .limit(3),
        supabase
          .from('method_program_template_scores')
          .select('score, methods(name)')
          .eq('program_template_id', templateId)
          .order('score', { ascending: false })
          .limit(3),
      ]);
      if (cancelled) return;
      const toScored = (rows: unknown): { name: string; score: number }[] =>
        ((rows as { score: number; methods?: { name: string } | null; goals?: { name: string } | null }[] | null) ?? [])
          .map((r) => ({ name: r.methods?.name ?? r.goals?.name ?? '', score: r.score }))
          .filter((r) => r.name);
      // Best-effort preselect: first scored name with a clean mapping wins;
      // when nothing maps, wizard defaults stay (mapping documented in
      // src/lib/programTemplates.ts).
      const goalId = bestMappedId(toScored(gs), TEMPLATE_GOAL_MAP);
      const methodId = bestMappedId(toScored(ms), TEMPLATE_METHOD_MAP);
      const rawTags = parseTemplateTags(tpl.tags);
      const labels = templateTagLabels(tpl.tags);
      updateData({
        programName: tpl.name,
        description: labels.slice(0, 3).join(' · '),
        tags: rawTags.slice(0, 5),
        ...(goalId ? { goal: goalId } : {}),
        ...(methodId ? { method: methodId } : {}),
      });
      toast.success(`Template "${tpl.name}" loaded`);
      templateHandled.current = true;
    })();
    return () => { cancelled = true; };
  }, [templateId, updateData]);

  const stepComplete = useMemo(() => {
    const exerciseCount = data.workoutExercises
      ? Object.values(data.workoutExercises).flat().length
      : data.exercises.length;
    return [!!data.goal, !!data.method, !!(data.clientContext.ageRange && data.clientContext.experience), data.phases.some((p) => p.active), data.split.some((d) => d.active), exerciseCount > 0, !!(data.goal && data.method), !!data.programName];
  }, [data]);
  const completionPercent = useMemo(() => Math.round((stepComplete.filter(Boolean).length / stepComplete.length) * 100), [stepComplete]);

  const CurrentComponent = STEPS[currentStep].component;
  const isFinalStep = currentStep === STEPS.length - 1;
  const generateHint = buildForClientRow ? `Tailored to ${buildForClientRow.full_name}'s intake profile` : 'Generic template';

  const goNext = () => {
    if (isFinalStep) { handleSaveAndAssign(); return; }
    if (!stepComplete[currentStep]) return;
    setCurrentStep((s) => {
      const n = Math.min(STEPS.length - 1, s + 1);
      setMaxStep((m) => Math.max(m, n));
      return n;
    });
  };
  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  return (
    // Dark-mode-only page: the data-theme="dark" wrapper forces the app's
    // dark CSS vars (page/card/border + shadcn tokens) for the whole subtree.
    <div data-theme="dark" className="min-h-screen bg-[var(--page-bg)] text-[var(--page-text)]">
      {/* Header */}
      <div className="border-b border-[var(--card-border)] bg-[var(--card-bg)] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-[var(--page-bg)] transition-colors"><ArrowLeft className="w-5 h-5 text-[var(--page-text)]/60" /></button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#00AEEF] flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
                <h1 className="text-lg sm:text-xl font-bold">All-in-One Program Creator</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleAutoGenerate} disabled={generating} className="bg-[#00AEEF] hover:bg-[#0099D1] text-[#0B1120] text-xs font-bold px-4">
                {generating ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-[#0B1120]/30 border-t-[#0B1120] rounded-full animate-spin" />Generating...</span> : <><Bot className="w-4 h-4 mr-1.5" />Auto-Generate Program</>}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className={`border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] text-xs transition-all disabled:opacity-50 ${saveFlash ? 'border-[#22C55E] text-[#22C55E]' : ''}`}><Save className="w-3.5 h-3.5 mr-1" />{saving ? 'Saving…' : saveFlash ? 'Saved!' : 'Save Program'}</Button>
              {savedList.length > 0 && (
                <select value="" onChange={(e) => { const saved = savedList.find((p) => p.id === e.target.value); if (saved) loadSavedProgram(saved); }} className="h-9 bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-xs rounded-lg px-3 focus:outline-none focus:border-[#00AEEF]">
                  <option value="">Load Saved...</option>
                  {savedList.map((p) => <option key={p.id} value={p.id}>{p.data.programName || 'Untitled'}</option>)}
                </select>
              )}
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-[var(--page-text)]/60 hover:text-[#EF4444] hover:bg-[#EF4444]/10 text-xs"><RotateCcw className="w-3.5 h-3.5 mr-1" />Reset</Button>
            </div>
          </div>

          {/* Build for client selector + hint */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Users className="w-4 h-4 text-[#00AEEF]" />
            <span className="text-xs text-[var(--page-text)]/60">Build for client:</span>
            <select value={buildForClient} onChange={(e) => setBuildForClient(e.target.value)} className="bg-[var(--page-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00AEEF]">
              <option value="">Generic template</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <span className="text-[11px] text-[#00AEEF]">{generateHint}</span>
          </div>
        </div>
      </div>

      {/* Legacy import banner */}
      {legacySaved.length > 0 && (
        <div className="border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center" style={{ backgroundColor: 'var(--page-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--card-bg)' }}>
                  <Upload className="h-5 w-5 text-[#00AEEF]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--page-text)]">Import legacy local programs</h3>
                  <p className="text-xs text-[var(--page-text)]/60">{legacySaved.length} saved program(s) found in local storage. Import them to the cloud to keep them.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleImportLegacy} className="bg-[#00AEEF] hover:bg-[#0099D1] text-white text-xs font-semibold"><Upload className="w-3.5 h-3.5 mr-1" />Import to Cloud</Button>
                <Button variant="outline" size="sm" onClick={dismissLegacy} className="border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] text-xs">Dismiss</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar + step dots */}
      <div className="border-b border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold whitespace-nowrap">{STEPS[currentStep].title}</span>
            <div className="flex-1 bg-[var(--page-bg)] rounded-full h-2 border border-[var(--card-border)]"><motion.div initial={{ width: 0 }} animate={{ width: `${completionPercent}%` }} transition={{ duration: 0.4 }} className="h-full rounded-full bg-[#00AEEF]" /></div>
            <span className="text-xs font-mono text-[var(--page-text)]/60">{completionPercent}%</span>
          </div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, idx) => {
              const complete = stepComplete[idx];
              const reached = idx <= maxStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={idx} className="flex items-center">
                  <button
                    onClick={() => reached && setCurrentStep(idx)}
                    disabled={!reached}
                    aria-label={s.title}
                    className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all shrink-0',
                      isCurrent ? 'border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10' :
                      complete ? 'bg-[#00AEEF] border-[#00AEEF] text-[#0B1120]' :
                      'border-[var(--card-border)] text-[var(--page-text)]/40',
                      reached && !isCurrent ? 'cursor-pointer hover:border-[#00AEEF]/60' : 'cursor-default opacity-70')}
                  >
                    {complete && !isCurrent ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </button>
                  {idx < STEPS.length - 1 && <div className="w-3 h-px bg-[var(--card-border)]" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current step */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            <CurrentComponent data={data} updateData={updateData} program={program} onSave={handleSave} onSaveAndAssign={handleSaveAndAssign} clientName={selectedClientName} clients={clients} saving={saving} limitations={wizardLimitations} dbMethods={dbMethods} methodCategories={methodCategories} goalScores={goalScores} methodsLoading={methodsLoading} methodsError={methodsError} />
          </motion.div>
        </AnimatePresence>

        {/* Back / Next */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={goBack} disabled={currentStep === 0} className="border-[var(--card-border)] text-[var(--page-text)] hover:bg-[var(--page-bg)] disabled:opacity-50">
            Back
          </Button>
          {isFinalStep ? (
            <Button onClick={goNext} disabled={saving} className="bg-[#00AEEF] hover:bg-[#0099D1] text-[#0B1120] font-bold px-6 disabled:opacity-50">
              <Check className="w-4 h-4 mr-1.5" />{saving ? 'Saving…' : 'Save & Assign Program'}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!stepComplete[currentStep]} className="bg-[#00AEEF] hover:bg-[#0099D1] text-[#0B1120] font-bold px-6 disabled:opacity-50">
              Next: {STEPS[currentStep + 1]?.title}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
