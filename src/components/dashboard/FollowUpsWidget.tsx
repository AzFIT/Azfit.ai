import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import {
  CalendarX,
  Ruler,
  FileSpreadsheet,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { profileGaps, profileGapReason } from "@/lib/trialIntake";
import { CollapsibleSection } from "./shared/CollapsibleSection";

/* ═══════════════════════════════════════════════════════════════════
   Follow-Ups (Phase 28C) — computed client-side from existing queries.
   Groups: no session in 5+ days • BioPrint overdue 30+ • no active program
   ═══════════════════════════════════════════════════════════════════ */

interface ClientRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  date_of_birth: string | null;
  fitness_goal: string | null;
}

interface FollowUpRow {
  clientId: string;
  name: string;
  detail: string;
  actionLabel: string;
  action: string; // navigation target
}

interface Groups {
  noSession: FollowUpRow[];
  bioprint: FollowUpRow[];
  noProgram: FollowUpRow[];
  profileIncomplete: FollowUpRow[];
}

const DAY_MS = 86400000;
const CAP = 3;

export default function FollowUpsWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Groups | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, full_name, email, status, created_at, weight_kg, height_cm, date_of_birth, fitness_goal")
        .eq("trainer_id", user.id)
        .neq("status", "archived")
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (!clients || clients.length === 0) {
        setGroups({ noSession: [], bioprint: [], noProgram: [], profileIncomplete: [] });
        return;
      }

      const clientIds = clients.map((c) => c.id);
      const emails = clients.map((c) => c.email);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("email", emails);
      const profileIdByEmail = new Map((profiles || []).map((p) => [p.email, p.id]));
      const profileIds = [...new Set((profiles || []).map((p) => p.id))];

      const [sessRes, assessRes, progRes] = await Promise.all([
        profileIds.length
          ? supabase
              .from("sessions")
              .select("client_id, ends_at, status")
              .in("client_id", profileIds)
              .neq("status", "cancelled")
              .order("ends_at", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] as { client_id: string; ends_at: string; status: string }[] }),
        supabase
          .from("skinfold_assessments")
          .select("client_id, recorded_at")
          .in("client_id", clientIds)
          .order("recorded_at", { ascending: false })
          .limit(500),
        supabase
          .from("programs")
          .select("client_id, status")
          .in("client_id", clientIds)
          .eq("status", "active"),
      ]);
      if (cancelled) return;

      const now = Date.now();

      // Last non-cancelled session end per profile id (rows are newest-first)
      const lastSessionEnd = new Map<string, string>();
      for (const s of (sessRes.data as { client_id: string; ends_at: string; status: string }[]) || []) {
        if (!lastSessionEnd.has(s.client_id)) lastSessionEnd.set(s.client_id, s.ends_at);
      }

      // Latest assessment per client id (newest-first)
      const lastAssessment = new Map<string, string>();
      for (const a of (assessRes.data as { client_id: string; recorded_at: string }[]) || []) {
        if (!lastAssessment.has(a.client_id)) lastAssessment.set(a.client_id, a.recorded_at);
      }

      const activeProgramClients = new Set(
        ((progRes.data as { client_id: string; status: string }[]) || []).map((p) => p.client_id),
      );

      const noSession: FollowUpRow[] = [];
      const bioprint: FollowUpRow[] = [];
      const noProgram: FollowUpRow[] = [];
      const profileIncomplete: FollowUpRow[] = [];

      for (const c of clients as ClientRow[]) {
        // ── No session in 5+ days (needs a linked profile to have sessions)
        const pid = profileIdByEmail.get(c.email);
        const lastEnd = pid ? lastSessionEnd.get(pid) : undefined;
        const daysSince = lastEnd ? Math.floor((now - new Date(lastEnd).getTime()) / DAY_MS) : null;
        if (daysSince === null || daysSince >= 5) {
          noSession.push({
            clientId: c.id,
            name: c.full_name,
            detail: daysSince === null ? "no sessions yet" : `last session ${daysSince}d ago`,
            actionLabel: "View",
            action: `/client/${c.id}`,
          });
        }

        // ── BioPrint overdue 30+ (or none AND client older than 30 days)
        const lastAssess = lastAssessment.get(c.id);
        const assessDays = lastAssess
          ? Math.floor((now - new Date(lastAssess).getTime()) / DAY_MS)
          : null;
        const clientAgeDays = Math.floor((now - new Date(c.created_at).getTime()) / DAY_MS);
        if ((assessDays !== null && assessDays >= 30) || (assessDays === null && clientAgeDays >= 30)) {
          bioprint.push({
            clientId: c.id,
            name: c.full_name,
            detail: assessDays !== null ? `last BioPrint ${assessDays}d ago` : "no BioPrint yet",
            actionLabel: "Enter BioPrint",
            action: `/client/${c.id}?tab=bio`,
          });
        }

        // ── No active program (active clients only)
        if (c.status === "active" && !activeProgramClients.has(c.id)) {
          noProgram.push({
            clientId: c.id,
            name: c.full_name,
            detail: "no active program",
            actionLabel: "Build",
            action: `/ai-program-builder?clientId=${c.id}`,
          });
        }

        // ── Phase 53: profile incomplete (missing body metrics / goal)
        const gaps = profileGaps(c);
        if (gaps.length) {
          profileIncomplete.push({
            clientId: c.id,
            name: c.full_name,
            detail: profileGapReason(gaps),
            actionLabel: "Complete",
            action: `/client/${c.id}?tab=overview`,
          });
        }
      }

      setGroups({
        noSession: noSession.slice(0, CAP),
        bioprint: bioprint.slice(0, CAP),
        noProgram: noProgram.slice(0, CAP),
        profileIncomplete: profileIncomplete.slice(0, CAP),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!groups) return null;
  const total = groups.noSession.length + groups.bioprint.length + groups.noProgram.length + groups.profileIncomplete.length;
  if (total === 0) return null; // render nothing when zero follow-ups

  const sections: {
    key: keyof Groups;
    title: string;
    color: string;
    Icon: typeof CalendarX;
    rows: FollowUpRow[];
  }[] = [
    { key: "noSession", title: "No session in 5+ days", color: "#F59E0B", Icon: CalendarX, rows: groups.noSession },
    { key: "bioprint", title: "BioPrint overdue (30+ days)", color: "#8B5CF6", Icon: Ruler, rows: groups.bioprint },
    { key: "noProgram", title: "No active program", color: "#00AEEF", Icon: FileSpreadsheet, rows: groups.noProgram },
    { key: "profileIncomplete", title: "Profile incomplete", color: "#F59E0B", Icon: AlertTriangle, rows: groups.profileIncomplete },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6"
    >
      <CollapsibleSection
        title="Follow-Ups"
        icon={<AlertTriangle className="h-4 w-4" />}
        defaultExpanded
        accentColor="#EF4444"
        badge={
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: "#EF4444" }}
          >
            {total}
          </span>
        }
        headerAction={
          <button
            onClick={() => navigate("/clients")}
            className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--azfit-primary)" }}
          >
            View all
            <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-4">
          {sections
            .filter((s) => s.rows.length > 0)
            .map((s) => (
              <div key={s.key}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <s.Icon size={13} style={{ color: s.color }} />
                  <p className="text-[11px] font-semibold" style={{ color: s.color }}>
                    {s.title}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {s.rows.map((r) => (
                    <div
                      key={`${s.key}-${r.clientId}`}
                      className="flex items-center justify-between rounded-xl border px-3 py-2"
                      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--page-text)" }}>
                          {r.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                          {r.detail}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(r.action)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90"
                        style={{ backgroundColor: `${s.color}20`, color: s.color }}
                      >
                        {r.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </CollapsibleSection>
    </motion.section>
  );
}
