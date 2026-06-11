// ═══════════════════════════════════════════════════════════════
// AzFIT AI Program Generator
// Constraint-based program generation from client profile
// ═══════════════════════════════════════════════════════════════

import { EXERCISE_CATEGORIES } from '@/data/exerciseDatabase';
import { type MasterProgram } from '@/data/masterWorkouts';

/* ── Types ─────────────────────────────────────────────── */

export interface ClientProfile {
  trainingFrequency: number; // 2-6
  trainingExperience: string; // beginner | intermediate | advanced
  primaryGoal: string; // lose_fat | build_muscle | strength | recomposition | performance | general_health
  availableEquipment: string[]; // Full Gym, Dumbbells Only, etc.
  preferredStyle: string[]; // Free Weights, Machines, etc.
  injuries?: string;
}

export interface GeneratedProgram {
  id: string;
  name: string;
  description: string;
  category: string;
  level: string;
  totalWeeks: number;
  goal: string;
  frequency: number;
  phases: GeneratedPhase[];
}

export interface GeneratedPhase {
  id: string;
  name: string;
  block: string;
  durationWeeks: number;
  goal: string;
  workouts: GeneratedWorkout[];
}

export interface GeneratedWorkout {
  id: string;
  name: string;
  dayNumber: number;
  focus: string;
  exercises: GeneratedExercise[];
  estimatedMinutes: number;
}

export interface GeneratedExercise {
  order: string;
  name: string;
  category: string;
  sets: number;
  reps: string;
  tempo: string;
  restSeconds: number;
}

/* ── Goal-based parameters ─────────────────────────────── */

interface GoalParams {
  setsMin: number;
  setsMax: number;
  reps: string;
  tempo: string;
  restMin: number;
  restMax: number;
}

const GOAL_PARAMS: Record<string, GoalParams> = {
  lose_fat: { setsMin: 3, setsMax: 4, reps: '10-15', tempo: '3-0-1-0', restMin: 45, restMax: 60 },
  build_muscle: { setsMin: 3, setsMax: 4, reps: '8-12', tempo: '3-0-1-0', restMin: 60, restMax: 90 },
  strength: { setsMin: 4, setsMax: 5, reps: '3-6', tempo: '2-1-X-0', restMin: 120, restMax: 180 },
  recomposition: { setsMin: 3, setsMax: 3, reps: '8-10', tempo: '3-0-1-0', restMin: 60, restMax: 60 },
  performance: { setsMin: 3, setsMax: 4, reps: '5-8', tempo: '2-0-1-0', restMin: 90, restMax: 120 },
  general_health: { setsMin: 2, setsMax: 3, reps: '10-12', tempo: '3-0-1-0', restMin: 45, restMax: 60 },
};

/* ── Split definitions ─────────────────────────────────── */

interface SplitConfig {
  name: string;
  days: { name: string; focus: string; slotCategories: string[] }[];
}

