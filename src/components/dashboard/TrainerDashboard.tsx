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
  Target,
  Flame,
  Zap,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router";
import { GlassCard } from "./shared/GlassCard";
import { ProgressRing } from "./shared/ProgressRing";
import { CollapsibleSection } from "./shared/CollapsibleSection";

/* ═══════════════════════════════════════════════════════════════════
   Trainer Dashboard — Phase A3
   ═══════════════════════════════════════════════════════════════════
   Core trainer overview with:
   • Revenue Ring ($6,500 / 65% goal)
   • Client Compliance bar (85% | 17/20)
   • Weekly Summary metrics (Volume, RPE, Time)
   • Today's Sessions list
   • Client Insights placeholder
   • Glassmorphic dark-mode aesthetic with neon accents
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

interface ClientInsight {
  id: string;
  name: string;
  avatar?: string;
  compliance: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
  lastActive: string;
  nextSession: string;
}

/* ── Mock Data ───────────────────────────────────────────────────── */
const MOCK_SESSIONS: SessionItem[] = [
  {
    id: "s1",
    clientName: "Sarah Chen",
    time: "7:00 AM",
    duration: "60 min",
    type: "strength",
    status: "completed",
  },
  {
    id: "s2",
    clientName: "Marcus Johnson",
    time: "9:00 AM",
    duration: "45 min",
    type: "cardio",
    status: "in-progress",
  },
  {
    id: "s3",
    clientName: "Alex Rivera",
    time: "11:00 AM",
    duration: "75 min",
    type: "strength",
    status: "upcoming",
  },
  {
    id: "s4",
    clientName: "Emma Wilson",
    time: "2:00 PM",
    duration: "30 min",
    type: "assessment",
    status: "upcoming",
  },
  {
    id: "s5",
    clientName: "David Kim",
    time: "4:00 PM",
    duration: "60 min",
    type: "recovery",
    status: "upcoming",
  },
];

const MOCK_INSIGHTS: ClientInsight[] = [
  {
    id: "c1",
    name: "Sarah Chen",
    compliance: 94,
    trend: "up",
    trendValue: 3,
    lastActive: "Today",
    nextSession: "Tomorrow 7:00 AM",
  },
  {
    id: "c2",
    name: "Marcus Johnson",
    compliance: 87,
    trend: "stable",
    trendValue: 0,
    lastActive: "Today",
    nextSession: "Today 9:00 AM",
  },
  {
    id: "c3",
    name: "Alex Rivera",
    compliance: 72,
    trend: "down",
    trendValue: 5,
    lastActive: "2 days ago",
    nextSession: "Today 11:00 AM",
  },
  {
    id: "c4",
    name: "Emma Wilson",
    compliance: 91,
    trend: "up",
    trendValue: 2,
    lastActive: "Yesterday",
    nextSession: "Today 2:00 PM",
  },
  {
    id: "c5",
    name: "David Kim",
    compliance: 68,
    trend: "down",
    trendValue: 8,
    lastActive: "3 days ago",
    nextSession: "Today 4:00 PM",
  },
];

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

