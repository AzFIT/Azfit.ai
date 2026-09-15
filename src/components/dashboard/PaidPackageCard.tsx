import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ticket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { remainingSessions, showExpiryWarning } from "@/lib/sessionBilling";
import { CollapsibleSection } from "./shared/CollapsibleSection";

/* ═══════════════════════════════════════════════════════════════════
   Paid package (Phase 96, client view) — the client's own PAID
   packages from the `packages` table (Phase 50's session_packages
   is the separate free-credit model — SessionsRemainingCard).
   Read-only; PRICE AMOUNTS ARE HIDDEN from clients this phase
   (owner decision — documented in PROGRESS.md). Honest absence:
   no packages → renders nothing.
   ═══════════════════════════════════════════════════════════════════ */

interface Pkg {
  id: string;
  name: string;
  total_sessions: number;
  sessions_used: number;
  expires_at: string | null;
  active: boolean;
}

export default function PaidPackageCard({ clientId }: { clientId: string }) {
  const [packages, setPackages] = useState<Pkg[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name, total_sessions, sessions_used, expires_at, active")
        .eq("client_id", clientId)
        .eq("active", true)
        .order("purchased_at", { ascending: false });
      if (!cancelled) setPackages((data as Pkg[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!packages || packages.length === 0) return null;

  const now = new Date();

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6"
    >
      <CollapsibleSection
        title="My Sessions Package"
        icon={<Ticket className="h-4 w-4" />}
        defaultExpanded
        accentColor="var(--azfit-primary)"
      >
        <ul className="space-y-2">
          {packages.map((p) => {
            const remaining = remainingSessions(p);
            const warn = showExpiryWarning(p, now);
            return (
              <li key={p.id} className="text-xs" style={{ color: "var(--light-text-muted)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                  {p.name}
                </span>
                {" — "}
                <strong style={{ color: "var(--page-text)" }}>{remaining}</strong> of{" "}
                {p.total_sessions} remaining
                {remaining === 0 && (
                  <span className="ml-1 font-medium" style={{ color: "var(--danger)" }}>
                    — package finished
                  </span>
                )}
                {warn && remaining > 0 && (
                  <span className="ml-1 font-medium" style={{ color: "var(--warning)" }}>
                    — expires soon
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CollapsibleSection>
    </motion.section>
  );
}
