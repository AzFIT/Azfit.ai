import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Activity,
  Utensils,
  Dumbbell,
  CalendarDays,
  Layers,
  StickyNote,
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
} from "@/components/client";
import type { Client, ClientNote } from "@/types/client";
import {
  loadClientById,
  getClientNutritionPlan,
  getClientNutritionLogs,
  getClientBioHistory,
  getClientWorkoutLogs,
  getClientScheduleEvents,
  getClientPrograms,
  getClientNotes,
  saveClientNotes,
} from "@/lib/client-demo";

const tabs = [
  { id: "overview", label: "Overview", icon: User },
  { id: "bio", label: "Bio History", icon: Activity },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "workouts", label: "Workout Logs", icon: Dumbbell },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "programs", label: "Programs", icon: Layers },
  { id: "notes", label: "Notes", icon: StickyNote },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ClientProfile() {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clientId) return;
    const raf = window.requestAnimationFrame(() => setLoading(true));
    const timer = window.setTimeout(() => {
      const loaded = loadClientById(clientId);
      setClient(loaded);
      setNotes(getClientNotes(clientId));
      setLoading(false);
    }, 150);
    return () => {
      window.cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [clientId]);

  const handleAddNote = useCallback(
    (content: string) => {
      if (!clientId) return;
      const newNote: ClientNote = {
        id: `note_${Date.now()}`,
        clientId,
        content,
        createdAt: new Date().toISOString(),
        createdBy: "Coach",
      };
      const updated = [newNote, ...notes];
      setNotes(updated);
      saveClientNotes(clientId, updated);
    },
    [clientId, notes],
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      if (!clientId) return;
      const updated = notes.filter((n) => n.id !== noteId);
      setNotes(updated);
      saveClientNotes(clientId, updated);
    },
    [clientId, notes],
  );

  const handleBuildProgram = useCallback(() => {
    if (!client) return;
    navigate(`/program-builder?clientId=${client.id}`);
  }, [client, navigate]);

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

  if (!client) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        <div className="text-center">
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
            The client you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const nutritionPlan = getClientNutritionPlan(client.id);
  const nutritionLogs = getClientNutritionLogs(client.id);
  const bioHistory = getClientBioHistory(client.id);
  const workoutLogs = getClientWorkoutLogs(client.id);
  const scheduleEvents = getClientScheduleEvents(client.id);
  const programs = getClientPrograms(client.id);

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
                  onClick={() => setActiveTab(tab.id)}
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
              <OverviewTab client={client} nutritionPlan={nutritionPlan} />
            )}
            {activeTab === "bio" && <BioHistoryTab entries={bioHistory} />}
            {activeTab === "nutrition" && (
              <NutritionTab
                nutritionPlan={nutritionPlan}
                nutritionLogs={nutritionLogs}
              />
            )}
            {activeTab === "workouts" && <WorkoutLogsTab logs={workoutLogs} />}
            {activeTab === "schedule" && (
              <ScheduleTab events={scheduleEvents} />
            )}
            {activeTab === "programs" && <ProgramsTab programs={programs} />}
            {activeTab === "notes" && (
              <NotesTab
                notes={notes}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
