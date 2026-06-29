import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════
   AI Context Provider — Phase A5 (Foundation for Gemini Co-Pilot)
   ═══════════════════════════════════════════════════════════════════
   Lightweight context that tracks the user's current view state
   so the Gemini AI assistant can inject relevant context into prompts.

   Future: This will be consumed by AIChatBubble to build the
   system prompt sent to the Supabase Edge Function.
   ═══════════════════════════════════════════════════════════════════ */

export type DashboardPage =
  | "dashboard"
  | "client-profile"
  | "program-builder"
  | "nutrition"
  | "workout"
  | "schedule"
  | "analytics"
  | "clients"
  | "settings";

export interface AIContextState {
  /** Current page the user is viewing */
  page: DashboardPage;
  /** Active client ID (if viewing a client profile) */
  activeClientId?: string;
  /** Active client name (for display) */
  activeClientName?: string;
  /** Active program ID (if in program builder) */
  activeProgramId?: string;
  /** Active workout log ID (if in workout session) */
  activeWorkoutId?: string;
  /** Current metrics visible on the dashboard */
  visibleMetrics?: Record<string, number>;
  /** Timestamp of last context update */
  updatedAt: number;
}

interface AIContextType {
  context: AIContextState;
  setPage: (page: DashboardPage) => void;
  setActiveClient: (id: string | undefined, name?: string) => void;
  setActiveProgram: (id: string | undefined) => void;
  setActiveWorkout: (id: string | undefined) => void;
  setVisibleMetrics: (metrics: Record<string, number>) => void;
  clearContext: () => void;
}

const defaultContext: AIContextState = {
  page: "dashboard",
  updatedAt: Date.now(),
};

const AIContext = createContext<AIContextType | undefined>(undefined);

/* eslint-disable react-refresh/only-export-components */
export function AIContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AIContextState>(defaultContext);

  const updateContext = useCallback((partial: Partial<AIContextState>) => {
    setContext((prev) => ({
      ...prev,
      ...partial,
      updatedAt: Date.now(),
    }));
  }, []);

  const setPage = useCallback(
    (page: DashboardPage) => updateContext({ page }),
    [updateContext]
  );

  const setActiveClient = useCallback(
    (activeClientId: string | undefined, activeClientName?: string) =>
      updateContext({ activeClientId, activeClientName }),
    [updateContext]
  );

  const setActiveProgram = useCallback(
    (activeProgramId: string | undefined) => updateContext({ activeProgramId }),
    [updateContext]
  );

  const setActiveWorkout = useCallback(
    (activeWorkoutId: string | undefined) => updateContext({ activeWorkoutId }),
    [updateContext]
  );

  const setVisibleMetrics = useCallback(
    (visibleMetrics: Record<string, number>) => updateContext({ visibleMetrics }),
    [updateContext]
  );

  const clearContext = useCallback(() => {
    setContext(defaultContext);
  }, []);

  const value: AIContextType = {
    context,
    setPage,
    setActiveClient,
    setActiveProgram,
    setActiveWorkout,
    setVisibleMetrics,
    clearContext,
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const ctx = useContext(AIContext);
  if (ctx === undefined) {
    throw new Error("useAIContext must be used within an AIContextProvider");
  }
  return ctx;
}
