import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
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
  Sun,
  PartyPopper,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "./shared/GlassCard";
import PulseRing from "@/components/ui/PulseRing";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import { ClientHealthGrid } from "./ClientHealthGrid";
import FollowUpsWidget from "./FollowUpsWidget";
import NutritionCommandCenter from "./NutritionCommandCenter";
import { useClientHealth } from "./useClientHealth";
import { useSessions } from "@/hooks/useSessions";
import QuickAddClientModal from "@/components/QuickAddClientModal";
import { formatDateKeyLocal } from "@/lib/utils";

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
    };
  }, [allSessions]);
  const weeklyMetrics = [
    { label: "Sessions This Week", value: String(weeklyStats.scheduled), change: `${weeklyStats.completed} completed`, positive: true, icon: Calendar },
    { label: "Scheduled Hours", value: `${weeklyStats.hours}h`, change: "this week", positive: true, icon: Clock },
    { label: "Completed", value: String(weeklyStats.completed), change: "this week", positive: true, icon: Zap },
    { label: "Cancelled", value: String(weeklyStats.cancelled), change: "this week", positive: weeklyStats.cancelled === 0, icon: Activity },
  ];

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
          TODAY AT A GLANCE (sessions + holidays + reminders + returning)
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <CollapsibleSection
          title="Today at a Glance"
          icon={<Calendar className="h-4 w-4" />}
          defaultExpanded
          accentColor="#0D9488"
          badge={
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: "#0D9488" }}
            >
              {glanceItems.length}
            </span>
          }
          headerAction={
            <button
              onClick={() => navigate("/schedule")}
              className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--azfit-primary)" }}
            >
              Open Full Calendar
              <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="space-y-3">
            {sessionsLoading && glanceItems.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border p-3 animate-pulse"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-slate-700" />
                      <div className="h-3 w-24 rounded bg-slate-700" />
                    </div>
                  </div>
                ))}
              </div>
            ) : glanceItems.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
                  Nothing scheduled today — enjoy the calm.
                </p>
                <button
                  onClick={() => navigate("/schedule")}
                  className="mt-2 text-[11px] font-medium"
                  style={{ color: "var(--azfit-primary)" }}
                >
                  Open Full Calendar →
                </button>
              </div>
            ) : (
              glanceItems.map((item, i) => {
                if (item.kind === "session" && item.session) {
                  const session = item.session;
                  const start = new Date(session.startsAt);
                  const end = new Date(session.endsAt);
                  const timeStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  const durationMin = (end.getTime() - start.getTime()) / 60000;
                  const durationStr = durationMin >= 60
                    ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                    : `${durationMin}m`;
                  const statusColor =
                    session.status === "completed"
                      ? "#84CC16"
                      : session.status === "scheduled"
                        ? "#0D9488"
                        : session.status === "cancelled"
                          ? "#F87171"
                          : "#64748B";

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.3 }}
                      className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5"
                      style={{
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      {/* Status + Time */}
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: statusColor,
                            boxShadow: session.status === "scheduled" ? `0 0 8px ${statusColor}` : "none",
                          }}
                        />
                        <span
                          className="text-[10px] font-mono font-medium"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          {timeStr}
                        </span>
                      </div>

                      {/* Client Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--page-text)" }}
                          >
                            {session.clientName || "Unknown"}
                          </p>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              backgroundColor: "rgba(13,148,136,0.15)",
                              color: "#0D9488",
                            }}
                          >
                            {session.type}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                          {durationStr} • {session.title}
                        </p>
                      </div>

                      {/* Status label */}
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: statusColor }}
                      >
                        {session.status}
                      </span>

                      <ChevronRight
                        className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: "var(--light-text-muted)" }}
                      />
                    </motion.div>
                  );
                }

                // holiday / reminder / returning — left color-bar style
                const cfg =
                  item.kind === "holiday"
                    ? { color: "#F59E0B", Icon: Sun, action: null as string | null, actionLabel: "View" }
                    : item.kind === "reminder"
                      ? { color: "#00AEEF", Icon: Bell, action: null as string | null, actionLabel: "View" }
                      : { color: "#22C55E", Icon: PartyPopper, action: "welcome", actionLabel: "Welcome back" };

                return (
                  <motion.div
                    key={`${item.kind}-${item.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                      borderLeft: `3px solid ${cfg.color}`,
                    }}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${cfg.color}20` }}
                    >
                      <cfg.Icon size={15} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--page-text)" }}>
                        {item.title}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                        {item.clientName} • {item.timeLabel}
                      </p>
                    </div>
                    {item.clientId && (
                      <button
                        onClick={() => navigate(`/client/${item.clientId}`)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90"
                        style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                      >
                        {cfg.actionLabel}
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </CollapsibleSection>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          BUSINESS AT A GLANCE (Compliance + Active Clients — Phase 33B)
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 mb-6"
      >
        {/* Phase 33B: the hardcoded Revenue ring was removed — no revenue
            data source exists in the schema. */}
        {/* Client Compliance Ring (real health statuses, Phase 33B) */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Client Compliance"
            titleIcon={<Users className="h-4 w-4" />}
            headerAction={
              <span className="text-[11px] font-medium" style={{ color: "#84CC16" }}>
                {healthClients.filter((c) => c.status === "on_track").length}/{healthClients.length} on track
              </span>
            }
            glass
            glow
            accentColor="#06B6D4"
            hover
            onClick={() => navigate("/analytics")}
          >
            <div className="flex items-center justify-center py-4">
              <PulseRing
                size={160}
                strokeWidth={12}
                percent={healthClients.length > 0 ? Math.round((healthClients.filter((c) => c.status === "on_track").length / healthClients.length) * 100) : 0}
                centerLabel={`${healthClients.length > 0 ? Math.round((healthClients.filter((c) => c.status === "on_track").length / healthClients.length) * 100) : 0}%`}
                subLabel="compliance this week"
                ariaLabel="Client compliance this week"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "#84CC16" }}>{healthClients.filter((c) => c.status === "on_track").length}</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  On Track
                </p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "#F59E0B" }}>{healthClients.filter((c) => c.status === "needs_attention").length}</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  At Risk
                </p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "#F87171" }}>{healthClients.filter((c) => c.status === "at_risk").length}</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Off Track
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Active Clients (real count, Phase 33B) */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Active Clients"
            titleIcon={<Users className="h-4 w-4" />}
            glass
            hover
            accentColor="#8B5CF6"
            onClick={() => navigate("/clients")}
          >
            <div className="flex flex-col items-center justify-center py-6">
              <p className="text-5xl font-bold font-mono" style={{ color: "var(--page-text)" }}>
                {clientStats?.active ?? "—"}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                active clients
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  {clientStats?.newThisWeek ?? "—"}
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  New this week
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  {clientStats?.atRisk ?? "—"}
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  At risk of churn
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════
          WEEKLY SUMMARY METRICS
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6"
      >
        {weeklyMetrics.map((metric) => (
          <motion.div key={metric.label} variants={fadeInUp}>
            <GlassCard
              glass
              hover
              padding="p-4"
              className="relative overflow-hidden"
            >
              <div
                className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-2xl"
                style={{ backgroundColor: metric.positive ? "#0D9488" : "#F87171" }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: metric.positive
                        ? "rgba(13,148,136,0.12)"
                        : "rgba(248,113,113,0.12)",
                    }}
                  >
                    <metric.icon
                      className="h-4 w-4"
                      style={{ color: metric.positive ? "#0D9488" : "#F87171" }}
                    />
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
                <div className="mt-1 flex items-center gap-1">
                  <TrendingUp
                    className="h-3 w-3"
                    style={{ color: metric.positive ? "#84CC16" : "#F87171" }}
                  />
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: metric.positive ? "#84CC16" : "#F87171" }}
                  >
                    {metric.change}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    vs last week
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
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

      {/* NUTRITION COMMAND CENTER (Phase 37) — per-client targets/plan/adherence */}
      <NutritionCommandCenter />

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
