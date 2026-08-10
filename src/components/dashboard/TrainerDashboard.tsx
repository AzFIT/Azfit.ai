import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Activity,
  Zap,
  Bell,
  UserPlus,
  AlertTriangle,
  ClipboardCheck,
  Mail,
  FileSpreadsheet,
  Megaphone,
  Dumbbell,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "./shared/GlassCard";
import { ClientHealthGrid } from "./ClientHealthGrid";
import FollowUpsWidget from "./FollowUpsWidget";
import NutritionCommandCenter from "./NutritionCommandCenter";
import { useClientHealth } from "./useClientHealth";
import { useSessions } from "@/hooks/useSessions";
import QuickAddClientModal from "@/components/QuickAddClientModal";
import { formatDateKeyLocal } from "@/lib/utils";
import { weekWindow } from "@/lib/weeklyDigest";
import {
  weeklyComplianceShare,
  weeklyVolumeByDay,
  wowDeltaPct,
  type VolumeEntryRow,
  type WeeklyVolume,
} from "@/lib/dashboardBento";
import TodayTimelineTile from "./bento/TodayTimelineTile";
import ComplianceHeroTile from "./bento/ComplianceHeroTile";
import ActiveClientsTile from "./bento/ActiveClientsTile";
import WeeklyVolumeTile from "./bento/WeeklyVolumeTile";
import DeltaChip from "./bento/DeltaChip";
import CoachBriefTile from "./CoachBriefTile";

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   Trainer Dashboard — Restructured (Phase 2)
   Answers: "Who needs my attention right now?"
   ═══════════════════════════════════════════════════════════════════ */

/* ── Animation Variants ──────────────────────────────────────────── */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

/* ── Types ───────────────────────────────────────────────────────── */
// SessionItem type replaced by useSessions Session type

/* ── Phase 33B: mock data removed — all dashboard numbers below are
      computed from real trainer-scoped queries (client stats effect and
      the weekly metrics memo in the component). The fabricated AI-insights
      feed and revenue card are REMOVED (no honest data source exists). ── */

/* ── Helper Components ─────────────────────────────────────────── */

