// ═══════════════════════════════════════════════════════════════
// AzFIT LocalStorage Layer
// ALL storage access goes through here — no direct localStorage elsewhere
// ═══════════════════════════════════════════════════════════════

const PREFIX = "azfit_";

const KEYS = {
  THEME: `${PREFIX}theme`,
  CLIENTS: `${PREFIX}clients`,
  CLIENT_PROGRAMS: `${PREFIX}client_programs`,
  SESSIONS: `${PREFIX}sessions`,
  ACTIVE_SESSION: `${PREFIX}active_session`,
  SETTINGS: `${PREFIX}settings`,
  NOTES: (clientId: string) => `${PREFIX}notes_${clientId}`,
  WORKOUT_LOGS: `${PREFIX}workout_logs`,
  CURRENT_USER: `${PREFIX}current_user`,
  WORKOUT_DRAFT: (userId: string, workoutLogId: string, exerciseId: string) =>
    `${PREFIX}workout_draft:${userId}:${workoutLogId}:ex_${exerciseId}`,
  OFFLINE_QUEUE: (userId: string) => `${PREFIX}offline_queue:${userId}`,
} as const;

// ─── Generic helpers ───

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage write failed:", e);
  }
}

function remove(key: string): void {
  localStorage.removeItem(key);
}

// ─── Theme ───

export type Theme = "light" | "dark";

export function setTheme(theme: Theme): void {
  set(KEYS.THEME, theme);
}

// ─── Clients ───

export interface StoredClient {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  fitnessGoal?: string;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  status: "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
}

export function getClients(): StoredClient[] {
  return get<StoredClient[]>(KEYS.CLIENTS, []);
}

export function saveClient(client: StoredClient): void {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = { ...client, updatedAt: new Date().toISOString() };
  } else {
    clients.push(client);
  }
  set(KEYS.CLIENTS, clients);
}

// ─── Programs (assigned to clients) ───

export interface StoredProgram {
  id: string;
  clientId: string;
  clientName: string;
  masterProgramId: string;
  masterPhaseId: string;
  name: string;
  status: "active" | "paused" | "completed";
  startDate: string;
  currentWeek: number;
  createdAt: string;
}

export function getClientPrograms(): StoredProgram[] {
  return get<StoredProgram[]>(KEYS.CLIENT_PROGRAMS, []);
}

// ─── Workout Sessions / Logs ───

export type SetType =
  | "Normal"
  | "Warm-up"
  | "Drop Set"
  | "To Failure"
  | "AMRAP"
  | "Superset"
  | "Giant Set"
  | "Cluster"
  | "Back-off"
  | "Eccentric";

export const SET_TYPE_COLORS: Record<SetType, string> = {
  Normal: "#94A3B8",
  "Warm-up": "#64748B",
  "Drop Set": "#EF4444",
  "To Failure": "#F59E0B",
  AMRAP: "#22C55E",
  Superset: "#00AEEF",
  "Giant Set": "#EC4899",
  Cluster: "#8B5CF6",
  "Back-off": "#06B6D4",
  Eccentric: "#F97316",
};

export interface LoggedSet {
  setNumber: number;
  load: number;
  reps: number;
  rpe: number;
  done: boolean;
  restSeconds: number;
  type: SetType;
}

export interface LoggedExercise {
  order: string;
  name: string;
  category: string;
  targetSets: number;
  targetReps: string;
  targetLoad: number;
  tempo: string;
  sets: LoggedSet[];
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  programId: string;
  clientId: string;
  clientName: string;
  workoutName: string;
  phaseName: string;
  weekNumber: number;
  dayNumber: number;
  exercises: LoggedExercise[];
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  totalVolume: number;
  totalSets: number;
  completedSets: number;
  avgRpe: number;
  status: "in_progress" | "completed" | "cancelled";
  createdAt: string;
}

export function getWorkoutLogs(): WorkoutLog[] {
  return get<WorkoutLog[]>(KEYS.WORKOUT_LOGS, []);
}

export function setActiveSession(session: WorkoutLog | null): void {
  if (session) {
    set(KEYS.ACTIVE_SESSION, session);
  } else {
    remove(KEYS.ACTIVE_SESSION);
  }
}

// ─── Settings ───

export interface AppSettings {
  units: "metric" | "imperial";
  defaultRestSeconds: number;
  currency: string;
  defaultSessionPrice: number;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  units: "metric",
  defaultRestSeconds: 60,
  currency: "USD",
  defaultSessionPrice: 100,
  soundEnabled: true,
  hapticEnabled: true,
};

export function getSettings(): AppSettings {
  return get<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(partial: Partial<AppSettings>): void {
  const current = getSettings();
  set(KEYS.SETTINGS, { ...current, ...partial });
}

// ─── Current User (for localStorage auth mode) ───

export interface StoredUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "trainer" | "client";
  avatarUrl?: string;
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: Workout Draft Helpers — Resilient State Management
// ═══════════════════════════════════════════════════════════════

export interface WorkoutDraftData {
  sets: { reps: string; weight: string; rpe: string; done: boolean }[];
  notes: string;
  timestamp: number;
  synced: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: Offline Queue Helpers
// ═══════════════════════════════════════════════════════════════

export interface OfflineQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update';
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  error?: string;
}

// ─── Onboarding Data ───

export interface OnboardingState {
  role: 'trainer' | 'client' | '';
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  weight: number;
  goalWeight: number;
  height: number;
  bodyFatPercentage?: number;
  primaryGoal: string;
  primaryGoalId: string;
  trainingExperience: string;
  trainingFrequency: string;
  activityLevel: string;
  gymType: string;
  sessionLength: number;
  hasCoach: boolean;
  coachCode: string;
  macroSplit: string;
  mealCount: string;
  connectedDevices: string[];
  injuries: string;
  availableEquipment: string[];
  parqAnswers: boolean[];
  useNavyMethod: boolean;
  navyNeck: number;
  navyWaist: number;
  navyHip: number;
  measurements: Record<string, number>;
  progressPhoto?: string;
  photo?: string;
  preferredStyle: string[];
}

export function getOnboardingData(): OnboardingState | null {
  return get<OnboardingState | null>(`${PREFIX}onboarding_data`, null);
}

export function setOnboardingData(data: OnboardingState): void {
  set(`${PREFIX}onboarding_data`, data);
}

export function clearOnboardingData(): void {
  remove(`${PREFIX}onboarding_data`);
}
