// ═══════════════════════════════════════════════════════════════
// PlanSummaryIndex (Phase 89) — the "Plan Summary" nav destination.
//
// Route mapping (documented in PROGRESS.md): the plan-summary screen
// is per-client — it lives in ClientProfile as the "plansummary" tab
// (PlanSummaryTab, Phase 61), reachable at /clients/:id?tab=
// plansummary, with print at /clients/:id/plan-summary/print. There
// was no standalone route, so this page is a thin index over the
// trainer's existing roster: each row deep-links to that client's
// existing Plan Summary tab, with the latest summary's date shown
// when one exists (honest empty state when not).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, FileText, Inbox } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface RosterRow {
  id: string;
  full_name: string;
  status: string;
  latestSummaryAt: string | null;
}

export default function PlanSummaryIndexPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, status")
        .eq("trainer_id", user.id)
        .neq("status", "archived")
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (clientsError || !clients) {
        setError(true);
        setRows([]);
        return;
      }
      const ids = (clients as { id: string }[]).map((c) => c.id);
      const latestByClient = new Map<string, string>();
      if (ids.length > 0) {
        const { data: summaries } = await supabase
          .from("plan_summaries")
          .select("client_id, created_at")
          .in("client_id", ids);
        if (!cancelled && summaries) {
          for (const s of summaries as { client_id: string; created_at: string }[]) {
            const prev = latestByClient.get(s.client_id);
            if (!prev || s.created_at > prev) latestByClient.set(s.client_id, s.created_at);
          }
        }
      }
      if (cancelled) return;
      setRows(
        (clients as { id: string; full_name: string; status: string }[]).map((c) => ({
          ...c,
          latestSummaryAt: latestByClient.get(c.id) ?? null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-6">
        <h1 className="mb-1 text-xl font-bold" style={{ color: "var(--page-text)" }}>
          Plan Summary
        </h1>
        <p className="mb-4 text-sm" style={{ color: "var(--light-text-muted)" }}>
          Pick a client to view or build their Blueprint Plan Summary.
        </p>

        {rows === null ? (
          <div className="space-y-2" aria-label="Loading clients">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--light-text-muted)" }}
          >
            Could not load your roster. Try again in a moment.
          </div>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-xl p-8 text-center"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            <Inbox size={28} style={{ color: "var(--light-text-muted)" }} aria-hidden />
            <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
              No clients yet — add a client first, then build their plan summary from
              their profile.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Clients">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  onClick={() => navigate(`/client/${row.id}?tab=plansummary`)}
                  className="flex h-14 w-full items-center gap-3 rounded-xl px-4 text-left transition-all duration-150 active:scale-[0.99]"
                  style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
                >
                  <FileText size={18} className="shrink-0" style={{ color: "var(--azfit-primary)" }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" style={{ color: "var(--page-text)" }}>
                      {row.full_name}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--light-text-muted)" }}>
                      {row.latestSummaryAt
                        ? `Latest summary ${new Date(row.latestSummaryAt).toLocaleDateString()}`
                        : "No summary yet"}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0" style={{ color: "var(--light-text-muted)" }} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
