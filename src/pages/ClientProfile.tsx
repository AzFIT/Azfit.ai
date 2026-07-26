import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Activity,
  Utensils,
  Dumbbell,
  CalendarDays,
  Layers,
  StickyNote,
  ArrowLeft,
  Camera,
  Video,
} from "lucide-react";
import ClientProfileHeader from "@/components/client/ClientProfileHeader";
import {
  OverviewTab,
  BioHistoryTab,
  NutritionTab,
  WorkoutLogsTab,
  ScheduleTab,
  ProgramsTab,
  NotesTab,
  ClientPhotosTab,
  ClientFormChecksTab,
} from "@/components/client";
import type { Client, ClientGeneratedProgram } from "@/types/client";
import { supabase } from "@/lib/supabase";
import { codeFromOrderIndex, parseExerciseNotes } from "@/lib/aiProgramMapper";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/types/supabase";

const tabs = [
  { id: "overview", label: "Overview", icon: User },
  { id: "bio", label: "Bio History", icon: Activity },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "workouts", label: "Workout Logs", icon: Dumbbell },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "programs", label: "Programs", icon: Layers },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "formchecks", label: "Form Checks", icon: Video },
  { id: "notes", label: "Notes", icon: StickyNote },
] as const;

type TabId = (typeof tabs)[number]["id"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string | undefined): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function mapDbClientToClient(row: Database["public"]["Tables"]["clients"]["Row"]): Client {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    weight: row.weight_kg ?? 0,
    goalWeight: null,
    height: row.height_cm ?? 0,
    bodyFatPercentage: row.body_fat_percentage,
    primaryGoal: row.fitness_goal,
    trainingExperience: row.experience_level,
    trainingFrequency: null,
    activityLevel: null,
    availableEquipment: [],
    preferredStyle: [],
    injuries: null,
    status: row.status,
    avatar: null,
    location: null,
    age: undefined,
    fitnessScore: undefined,
    compliance: undefined,
    progress: undefined,
    streak: undefined,
    lastActive: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchClientPrograms(clientId: string): Promise<ClientGeneratedProgram[]> {
  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (programsError || !programs || programs.length === 0) return [];

  const programIds = programs.map((p) => p.id);
  const { data: workouts } = await supabase
    .from("workouts")
    .select("*")
    .in("program_id", programIds)
    .order("week_number", { ascending: true })
    .order("day_of_week", { ascending: true });

  const workoutIds = (workouts || []).map((w) => w.id);
  const { data: exercises } = workoutIds.length
    ? await supabase
        .from("exercises")
        .select("*")
        .in("workout_id", workoutIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  return programs.map((p) => {
    const programWorkouts = (workouts || []).filter((w) => w.program_id === p.id);
    return {
      id: p.id,
      clientId: p.client_id || undefined,
      name: p.name,
      description: p.description || "",
      category: "Custom",
      level: "Custom",
      totalWeeks: p.duration_weeks || 4,
      goal: p.description || "",
      frequency: p.frequency_per_week || 1,
      status: p.status,
      createdAt: p.created_at,
      startDate: p.start_date,
      endDate: p.end_date,
      phases: [
        {
          id: `phase-${p.id}`,
          name: p.phase_name || "Program Phase",
          block: "Block 1",
          durationWeeks: p.duration_weeks || 4,
          goal: p.description || "",
          workouts: programWorkouts.map((w) => {
            const wExercises = (exercises || []).filter((e) => e.workout_id === w.id);
            return {
              id: w.id,
              name: w.name,
              dayNumber: w.day_of_week || 1,
              focus: w.name,
              estimatedMinutes: Math.max(30, wExercises.length * 5),
              exercises: wExercises.map((e) => {
                const extra = parseExerciseNotes(e.notes);
                return {
                  order: codeFromOrderIndex(e.order_index),
                  name: e.name,
                  category: "custom",
                  sets: e.sets || 0,
                  reps: e.reps || "",
                  tempo: extra.tempo,
                  restSeconds: e.rest_seconds || 60,
                  load: e.weight_kg ?? null,
                };
              }),
            };
          }),
        },
      ],
    };
  });
}

export default function ClientProfile() {
  const { clientId } = useParams<{ clientId: string }>();
  const hasValidId = isValidUUID(clientId);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabId>(
    (tabs.find((t) => t.id === urlTab)?.id as TabId) || "overview"
  );
  const [client, setClient] = useState<Client | null>(null);
  const [programs, setPrograms] = useState<ClientGeneratedProgram[]>([]);
  const [bioAddHint, setBioAddHint] = useState<"weight" | "bodyFat" | null>(null);
  const [loading, setLoading] = useState(hasValidId);
  const navigate = useNavigate();
  const { user } = useAuth();

  // In-page tab navigation for clickable tiles (tabs are state, not routes).
  // `hint` optionally pre-opens the Bio History quick-add dialog.
  const handleNavigateTab = useCallback(
    (tab: TabId, hint?: "weight" | "bodyFat") => {
      setBioAddHint(hint ?? null);
      setActiveTab(tab);
      setSearchParams({ tab });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!hasValidId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const load = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (error || !data) {
        setClient(null);
      } else {
        setClient(mapDbClientToClient(data));
      }
      setLoading(false);
    };

    load();
  }, [clientId, hasValidId, user?.id]);

  const clientDbId = client?.id;
  const reloadPrograms = useCallback(() => {
    if (!clientDbId) return Promise.resolve();
    return fetchClientPrograms(clientDbId).then(setPrograms);
  }, [clientDbId]);

  useEffect(() => {
    reloadPrograms();
  }, [reloadPrograms]);

  const handleBuildProgram = useCallback(() => {
    if (!client) return;
    navigate(`/ai-program-builder?clientId=${client.id}`);
  }, [client, navigate]);

  const handleStartWorkout = useCallback(
    async (workoutId: string, clientId: string) => {
      const { data: log, error } = await supabase
        .from("workout_logs")
        .insert({ client_id: clientId, workout_id: workoutId })
        .select("id")
        .single();
      if (error || !log) {
        toast.error(error?.message || "Failed to start workout");
        return;
      }
      navigate(`/sheets?workoutLogId=${log.id}`);
    },
    [navigate]
  );

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--azfit-primary)" }}
          />
          <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
            Loading client profile...
          </p>
        </div>
      </div>
    );
  }

  if (!hasValidId || !client) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <User
            size={40}
            style={{ color: "var(--light-text-muted)" }}
            className="mx-auto mb-3"
          />
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--page-text)" }}
          >
            Client Not Found
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--light-text-muted)" }}
          >
            The client you're looking for doesn't exist or the link is invalid.
          </p>
          <button
            onClick={() => navigate("/clients")}
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--azfit-primary)" }}
          >
            <ArrowLeft size={16} />
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-4">
        {/* Header */}
        <ClientProfileHeader
          client={client}
          onBuildProgram={handleBuildProgram}
        />

        {/* Tabs */}
        <div
          className="rounded-2xl border p-1.5 overflow-x-auto"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchParams({ tab: tab.id });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    backgroundColor: isActive
                      ? "var(--azfit-primary)"
                      : "transparent",
                    color: isActive ? "#fff" : "var(--light-text-muted)",
                  }}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && (
              <OverviewTab client={client} clientId={clientId!} onNavigate={handleNavigateTab} />
            )}
            {activeTab === "bio" && <BioHistoryTab clientId={client.id} openAdd={bioAddHint} />}
            {activeTab === "nutrition" && (
              <NutritionTab clientId={client.id} clientEmail={client.email} />
            )}
            {activeTab === "workouts" && <WorkoutLogsTab clientId={client.id} />}
            {activeTab === "schedule" && <ScheduleTab clientEmail={client.email} />}
            {activeTab === "programs" && (
              <ProgramsTab programs={programs} onStartWorkout={handleStartWorkout} onChanged={reloadPrograms} />
            )}
            {activeTab === "photos" && <ClientPhotosTab clientEmail={client.email} />}
            {activeTab === "formchecks" && <ClientFormChecksTab clientEmail={client.email} />}
            {activeTab === "notes" && <NotesTab clientId={client.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
