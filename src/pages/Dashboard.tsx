import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Dumbbell,
  Scale,
  Utensils,
  Moon,
  TrendingUp,
  Flame,
  Layers,
  PersonStanding,
  Clock,
  Repeat,
  MessageCircle,
  Target,
  ChevronRight,
  Plus,
} from 'lucide-react';
import Layout from '@/components/Layout';
import ProgressRing from '@/components/ProgressRing';
import { SheetsPanel } from '@/components/SheetsPanel';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] },
  },
};

const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const slideInLeft = {
  hidden: { opacity: 0, x: -15 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.12, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const rings = [
  {
    percentage: 82,
    color: '#0D9488',
    label: 'Fitness Score',
    value: '82%',
    glow: 'glow-teal',
    sublabel: '+3% this week',
    subColor: 'var(--success)',
  },
  {
    percentage: 65,
    color: '#06B6D4',
    label: 'Macro Target',
    value: '65%',
    glow: 'glow-cyan',
    sublabel: '128g protein left',
    subColor: 'var(--light-text-muted)',
  },
  {
    percentage: 56.5,
    color: '#8B5CF6',
    label: 'Steps',
    value: '5,654',
    glow: 'glow-purple',
    sublabel: '4,346 to go',
    subColor: 'var(--light-text-muted)',
  },
  {
    percentage: 93.75,
    color: '#22D3EE',
    label: 'Sleep',
    value: '7h30m',
    glow: 'glow-cyan',
    sublabel: 'Great recovery!',
    subColor: 'var(--success)',
  },
];

const quickStats = [
  { label: '82.5 kg', icon: Scale, color: 'var(--azfit-primary)', text: 'Weight' },
  { label: 'Squat 100kg \u00d7 5 @ RPE 8', icon: Dumbbell, color: 'var(--azfit-secondary)', text: 'Recent Workout' },
  { label: '12 days', icon: Flame, color: 'var(--success)', text: 'Streak', pulse: true },
];

const timeline = [
  { type: 'workout', title: 'Leg Day \u2014 Squat 100kg \u00d7 5', time: 'Today, 7:30 AM', color: '#0D9488', Icon: Dumbbell },
  { type: 'weigh-in', title: 'Weigh-in: 82.5kg', time: 'Today, 6:45 AM', color: '#06B6D4', Icon: Scale },
  { type: 'meal', title: 'Logged Breakfast \u2014 420 kcal', time: 'Today, 8:15 AM', color: '#8B5CF6', Icon: Utensils },
  { type: 'sleep', title: 'Sleep: 7h 30m', time: 'Yesterday, 10:30 PM', color: '#22D3EE', Icon: Moon },
  { type: 'workout', title: 'Upper Body \u2014 Bench 80kg \u00d7 8', time: 'Yesterday, 6:00 PM', color: '#0D9488', Icon: Dumbbell },
  { type: 'mood', title: 'Mood: 4/5 \u2014 Feeling strong', time: 'Yesterday, 9:00 AM', color: '#84CC16', Icon: TrendingUp },
];

const achievements = [
  { label: '5000 Sets', icon: Layers, bg: 'purple', earned: true, img: '/badge-5000-sets.png' },
  { label: '550 Kcal', icon: Flame, bg: 'teal', earned: true, img: '/badge-550-kcal.png' },
  { label: '25 Poses', icon: PersonStanding, bg: 'purple', earned: true, img: '/badge-25-poses.png' },
  { label: '135 Hours', icon: Clock, bg: 'aqua', earned: true, img: '/badge-135-hours.png' },
  { label: '500 Reps', icon: Repeat, bg: 'aqua', earned: false, img: '/badge-500-reps.png' },
];

const notifications = [
  { type: 'streak', message: '12-day workout streak! Keep it going!', active: true, time: '2 min ago' },
  { type: 'coach', message: 'Coach Maria commented on your leg day log', active: true, time: '1 hr ago' },
  { type: 'goal', message: "You're 83% to your monthly steps goal", active: false, time: '3 hrs ago' },
];

const colorMap: Record<string, string> = {
  purple: 'var(--azfit-accent)',
  teal: 'var(--azfit-primary)',
  aqua: 'var(--azfit-secondary)',
};

const _glowMap: Record<string, string> = {
  purple: 'glow-purple',
  teal: 'glow-teal',
  aqua: 'glow-cyan',
};
void _glowMap;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PulsingDot({ color = 'var(--success)' }: { color?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{
        backgroundColor: color,
        animation: 'pulse-dot 2s infinite',
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const [mode, setMode] = useState<'dashboard' | 'sheets'>('dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const activeNotifCount = notifications.filter((n) => n.active).length;

  return (
    <Layout mode={mode} onModeToggle={setMode}>
      {/* Inject pulsing dot keyframes */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.4); }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
        }
      `}</style>

      {mode === 'sheets' ? (
        <div className="pt-14">
          <SheetsPanel />
        </div>
      ) : (
      <div className="mx-auto max-w-[1200px] px-4 pt-4 pb-20 lg:px-6 lg:pb-8">
        {/* ============================================================ */}
        {/*  SECTION 1: Progress Rings                                   */}
        {/* ============================================================ */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate={mounted ? 'visible' : 'hidden'}
          className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
        >
          {rings.map((ring, i) => (
            <motion.div
              key={ring.label}
              custom={i}
              variants={fadeInUp}
              className="flex flex-col items-center rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <ProgressRing
                size={window?.innerWidth >= 1024 ? 140 : 120}
                percentage={ring.percentage}
                color={ring.color}
                label={ring.label}
                value={ring.value}
                glowClass={ring.glow}
              />
              <span
                className="mt-2 text-[11px] font-medium tracking-wide"
                style={{ color: ring.subColor, textShadow: 'var(--text-shadow-dark)' }}
              >
                {ring.sublabel}
              </span>
            </motion.div>
          ))}
        </motion.section>

        {/* ============================================================ */}
        {/*  SECTION 2: Quick Stats Bar                                  */}
        {/* ============================================================ */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate={mounted ? 'visible' : 'hidden'}
          className="mt-4 flex flex-wrap gap-3 rounded-2xl p-4"
          style={{ backgroundColor: 'var(--light-elevated)' }}
        >
          {quickStats.map((stat, i) => (
            <motion.div
              key={stat.text}
              custom={i}
              variants={fadeInUp}
              className="flex h-10 items-center gap-2 rounded-full border px-4"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              {stat.pulse && <PulsingDot />}
              <stat.icon size={16} style={{ color: stat.color }} />
              <span
                className="whitespace-nowrap text-xs font-semibold"
                style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
              >
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.section>

        {/* ============================================================ */}
        {/*  SECTION 3: Activity Timeline Feed                           */}
        {/* ============================================================ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          className="relative mt-6 px-0"
        >
          {/* Section header */}
          <div className="mb-4 flex items-center justify-between">
            <h3
              className="text-xl font-bold"
              style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
            >
              Activity Feed
            </h3>
            <button
              className="flex items-center gap-0.5 text-xs font-semibold transition-colors duration-200 hover:opacity-80"
              style={{ color: 'var(--azfit-primary)' }}
            >
              View All
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Timeline container */}
          <div className="relative">
            {/* Vertical line */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={mounted ? { scaleY: 1 } : {}}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
              className="absolute left-[23px] top-0 h-full w-[2px] origin-top"
              style={{ backgroundColor: 'var(--light-border)' }}
            />

            {/* Timeline items */}
            {timeline.map((item, i) => {
              const isToday = item.time.startsWith('Today');
              return (
                <motion.div
                  key={i}
                  custom={i}
                  variants={slideInLeft}
                  initial="hidden"
                  animate={mounted ? 'visible' : 'hidden'}
                  className="relative mb-4 flex items-start gap-4"
                >
                  {/* Node dot */}
                  <div className="relative z-10 flex h-6 w-6 items-center justify-center">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: isToday ? item.color : 'var(--light-border)',
                        boxShadow: isToday ? `0 0 8px ${item.color}` : 'none',
                      }}
                    />
                  </div>

                  {/* Content card */}
                  <div
                    className="flex-1 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon circle */}
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${item.color}20` }}
                      >
                        <item.Icon size={16} style={{ color: item.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                        >
                          {item.title}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: 'var(--light-text-muted)' }}
                        >
                          {item.time}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ============================================================ */}
        {/*  SECTION 4: Achievement Badges                                 */}
        {/* ============================================================ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          className="mt-6"
        >
          {/* Section header */}
          <div className="mb-4 flex items-center justify-between px-0">
            <h3
              className="text-xl font-bold"
              style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
            >
              Achievements
            </h3>
            <span
              className="text-[11px] font-medium tracking-wide"
              style={{ color: 'var(--light-text-muted)' }}
            >
              4/25 Earned
            </span>
          </div>

          {/* Horizontal scroll badges */}
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
            {achievements.map((badge, i) => {
              const bgColor = colorMap[badge.bg] || 'var(--azfit-accent)';
              const earnedStyle = badge.earned ? {} : { opacity: 0.5 };
              return (
                <motion.div
                  key={badge.label}
                  variants={scaleIn}
                  initial="hidden"
                  animate={mounted ? 'visible' : 'hidden'}
                  custom={i}
                  className="flex shrink-0 snap-center flex-col items-center justify-center rounded-2xl border p-3"
                  style={{
                    width: '100px',
                    height: '120px',
                    background: `linear-gradient(135deg, ${bgColor}33, ${bgColor}0D)`,
                    borderColor: `${bgColor}4D`,
                    ...earnedStyle,
                  }}
                >
                  {/* Badge image */}
                  <div className="relative">
                    <img
                      src={badge.img}
                      alt={badge.label}
                      className="mb-2 h-12 w-12 rounded-full object-cover"
                      style={{
                        boxShadow: badge.earned ? `0 0 8px ${bgColor}66` : 'none',
                      }}
                    />
                    {badge.earned && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'var(--success)' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Icon fallback */}
                  <badge.icon size={20} style={{ color: bgColor }} />
                  <span
                    className="mt-1 text-center text-[10px] font-bold leading-tight"
                    style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                  >
                    {badge.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ============================================================ */}
        {/*  SECTION 5: Notifications                                    */}
        {/* ============================================================ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          className="mt-6 pb-8"
        >
          {/* Section header */}
          <div className="mb-4 flex items-center justify-between">
            <h3
              className="text-xl font-bold"
              style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
            >
              Notifications
            </h3>
            {activeNotifCount > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--danger)' }}
              >
                {activeNotifCount}
              </span>
            )}
          </div>

          {/* Notification items */}
          <div className="flex flex-col gap-2">
            {notifications.map((notif, i) => {
              const iconConfig = {
                streak: { Icon: Flame, bg: '#F59E0B20', color: '#F59E0B' },
                coach: { Icon: MessageCircle, bg: '#0D948820', color: 'var(--azfit-primary)' },
                goal: { Icon: Target, bg: '#8B5CF620', color: 'var(--azfit-accent)' },
              };
              const config = iconConfig[notif.type as keyof typeof iconConfig] || iconConfig.goal;
              return (
                <motion.div
                  key={i}
                  custom={i}
                  variants={slideInRight}
                  initial="hidden"
                  animate={mounted ? 'visible' : 'hidden'}
                  className="flex items-center gap-3 rounded-xl border p-3"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Active indicator */}
                  <PulsingDot color={notif.active ? 'var(--success)' : 'var(--light-border)'} />

                  {/* Icon */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: config.bg }}
                  >
                    <config.Icon size={16} style={{ color: config.color }} />
                  </div>

                  {/* Message */}
                  <p
                    className="min-w-0 flex-1 truncate text-sm"
                    style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                  >
                    {notif.message}
                  </p>

                  {/* Time */}
                  <span
                    className="shrink-0 text-[11px] font-medium"
                    style={{ color: 'var(--light-text-muted)' }}
                  >
                    {notif.time}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ============================================================ */}
        {/*  Floating Action Button (mobile)                               */}
        {/* ============================================================ */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg lg:hidden"
          style={{
            backgroundColor: 'var(--azfit-primary)',
            boxShadow: '0 4px 16px rgba(13,148,136,0.4)',
          }}
          whileTap={{ scale: 0.92 }}
        >
          <Plus size={24} />
        </motion.button>
      </div>
      )}
    </Layout>
  );
}
