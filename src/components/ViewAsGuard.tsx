import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { toast } from "sonner";
import { useViewAs } from "@/hooks/useViewAs";
import { isRouteBlockedInViewAs } from "@/lib/viewAs";

/* ═══════════════════════════════════════════════════════════════════
   ViewAsGuard (Phase 90e) — HONEST DATA guardrail. Account-level /
   trainer-own-data routes (settings, trainer profile, analytics, the
   trainer library, …) must never render while viewing as a client:
   instead of silently showing the TRAINER's data inside the client's
   view, the guard toasts "Not available in Client View" and redirects
   to /dashboard (which renders the target's dashboard while the
   override lasts).

   Wrap blocked route groups in App.tsx:
     <Route element={<ViewAsGuard />}>
       <Route path="/settings" … />
     </Route>
   (nest inside the ArrowsShell groups where the routes already live).
   ═══════════════════════════════════════════════════════════════════ */

export default function ViewAsGuard() {
  const location = useLocation();
  const { viewAs } = useViewAs();

  const blocked = viewAs !== null && isRouteBlockedInViewAs(location.pathname);

  useEffect(() => {
    if (blocked) toast("Not available in Client View");
  }, [blocked]);

  if (blocked) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
