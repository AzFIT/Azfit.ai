import { useNavigate } from "react-router";
import { Undo2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useViewAs } from "@/hooks/useViewAs";

/* ═══════════════════════════════════════════════════════════════════
   ViewAsBanner (Phase 90e) — persistent in-flow strip that rides
   EVERY screen while a trainer views a client's dashboard. Brand cyan
   accent (var(--azfit-primary)); NOT fixed/sticky — it sits in the
   document flow between the nav chrome and the page content so it
   never overlaps sticky page headers. Renders null when no override
   is active (role guard) — blocked routes redirect away via
   ViewAsGuard anyway.

   Logout safety note: while the override is active the account menus
   in Layout replace their logout entry with "Back to Coach View"
   (same action as this button) — signing out mid-override would drop
   the trainer into a logged-out page with the override still staged.
   ═══════════════════════════════════════════════════════════════════ */

export default function ViewAsBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { viewAs, endViewAs } = useViewAs();

  if (!viewAs) return null;

  const trainerName = user?.full_name || "your coach account";

  const backToCoachView = () => {
    const clientId = viewAs.clientId;
    endViewAs();
    navigate(`/client/${clientId}`);
  };

  return (
    <div
      data-testid="view-as-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 lg:px-6"
      style={{
        backgroundColor: "color-mix(in srgb, var(--azfit-primary) 8%, var(--page-bg))",
        borderColor: "color-mix(in srgb, var(--azfit-primary) 35%, transparent)",
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--azfit-primary)" }}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-xs" style={{ color: "var(--page-text)" }}>
        Viewing as <strong>{viewAs.name}</strong>
        <span style={{ color: "var(--light-text-muted)" }}>
          {" "}
          — you&apos;re logged in as {trainerName}
        </span>
      </p>
      <button
        type="button"
        onClick={backToCoachView}
        className="flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{
          borderColor: "var(--azfit-primary)",
          color: "var(--azfit-primary)",
          backgroundColor: "transparent",
        }}
      >
        <Undo2 size={12} />
        Back to Coach View
      </button>
    </div>
  );
}
