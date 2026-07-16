import { Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import DashboardRouter from "@/components/dashboard/DashboardRouter";

/* ═══════════════════════════════════════════════════════════════════
   Dashboard Page — Phase A5
   ═══════════════════════════════════════════════════════════════════
   For admin users: redirects to /coach (admin dashboard)
   For trainers/clients: renders role-appropriate dashboard
   ═══════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: '#0F172A' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid" style={{ borderColor: '#0D9488', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Admin users get redirected to /coach (the admin dashboard)
  if (isAdmin) {
    return <Navigate to="/coach" replace />;
  }

  // Trainers and clients see their role-appropriate dashboard
  return <DashboardRouter />;
}