function getSplitConfig(frequency: number): SplitConfig {
  switch (frequency) {
    case 2:
      return {
        name: 'Full Body',
        days: [
          { name: 'Full Body A', focus: 'Compound emphasis', slotCategories: ['pulling', 'unilateral_quad', 'pressing', 'posterior', 'delt_scap', 'biceps', 'bracing', 'metcon_bracing'] },
          { name: 'Full Body B', focus: 'Compound emphasis', slotCategories: ['pulling', 'bilateral_quad', 'pressing', 'posterior', 'delt_scap', 'triceps', 'bracing', 'metcon_bracing'] },
        ],
      };
    case 3:
      return {
        name: 'Full Body',
        days: [
          { name: 'Full Body 1', focus: 'Pull + Legs', slotCategories: ['pulling', 'unilateral_quad', 'pressing', 'posterior', 'delt_scap', 'biceps', 'bracing', 'metcon_bracing'] },
          { name: 'Full Body 2', focus: 'Push + Legs', slotCategories: ['pulling', 'bilateral_quad', 'pressing', 'posterior', 'delt_scap', 'triceps', 'bracing', 'metcon_bracing'] },
          { name: 'Full Body 3', focus: 'Upper + Core', slotCategories: ['pulling', 'pressing', 'delt_scap', 'biceps', 'triceps', 'bracing', 'target_areas', 'metcon_bracing'] },
        ],
      };
    case 4:
      return {
        name: 'Upper/Lower',
        days: [
          { name: 'Upper A', focus: 'Pull emphasis', slotCategories: ['pulling', 'pressing', 'pulling', 'pressing', 'delt_scap', 'biceps', 'triceps', 'bracing'] },
          { name: 'Lower A', focus: 'Quad emphasis', slotCategories: ['bilateral_quad', 'posterior', 'unilateral_quad', 'posterior', 'bilateral_quad', 'bracing', 'target_areas', 'metcon_bracing'] },
          { name: 'Upper B', focus: 'Push emphasis', slotCategories: ['pressing', 'pulling', 'pressing', 'pulling', 'delt_scap', 'triceps', 'biceps', 'bracing'] },
          { name: 'Lower B', focus: 'Hip emphasis', slotCategories: ['posterior', 'bilateral_quad', 'posterior', 'unilateral_quad', 'posterior', 'bracing', 'target_areas', 'metcon_bracing'] },
        ],
      };
    case 5:
      return {
        name: 'Push/Pull/Legs + Upper/Lower',
        days: [
          { name: 'Push', focus: 'Chest/Shoulders/Triceps', slotCategories: ['pressing', 'pressing', 'delt_scap', 'delt_scap', 'triceps', 'triceps', 'bracing', 'metcon_bracing'] },
          { name: 'Pull', focus: 'Back/Biceps', slotCategories: ['pulling', 'pulling', 'pulling', 'biceps', 'biceps', 'target_areas', 'bracing', 'metcon_bracing'] },
          { name: 'Legs', focus: 'Quads/Hams/Glutes', slotCategories: ['bilateral_quad', 'posterior', 'unilateral_quad', 'posterior', 'bilateral_quad', 'bracing', 'target_areas', 'metcon_bracing'] },
          { name: 'Upper', focus: 'Full upper', slotCategories: ['pulling', 'pressing', 'pulling', 'pressing', 'delt_scap', 'biceps', 'triceps', 'bracing'] },
          { name: 'Lower + Core', focus: 'Posterior chain', slotCategories: ['posterior', 'bilateral_quad', 'unilateral_quad', 'posterior', 'bracing', 'bracing', 'target_areas', 'metcon_bracing'] },
        ],
      };
    case 6:
      return {
        name: 'Push/Pull/Legs',
        days: [
          { name: 'Push A', focus: 'Chest/Shoulders/Triceps', slotCategories: ['pressing', 'pressing', 'delt_scap', 'delt_scap', 'triceps', 'triceps', 'bracing', 'metcon_bracing'] },
          { name: 'Pull A', focus: 'Back/Biceps', slotCategories: ['pulling', 'pulling', 'pulling', 'biceps', 'biceps', 'target_areas', 'bracing', 'metcon_bracing'] },
          { name: 'Legs A', focus: 'Quads emphasis', slotCategories: ['bilateral_quad', 'unilateral_quad', 'posterior', 'bilateral_quad', 'posterior', 'bracing', 'target_areas', 'metcon_bracing'] },
          { name: 'Push B', focus: 'Incline/Shoulders', slotCategories: ['pressing', 'pressing', 'delt_scap', 'delt_scap', 'triceps', 'triceps', 'bracing', 'metcon_bracing'] },
          { name: 'Pull B', focus: 'Lats/Rear delts', slotCategories: ['pulling', 'pulling', 'pulling', 'biceps', 'biceps', 'target_areas', 'bracing', 'metcon_bracing'] },
          { name: 'Legs B', focus: 'Hips/Hams', slotCategories: ['posterior', 'bilateral_quad', 'unilateral_quad', 'posterior', 'posterior', 'bracing', 'target_areas', 'metcon_bracing'] },
        ],
      };
    default:
      return getSplitConfig(3);
  }
}

/* ── Exercise filtering ────────────────────────────────── */

