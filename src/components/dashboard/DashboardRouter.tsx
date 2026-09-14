import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useViewAs } from "@/hooks/useViewAs";
import { useAIContext } from "@/components/ai-copilot/AIContextProvider";
import Layout from "@/components/Layout";
import TrainerDashboard from "@/components/dashboard/TrainerDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

/* ═══════════════════════════════════════════════════════════════════
   Dashboard Router — Phase A5 (+ Phase 90e view-as override)
   ═══════════════════════════════════════════════════════════════════
   Role-aware dashboard that renders:
   • TrainerDashboard for trainers/admins
   • ClientDashboard for clients
   • ClientDashboard for ANY role while a view-as override is active —
     the trainer rides the TARGET client's actual dashboard (data
     level only; the auth session is untouched)

   Wrapped in AIContextProvider so the Gemini Co-Pilot can
   inject page context into prompts.
   ═══════════════════════════════════════════════════════════════════ */

export default function DashboardRouter() {
  const { isTrainer, loading } = useAuth();
  const { viewAs } = useViewAs();
  const { setPage } = useAIContext();

  // Update AI context when dashboard mounts
  useEffect(() => {
    setPage("dashboard");
  }, [setPage]);

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-solid"
            style={{
              borderColor: "var(--azfit-primary)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      </Layout>
    );
  }

  // Role-based rendering: trainer view takes precedence for admin users,
  // EXCEPT while viewing as a client (override wins).
  return (
    <Layout>
      {isTrainer && !viewAs ? <TrainerDashboard /> : <ClientDashboard />}
    </Layout>
  );
}
