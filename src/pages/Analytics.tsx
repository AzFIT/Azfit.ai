import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Dumbbell,
  Weight,
  Gauge,
  Target,
  Scale,
  BarChart3,
  PieChart,
  Calendar,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
} from 'recharts';
import Layout from '@/components/Layout';

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const easeDefault = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: easeDefault } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const weightData30D = [
  { date: '2025-01-15', weight: 82.5, movingAvg: 82.7 },
  { date: '2025-01-14', weight: 82.8, movingAvg: 82.8 },
  { date: '2025-01-13', weight: 83.1, movingAvg: 82.9 },
  { date: '2025-01-12', weight: 83.0, movingAvg: 83.0 },
  { date: '2025-01-11', weight: 83.2, movingAvg: 83.1 },
  { date: '2025-01-10', weight: 83.0, movingAvg: 83.2 },
  { date: '2025-01-09', weight: 82.9, movingAvg: 83.3 },
  { date: '2025-01-08', weight: 83.3, movingAvg: 83.4 },
  { date: '2025-01-07', weight: 83.5, movingAvg: 83.5 },
  { date: '2025-01-06', weight: 83.4, movingAvg: 83.6 },
  { date: '2025-01-05', weight: 83.6, movingAvg: 83.7 },
  { date: '2025-01-04', weight: 83.8, movingAvg: 83.8 },
  { date: '2025-01-03', weight: 84.0, movingAvg: 83.9 },
  { date: '2025-01-02', weight: 84.2, movingAvg: 84.0 },
  { date: '2025-01-01', weight: 84.5, movingAvg: 84.1 },
  { date: '2024-12-31', weight: 84.3, movingAvg: 84.2 },
  { date: '2024-12-30', weight: 84.6, movingAvg: 84.3 },
  { date: '2024-12-29', weight: 84.8, movingAvg: 84.4 },
  { date: '2024-12-28', weight: 85.0, movingAvg: 84.5 },
  { date: '2024-12-27', weight: 85.2, movingAvg: 84.6 },
  { date: '2024-12-26', weight: 85.1, movingAvg: 84.7 },
  { date: '2024-12-25', weight: 85.5, movingAvg: 84.8 },
  { date: '2024-12-24', weight: 85.3, movingAvg: 84.9 },
  { date: '2024-12-23', weight: 85.6, movingAvg: 85.0 },
  { date: '2024-12-22', weight: 85.8, movingAvg: 85.1 },
  { date: '2024-12-21', weight: 86.0, movingAvg: 85.2 },
  { date: '2024-12-20', weight: 86.2, movingAvg: 85.3 },
  { date: '2024-12-19', weight: 86.0, movingAvg: 85.4 },
  { date: '2024-12-18', weight: 86.5, movingAvg: 85.5 },
  { date: '2024-12-17', weight: 86.3, movingAvg: 85.6 },
];

const volumeData = [
  { week: 'Week 1', legs: 18500, chest: 12800, back: 15200, shoulders: 8400, arms: 6200 },
  { week: 'Week 2', legs: 21200, chest: 14500, back: 16800, shoulders: 9600, arms: 7800 },
  { week: 'Week 3', legs: 19800, chest: 13900, back: 17500, shoulders: 10200, arms: 8100 },
  { week: 'Week 4', legs: 22400, chest: 15600, back: 18200, shoulders: 11000, arms: 8900 },
];

const macroData = [
  { name: 'Protein', value: 38, grams: 260, color: '#0D9488' },
  { name: 'Carbs', value: 47, grams: 325, color: '#06B6D4' },
  { name: 'Fats', value: 15, grams: 88, color: '#F59E0B' },
];