function filterExercisesByEquipment(exercises: string[], equipment: string[]): string[] {
  if (equipment.includes('Full Gym')) return exercises;
  if (equipment.includes('Bodyweight Only')) {
    return exercises.filter((e) =>
      /push up|pull up|chin up|dip|plank|leg raise|crunch|airplane|sprint|walk|crawl|hold/i.test(e)
    );
  }
  if (equipment.includes('Dumbbells Only')) {
    return exercises.filter((e) =>
      !/machine|smith|barbell|ez bar|football bar|landmine|sled|prowler|yoke|zercher|band|chain|cable/i.test(e) ||
      /db |dumbbell/i.test(e)
    );
  }
  if (equipment.includes('Home Gym (limited)')) {
    return exercises.filter((e) =>
      !/machine|smith|sled|prowler|yoke|zercher|chain/i.test(e)
    );
  }
  return exercises;
}

function filterByInjuries(exercises: string[], injuries?: string): string[] {
  if (!injuries) return exercises;
  const lower = injuries.toLowerCase();
  const excludePatterns: string[] = [];
  if (lower.includes('shoulder') || lower.includes('rotator')) {
    excludePatterns.push('overhead press', 'military press', 'shoulder press', 'landmine press');
  }
  if (lower.includes('knee') || lower.includes('acl') || lower.includes('meniscus')) {
    excludePatterns.push('squat', 'lunge', 'split squat', 'leg press', 'step up');
  }
  if (lower.includes('back') || lower.includes('spine') || lower.includes('disc')) {
    excludePatterns.push('deadlift', 'good morning', 'romanian deadlift', 'rdl', 'back extension');
  }
  if (lower.includes('wrist') || lower.includes('elbow')) {
    excludePatterns.push('bench press', 'curl', 'extension', 'skull');
  }
  if (excludePatterns.length === 0) return exercises;
  return exercises.filter((e) => !excludePatterns.some((p) => e.toLowerCase().includes(p)));
}

function filterByExperience(exercises: string[], experience: string): string[] {
  if (experience === 'advanced') return exercises;
  if (experience === 'beginner') {
    // Prefer simpler, machine-based or basic compound movements
    const beginnerFriendly = exercises.filter((e) =>
      /machine|smith|chest press|leg press|lat pulldown|seated row|leg curl|leg extension|calf raise|plank/i.test(e)
    );
    return beginnerFriendly.length >= 4 ? beginnerFriendly : exercises;
  }
  // intermediate — allow everything but deprioritize extreme variations
  return exercises.filter((e) => !/chain|band|fat grip|from pins|lockout|board|slingshot/i.test(e));
}

/* ── Exercise pool builder ─────────────────────────────── */

function buildExercisePool(profile: ClientProfile): Record<string, string[]> {
  const pool: Record<string, string[]> = {};
  EXERCISE_CATEGORIES.forEach((cat) => {
    let exercises = [...cat.exercises, ...cat.alternatives];
    exercises = filterExercisesByEquipment(exercises, profile.availableEquipment);
    exercises = filterByInjuries(exercises, profile.injuries);
    exercises = filterByExperience(exercises, profile.trainingExperience);
    pool[cat.id] = exercises;
  });
  return pool;
}

/* ── Program generation ────────────────────────────────── */

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickExercise(pool: Record<string, string[]>, category: string, used: Set<string>): string | null {
  const candidates = pool[category] || [];
  const available = candidates.filter((e) => !used.has(e));
  if (available.length === 0) {
    // Fallback: any exercise from same category even if used
    if (candidates.length > 0) {
      const shuffled = shuffleArray(candidates);
      return shuffled[0];
    }
    return null;
  }
  const shuffled = shuffleArray(available);
  return shuffled[0];
}

function getOrderPrefix(index: number): string {
  const prefixes = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3', 'D'];
  return prefixes[index] || `E${index - 7}`;
}

function getCategoryDisplayName(categoryId: string): string {
  const cat = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
  return cat?.label || categoryId;
}

