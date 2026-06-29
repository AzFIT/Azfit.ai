import DashboardRouter from "@/components/dashboard/DashboardRouter";

/* ═══════════════════════════════════════════════════════════════════
   Dashboard Page — Phase A5
   ═══════════════════════════════════════════════════════════════════
   Thin wrapper that delegates to DashboardRouter.
   The old monolithic Dashboard.tsx has been superseded by:
   • DashboardRouter.tsx (role detection + layout)
   • TrainerDashboard.tsx (trainer view)
   • ClientDashboard.tsx (client view)
   ═══════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  return <DashboardRouter />;
}
