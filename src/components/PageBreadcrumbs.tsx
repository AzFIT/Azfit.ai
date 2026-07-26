import { useNavigate, useLocation } from "react-router";
import { Home } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbSegment {
  label: string;
  path?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   PageBreadcrumbs — Shows navigation trail for nested pages only
   
   Rules:
   - Only shown on nested pages (depth >= 2)
   - Hidden on mobile except client profile pages
   - Uses shadcn breadcrumb component
   - Home icon links to dashboard (or / for non-authed)
   ═══════════════════════════════════════════════════════════════════ */

// Tab labels for Coach page
const COACH_TAB_LABELS: Record<string, string> = {
  clients: "Clients",
  programs: "Programs",
  analytics: "Analytics",
  messages: "Messages",
  settings: "Settings",
};

export default function PageBreadcrumbs() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  // Determine if we should show breadcrumbs
  const isClientProfile = pathname.startsWith("/client/");
  const isCoachPage = pathname === "/coach";
  const isProgramBuilder = pathname === "/ai-program-builder";

  const isMobile = useIsMobile();

  // Only show on nested pages
  const shouldShow = isClientProfile || isCoachPage || isProgramBuilder;
  if (!shouldShow) return null;

  // Hide on mobile except client profile
  if (isMobile && !isClientProfile) return null;

  // Build segments
  const segments: BreadcrumbSegment[] = [];

  if (isClientProfile) {
    segments.push({ label: "Clients", path: "/clients" });
    segments.push({ label: "Client Profile" });
  } else if (isProgramBuilder) {
    segments.push({ label: "Coach", path: "/coach" });
    segments.push({ label: "Program Builder" });
  } else if (isCoachPage) {
    segments.push({ label: "Coach" });
    // Check for active tab in URL query
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab && COACH_TAB_LABELS[tab]) {
      segments.push({ label: COACH_TAB_LABELS[tab] });
    }
  }

  if (segments.length === 0) return null;

  return (
    <Breadcrumb
      className="px-4 py-2 lg:px-6"
      style={{
        backgroundColor: "var(--page-bg)",
        borderBottom: "1px solid var(--card-border)",
      }}
    >
      <BreadcrumbList>
        {/* Home */}
        <BreadcrumbItem>
          <BreadcrumbLink
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 cursor-pointer"
            style={{ color: "var(--azfit-primary)" }}
          >
            <Home size={14} />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {/* Segments */}
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <BreadcrumbItem key={segment.label}>
              {isLast || !segment.path ? (
                <BreadcrumbPage
                  style={{
                    color: isLast
                      ? "var(--page-text)"
                      : "var(--light-text-muted)",
                  }}
                >
                  {segment.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  onClick={() => segment.path && navigate(segment.path)}
                  className="cursor-pointer"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {segment.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
