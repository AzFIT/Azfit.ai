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
    | "inactive"
    | "paused"
    | "on_holiday"
    | "on_break"
    | "pending_start"
    | "trial"
    | "cancelled"
    | "unavailable"
    | "transferred"
    | "archived";
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
  status?: string;
  createdAt?: string;
  startDate?: string | null;
  endDate?: string | null;
  progressionRules?: Array<{ id?: string; label: string; text: string }>;
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
        supersetGroup?: string;
      }>;
    }>;
  }>;
}
