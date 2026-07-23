export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  photo?: string | null;
  weight: number;
  goalWeight?: number | null;
  height: number;
  bodyFatPercentage?: number | null;
  primaryGoal?: string | null;
  trainingExperience?: string | null;
  trainingFrequency?: number | null;
  activityLevel?: string | null;
  availableEquipment?: string[];
  preferredStyle?: string[];
  injuries?: string | null;
  status?:
    | "active"
    | "paused"
    | "archived"
    | "away"
    | "new"
    | "inactive"
    | "on_hold"
    | "cancelled";
  avatar?: string | null;
  location?: string | null;
  age?: number;
  fitnessScore?: number;
  compliance?: number;
  progress?: number;
  streak?: number;
  lastActive?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface ClientNutritionPlan {
  clientId: string;
  calorieGoal: number;
  macroSplit: string;
  proteinGrams: number;
  fatsGrams: number;
  carbsGrams: number;
  waterGoal: number;
  mealCount: number;
  createdAt: number;
}

export interface ClientNutritionLog {
  id: string;
  clientId: string;
  date: string;
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatsConsumed: number;
  waterConsumed: number;
}

export interface ClientBioEntry {
  id: string;
  date: string;
  weight: number;
  bodyFatPercentage: number;
  bmi?: number;
  waistCm?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  notes?: string;
}

export interface ClientWorkoutSet {
  setNumber: number;
  load: number;
  weight?: number;
  reps: number | string;
  rpe: number;
  done: boolean;
  restSeconds: number;
  type: string;
}

export interface ClientWorkoutExercise {
  order: string;
  name: string;
  category: string;
  muscleGroup?: string;
  targetSets: number;
  targetReps: string;
  targetLoad: number;
  tempo: string;
  sets: ClientWorkoutSet[];
}

export interface ClientWorkoutLog {
  id: string;
  programId: string;
  clientId: string;
  clientName: string;
  workoutName: string;
  phaseName: string;
  weekNumber: number;
  dayNumber: number;
  date: string;
  exercises: ClientWorkoutExercise[];
  startTime: string;
  endTime: string;
  durationSeconds: number;
  durationMinutes?: number;
  caloriesBurned?: number;
  totalVolume: number;
  totalSets: number;
  completedSets: number;
  completed?: boolean;
  avgRpe: number;
  status: "completed" | "partial" | "planned";
  notes?: string;
  createdAt: string;
}

export interface ClientScheduleEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "session" | "check-in" | "assessment" | "reminder" | "message";
  clientId: string;
  clientName: string;
  location?: string;
  description?: string;
}

export interface ClientGeneratedProgram {
  id: string;
  clientId?: string;
  clientName?: string;
  name: string;
  description: string;
  category: string;
  level: string;
  totalWeeks: number;
  goal: string;
  frequency: number;
  phases: Array<{
    id: string;
    name: string;
    block: string;
    durationWeeks: number;
    goal: string;
    workouts: Array<{
      id: string;
      name: string;
      dayNumber: number;
      focus: string;
      estimatedMinutes: number;
      exercises: Array<{
        order: string;
        name: string;
        category: string;
        sets: number;
        reps: string;
        tempo: string;
        restSeconds: number;
        load?: number | null;
      }>;
    }>;
  }>;
}
