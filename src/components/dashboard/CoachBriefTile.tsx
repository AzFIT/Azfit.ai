/* ═══════════════════════════════════════════════════════════════
   CoachBriefTile (Phase 60, Item 5) — rule-based daily brief in
   the Phase 60 Row B slot. Self-loading; dismissals persist for
   the DAY in localStorage (coachBrief.dismissed.YYYY-MM-DD — a
   deliberate daily reset, no schema needed; see PROGRESS).
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, X, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { weekWindow } from "@/lib/weeklyDigest";
import AIPanel from "./AIPanel";
import {
  buildCoachBrief,
  dataCompleteness,
  confidenceLevel,
  type BriefClientInput,
  type BriefSeverity,
} from "@/lib/coachBrief";

const SEVERITY_STYLE: Record<BriefSeverity, { color: string; bg: string; Icon: typeof AlertTriangle }> = {
  alert: { color: "var(--danger)", bg: "var(--danger-bg)", Icon: AlertTriangle },
  warning: { color: "var(--warning)", bg: "var(--light-elevated)", Icon: AlertTriangle },
  info: { color: "var(--ai-violet)", bg: "var(--light-elevated)", Icon: Info },
};

function dismissKey(): string {
  const d = new Date();
  return `coachBrief.dismissed.${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(dismissKey());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export default function CoachBriefTile({ sessionsToday }: { sessionsToday: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<BriefClientInput[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const thisWeek = weekWindow(0);
      const lastWeek = weekWindow(1);

      const { data: roster } = await supabase
        .from("clients")
        .select("id, full_name, email, created_at")
        .eq("trainer_id", user.id)
        .neq("status", "archived");
      if (cancelled || !roster) return;

      const clientIds = roster.map((c) => c.id);
      const emails = roster.map((c) => c.email);
      const [{ data: profiles }, { count: formCount }, { data: subs }, { data: logs }, { data: progs }, { data: packs }] =
        await Promise.all([
          supabase.from("profiles").select("id, email").in("email", emails),
          supabase.from("check_in_forms").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).eq("active", true),
          supabase.from("check_in_submissions").select("client_id").in("client_id", clientIds).gte("submitted_at", thisWeek.start.toISOString()),
          supabase
            .from("workout_logs")
            .select("client_id, completed_at")
            .in("client_id", clientIds)
            .not("completed_at", "is", null)
            .gte("completed_at", lastWeek.start.toISOString()),
          supabase.from("programs").select("client_id").in("client_id", clientIds).eq("status", "active"),
          supabase.from("session_packages").select("client_id, total_credits, created_at").in("client_id", clientIds),
        ]);
      if (cancelled) return;

      const profileIdByEmail = new Map((profiles || []).map((p) => [p.email, p.id]));
      const profileIds = [...new Set((profiles || []).map((p) => p.id))];
      // sessions for the credits derivative count (both id spaces, 50 pattern)
      const { data: creditSessions } =
        packs && packs.length > 0 && profileIds.length
          ? await supabase
              .from("sessions")
              .select("client_id, client_record_id, status, created_at")
              .or(`client_record_id.in.(${clientIds.join(",")}),client_id.in.(${profileIds.join(",")})`)
              .in("status", ["scheduled", "completed"])
          : { data: [] as { client_id: string | null; client_record_id: string | null; status: string; created_at: string }[] };
      if (cancelled) return;

      const hasForms = (formCount ?? 0) > 0;
      const submittedSet = new Set((subs || []).map((s) => s.client_id));
      const withProgram = new Set((progs || []).map((p) => p.client_id));
      const profileIdToClientId = new Map(roster.filter((c) => profileIdByEmail.get(c.email)).map((c) => [profileIdByEmail.get(c.email)!, c.id]));
      const now = Date.now();

      const creditsByClient = new Map<string, number>();
      for (const p of packs || []) {
        const since = p.created_at ? new Date(p.created_at).getTime() : 0;
        const used = (creditSessions || []).filter((s) => {
          const cid = s.client_record_id ?? (s.client_id ? profileIdToClientId.get(s.client_id) : undefined);
          const at = s.created_at ? new Date(s.created_at).getTime() : 0;
          return cid === p.client_id && at >= since;
        }).length;
        creditsByClient.set(p.client_id, (creditsByClient.get(p.client_id) ?? 0) + Math.max(0, p.total_credits - used));
      }

      const inputs: BriefClientInput[] = roster.map((c) => {
        const myLogs = (logs || []).filter((l) => l.client_id === c.id && l.completed_at != null);
        const thisCount = myLogs.filter((l) => new Date(l.completed_at as string) >= thisWeek.start).length;
        const lastCount = myLogs.length - thisCount;
        const latest = myLogs.reduce<number>((m, l) => Math.max(m, new Date(l.completed_at as string).getTime()), 0);
        return {
          id: c.id,
          name: c.full_name,
          checkinDue: hasForms && !submittedSet.has(c.id),
          workoutsThisWeek: thisCount,
          workoutsLastWeek: lastCount,
          daysSinceLastWorkout: latest ? Math.floor((now - latest) / 86400000) : null,
          hasActiveProgram: withProgram.has(c.id),
          creditsRemaining: creditsByClient.has(c.id) ? creditsByClient.get(c.id)! : null,
        };
      });
      if (!cancelled) setClients(inputs);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const items = useMemo(() => {
    if (!clients) return [];
    return buildCoachBrief({ sessionsToday, clients }).filter((i) => !dismissed.has(i.id));
  }, [clients, sessionsToday, dismissed]);

  const confidence = useMemo(() => {
    if (!clients) return null;
    const percent = dataCompleteness(clients);
    return { percent, level: confidenceLevel(percent) };
  }, [clients]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      localStorage.setItem(dismissKey(), JSON.stringify([...next]));
    } catch {
      /* storage full/blocked — dismissal simply won't persist */
    }
  };

  return (
    <AIPanel
      subtitle="Daily Brief"
      loading={clients === null}
      empty={clients !== null && items.length === 0}
      emptyMessage="All caught up — nothing needs your attention today."
      confidence={confidence ?? undefined}
    >
      <ul className="space-y-2">
        {items.map((item) => {
          const s = SEVERITY_STYLE[item.severity];
          return (
            <li
              key={item.id}
              className="flex items-start gap-2.5 rounded-[var(--radius-card)] border px-3 py-2.5"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: s.bg, color: s.color }}
              >
                <s.Icon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                  {item.title}
                </p>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  {item.detail}
                </p>
                <button
                  onClick={() => navigate(item.action.route)}
                  className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold"
                  style={{ color: "var(--azfit-primary)" }}
                >
                  {item.action.label}
                  <ChevronRight size={10} />
                </button>
              </div>
              <button
                onClick={() => dismiss(item.id)}
                aria-label={`Dismiss: ${item.title}`}
                className="shrink-0 rounded p-0.5 transition hover:opacity-70"
                style={{ color: "var(--light-text-muted)" }}
              >
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </AIPanel>
  );
}