export function generateProgram(profile: ClientProfile): GeneratedProgram {
  const split = getSplitConfig(profile.trainingFrequency);
  const goalParams = GOAL_PARAMS[profile.primaryGoal] || GOAL_PARAMS.general_health;
  const pool = buildExercisePool(profile);
  const usedExercises = new Set<string>();

  const workouts: GeneratedWorkout[] = split.days.map((day, dayIndex) => {
    const exercises: GeneratedExercise[] = [];

    for (let i = 0; i < day.slotCategories.length; i++) {
      const category = day.slotCategories[i];
      const name = pickExercise(pool, category, usedExercises);
      if (!name) continue;

      usedExercises.add(name);

      const sets = Math.floor(Math.random() * (goalParams.setsMax - goalParams.setsMin + 1)) + goalParams.setsMin;
      const rest = Math.floor(Math.random() * (goalParams.restMax - goalParams.restMin + 1)) + goalParams.restMin;

      exercises.push({
        order: getOrderPrefix(i),
        name,
        category: getCategoryDisplayName(category),
        sets,
        reps: goalParams.reps,
        tempo: goalParams.tempo,
        restSeconds: rest,
      });
    }

    const exerciseCount = exercises.length;
    const estimatedMinutes = Math.round(exerciseCount * 4.5 + (exercises.reduce((s, e) => s + e.restSeconds, 0) / 60));

    return {
      id: `gen-day-${dayIndex + 1}`,
      name: day.name,
      dayNumber: dayIndex + 1,
      focus: day.focus,
      exercises,
      estimatedMinutes,
    };
  });

  const phase: GeneratedPhase = {
    id: 'gen-phase-1',
    name: 'Phase 1: Adaptation',
    block: 'Block 1',
    durationWeeks: 4,
    goal: getGoalDescription(profile.primaryGoal),
    workouts,
  };

  return {
    id: `gen-${crypto.randomUUID()}`,
    name: `${split.name} — ${GOAL_OPTIONS.find((g) => g.value === profile.primaryGoal)?.label || 'Custom'}`,
    description: `${profile.trainingFrequency}-day ${split.name.toLowerCase()} split optimized for ${profile.primaryGoal.replace('_', ' ')}. Generated for ${profile.trainingExperience} level with ${profile.availableEquipment.join(', ')}.`,
    category: 'AI Generated',
    level: profile.trainingExperience,
    totalWeeks: 4,
    goal: profile.primaryGoal,
    frequency: profile.trainingFrequency,
    phases: [phase],
  };
}

function getGoalDescription(goal: string): string {
  const map: Record<string, string> = {
    lose_fat: 'Maximize caloric expenditure while preserving lean mass through higher rep ranges and shorter rest periods',
    build_muscle: 'Optimize mechanical tension and metabolic stress for hypertrophy with moderate rep ranges',
    strength: 'Prioritize neural adaptations and peak force production with lower reps and longer rest',
    recomposition: 'Balance stimulus for muscle retention with sufficient volume for fat loss',
    performance: 'Develop power, speed, and work capacity with explosive movements and sport-specific conditioning',
    general_health: 'Build foundational fitness with manageable volume and sustainable progression',
  };
  return map[goal] || 'Balanced fitness development';
}

const GOAL_OPTIONS = [
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'strength', label: 'Strength' },
  { value: 'recomposition', label: 'Recomposition' },
  { value: 'performance', label: 'Athletic Performance' },
  { value: 'general_health', label: 'General Health' },
];

/* ── Convert to MasterProgram format ───────────────────── */

export function generatedToMasterProgram(gen: GeneratedProgram): MasterProgram {
  return {
    id: gen.id,
    name: gen.name,
    description: gen.description,
    category: 'Custom',
    level: gen.level as 'Beginner' | 'Intermediate' | 'Advanced',
    totalWeeks: gen.totalWeeks,
    phases: gen.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      block: phase.block,
      durationWeeks: phase.durationWeeks,
      goal: phase.goal,
      workouts: phase.workouts.map((w) => ({
        id: w.id,
        name: w.name,
        exercises: w.exercises.map((ex) => ({
          order: ex.order,
          name: ex.name,
          category: ex.category,
          reps: ex.reps,
          sets: ex.sets,
          tempo: ex.tempo,
          tut: 0,
          restSeconds: ex.restSeconds,
        })),
      })),
    })),
  };
}