const prData = [
  { exercise: 'Squat', muscleGroup: 'Legs', weight: 140, unit: 'kg', reps: 1, date: '2024-12-01', change: '+5', previous: 135 },
  { exercise: 'Deadlift', muscleGroup: 'Legs', weight: 180, unit: 'kg', reps: 1, date: '2024-12-15', change: '+10', previous: 170 },
  { exercise: 'Bench Press', muscleGroup: 'Push', weight: 100, unit: 'kg', reps: 1, date: '2024-11-20', change: '+5', previous: 95 },
  { exercise: 'Overhead Press', muscleGroup: 'Push', weight: 62.5, unit: 'kg', reps: 1, date: '2024-11-10', change: '+2.5', previous: 60 },
  { exercise: 'Pull-up', muscleGroup: 'Pull', weight: 30, unit: 'kg', reps: 5, date: '2024-12-10', change: '+5', previous: 25 },
  { exercise: 'Leg Press', muscleGroup: 'Legs', weight: 280, unit: 'kg', reps: 8, date: '2024-11-28', change: '+20', previous: 260 },
];

const summaryStats = [
  { value: '42', label: 'This Month', icon: Dumbbell, color: 'var(--azfit-primary)' },
  { value: '84,200 kg', label: 'Total Lifted', icon: Weight, color: 'var(--azfit-secondary)' },
  { value: '7.2', label: 'Intensity', icon: Gauge, color: 'var(--warning)' },
  { value: '78%', label: 'Training Days', icon: Target, color: 'var(--success)' },
];

const timeRanges = ['7D', '30D', '90D', '1Y'] as const;
type TimeRange = (typeof timeRanges)[number];

/* ------------------------------------------------------------------ */
/*  Muscle group badge color                                           */
/* ------------------------------------------------------------------ */

function muscleGroupBadge(group: string) {
  switch (group) {
    case 'Legs':
      return { bg: 'rgba(13,148,136,0.15)', color: '#0D9488' };
    case 'Push':
      return { bg: 'rgba(6,182,212,0.15)', color: '#06B6D4' };
    case 'Pull':
      return { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' };
    default:
      return { bg: 'rgba(100,116,139,0.15)', color: '#64748B' };
  }
}

/* ------------------------------------------------------------------ */
/*  Heatmap data generator (90 days)                                   */
/* ------------------------------------------------------------------ */

function generateHeatmapData(): number[][] {
  const patterns: number[][] = [];
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };
  const rand = rng(42);

  for (let week = 0; week < 13; week++) {
    const days: number[] = [];
    for (let day = 0; day < 7; day++) {
      const idx = week * 7 + day;
      if (idx >= 90) {
        days.push(-1); // empty cell
        continue;
      }
      // Simulate patterns: more rest on weekends, more intense mid-week
      const isWeekend = day >= 5;
      const base = isWeekend ? 0.3 : 0.7;
      const r = rand();
      let intensity: number;
      if (r > base) {
        intensity = 0; // rest
      } else if (r > base * 0.6) {
        intensity = 1; // light
      } else if (r > base * 0.3) {
        intensity = 2; // moderate
      } else if (r > base * 0.1) {
        intensity = 3; // heavy
      } else {
        intensity = 4; // intense
      }
      days.push(intensity);
    }
    patterns.push(days);
  }
  return patterns;
}

