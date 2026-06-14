import type {
  Client,
  ClientNote,
  ClientNutritionPlan,
  ClientNutritionLog,
  ClientBioEntry,
  ClientWorkoutLog,
  ClientScheduleEvent,
  ClientGeneratedProgram,
} from "@/types/client";
import { getClientAssignedPrograms } from "@/lib/storage";

const DEMO_CLIENT_ID = "demo-client-001";

const demoClient: Client = {
  id: DEMO_CLIENT_ID,
  name: "Alex Chen",
  email: "alex.chen@email.com",
  phone: "+1 (555) 123-4567",
  dateOfBirth: "1997-03-15",
  gender: "male",
  photo: "./avatar-alex.jpg",
  weight: 82.5,
  goalWeight: 78.0,
  height: 178,
  bodyFatPercentage: 14.2,
  primaryGoal: "build_muscle",
  trainingExperience: "intermediate",
  trainingFrequency: 4,
  activityLevel: "moderate",
  availableEquipment: ["Full Gym"],
  preferredStyle: ["Free Weights"],
  injuries: "",
  status: "active",
  age: 28,
  fitnessScore: 82,
  compliance: 95,
  progress: 82,
  streak: 12,
  lastActive: "Active 2h ago",
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

const demoNutritionPlan: ClientNutritionPlan = {
  clientId: DEMO_CLIENT_ID,
  calorieGoal: 2650,
  macroSplit: "high_protein",
  proteinGrams: 198,
  fatsGrams: 88,
  carbsGrams: 265,
  waterGoal: 2888,
  mealCount: 4,
  createdAt: Date.now(),
};

const demoBioHistory: ClientBioEntry[] = [
  {
    id: "bio-1",
    date: "2025-03-15",
    weight: 86.2,
    bodyFatPercentage: 16.5,
    bmi: 26.7,
    waistCm: 86,
    measurements: { chest: 102, waist: 86, hips: 98, arms: 36, thighs: 58 },
    notes: "Starting point",
  },
  {
    id: "bio-2",
    date: "2025-04-01",
    weight: 85.1,
    bodyFatPercentage: 15.8,
    bmi: 26.3,
    waistCm: 85,
  },
  {
    id: "bio-3",
    date: "2025-04-15",
    weight: 84.3,
    bodyFatPercentage: 15.2,
    bmi: 26.0,
    waistCm: 84,
  },
  {
    id: "bio-4",
    date: "2025-05-01",
    weight: 83.5,
    bodyFatPercentage: 14.8,
    bmi: 25.7,
    waistCm: 83,
    notes: "Feeling strong, good recovery",
  },
  {
    id: "bio-5",
    date: "2025-05-15",
    weight: 82.9,
    bodyFatPercentage: 14.5,
    bmi: 25.5,
    waistCm: 82.5,
  },
  {
    id: "bio-6",
    date: "2025-06-01",
    weight: 82.5,
    bodyFatPercentage: 14.2,
    bmi: 25.4,
    waistCm: 82,
    notes: "Feeling strong, good recovery",
  },
];

const demoWorkoutLogs: ClientWorkoutLog[] = [
  {
    id: "log-1",
    programId: "prog-1",
    clientId: DEMO_CLIENT_ID,
    clientName: "Alex Chen",
    workoutName: "FULL BODY 1",
    phaseName: "Phase 1: GBC Accumulation",
    weekNumber: 1,
    dayNumber: 1,
    date: "2025-06-10",
    exercises: [
      {
        order: "A1",
        name: "Chin up - Semi supinated",
        category: "PULLING",
        muscleGroup: "Back",
        targetSets: 2,
        targetReps: "10",
        targetLoad: 0,
        tempo: "3-2-1-2",
        sets: [
          {
            setNumber: 1,
            load: 0,
            weight: 0,
            reps: 10,
            rpe: 8,
            done: true,
            restSeconds: 45,
            type: "Normal",
          },
          {
            setNumber: 2,
            load: 0,
            weight: 0,
            reps: 9,
            rpe: 9,
            done: true,
            restSeconds: 45,
            type: "Normal",
          },
        ],
      },
    ],
    startTime: "2025-06-10T07:30:00Z",
    endTime: "2025-06-10T08:20:00Z",
    durationSeconds: 3000,
    durationMinutes: 50,
    caloriesBurned: 450,
    totalVolume: 2840,
    totalSets: 8,
    completedSets: 8,
    completed: true,
    avgRpe: 7.8,
    status: "completed",
    notes: "Felt strong throughout the session.",
    createdAt: "2025-06-10T07:30:00Z",
  },
];

const demoScheduleEvents: ClientScheduleEvent[] = [
  {
    id: "evt-1",
    title: "PT with Alex Chen",
    date: "2025-06-11",
    startTime: "07:00",
    endTime: "08:00",
    type: "session",
    clientId: DEMO_CLIENT_ID,
    clientName: "Alex Chen",
    description: "Leg day focus",
  },
];

const demoGeneratedProgram: ClientGeneratedProgram = {
  id: "ai-prog-1",
  name: "Hypertrophy Phase 1",
  description:
    "AI-generated 4-week muscle building program optimized for intermediate lifters with full gym access.",
  category: "Hypertrophy",
  level: "Intermediate",
  totalWeeks: 4,
  goal: "build_muscle",
  frequency: 4,
  phases: [
    {
      id: "phase-1",
      name: "Phase 1: Accumulation",
      block: "Block 1",
      durationWeeks: 4,
      goal: "Build work capacity and establish baseline loads",
      workouts: [
        {
          id: "w1",
          name: "FULL BODY 1",
          dayNumber: 1,
          focus: "Pull / Quad dominant",
          estimatedMinutes: 45,
          exercises: [
            {
              order: "A1",
              name: "Chin up - Semi supinated",
              category: "PULLING",
              sets: 2,
              reps: "10",
              tempo: "3-2-1-2",
              restSeconds: 45,
            },
            {
              order: "A2",
              name: "DB Split Squat",
              category: "UNILATERAL_QUAD",
              sets: 2,
              reps: "10-12",
              tempo: "3-2-1-2",
              restSeconds: 45,
            },
          ],
        },
      ],
    },
  ],
};

export function getClientNotes(clientId: string): ClientNote[] {
  const raw = localStorage.getItem(`azfit_client_notes_${clientId}`);
  return raw ? JSON.parse(raw) : [];
}

export function saveClientNotes(clientId: string, notes: ClientNote[]): void {
  localStorage.setItem(`azfit_client_notes_${clientId}`, JSON.stringify(notes));
}

export function loadClientById(clientId: string): Client | null {
  if (clientId === DEMO_CLIENT_ID) return demoClient;

  try {
    const raw = localStorage.getItem("azfit_clients");
    if (raw) {
      const clients = JSON.parse(raw) as Client[];
      const found = clients.find((c) => c.id === clientId);
      if (found) return found;
    }
  } catch {
    // ignore
  }

  try {
    const raw = localStorage.getItem("azfit_client_profile");
    if (raw) {
      const profile = JSON.parse(raw) as Client & { fullName?: string };
      if (profile.id === clientId) {
        return { ...profile, name: profile.fullName || profile.name };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function getClientNutritionPlan(
  clientId: string,
): ClientNutritionPlan | null {
  if (clientId === DEMO_CLIENT_ID) return demoNutritionPlan;
  try {
    const raw = localStorage.getItem("azfit_nutrition_plan");
    if (raw) {
      const plan = JSON.parse(raw) as ClientNutritionPlan;
      if (plan.clientId === clientId) return plan;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getClientNutritionLogs(
  _clientId: string,
): ClientNutritionLog[] {
  return [
    {
      id: "log-today",
      clientId: _clientId,
      date: new Date().toISOString().split("T")[0],
      caloriesConsumed: 2100,
      proteinConsumed: 165,
      carbsConsumed: 220,
      fatsConsumed: 72,
      waterConsumed: 2400,
    },
  ];
}

export function getClientBioHistory(clientId: string): ClientBioEntry[] {
  if (clientId === DEMO_CLIENT_ID) return demoBioHistory;
  try {
    const raw = localStorage.getItem("azfit_bio_history");
    if (raw) return JSON.parse(raw) as ClientBioEntry[];
  } catch {
    // ignore
  }
  return [];
}

export function getClientWorkoutLogs(clientId: string): ClientWorkoutLog[] {
  if (clientId === DEMO_CLIENT_ID) return demoWorkoutLogs;
  try {
    const raw = localStorage.getItem("azfit_workout_logs");
    if (raw) return JSON.parse(raw) as ClientWorkoutLog[];
  } catch {
    // ignore
  }
  return [];
}

export function getClientScheduleEvents(
  clientId: string,
): ClientScheduleEvent[] {
  if (clientId === DEMO_CLIENT_ID) return demoScheduleEvents;
  try {
    const raw = localStorage.getItem("azfit_schedule_events");
    if (raw) {
      const events = JSON.parse(raw) as ClientScheduleEvent[];
      return events.filter((event) => event.clientId === clientId);
    }
  } catch {
    // ignore
  }
  return [];
}

export function getClientPrograms(clientId: string): ClientGeneratedProgram[] {
  if (clientId === DEMO_CLIENT_ID) return [demoGeneratedProgram];
  return getClientAssignedPrograms(clientId);
}
