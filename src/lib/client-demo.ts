import type {
  Client,
  ClientNote,
  ClientNutritionPlan,
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

export function getClientPrograms(clientId: string): ClientGeneratedProgram[] {
  if (clientId === DEMO_CLIENT_ID) return [demoGeneratedProgram];
  return getClientAssignedPrograms(clientId);
}
