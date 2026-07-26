import type { Client } from "@/types/client";

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
