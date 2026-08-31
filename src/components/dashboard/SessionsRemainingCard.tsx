import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ticket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { remainingCredits } from "@/lib/creditsAvailability";
import { CollapsibleSection } from "./shared/CollapsibleSection";

/* ═══════════════════════════════════════════════════════════════════
   Sessions remaining (Phase 50, Item 1) — client dashboard card.
   Shows only when the client HAS packages (honest absence otherwise).
   Remaining is derivative (no stored counter).
   ═══════════════════════════════════════════════════════════════════ */

export default function SessionsRemainingCard({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ remaining: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: pkgs } = await supabase
        .from("session_packages")
        .select("id, total_credits, created_at")
        .eq("client_id", clientId);
      if (!pkgs || pkgs.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: sess } = await supabase
        .from("sessions")
        .select("status, created_at")
        .eq("client_record_id", clientId)
        .in("status", ["scheduled", "completed"]);
      if (!cancelled) {
        setState({
          remaining: remainingCredits(pkgs, sess || []),
          total: pkgs.reduce((s, p) => s + p.total_credits, 0),
        });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading || !state) return null; // no packages → render nothing

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6"
    >
      <CollapsibleSection
        title="Session Package"
        icon={<Ticket className="h-4 w-4" />}
        defaultExpanded
        accentColor="var(--azfit-accent)"
        badge={
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: state.remaining <= 1 ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)",
              color: state.remaining <= 1 ? "var(--danger)" : "var(--azfit-accent)",
            }}
          >
            {state.remaining} left
          </span>
        }
      >
        <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
          Sessions remaining:{" "}
          <strong className="text-sm" style={{ color: "var(--page-text)" }}>
            {state.remaining}
          </strong>{" "}
          of {state.total}
          {state.remaining <= 1 && (
            <span className="ml-2 font-medium" style={{ color: "var(--warning)" }}>
              — time to renew
            </span>
          )}
        </p>
      </CollapsibleSection>
    </motion.section>
  );
}
