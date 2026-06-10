// ═══════════════════════════════════════════════════════════════
// AzFIT Master Workout Programs — Parsed from Excel
// GBC (German Body Composition) Protocol
// ═══════════════════════════════════════════════════════════════

export interface MasterExercise {
  order: string;           // A1, A2, B1, B2, C1, C2, C3, D
  name: string;
  category: string;        // PRESSING, PULLING, BILATERAL_QUAD, etc.
  reps: string;            // "10" or "10-12"
  sets: number;
  tempo: string;           // "3-2-1-2" or "3-0-1-2"
  tut: number;             // Time Under Tension (seconds)
  restSeconds: number;
  link?: string;           // Tutorial video link
}

export interface MasterWorkout {
  id: string;
  name: string;            // "FULL BODY 1", "UPPER FOCUS", etc.
  exercises: MasterExercise[];
}

export interface MasterPhase {
  id: string;
  name: string;            // "Phase 1: GBC Accumulation", "Phase 2: GBC Intensification"
  block: string;           // "Block 1" or "Block 2"
  durationWeeks: number;
  goal: string;
  workouts: MasterWorkout[];
}

export interface MasterProgram {
  id: string;
  name: string;
  description: string;
  category: 'GBC' | 'Strength' | 'Hypertrophy' | 'Custom';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  totalWeeks: number;
  phases: MasterPhase[];
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1: GBC ACCUMULATION (Weeks 1-4)
// Higher reps, moderate load, metabolic stress focus
// ═══════════════════════════════════════════════════════════════

export const phase1Accumulation: MasterPhase = {
  id: 'gbc-phase-1',
  name: 'Phase 1: GBC Accumulation',
  block: 'Block 1',
  durationWeeks: 4,
  goal: 'Build work capacity, improve mind-muscle connection, establish baseline loads',
  workouts: [
    {
      id: 'p1-w1-fullbody-1',
      name: 'FULL BODY 1',
      exercises: [
        {
          order: 'A1',
          name: 'Chin up - Semi supinated',
          category: 'PULLING',
          reps: '10',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 60,
          restSeconds: 45,
          link: 'Chin up tutorial',
        },
        {
          order: 'A2',
          name: 'DB Split Squat',
          category: 'UNILATERAL_QUAD',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'B1',
          name: '15° DB Incline Press',
          category: 'PRESSING',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
          link: 'Flat Dumbbell Bench Press tutorial',
        },
        {
          order: 'B2',
          name: 'Seated Leg Curl',
          category: 'POSTERIOR',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'C1',
          name: 'DB Lateral Raise - Seated',
          category: 'DELT_SCAP_CONTROL',
          reps: '10-15',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 90,
          restSeconds: 45,
        },
        {
          order: 'C2',
          name: '80° DB Incline Curl',
          category: 'BICEPS',
          reps: '10-15',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 90,
          restSeconds: 45,
          link: 'Incline DB curl tutorial',
        },
        {
          order: 'C3',
          name: 'Front Plank',
          category: 'BRACING',
          reps: '10-6',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 36,
          restSeconds: 45,
          link: 'Front Plank Tutorial',
        },
      ],
    },
    {
      id: 'p1-w1-fullbody-2',
      name: 'FULL BODY 2',
      exercises: [
        {
          order: 'A1',
          name: '80° DB Incline Press',
          category: 'PRESSING',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
          link: 'DB shoulder press tutorial',
        },
        {
          order: 'A2',
          name: '40° Incline Hyper',
          category: 'POSTERIOR',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
          link: 'Incline Hyper tutorial',
        },
        {
          order: 'B1',
          name: 'Seated Cable Row - Neutral Grip',
          category: 'PULLING',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'B2',
          name: 'Goblet Squat',
          category: 'BILATERAL_QUAD',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'C1',
          name: 'DB Step Up',
          category: 'UNILATERAL_QUAD',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'C2',
          name: 'Dual Rope Tricep Extension - Kneeling',
          category: 'TRICEPS',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
          link: 'Rope Tricep Extension tutorial',
        },
        {
          order: 'C3',
          name: 'Face Pull',
          category: 'DELT_SCAP_CONTROL',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
          link: 'Face Pull Tutorial',
        },
      ],
    },
    {
      id: 'p1-w1-upper-focus',
      name: 'UPPER FOCUS',
      exercises: [
        {
          order: 'A1',
          name: '60° DB Incline Curl',
          category: 'BICEPS',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'A2',
          name: 'DB Walking Lunges',
          category: 'UNILATERAL_QUAD',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'B1',
          name: 'Dips',
          category: 'PRESSING',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'B2',
          name: 'BB Deadlift - Conventional',
          category: 'POSTERIOR',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'C1',
          name: 'Face Pull',
          category: 'DELT_SCAP_CONTROL',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'C2',
          name: '80° DB Incline Curl',
          category: 'BICEPS',
          reps: '10-12',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 72,
          restSeconds: 45,
        },
        {
          order: 'C3',
          name: 'Dish hold',
          category: 'BRACING',
          reps: '10-6',
          sets: 2,
          tempo: '3-2-1-2',
          tut: 36,
          restSeconds: 45,
        },
      ],
    },
    {
      id: 'p1-w1-custom-1',
      name: 'CUSTOM SESSION 1',
      exercises: [],
    },
    {
      id: 'p1-w1-custom-2',
      name: 'CUSTOM SESSION 2',
      exercises: [],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// PHASE 2: GBC INTENSIFICATION (Weeks 5-8)
// Lower reps, higher load, mechanical tension focus
// ═══════════════════════════════════════════════════════════════

export const phase2Intensification: MasterPhase = {
  id: 'gbc-phase-2',
  name: 'Phase 2: GBC Intensification',
  block: 'Block 2',
  durationWeeks: 4,
  goal: 'Increase load, reduce reps, focus on mechanical tension and strength',
  workouts: [
    {
      id: 'p2-w5-fullbody-1',
      name: 'FULL BODY 1',
      exercises: [
        {
          order: 'A1',
          name: 'Lat Pulldown - Semi Supinated',
          category: 'PULLING',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
          link: 'Lat Pulldown Tutorial',
        },
        {
          order: 'A2',
          name: 'Machine Hack Squat',
          category: 'BILATERAL_QUAD',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
          link: 'Leverage squat tutorial update',
        },
        {
          order: 'B1',
          name: 'Decline BB Press',
          category: 'PRESSING',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
          link: 'Barbell Bench Press Tutorial',
        },
        {
          order: 'B2',
          name: 'Lying Leg Curl',
          category: 'POSTERIOR',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
          link: 'Prone leg curl tutorial',
        },
        {
          order: 'C1',
          name: 'Cable Lateral raise - Lying',
          category: 'DELT_SCAP_CONTROL',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-2',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C2',
          name: 'DB Preacher Curl',
          category: 'BICEPS',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C3',
          name: 'Farmers Walk',
          category: 'BRACING',
          reps: '60s',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
        },
      ],
    },
    {
      id: 'p2-w5-fullbody-2',
      name: 'FULL BODY 2',
      exercises: [
        {
          order: 'A1',
          name: 'Pull up - Pronated Grip',
          category: 'PULLING',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'A2',
          name: 'BB Back Squat - Paused',
          category: 'BILATERAL_QUAD',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'B1',
          name: 'DB Shoulder Press',
          category: 'PRESSING',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'B2',
          name: 'BB Rack Pull - Knee Height',
          category: 'POSTERIOR',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C1',
          name: 'Face pull with External Rotation',
          category: 'DELT_SCAP_CONTROL',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C2',
          name: '60° DB Incline Curl',
          category: 'BICEPS',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C3',
          name: 'Dish Hold',
          category: 'BRACING',
          reps: '60s',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
        },
      ],
    },
    {
      id: 'p2-w5-upper-focus',
      name: 'UPPER FOCUS',
      exercises: [
        {
          order: 'A1',
          name: 'Chin Up - Supinated',
          category: 'PULLING',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'A2',
          name: 'BB Box Squat',
          category: 'BILATERAL_QUAD',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'B1',
          name: 'Flat BB Bench Press',
          category: 'PRESSING',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'B2',
          name: 'BB Deadlift - Sumo',
          category: 'POSTERIOR',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C1',
          name: 'DB Prone Y Raise',
          category: 'DELT_SCAP_CONTROL',
          reps: '10',
          sets: 3,
          tempo: '3-2-1-0',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C2',
          name: '45° DB Incline Curl',
          category: 'BICEPS',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
        },
        {
          order: 'C3',
          name: 'Band Resisted Deadbug',
          category: 'BRACING',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-2',
          tut: 60,
          restSeconds: 45,
        },
      ],
    },
    {
      id: 'p2-w5-custom-1',
      name: 'CUSTOM SESSION 1',
      exercises: [],
    },
    {
      id: 'p2-w5-custom-2',
      name: 'CUSTOM SESSION 2',
      exercises: [],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// PHASE 3: GBC REALIZATION (Weeks 9-12)
// Heavy compounds, lower reps, explosive concentrics
// 3-4 sets, 6-8 reps, tempo '5-0-X-0', rest 60-90s
// ═══════════════════════════════════════════════════════════════

export const phase3Realization: MasterPhase = {
  id: 'gbc-phase-3',
  name: 'Phase 3: GBC Realization',
  block: 'Block 3',
  durationWeeks: 4,
  goal: 'Maximal strength expression, heavy compound lifts, reduced volume, longer rest',
  workouts: [
    {
      id: 'p3-w9-fullbody-1',
      name: 'FULL BODY 1',
      exercises: [
        {
          order: 'A1',
          name: 'Weighted Pull Up',
          category: 'PULLING',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Pull Up Tutorial',
        },
        {
          order: 'A2',
          name: 'BB Front Squat',
          category: 'BILATERAL_QUAD',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Front Squat Tutorial',
        },
        {
          order: 'B1',
          name: 'BB Bench Press',
          category: 'PRESSING',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Bench Press Tutorial',
        },
        {
          order: 'B2',
          name: 'BB RDL',
          category: 'POSTERIOR',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'RDL Tutorial',
        },
        {
          order: 'C1',
          name: 'Standing BB Press',
          category: 'PRESSING',
          reps: '8',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 32,
          restSeconds: 60,
          link: 'Overhead Press Tutorial',
        },
        {
          order: 'C2',
          name: 'BB Curl',
          category: 'BICEPS',
          reps: '8',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 32,
          restSeconds: 60,
          link: 'Barbell Curl Tutorial',
        },
        {
          order: 'C3',
          name: 'Ab Wheel Rollout',
          category: 'BRACING',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 40,
          restSeconds: 60,
          link: 'Ab Wheel Tutorial',
        },
      ],
    },
    {
      id: 'p3-w9-fullbody-2',
      name: 'FULL BODY 2',
      exercises: [
        {
          order: 'A1',
          name: 'BB Incline Press',
          category: 'PRESSING',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Incline Press Tutorial',
        },
        {
          order: 'A2',
          name: 'Trap Bar Deadlift',
          category: 'POSTERIOR',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Trap Bar Deadlift Tutorial',
        },
        {
          order: 'B1',
          name: 'Chest Supported Row',
          category: 'PULLING',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Chest Supported Row Tutorial',
        },
        {
          order: 'B2',
          name: 'BB Back Squat',
          category: 'BILATERAL_QUAD',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Back Squat Tutorial',
        },
        {
          order: 'C1',
          name: 'Face Pull',
          category: 'DELT_SCAP_CONTROL',
          reps: '12',
          sets: 3,
          tempo: '2-1-2-1',
          tut: 60,
          restSeconds: 45,
          link: 'Face Pull Tutorial',
        },
        {
          order: 'C2',
          name: 'Rope Pushdown',
          category: 'TRICEPS',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 40,
          restSeconds: 45,
          link: 'Tricep Pushdown Tutorial',
        },
        {
          order: 'C3',
          name: 'Side Plank',
          category: 'BRACING',
          reps: '30s',
          sets: 3,
          tempo: 'N/A',
          tut: 30,
          restSeconds: 45,
          link: 'Side Plank Tutorial',
        },
      ],
    },
    {
      id: 'p3-w9-upper-focus',
      name: 'UPPER FOCUS',
      exercises: [
        {
          order: 'A1',
          name: 'Weighted Dips',
          category: 'PRESSING',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Weighted Dips Tutorial',
        },
        {
          order: 'A2',
          name: 'BB Bent Over Row',
          category: 'PULLING',
          reps: '6',
          sets: 4,
          tempo: '5-0-X-0',
          tut: 30,
          restSeconds: 90,
          link: 'Bent Over Row Tutorial',
        },
        {
          order: 'B1',
          name: 'DB Shoulder Press',
          category: 'PRESSING',
          reps: '8',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 32,
          restSeconds: 60,
          link: 'DB Shoulder Press Tutorial',
        },
        {
          order: 'B2',
          name: 'Lat Pulldown - Wide',
          category: 'PULLING',
          reps: '8',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 32,
          restSeconds: 60,
          link: 'Lat Pulldown Tutorial',
        },
        {
          order: 'C1',
          name: 'Cable Lateral Raise',
          category: 'DELT_SCAP_CONTROL',
          reps: '12',
          sets: 3,
          tempo: '2-1-2-1',
          tut: 60,
          restSeconds: 45,
          link: 'Lateral Raise Tutorial',
        },
        {
          order: 'C2',
          name: 'Incline DB Curl',
          category: 'BICEPS',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 40,
          restSeconds: 45,
          link: 'Incline Curl Tutorial',
        },
        {
          order: 'C3',
          name: 'Hanging Leg Raise',
          category: 'BRACING',
          reps: '10',
          sets: 3,
          tempo: '3-0-1-0',
          tut: 40,
          restSeconds: 45,
          link: 'Hanging Leg Raise Tutorial',
        },
      ],
    },
    {
      id: 'p3-w9-custom-1',
      name: 'CUSTOM SESSION 1',
      exercises: [],
    },
    {
      id: 'p3-w9-custom-2',
      name: 'CUSTOM SESSION 2',
      exercises: [],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// MASTER PROGRAM
// ═══════════════════════════════════════════════════════════════

export const gbcProgram: MasterProgram = {
  id: 'gbc-standard',
  name: 'GBC Standard',
  description: 'German Body Composition — 12-week protocol with accumulation, intensification, and realization blocks',
  category: 'GBC',
  level: 'Intermediate',
  totalWeeks: 12,
  phases: [phase1Accumulation, phase2Intensification, phase3Realization],
};

// ═══════════════════════════════════════════════════════════════
// ALL PROGRAMS
// ═══════════════════════════════════════════════════════════════

export const masterPrograms: MasterProgram[] = [gbcProgram];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function getProgramById(id: string): MasterProgram | undefined {
  return masterPrograms.find((p) => p.id === id);
}

export function getPhaseById(programId: string, phaseId: string): MasterPhase | undefined {
  const program = getProgramById(programId);
  return program?.phases.find((p) => p.id === phaseId);
}

export function getWorkoutById(programId: string, phaseId: string, workoutId: string): MasterWorkout | undefined {
  const phase = getPhaseById(programId, phaseId);
  return phase?.workouts.find((w) => w.id === workoutId);
}

// Simplified: find workout by ID across all phases/programs
export function findWorkoutById(workoutId: string): MasterWorkout | undefined {
  for (const program of masterPrograms) {
    for (const phase of program.phases) {
      const workout = phase.workouts.find((w) => w.id === workoutId);
      if (workout) return workout;
    }
  }
  return undefined;
}

export function getAllExercises(): string[] {
  const exercises = new Set<string>();
  masterPrograms.forEach((program) => {
    program.phases.forEach((phase) => {
      phase.workouts.forEach((workout) => {
        workout.exercises.forEach((ex) => exercises.add(ex.name));
      });
    });
  });
  return Array.from(exercises).sort();
}

export function getExercisesByCategory(category: string): MasterExercise[] {
  const result: MasterExercise[] = [];
  masterPrograms.forEach((program) => {
    program.phases.forEach((phase) => {
      phase.workouts.forEach((workout) => {
        workout.exercises.forEach((ex) => {
          if (ex.category === category) result.push(ex);
        });
      });
    });
  });
  return result;
}
