import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAIContext } from "@/components/ai-copilot/AIContextProvider";
import Layout from "@/components/Layout";
import TrainerDashboard from "@/components/dashboard/TrainerDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

/* ═══════════════════════════════════════════════════════════════════
   Dashboard Router — Phase A5
   ═══════════════════════════════════════════════════════════════════
   Role-aware dashboard that renders:
   • TrainerDashboard for trainers/admins
   • ClientDashboard for clients

   Wrapped in AIContextProvider so the Gemini Co-Pilot can
   inject page context into prompts.
   ═══════════════════════════════════════════════════════════════════ */

export default function DashboardRouter() {
  const { isTrainer, loading } = useAuth();
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

  // Role-based rendering: trainer view takes precedence for admin users
  return (
    <Layout>
      {isTrainer ? <TrainerDashboard /> : <ClientDashboard />}
    </Layout>
  );
}
