import type { ClientGeneratedProgram } from "@/types/client";
// ═══════════════════════════════════════════════════════════════
// AzFIT LocalStorage Layer
// ALL storage access goes through here — no direct localStorage elsewhere
// ═══════════════════════════════════════════════════════════════

const PREFIX = "azfit_";

const KEYS = {
  THEME: `${PREFIX}theme`,
  CLIENTS: `${PREFIX}clients`,
  PROGRAMS: `${PREFIX}programs`,
  CLIENT_PROGRAMS: `${PREFIX}client_programs`,
  CLIENT_ASSIGNED_PROGRAMS: `${PREFIX}client_assigned_programs`,
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

export function getTheme(): Theme {
  return get<Theme>(KEYS.THEME, "dark");
}

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

export function deleteClient(clientId: string): void {
  const clients = getClients().filter((c) => c.id !== clientId);
  set(KEYS.CLIENTS, clients);
}

// ─── Program Templates (builder) ───

export interface ProgramTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  weeks: number;
  days: ProgramTemplateDay[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramTemplateDay {
  id: string;
  name: string;
  dayNumber: number;
  slots: ProgramTemplateSlot[];
}

export interface ProgramTemplateSlot {
  order: string;
  exercise: string;
  categoryId: string;
  sets: number;
  reps: string;
  tempo: string;
  restSeconds: number;
}

export function getProgramTemplates(): ProgramTemplate[] {
  return get<ProgramTemplate[]>(KEYS.PROGRAMS, []);
}

export function saveProgramTemplate(template: ProgramTemplate): void {
  const templates = getProgramTemplates();
  const idx = templates.findIndex((p) => p.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.push(template);
  }
  set(KEYS.PROGRAMS, templates);
}

export function deleteProgramTemplate(id: string): void {
  const templates = getProgramTemplates().filter((p) => p.id !== id);
  set(KEYS.PROGRAMS, templates);
}

export interface AssignedProgram extends ClientGeneratedProgram {
  clientId: string;
  clientName: string;
}

export function getClientAssignedPrograms(clientId: string): AssignedProgram[] {
  return get<AssignedProgram[]>(KEYS.CLIENT_ASSIGNED_PROGRAMS, []).filter(
    (program) => program.clientId === clientId,
  );
}

export function saveClientAssignedProgram(program: AssignedProgram): void {
  const programs = get<AssignedProgram[]>(KEYS.CLIENT_ASSIGNED_PROGRAMS, []);
  const idx = programs.findIndex(
    (p) => p.id === program.id && p.clientId === program.clientId,
  );
  if (idx >= 0) {
    programs[idx] = program;
  } else {
    programs.push(program);
  }
  set(KEYS.CLIENT_ASSIGNED_PROGRAMS, programs);
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

export function saveClientProgram(program: StoredProgram): void {
  const programs = getClientPrograms();
  const idx = programs.findIndex((p) => p.id === program.id);
  if (idx >= 0) {
    programs[idx] = program;
  } else {
    programs.push(program);
  }
  set(KEYS.CLIENT_PROGRAMS, programs);
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

export function saveWorkoutLog(log: WorkoutLog): void {
  const logs = getWorkoutLogs();
  const idx = logs.findIndex((l) => l.id === log.id);
  if (idx >= 0) {
    logs[idx] = log;
  } else {
    logs.push(log);
  }
  set(KEYS.WORKOUT_LOGS, logs);
}

export function getActiveSession(): WorkoutLog | null {
  return get<WorkoutLog | null>(KEYS.ACTIVE_SESSION, null);
}

export function setActiveSession(session: WorkoutLog | null): void {
  if (session) {
    set(KEYS.ACTIVE_SESSION, session);
  } else {
    remove(KEYS.ACTIVE_SESSION);
  }
}

export function getClientLogs(clientId: string): WorkoutLog[] {
  return getWorkoutLogs().filter((l) => l.clientId === clientId);
}

export function getProgramLogs(programId: string): WorkoutLog[] {
  return getWorkoutLogs().filter((l) => l.programId === programId);
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

export function getStoredUser(): StoredUser | null {
  return get<StoredUser | null>(KEYS.CURRENT_USER, null);
}

export function setStoredUser(user: StoredUser | null): void {
  if (user) {
    set(KEYS.CURRENT_USER, user);
  } else {
    remove(KEYS.CURRENT_USER);
  }
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

export function getWorkoutDraft(userId: string, workoutLogId: string, exerciseId: string): WorkoutDraftData | null {
  return get<WorkoutDraftData | null>(KEYS.WORKOUT_DRAFT(userId, workoutLogId, exerciseId), null);
}

export function setWorkoutDraft(userId: string, workoutLogId: string, exerciseId: string, data: Omit<WorkoutDraftData, 'timestamp' | 'synced'>): void {
  set(KEYS.WORKOUT_DRAFT(userId, workoutLogId, exerciseId), {
    ...data,
    timestamp: Date.now(),
    synced: false,
  });
}

export function clearWorkoutDraft(userId: string, workoutLogId: string, exerciseId: string): void {
  remove(KEYS.WORKOUT_DRAFT(userId, workoutLogId, exerciseId));
}

export function clearAllWorkoutDrafts(userId: string, workoutLogId: string): void {
  const prefix = `${PREFIX}workout_draft:${userId}:${workoutLogId}:`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      remove(key);
    }
  }
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

export function getOfflineQueue(userId: string): OfflineQueueItem[] {
  return get<OfflineQueueItem[]>(KEYS.OFFLINE_QUEUE(userId), []);
}

export function setOfflineQueue(userId: string, queue: OfflineQueueItem[]): void {
  set(KEYS.OFFLINE_QUEUE(userId), queue);
}

export function clearOfflineQueue(userId: string): void {
  remove(KEYS.OFFLINE_QUEUE(userId));
}

// ─── Export / Import ───

export function exportAllData(): string {
  const data = {
    clients: getClients(),
    programs: getProgramTemplates(),
    logs: getWorkoutLogs(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.clients) set(KEYS.CLIENTS, data.clients);
    if (data.programs) set(KEYS.PROGRAMS, data.programs);
    if (data.logs) set(KEYS.WORKOUT_LOGS, data.logs);
    if (data.settings) set(KEYS.SETTINGS, data.settings);
    return true;
  } catch {
    return false;
  }
}

// ─── Clear all ───

export function clearAllData(): void {
  Object.values(KEYS).forEach((key) => {
    if (typeof key === "string") remove(key);
  });
}