/* ── Similarity scoring for exercise replacement ───────── */

export interface ScoredExercise {
  name: string;
  category: string;
  similarityScore: number;
  reason: string;
}

export function getSimilarExercises(
  targetName: string,
  targetCategory: string,
  usedExercises: Set<string>,
  allExercises: string[] = getAllExercisesFlat()
): ScoredExercise[] {
  const targetCatId = findCategoryId(targetName) || targetCategory.toLowerCase().replace(/\s+/g, '_');

  return allExercises
    .filter((e) => e !== targetName && !usedExercises.has(e))
    .map((e) => {
      let score = 0;
      const reasons: string[] = [];
      const catId = findCategoryId(e);

      if (catId === targetCatId) {
        score += 40;
        reasons.push('Same category');
      }

      const targetWords = targetName.toLowerCase().split(/\s+/);
      const candidateWords = e.toLowerCase().split(/\s+/);
      const shared = targetWords.filter((w) => candidateWords.includes(w));
      if (shared.length > 0) {
        score += shared.length * 15;
        reasons.push('Shared keywords');
      }

      // Equipment similarity
      const targetEquip = inferEquipment(targetName);
      const candidateEquip = inferEquipment(e);
      if (targetEquip === candidateEquip) {
        score += 20;
        reasons.push('Same equipment');
      }

      // Movement pattern similarity
      if (targetWords.some((w) => ['press', 'bench', 'incline', 'decline', 'floor', 'military'].includes(w)) &&
          candidateWords.some((w) => ['press', 'bench', 'incline', 'decline', 'floor', 'military'].includes(w))) {
        score += 10;
        reasons.push('Same movement');
      }
      if (targetWords.some((w) => ['pull', 'chin', 'row', 'pulldown', 'lat'].includes(w)) &&
          candidateWords.some((w) => ['pull', 'chin', 'row', 'pulldown', 'lat'].includes(w))) {
        score += 10;
        reasons.push('Same movement');
      }
      if (targetWords.some((w) => ['squat', 'lunge', 'split', 'leg press', 'step'].includes(w)) &&
          candidateWords.some((w) => ['squat', 'lunge', 'split', 'leg press', 'step'].includes(w))) {
        score += 10;
        reasons.push('Same movement');
      }

      return {
        name: e,
        category: getCategoryDisplayName(catId || ''),
        similarityScore: Math.min(score, 100),
        reason: reasons[0] || 'Alternative exercise',
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 8);
}

function findCategoryId(exerciseName: string): string | null {
  for (const cat of EXERCISE_CATEGORIES) {
    if (cat.exercises.includes(exerciseName) || cat.alternatives.includes(exerciseName)) {
      return cat.id;
    }
  }
  return null;
}

function inferEquipment(exerciseName: string): string {
  const lower = exerciseName.toLowerCase();
  if (lower.includes('machine')) return 'machine';
  if (lower.includes('db ') || lower.includes('dumbbell')) return 'dumbbell';
  if (lower.includes('bb ') || lower.includes('barbell')) return 'barbell';
  if (lower.includes('cable')) return 'cable';
  if (lower.includes('smith')) return 'smith';
  if (lower.includes('bodyweight') || lower.includes('push up') || lower.includes('pull up') || lower.includes('chin up')) return 'bodyweight';
  return 'other';
}

function getAllExercisesFlat(): string[] {
  const all = new Set<string>();
  EXERCISE_CATEGORIES.forEach((cat) => {
    cat.exercises.forEach((e) => all.add(e));
    cat.alternatives.forEach((e) => all.add(e));
  });
  return Array.from(all).sort();
}

/* ── Save generated program ────────────────────────────── */

export function saveGeneratedProgram(program: GeneratedProgram): void {
  const key = 'azfit_generated_programs';
  const existing = JSON.parse(localStorage.getItem(key) || '[]') as GeneratedProgram[];
  existing.push(program);
  localStorage.setItem(key, JSON.stringify(existing));
}

export function getGeneratedPrograms(): GeneratedProgram[] {
  const key = 'azfit_generated_programs';
  return JSON.parse(localStorage.getItem(key) || '[]') as GeneratedProgram[];
}