function TrendIndicator({ trend, value }: { trend: ClientInsight["trend"]; value: number }) {
  if (trend === "stable") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "#64748B" }}>
        <span className="h-1 w-3 rounded-full bg-slate-500" />
        Stable
      </span>
    );
  }
  const isUp = trend === "up";
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  const color = isUp ? "#84CC16" : "#F87171";
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color }}>
      <Icon className="h-3 w-3" />
      {value}%
    </span>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function TrainerDashboard() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const completedSessions = MOCK_SESSIONS.filter((s) => s.status === "completed").length;
  const totalSessions = MOCK_SESSIONS.length;
  const sessionProgress = Math.round((completedSessions / totalSessions) * 100);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-20 lg:px-6 lg:pb-8">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
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
              Trainer Overview
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--light-text-muted)" }}>
              Welcome back — here's what's happening today
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 sm:mt-0">
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <Calendar className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
          TOP ROW: Progress Rings (Revenue + Compliance + Sessions)
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* Revenue Ring */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Revenue"
            titleIcon={<DollarSign className="h-4 w-4" />}
            headerAction={
              <span className="text-[11px] font-medium" style={{ color: "var(--success)" }}>
                +8% vs last month
              </span>
            }
            glass
            glow
            accentColor="#0D9488"
            hover
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
              <span className="text-[11px] font-medium" style={{ color: "var(--success)" }}>
                17/20 active
              </span>
            }
            glass
            glow
            accentColor="#06B6D4"
            hover
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

        {/* Today's Sessions Progress */}
        <motion.div variants={fadeInUp}>
          <GlassCard
            title="Today's Sessions"
            titleIcon={<Calendar className="h-4 w-4" />}
            headerAction={
              <span className="text-[11px] font-medium" style={{ color: "var(--light-text-muted)" }}>
                {completedSessions}/{totalSessions} done
              </span>
            }
            glass
            glow
            accentColor="#8B5CF6"
            hover
          >
            <div className="flex items-center justify-center py-4">
              <ProgressRing
                size={160}
                strokeWidth={12}
                percentage={sessionProgress}
                color="#8B5CF6"
                gradientEndColor="#A78BFA"
                label="completed"
                value={`${sessionProgress}%`}
                subtitle={`${completedSessions} of ${totalSessions}`}
                glowClass="glow-purple"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  4h 30m
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Remaining
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: "var(--page-text)" }}>
                  5
                </p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
                  Clients
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
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {WEEKLY_METRICS.map((metric, i) => (
          <motion.div key={metric.label} variants={fadeInUp} custom={i}>
            <GlassCard
              glass
              hover
              padding="p-4"
              className="relative overflow-hidden"
            >
              {/* Subtle accent glow in corner */}
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
          MIDDLE ROW: Sessions List + Client Insights
          ═══════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Sessions */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
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
                View All
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

                  {/* Arrow on hover */}
                  <ChevronRight
                    className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--light-text-muted)" }}
                  />
                </motion.div>
              ))}
            </div>
          </CollapsibleSection>
        </motion.div>

        {/* Client Insights */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          transition={{ delay: 0.1 }}
        >
          <CollapsibleSection
            title="Client Insights"
            icon={<Target className="h-4 w-4" />}
            defaultExpanded
            accentColor="#8B5CF6"
            headerAction={
              <button
                onClick={() => navigate("/clients")}
                className="flex items-center gap-0.5 text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--azfit-accent)" }}
              >
                All Clients
                <ChevronRight className="h-3 w-3" />
              </button>
            }
          >
            <div className="space-y-3">
              {MOCK_INSIGHTS.map((client, i) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                  }}
                  onClick={() => navigate(`/client/${client.id}`)}
                >
                  {/* Avatar placeholder */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: "rgba(13,148,136,0.15)",
                      color: "#0D9488",
                    }}
                  >
                    {client.name.split(" ").map((n) => n[0]).join("")}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--page-text)" }}
                    >
                      {client.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TrendIndicator trend={client.trend} value={client.trendValue} />
                      <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                        • {client.lastActive}
                      </span>
                    </div>
                  </div>

                  {/* Compliance mini-ring */}
                  <div className="flex flex-col items-center">
                    <ProgressRing
                      size={48}
                      strokeWidth={4}
                      percentage={client.compliance}
                      color={client.compliance >= 80 ? "#84CC16" : client.compliance >= 60 ? "#F59E0B" : "#F87171"}
                      label=""
                      value={`${client.compliance}`}
                      animate={false}
                      className="scale-75"
                    />
                    <span
                      className="text-[9px] font-medium uppercase tracking-wide"
                      style={{ color: "var(--light-text-muted)" }}
                    >
                      Compliance
                    </span>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--light-text-muted)" }}
                  />
                </motion.div>
              ))}
            </div>
          </CollapsibleSection>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM ROW: Quick Actions + Placeholder Cards
          ═══════════════════════════════════════════════════════════ */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          {
            label: "Start Session",
            icon: Flame,
            color: "#0D9488",
            path: "/sheets",
          },
          {
            label: "New Program",
            icon: Zap,
            color: "#8B5CF6",
            path: "/program-builder",
          },
          {
            label: "Add Client",
            icon: Users,
            color: "#06B6D4",
            path: "/clients",
          },
          {
            label: "Analytics",
            icon: BarChart3,
            color: "#F59E0B",
            path: "/analytics",
          },
        ].map((action, i) => (
          <motion.div key={action.label} variants={scaleIn} custom={i}>
            <GlassCard
              glass
              hover
              glow
              padding="p-4"
              className="cursor-pointer text-center"
              onClick={() => navigate(action.path)}
            >
              <div
                className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${action.color}15` }}
              >
                <action.icon className="h-6 w-6" style={{ color: action.color }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                {action.label}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════
          PLACEHOLDER: Schedule Timeline (for future expansion)
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-6"
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
    </div>
  );
}
