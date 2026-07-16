import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  BarChart3,
  MoreHorizontal,
  Bell,
  UserPlus,
  AlertTriangle,
  ClipboardCheck,
  Mail,
  FileSpreadsheet,
  Megaphone,
  Wand2,
  Dumbbell,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { GlassCard } from "./shared/GlassCard";
import { ProgressRing } from "./shared/ProgressRing";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import { ClientHealthGrid } from "./ClientHealthGrid";
import { AIInsightsPanel } from "./AIInsightsPanel";
import { RevenueSnapshot } from "./RevenueSnapshot";
import QuickAddClientModal from "@/components/QuickAddClientModal";
import type { ClientHealthItem, AIInsight, RevenueSnapshotData } from "./types";

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
interface SessionItem {
  id: string;
  clientName: string;
  clientAvatar?: string;
  time: string;
  duration: string;
  type: "strength" | "cardio" | "recovery" | "assessment";
  status: "completed" | "in-progress" | "upcoming" | "cancelled";
}

/* ── Mock Data ───────────────────────────────────────────────────── */
// TODO: wire to Supabase
const MOCK_SESSIONS: SessionItem[] = [
  { id: "s1", clientName: "Sarah Chen", time: "7:00 AM", duration: "60 min", type: "strength", status: "completed" },
  { id: "s2", clientName: "Marcus Johnson", time: "9:00 AM", duration: "45 min", type: "cardio", status: "in-progress" },
  { id: "s3", clientName: "Alex Rivera", time: "11:00 AM", duration: "75 min", type: "strength", status: "upcoming" },
  { id: "s4", clientName: "Emma Wilson", time: "2:00 PM", duration: "30 min", type: "assessment", status: "upcoming" },
  { id: "s5", clientName: "David Kim", time: "4:00 PM", duration: "60 min", type: "recovery", status: "upcoming" },
];

// TODO: wire to Supabase — attention counts
const MOCK_ATTENTION = {
  missedWorkouts: 3,
  checkinsPending: 5,
  unreadMessages: 8,
};

// TODO: wire to Supabase — active clients count
const MOCK_ACTIVE_CLIENTS = {
  count: 24,
  trend: "+2" as string,
  trendPositive: true,
};

const MOCK_HEALTH_GRID: ClientHealthItem[] = [
  { id: "h1", name: "Sarah Chen", initials: "SC", status: "on_track" },
  { id: "h2", name: "Marcus Johnson", initials: "MJ", status: "on_track" },
  { id: "h3", name: "Alex Rivera", initials: "AR", status: "at_risk", missedSessions: 2, lastActiveDays: 4 },
  { id: "h4", name: "Emma Wilson", initials: "EW", status: "on_track" },
  { id: "h5", name: "David Kim", initials: "DK", status: "needs_attention", weightStalledWeeks: 3, lastActiveDays: 1 },
  { id: "h6", name: "Lisa Lau", initials: "LL", status: "on_track" },
  { id: "h7", name: "Jason Chan", initials: "JC", status: "deload" },
  { id: "h8", name: "Tom Wong", initials: "TW", status: "on_track" },
  { id: "h9", name: "Jenny Lee", initials: "JL", status: "on_track" },
  { id: "h10", name: "Kevin Ho", initials: "KH", status: "needs_attention", hrvChange: -8, lastActiveDays: 2 },
];

const MOCK_AI_INSIGHTS: AIInsight[] = [
  {
    id: "ai1",
    severity: "danger",
    clientName: "Alex Rivera",
    clientId: "c3",
    title: "Missed 2 sessions — recommend check-in",
    description: "Alex hasn't logged a workout in 4 days. His HRV is down 12% according to his Apple Health sync.",
    suggestedAction: "Send Check-in",
    timestamp: "2h ago",
  },
  {
    id: "ai2",
    severity: "warning",
    clientName: "David Kim",
    clientId: "c5",
    title: "Weight stalled for 3 weeks",
    description: "David's weight has been flat at 78.2kg for 3 consecutive weeks. Consider adjusting his calorie target.",
    suggestedAction: "Adjust Plan",
    timestamp: "5h ago",
  },
  {
    id: "ai3",
    severity: "info",
    clientName: "Emma Wilson",
    clientId: "c4",
    title: "New PR on bench press",
    description: "Emma hit 62.5kg x 5 on bench press yesterday. Should we auto-progress her program?",
    suggestedAction: "Progress Program",
    timestamp: "1d ago",
  },
];