// SessionTypeBadge removed — session type is displayed inline now

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function TrainerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { todaySessions, loading: sessionsLoading, sessions: allSessions } = useSessions();
  const [mounted, setMounted] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const { clients: healthClients, counts: attentionCounts, hasAttention } = useClientHealth();
  const firstName = (() => {
    const parts = (user?.full_name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "Marcus";
    // Skip a leading "Coach" honorific so the greeting doesn't read "Coach Coach"
    return parts[0] === "Coach" ? (parts[1] || "Marcus") : parts[0];
  })();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Phase 33B — real client stats for the Active Clients card.
  // "At risk" definition: active clients with no non-cancelled session in the
  // last 14 days (sessions key on profiles.id, resolved via email; account-less
  // clients count as never-having-trained).
  const [clientStats, setClientStats] = useState<{ active: number; newThisWeek: number; atRisk: number } | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const weekStart = formatDateKeyLocal(addDays(now, -((now.getDay() + 6) % 7)));
      const twoWeeksAgo = addDays(now, -14).toISOString();
      const [activeRes, newRes, activeClientsRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).eq("status", "active"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).neq("status", "archived").gte("created_at", weekStart),
        supabase.from("clients").select("email").eq("trainer_id", user.id).eq("status", "active"),
      ]);
      let atRisk = 0;
      const emails = (activeClientsRes.data || []).map((c) => c.email);
      if (emails.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, email").in("email", emails);
        const profileIds = (profiles || []).map((p) => p.id);
        let engaged = 0;
        if (profileIds.length > 0) {
          const { data: recent } = await supabase
            .from("sessions")
            .select("client_id")
            .in("client_id", profileIds)
            .gte("starts_at", twoWeeksAgo)
            .neq("status", "cancelled");
          engaged = new Set((recent || []).map((s) => s.client_id)).size;
        }
        atRisk = emails.length - engaged;
      }
      if (!cancelled) {
        setClientStats({ active: activeRes.count ?? 0, newThisWeek: newRes.count ?? 0, atRisk });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Phase 33B — weekly metrics computed from the real sessions list
  // (Mon–Sun of the current week; hours from starts_at→ends_at).
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    const weekStart = formatDateKeyLocal(monday);
    const weekEnd = formatDateKeyLocal(addDays(monday, 7));
    const inWeek = allSessions.filter((s) => {
      const d = (s.startsAt || "").slice(0, 10);
      return d >= weekStart && d < weekEnd;
    });
    const scheduled = inWeek.filter((s) => s.status !== "cancelled");
    const hours = scheduled.reduce(
      (sum, s) => sum + Math.max(0, (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600000),
      0
    );
    return {
      scheduled: scheduled.length,
      completed: inWeek.filter((s) => s.status === "completed").length,
      hours: Math.round(hours * 10) / 10,
      cancelled: inWeek.filter((s) => s.status === "cancelled").length,
      // Phase 59: session-completion share for the hero-tile WoW delta
      compliance: weeklyComplianceShare(inWeek),
    };
  }, [allSessions]);
  const weeklyMetrics = [
    { label: "Sessions This Week", value: String(weeklyStats.scheduled), change: `${weeklyStats.completed} completed`, positive: true, icon: Calendar },
    { label: "Scheduled Hours", value: `${weeklyStats.hours}h`, change: "this week", positive: true, icon: Clock },
    { label: "Completed", value: String(weeklyStats.completed), change: "this week", positive: true, icon: Zap },
    { label: "Cancelled", value: String(weeklyStats.cancelled), change: "this week", positive: weeklyStats.cancelled === 0, icon: Activity },
  ];

  /* ── Phase 59 bento data: last-week stats (for honest WoW deltas),
        new-this-month count, active client names, weekly volume ── */
  const [lastWeekStats, setLastWeekStats] = useState<{ scheduled: number; completed: number; hours: number; cancelled: number; compliance: number | null } | null>(null);
  const [newThisMonth, setNewThisMonth] = useState<number | null>(null);
  const [activeClientNames, setActiveClientNames] = useState<string[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolume | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const thisWeek = weekWindow(0, now);
      const lastWeek = weekWindow(1, now);
      const lwStart = lastWeek.start.toISOString();
      const lwEnd = lastWeek.end.toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [lwRes, monthRes, namesRes, clientsRes] = await Promise.all([
        supabase.from("sessions").select("status, starts_at, ends_at").eq("trainer_id", user.id).gte("starts_at", lwStart).lt("starts_at", lwEnd),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).neq("status", "archived").gte("created_at", monthStart),
        supabase.from("clients").select("full_name").eq("trainer_id", user.id).eq("status", "active").order("full_name"),
        supabase.from("clients").select("id").eq("trainer_id", user.id).neq("status", "archived"),
      ]);
      if (cancelled) return;

      const lw = (lwRes.data as { status: string; starts_at: string; ends_at: string }[] | null) ?? [];
      const lwNonCancelled = lw.filter((s) => s.status !== "cancelled");
      const lwHours = lwNonCancelled.reduce(
        (sum, s) => sum + Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000),
        0,
      );
      setLastWeekStats({
        scheduled: lwNonCancelled.length,
        completed: lw.filter((s) => s.status === "completed").length,
        hours: Math.round(lwHours * 10) / 10,
        cancelled: lw.filter((s) => s.status === "cancelled").length,
        compliance: weeklyComplianceShare(lw),
      });
      setNewThisMonth(monthRes.count ?? 0);
      setActiveClientNames(((namesRes.data as { full_name: string }[] | null) ?? []).map((c) => c.full_name));

      // Weekly volume: this week's completed logs for the trainer's clients → entries
      const clientIds = ((clientsRes.data as { id: string }[] | null) ?? []).map((c) => c.id);
      if (clientIds.length === 0) {
        setWeeklyVolume(weeklyVolumeByDay([]));
        setVolumeLoading(false);
        return;
      }
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id, completed_at")
        .in("client_id", clientIds)
        .not("completed_at", "is", null)
        .gte("completed_at", thisWeek.start.toISOString())
        .lt("completed_at", thisWeek.end.toISOString());
      if (cancelled) return;
      const logRows = (logs as { id: string; completed_at: string }[] | null) ?? [];
      if (logRows.length === 0) {
        setWeeklyVolume(weeklyVolumeByDay([]));
        setVolumeLoading(false);
        return;
      }
      const completedByLogId = new Map(logRows.map((l) => [l.id, l.completed_at]));
      const { data: entries } = await supabase
        .from("workout_log_entries")
        .select("workout_log_id, weight_per_set, reps_per_set")
        .in("workout_log_id", logRows.map((l) => l.id));
      if (cancelled) return;
      const rows: VolumeEntryRow[] = (((entries as { workout_log_id: string; weight_per_set: number[] | null; reps_per_set: number[] | null }[] | null) ?? [])
        .map((e) => ({
          completed_at: completedByLogId.get(e.workout_log_id) ?? "",
          weight_per_set: e.weight_per_set,
          reps_per_set: e.reps_per_set,
        }))
        .filter((r) => r.completed_at));
      setWeeklyVolume(weeklyVolumeByDay(rows));
      setVolumeLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Real today's sessions from useSessions
  const todaysSessionList = todaySessions();

  /* ── Today at a Glance extras: holidays covering today, today's
        reminders, and on-holiday clients returning within 7 days ──── */
  const [returning, setReturning] = useState<{ id: string; name: string; endDate: string }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: hc } = await supabase
        .from("clients")
        .select("id, full_name, email")
        .eq("trainer_id", user.id)
        .eq("status", "on_holiday");
      const out: { id: string; name: string; endDate: string }[] = [];
      const todayStr = formatDateKeyLocal(new Date());
      const in7 = formatDateKeyLocal(addDays(new Date(), 7));
      for (const c of hc || []) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", c.email)
          .maybeSingle();
        // Phase 35: match holiday sessions by profiles.id OR clients.id
        const latestEnd = allSessions
          .filter(
            (s) =>
              s.type === "holiday" &&
              s.status !== "cancelled" &&
              ((prof && s.clientId === prof.id) || s.clientRecordId === c.id)
          )
          .map((s) => s.endsAt.split("T")[0])
          .sort()
          .pop();
        if (latestEnd && latestEnd >= todayStr && latestEnd <= in7) {
          out.push({ id: c.id, name: c.full_name, endDate: latestEnd });
        }
      }
      if (!cancelled) setReturning(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, allSessions]);

  const todayStr = formatDateKeyLocal(new Date());
  const holidaysToday = allSessions.filter(
    (s) =>
      s.type === "holiday" &&
      s.status !== "cancelled" &&
      todayStr >= s.startsAt.split("T")[0] &&
      todayStr <= s.endsAt.split("T")[0],
  );
  const remindersToday = allSessions.filter(
    (s) => s.type === "reminder" && s.status !== "cancelled" && s.startsAt.split("T")[0] === todayStr,
  );

  // Mixed glance items, sorted by time
  type GlanceItem = {
    kind: "session" | "holiday" | "reminder" | "returning";
    id: string;
    title: string;
    clientName: string;
    clientId: string | null;
    timeLabel: string;
    sortKey: string;
    session?: (typeof todaysSessionList)[number];
  };
  const glanceItems: GlanceItem[] = [
    ...todaysSessionList.map((s) => ({
      kind: "session" as const,
      id: s.id,
      title: s.title,
      clientName: s.clientName || "Unknown",
      clientId: null,
      timeLabel: new Date(s.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sortKey: s.startsAt,
      session: s,
    })),
    ...holidaysToday.map((s) => ({
      kind: "holiday" as const,
      id: s.id,
      title: "Holiday",
      clientName: s.clientName || "Unknown",
      clientId: null,
      timeLabel: "all day",
      sortKey: s.startsAt,
    })),
    ...remindersToday.map((s) => ({
      kind: "reminder" as const,
      id: s.id,
      title: s.title,
      clientName: s.clientName || "Unknown",
      clientId: null,
      timeLabel: new Date(s.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sortKey: s.startsAt,
    })),
    ...returning.map((r) => ({
      kind: "returning" as const,
      id: r.id,
      title: "Returning from holiday",
      clientName: r.name,
      clientId: r.id,
      timeLabel: r.endDate === todayStr ? "today" : `by ${r.endDate.slice(5).replace("-", "/")}`,
      sortKey: r.endDate,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  /* ── Phase 59 bento derivations ── */
  const onTrackCount = healthClients.filter((c) => c.status === "on_track").length;
  const compliancePctNow = healthClients.length > 0 ? Math.round((onTrackCount / healthClients.length) * 100) : null;
  // WoW delta in percentage POINTS on the session-completion share (both
  // weeks real); null when either week has no sessions → no chip
  const complianceDelta =
    weeklyStats.compliance != null && lastWeekStats?.compliance != null
      ? weeklyStats.compliance - lastWeekStats.compliance
      : null;
  const checkinDueNames = new Set(
    healthClients.filter((c) => (c.checkInsDue ?? 0) > 0 || c.reason === "check-in due").map((c) => c.name),
  );
  const timelineExtras = glanceItems.filter(
    (i): i is GlanceItem & { kind: "holiday" | "reminder" | "returning" } => i.kind !== "session",
  );
  const statDelta = (label: string): number | null => {
    const lw = lastWeekStats;
    if (label === "Sessions This Week") return wowDeltaPct(weeklyStats.scheduled, lw?.scheduled);
    if (label === "Scheduled Hours") return wowDeltaPct(weeklyStats.hours, lw?.hours);
    if (label === "Completed") return wowDeltaPct(weeklyStats.completed, lw?.completed);
    return wowDeltaPct(weeklyStats.cancelled, lw?.cancelled);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-20 lg:px-6 lg:pb-8">
      {/* ═══════════════════════════════════════════════════════════
          HEADER: Greeting + Notification Bell + Add Client
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight lg:text-3xl"
              style={{ color: "var(--page-text)" }}
            >
              {greeting()}, Coach {firstName}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--light-text-muted)" }}>
              Here&apos;s who needs your attention today
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 sm:mt-0">
            {/* Notification Bell */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/notifications")}
              className="relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--page-text)",
              }}
            >
              <Bell className="h-4 w-4" />
              {attentionCounts.unreadMessages > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: "#F87171" }}
                >
                  {attentionCounts.unreadMessages}
                </span>
              )}
            </motion.button>
            {/* Add Client — primary action */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddClientModal(true)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--azfit-primary)" }}
            >
              <UserPlus className="h-4 w-4" />
              Add Client
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          NEEDS ATTENTION STRIP (conditional)
          ═══════════════════════════════════════════════════════════ */}
      {hasAttention && (
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {/* Missed Workouts */}
          {attentionCounts.missedWorkouts > 0 && (
            <motion.div variants={fadeInUp}>
              <button
                onClick={() => navigate("/clients")}
                className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: "rgba(248,113,113,0.06)",
                  borderColor: "rgba(248,113,113,0.25)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(248,113,113,0.12)" }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: "#F87171" }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "#F87171" }}>
                    {attentionCounts.missedWorkouts}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    clients missed workouts this week
                  </p>
                </div>
              </button>
            </motion.div>
          )}

          {/* Check-ins Pending */}
          {attentionCounts.checkinsPending > 0 && (
            <motion.div variants={fadeInUp}>
              <button
                onClick={() => navigate("/check-ins")}
                className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: "rgba(245,158,11,0.06)",
                  borderColor: "rgba(245,158,11,0.25)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(245,158,11,0.12)" }}
                >
                  <ClipboardCheck className="h-5 w-5" style={{ color: "#F59E0B" }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "#F59E0B" }}>
                    {attentionCounts.checkinsPending}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    check-ins awaiting review
                  </p>
                </div>
              </button>
            </motion.div>
          )}

          {/* Unread Messages */}
          {attentionCounts.unreadMessages > 0 && (
            <motion.div variants={fadeInUp}>
              <button
                onClick={() => navigate("/messages")}
                className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: "rgba(6,182,212,0.06)",
                  borderColor: "rgba(6,182,212,0.25)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(6,182,212,0.12)" }}
                >
                  <Mail className="h-5 w-5" style={{ color: "#06B6D4" }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "#06B6D4" }}>
                    {attentionCounts.unreadMessages}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    unread messages
                  </p>
                </div>
              </button>
            </motion.div>
          )}
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          BENTO COMMAND CENTER (Phase 59)
          Row A: Today timeline 2fr · Compliance hero 1fr · Active Clients 1fr
          Row B: Weekly Volume 1fr · [NCC + Coach AI Daily Brief] 2fr column
                 (Phase 60 filled the slot by stacking the brief under the
                 NCC — structure unchanged at every breakpoint)
          Row C: 4 stat tiles with honest WoW delta chips
          (Client Health Grid + Follow-Ups follow as full-width rows)
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6 space-y-4"
      >
        {/* Row A */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <motion.div variants={fadeInUp} className="md:col-span-2 lg:col-span-1">
            <TodayTimelineTile
              sessions={todaysSessionList}
              extras={timelineExtras}
              loading={sessionsLoading}
              checkinDueNames={checkinDueNames}
              onOpenSchedule={() => navigate("/schedule")}
              onClientClick={(id) => navigate(`/client/${id}`)}
            />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <ComplianceHeroTile
              pct={compliancePctNow}
              onTrack={onTrackCount}
              total={healthClients.length}
              deltaPct={complianceDelta}
              onClick={() => navigate("/analytics")}
            />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <ActiveClientsTile
              active={clientStats?.active ?? null}
              newThisMonth={newThisMonth}
              atRisk={clientStats?.atRisk ?? null}
              names={activeClientNames}
              onClick={() => navigate("/clients")}
            />
          </motion.div>
        </div>

        {/* Row B — Phase 60: the Coach AI brief stacks under the NCC in the
            2fr column (a third grid cell would crowd the row; the column
            keeps the 59 structure intact at every breakpoint) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_2fr]">
          <motion.div variants={fadeInUp}>
            <WeeklyVolumeTile volume={weeklyVolume} loading={volumeLoading} />
          </motion.div>
          <motion.div variants={fadeInUp} className="space-y-4">
            <NutritionCommandCenter />
            <CoachBriefTile sessionsToday={todaysSessionList.length} />
          </motion.div>
        </div>

        {/* Row C — stat tiles with honest WoW delta chips (no basis → no chip) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {weeklyMetrics.map((metric) => (
            <motion.div key={metric.label} variants={fadeInUp}>
              <GlassCard glass hover padding="p-4" className="relative overflow-hidden">
                <div className="relative">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--light-elevated)" }}
                    >
                      <metric.icon className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />
                    </div>
                    <span
                      className="text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: "var(--light-text-muted)" }}
                    >
                      {metric.label}
                    </span>
                  </div>
                  <p className="stat-numeral text-2xl" style={{ color: "var(--page-text)" }}>
                    {metric.value}
                  </p>
                  <div className="mt-1 min-h-[18px]">
                    <DeltaChip pct={statDelta(metric.label)} invert={metric.label === "Cancelled"} />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════
          CLIENT HEALTH GRID
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <ClientHealthGrid
          clients={healthClients}
          onClientClick={(clientId) => navigate(`/client/${clientId}`)}
          onSendMessage={() => navigate("/messages")}
        />
      </motion.section>

      {/* FOLLOW-UPS (no session 5d+, BioPrint overdue, no active program) */}
      <FollowUpsWidget />

      {/* Phase 33B: the fabricated AI-insights feed and revenue snapshot were
          removed — no honest data source exists for either. FollowUpsWidget
          above carries the real attention data. */}

      {/* ═══════════════════════════════════════════════════════════
          QUICK ACTIONS — 6 compact buttons
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <h3
          className="mb-3 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--light-text-muted)" }}
        >
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: "Add Client",
              icon: UserPlus,
              color: "#0D9488",
              onClick: () => setShowAddClientModal(true),
            },
            {
              label: "Build Program",
              icon: Dumbbell,
              color: "#8B5CF6",
              onClick: () => navigate("/ai-program-builder"),
            },
            {
              label: "Log Assessment",
              icon: Scale,
              color: "#F59E0B",
              onClick: () => navigate("/bioprint"),
            },
            {
              label: "Export",
              icon: FileSpreadsheet,
              color: "#84CC16",
              onClick: () => navigate("/export"),
            },
            {
              label: "Broadcast",
              icon: Megaphone,
              color: "#F87171",
              onClick: () => navigate("/messages"),
            },
          ].map((action) => (
            <motion.button
              key={action.label}
              variants={scaleIn}
              whileTap={{ scale: 0.95 }}
              onClick={action.onClick}
              className="flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${action.color}15` }}
              >
                <action.icon className="h-5 w-5" style={{ color: action.color }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: "var(--page-text)" }}>
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* Phase 57: the placeholder "Weekly Schedule Overview / Phase A4" card
          was removed — the real Schedule page already covers this. */}
      {/* ═══════════════════════════════════════════════════════════
          QUICK ADD CLIENT MODAL
          ═══════════════════════════════════════════════════════════ */}
      <QuickAddClientModal
        open={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
      />
    </div>
  );
}