function heatmapColor(level: number, isDark: boolean): string {
  if (level === -1) return 'transparent';
  if (level === 0) return isDark ? 'var(--dark-elevated)' : 'var(--light-elevated)';
  if (level === 1) return 'rgba(132,204,22,0.25)';
  if (level === 2) return 'rgba(132,204,22,0.45)';
  if (level === 3) return 'rgba(132,204,22,0.7)';
  return '#84CC16';
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ------------------------------------------------------------------ */
/*  Recharts tooltip style                                             */
/* ------------------------------------------------------------------ */

function tooltipStyle() {
  return {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    color: 'var(--page-text)',
    fontSize: '12px',
    padding: '8px 12px',
  };
}

/* ------------------------------------------------------------------ */
/*  Weight Tooltip                                                     */
/* ------------------------------------------------------------------ */

function WeightTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const w = payload.find((p) => p.dataKey === 'weight');
  const change = payload.length > 1 && payload[0]?.value ? (payload[0].value - (payload[payload.length - 1]?.value ?? 0)).toFixed(1) : '0';
  return (
    <div style={tooltipStyle()}>
      <p className="text-[11px] font-medium" style={{ color: 'var(--light-text-muted)' }}>{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--azfit-primary)' }}>
        {w ? `${w.value} kg` : ''}
      </p>
      {w && (
        <p className="text-xs" style={{ color: 'var(--success)' }}>
          <TrendingDown size={10} className="mr-1 inline" />
          {change} kg vs prev
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Volume Tooltip                                                     */
/* ------------------------------------------------------------------ */

function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={tooltipStyle()}>
      <p className="text-[11px] font-medium" style={{ color: 'var(--light-text-muted)' }}>{label}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: 'var(--azfit-secondary)' }}>
        Total: {total.toLocaleString()} kg
      </p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 text-xs" style={{ color: p.color }}>
          {p.name}: {p.value?.toLocaleString()} kg
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Macro Tooltip                                                      */
/* ------------------------------------------------------------------ */

function MacroTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { grams: number; color: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  return (
    <div style={tooltipStyle()}>
      <p className="text-sm font-semibold" style={{ color: p.payload.color }}>
        {p.name}: {p.value}%
      </p>
      <p className="text-xs" style={{ color: 'var(--light-text-muted)' }}>{p.payload.grams}g</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Analytics() {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const heatmapData = useMemo(() => generateHeatmapData(), []);

  const filteredWeightData = useMemo(() => {
    const sliceMap: Record<TimeRange, number> = { '7D': 7, '30D': 30, '90D': 30, '1Y': 30 };
    const sliceN = sliceMap[timeRange];
    return weightData30D.slice(0, sliceN).reverse();
  }, [timeRange]);

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  }, []);

  const totalVolume = useMemo(() => {
    return volumeData.reduce((sum, w) => sum + w.legs + w.chest + w.back + w.shoulders + w.arms, 0);
  }, []);

  const totalCalories = useMemo(() => {
    const proteinCals = macroData[0].grams * 4;
    const carbCals = macroData[1].grams * 4;
    const fatCals = macroData[2].grams * 9;
    return proteinCals + carbCals + fatCals;
  }, []);

  /* ───────────────────── render ───────────────────── */

  return (
    <Layout>
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-20 lg:px-6 lg:pb-8">
        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.3, ease: easeDefault }}
          className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1
              className="text-[32px] font-bold leading-tight lg:text-[40px]"
              style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)', letterSpacing: '-0.02em' }}
            >
              Analytics
            </h1>
            <p
              className="mt-1 text-base"
              style={{ color: 'var(--light-text-secondary)' }}
            >
              Track your progress and spot trends
            </p>
          </div>
          <button
            className="mt-3 flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-200 hover:bg-[var(--light-elevated)] sm:mt-0"
            style={{
              color: 'var(--light-text-secondary)',
              borderColor: 'var(--card-border)',
              backgroundColor: 'transparent',
            }}
          >
            <Download size={16} />
            Export Data
          </button>
        </motion.div>

        {/* ── Time Range Selector ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mb-6 flex items-center gap-2 overflow-x-auto pb-2"
        >
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="h-9 rounded-full px-4 text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: timeRange === range ? 'var(--azfit-primary)' : 'transparent',
                color: timeRange === range ? '#FFFFFF' : 'var(--light-text-secondary)',
                border: timeRange === range ? '1px solid var(--azfit-primary)' : '1px solid var(--card-border)',
              }}
            >
              {range === '1Y' ? '1 Year' : range === '7D' ? '7 Days' : range === '30D' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </motion.div>

        {/* ── Summary Stats Row ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={mounted ? 'visible' : 'hidden'}
          className="mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        >
          {summaryStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              variants={fadeInUp}
              className="flex w-[140px] shrink-0 snap-start flex-col rounded-2xl border p-4 sm:w-[180px]"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                height: '100px',
              }}
            >
              <stat.icon size={20} style={{ color: stat.color }} />
              <span
                className="mt-2 text-lg font-bold"
                style={{ color: stat.color, textShadow: 'var(--text-shadow-dark)' }}
              >
                {stat.value}
              </span>
              <span
                className="mt-0.5 text-[11px] font-medium"
                style={{ color: 'var(--light-text-muted)' }}
              >
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Chart Grid ── */}
        <div className="flex flex-col gap-6">
          {/* Row 1: Weight Trend (full width) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.5, ease: easeDefault }}
            className="rounded-2xl border p-4 lg:p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {/* Card Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale size={16} style={{ color: 'var(--azfit-primary)' }} />
                <h3
                  className="text-xl font-bold"
                  style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  Weight Trend
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--azfit-primary)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  82.5 kg
                </span>
                <span
                  className="flex items-center gap-0.5 text-xs font-semibold"
                  style={{ color: 'var(--success)' }}
                >
                  <TrendingDown size={12} />
                  -3.8 kg
                </span>
              </div>
            </div>

            {/* Chart */}
            <div style={{ width: '100%', height: window?.innerWidth >= 1024 ? 360 : 300 }}>
              <ResponsiveContainer>
                <AreaChart data={filteredWeightData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0D9488" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border)" opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: 'var(--light-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={{ stroke: 'var(--light-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tick={{ fill: 'var(--light-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<WeightTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    fill="url(#weightGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#0D9488', strokeWidth: 0 }}
                    animationDuration={1200}
                  />
                  <Area
                    type="monotone"
                    dataKey="movingAvg"
                    stroke="#06B6D4"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    fill="none"
                    dot={false}
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Row 2: Macro Donut + Mini Weight (side by side on desktop) */}
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Macro Donut */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.5, ease: easeDefault }}
              className="flex-1 rounded-2xl border p-4 lg:p-6"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart size={16} style={{ color: 'var(--azfit-accent)' }} />
                  <h3
                    className="text-xl font-bold"
                    style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                  >
                    Macro Split
                  </h3>
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  {totalCalories.toLocaleString()} kcal avg
                </span>
              </div>

              <div className="flex flex-col items-center gap-4 sm:flex-row">
                {/* Donut Chart */}
                <div style={{ width: '100%', maxWidth: 240, height: 220 }}>
                  <ResponsiveContainer>
                    <RePieChart>
                      <Pie
                        data={macroData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                        animationDuration={1000}
                        animationBegin={200}
                      >
                        {macroData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<MacroTooltip />} />
                    </RePieChart>
                  </ResponsiveContainer>
                  {/* Center text overlay */}
                  <div className="pointer-events-none relative -mt-[140px] flex h-[140px] flex-col items-center justify-center">
                    <span
                      className="text-xl font-bold"
                      style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                    >
                      {totalCalories.toLocaleString()}
                    </span>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      kcal
                    </span>
                  </div>
                </div>

                {/* Macro bars */}
                <div className="flex w-full flex-col gap-3">
                  {macroData.map((macro) => (
                    <div key={macro.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold" style={{ color: macro.color }}>
                          {macro.name}
                        </span>
                        <span style={{ color: 'var(--light-text-muted)' }}>
                          {macro.grams}g ({macro.value}%)
                        </span>
                      </div>
                      <div
                        className="h-2 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: `${macro.color}20` }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={mounted ? { width: `${macro.value}%` } : {}}
                          transition={{ delay: 0.6, duration: 0.8, ease: easeDefault }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: macro.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Row 3: Workout Volume */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.35, duration: 0.5, ease: easeDefault }}
            className="rounded-2xl border p-4 lg:p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} style={{ color: 'var(--azfit-secondary)' }} />
                <h3
                  className="text-xl font-bold"
                  style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  Workout Volume
                </h3>
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: 'var(--azfit-secondary)', textShadow: 'var(--text-shadow-dark)' }}
              >
                Total: {totalVolume.toLocaleString()} kg
              </span>
            </div>

            <div style={{ width: '100%', height: window?.innerWidth >= 1024 ? 320 : 280 }}>
              <ResponsiveContainer>
                <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border)" opacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: 'var(--light-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={{ stroke: 'var(--light-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--light-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<VolumeTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="legs" stackId="a" fill="#0D9488" radius={[0, 0, 0, 0]} animationDuration={600} />
                  <Bar dataKey="chest" stackId="a" fill="#06B6D4" radius={[0, 0, 0, 0]} animationDuration={600} animationBegin={100} />
                  <Bar dataKey="back" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} animationDuration={600} animationBegin={200} />
                  <Bar dataKey="shoulders" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} animationDuration={600} animationBegin={300} />
                  <Bar dataKey="arms" stackId="a" fill="#A78BFA" radius={[4, 4, 0, 0]} animationDuration={600} animationBegin={400} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Row 4: Consistency Heatmap */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.5, ease: easeDefault }}
            className="rounded-2xl border p-4 lg:p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} style={{ color: 'var(--success)' }} />
                <h3
                  className="text-xl font-bold"
                  style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  Training Consistency
                </h3>
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: 'var(--success)', textShadow: 'var(--text-shadow-dark)' }}
              >
                78% consistency
              </span>
            </div>

            {/* Day labels */}
            <div className="mb-2 flex gap-1 pl-0">
              {dayLabels.map((d) => (
                <div
                  key={d}
                  className="flex h-7 w-7 items-center justify-center text-[10px] font-medium lg:h-8 lg:w-8"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  {d.slice(0, 2)}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex flex-col gap-1">
              {heatmapData.map((week, wi) => (
                <div key={wi} className="flex gap-1">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="h-7 w-7 rounded transition-transform duration-150 hover:scale-110 lg:h-8 lg:w-8"
                      style={{
                        backgroundColor: heatmapColor(day, isDark),
                        cursor: day >= 0 ? 'pointer' : 'default',
                      }}
                      title={day >= 0 ? `Intensity: ${['Rest', 'Light', 'Moderate', 'Heavy', 'Intense'][day]}` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[11px] font-medium" style={{ color: 'var(--light-text-muted)' }}>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div key={level} className="flex items-center gap-1">
                  <div
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: heatmapColor(level, isDark) }}
                  />
                </div>
              ))}
              <span className="text-[11px] font-medium" style={{ color: 'var(--light-text-muted)' }}>More</span>
            </div>
          </motion.div>

          {/* Row 5: Personal Records Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.5, ease: easeDefault }}
            className="rounded-2xl border p-4 lg:p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={16} style={{ color: 'var(--warning)' }} />
                <h3
                  className="text-xl font-bold"
                  style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  Personal Records
                </h3>
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
              >
                {prData.length} Records
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: 'var(--card-border)' }}
                  >
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      Exercise
                    </th>
                    <th
                      className="px-3 py-3 text-right text-xs font-semibold"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      Weight
                    </th>
                    <th
                      className="px-3 py-3 text-center text-xs font-semibold"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      Reps
                    </th>
                    <th
                      className="px-3 py-3 text-right text-xs font-semibold"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      Date
                    </th>
                    <th
                      className="px-3 py-3 text-right text-xs font-semibold"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {prData.map((pr, i) => {
                    const badge = muscleGroupBadge(pr.muscleGroup);
                    const changeVal = parseFloat(pr.change);
                    return (
                      <motion.tr
                        key={pr.exercise}
                        initial={{ opacity: 0, x: -20 }}
                        animate={mounted ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.5 + i * 0.08, duration: 0.4, ease: easeDefault }}
                        className="border-b transition-colors duration-150 hover:bg-[var(--light-elevated)]"
                        style={{ borderColor: 'var(--card-border)', height: 56 }}
                      >
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className="text-sm font-semibold"
                              style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                            >
                              {pr.exercise}
                            </span>
                            <span
                              className="w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: badge.bg, color: badge.color }}
                            >
                              {pr.muscleGroup}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className="font-mono text-sm font-bold"
                            style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                          >
                            {pr.weight} {pr.unit}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className="text-sm"
                            style={{ color: 'var(--light-text-secondary)' }}
                          >
                            {pr.reps}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className="text-xs"
                            style={{ color: 'var(--light-text-muted)' }}
                          >
                            {new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className="flex items-center justify-end gap-1 text-xs font-semibold"
                            style={{ color: changeVal > 0 ? 'var(--success)' : 'var(--light-text-muted)' }}
                          >
                            {changeVal > 0 ? <TrendingUp size={12} /> : <Minus size={12} />}
                            {pr.change > '0' ? `${pr.change} ${pr.unit}` : 'New'}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