const MOCK_REVENUE: RevenueSnapshotData = {
  thisMonth: 24500,
  lastMonth: 22800,
  currency: "HK$",
  activeClients: 24,
  clientLimit: 30,
  avgPerClient: 1021,
};

const WEEKLY_METRICS = [
  { label: "Total Volume", value: "142,500 kg", change: "+12%", positive: true, icon: BarChart3 },
  { label: "Avg RPE", value: "7.8", change: "-0.3", positive: true, icon: Activity },
  { label: "Session Hours", value: "28.5h", change: "+2.5h", positive: true, icon: Clock },
  { label: "Client PRs", value: "8", change: "+3", positive: true, icon: Zap },
];

/* ── Helper Components ─────────────────────────────────────────── */

function StatusDot({ status }: { status: SessionItem["status"] }) {
  const colors = {
    completed: "#84CC16",
    "in-progress": "#0D9488",
    upcoming: "#64748B",
    cancelled: "#F87171",
  };
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{
        backgroundColor: colors[status],
        boxShadow: status === "in-progress" ? `0 0 8px ${colors[status]}` : "none",
      }}
    />
  );
}

function SessionTypeBadge({ type }: { type: SessionItem["type"] }) {
  const config = {
    strength: { color: "#0D9488", bg: "rgba(13,148,136,0.15)", label: "Strength" },
    cardio: { color: "#06B6D4", bg: "rgba(6,182,212,0.15)", label: "Cardio" },
    recovery: { color: "#8B5CF6", bg: "rgba(139,92,246,0.15)", label: "Recovery" },
    assessment: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Assessment" },
  };
  const c = config[type];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

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
  const [mounted, setMounted] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const firstName = user?.full_name?.split(" ")[0] || "Marcus";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const hasAttention =
    MOCK_ATTENTION.missedWorkouts > 0 ||
    MOCK_ATTENTION.checkinsPending > 0 ||
    MOCK_ATTENTION.unreadMessages > 0;

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
              {MOCK_ATTENTION.unreadMessages > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: "#F87171" }}
                >
                  {MOCK_ATTENTION.unreadMessages}
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
          {MOCK_ATTENTION.missedWorkouts > 0 && (
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
                    {MOCK_ATTENTION.missedWorkouts}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    clients missed workouts this week
                  </p>
                </div>
              </button>
            </motion.div>
          )}

          {/* Check-ins Pending */}
          {MOCK_ATTENTION.checkinsPending > 0 && (
            <motion.div variants={fadeInUp}>
              <button
                onClick={() => navigate("/coach")}
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
                    {MOCK_ATTENTION.checkinsPending}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    check-ins awaiting review
                  </p>
                </div>
              </button>
            </motion.div>
          )}

          {/* Unread Messages */}
          {MOCK_ATTENTION.unreadMessages > 0 && (
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
                    {MOCK_ATTENTION.unreadMessages}
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
          TODAY'S SESSIONS
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mb-6"
      >
        <CollapsibleSection
          title="Today's Sessions"
          icon={<Calendar className="h-4 w-4" />}
          defaultExpanded
          accentColor="#0D9488"
          badge={
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: "#0D9488" }}
            >
              {MOCK_SESSIONS.length}
            </span>
          }
          headerAction={
            <button
              onClick={() => navigate("/schedule")}
              className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--azfit-primary)" }}
            >
              Full Schedule
              <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="space-y-3">
            {MOCK_SESSIONS.map((session, i) => (
              <motion.div
                key={session.id}
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
                  <StatusDot status={session.status} />
                  <span
                    className="text-[10px] font-mono font-medium"
                    style={{ color: "var(--light-text-muted)" }}
                  >
                    {session.time}
                  </span>
                </div>

                {/* Client Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--page-text)" }}
                    >
                      {session.clientName}
                    </p>
                    <SessionTypeBadge type={session.type} />
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                    {session.duration} • {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                  </p>
                </div>

                {/* Status label */}
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    color:
                      session.status === "completed"
                        ? "#84CC16"
                        : session.status === "in-progress"
                          ? "#0D9488"
                          : "#64748B",
                  }}
                >
                  {session.status === "in-progress" ? "Now" : session.status}
                </span>

                <ChevronRight
                  className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--light-text-muted)" }}
                />
              </motion.div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          BUSINESS AT A GLANCE (Revenue + Compliance + Active Clients)
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6"
      >
        {/* Revenue Ring */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Revenue"
            titleIcon={<DollarSign className="h-4 w-4" />}
            headerAction={
              <span className="text-[11px] font-medium" style={{ color: "#84CC16" }}>
                +8% vs last month
              </span>
            }
            glass
            glow
            accentColor="#0D9488"
            hover
            onClick={() => navigate("/coach")}
          >
            <div className="flex items-center justify-center py-4">
              <ProgressRing
                size={160}
                strokeWidth={12}
                percentage={65}
                color="#0D9488"
                gradientEndColor="#14B8A6"
                label="of $10k goal"
                value="$6,500"
                subtitle="Monthly target"
                glowClass="glow-teal"
                showPulse
              />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  $4,200
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Paid
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  $2,300
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Outstanding
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Client Compliance Ring */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Client Compliance"
            titleIcon={<Users className="h-4 w-4" />}
            headerAction={
              <span className="text-[11px] font-medium" style={{ color: "#84CC16" }}>
                17/20 active
              </span>
            }
            glass
            glow
            accentColor="#06B6D4"
            hover
            onClick={() => navigate("/analytics")}
          >
            <div className="flex items-center justify-center py-4">
              <ProgressRing
                size={160}
                strokeWidth={12}
                percentage={85}
                color="#06B6D4"
                gradientEndColor="#22D3EE"
                label="compliance"
                value="85%"
                subtitle="Weekly average"
                glowClass="glow-cyan"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "#84CC16" }}>12</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  On Track
                </p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "#F59E0B" }}>3</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  At Risk
                </p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "#F87171" }}>2</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Off Track
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Active Clients (replaced Sessions ring) */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Active Clients"
            titleIcon={<Users className="h-4 w-4" />}
            headerAction={
              <span
                className="flex items-center gap-0.5 text-[11px] font-medium"
                style={{ color: MOCK_ACTIVE_CLIENTS.trendPositive ? "#84CC16" : "#F87171" }}
              >
                {MOCK_ACTIVE_CLIENTS.trendPositive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {MOCK_ACTIVE_CLIENTS.trend}
              </span>
            }
            glass
            hover
            accentColor="#8B5CF6"
            onClick={() => navigate("/clients")}
          >
            <div className="flex flex-col items-center justify-center py-6">
              <p className="text-5xl font-bold font-mono" style={{ color: "var(--page-text)" }}>
                {MOCK_ACTIVE_CLIENTS.count}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                clients this month
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  6
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  New this week
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  2
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
        {WEEKLY_METRICS.map((metric) => (
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
                <p className="text-xl font-bold font-mono" style={{ color: "var(--page-text)" }}>
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
          clients={MOCK_HEALTH_GRID}
          onClientClick={(clientId) => navigate(`/client/${clientId}`)}
          onSendMessage={(clientId) => navigate(`/client/${clientId}`)}
        />
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════
          AI INSIGHTS + REVENUE SNAPSHOT
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6"
      >
        <motion.div variants={fadeInUp} className="lg:col-span-2">
          <AIInsightsPanel
            insights={MOCK_AI_INSIGHTS}
            onViewAll={() => navigate("/coach")}
            onActionClick={(id, action) => {
              console.log(`AI action: ${action} for insight ${id}`);
            }}
          />
        </motion.div>

        <motion.div variants={fadeInUp}>
          <RevenueSnapshot
            data={MOCK_REVENUE}
            onViewDetails={() => navigate("/analytics")}
          />
        </motion.div>
      </motion.section>

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
              onClick: () => navigate("/program-builder"),
            },
            {
              label: "AI Builder",
              icon: Wand2,
              color: "#06B6D4",
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

      {/* ═══════════════════════════════════════════════════════════
          WEEKLY SCHEDULE OVERVIEW
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <GlassCard
          title="Weekly Schedule Overview"
          titleIcon={<Clock className="h-4 w-4" />}
          glass
          hover
          accentColor="#F59E0B"
          className="min-h-[120px] flex items-center justify-center"
        >
          <div className="text-center py-8">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(245,158,11,0.12)" }}
            >
              <MoreHorizontal className="h-6 w-6" style={{ color: "#F59E0B" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
              Schedule Timeline
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
              Coming in Phase A4 — hourly timeline with session blocks
            </p>
          </div>
        </GlassCard>
      </motion.div>

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
