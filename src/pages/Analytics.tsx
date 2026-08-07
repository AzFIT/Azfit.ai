import { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
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
import { supabase } from '@/lib/supabase';
import WeightTrendChart from '@/components/shared/WeightTrendChart';
import { withMovingAverage, type WeightPoint } from '@/lib/weightTrend';

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
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

const timeRanges = ['7D', '30D', '90D', '1Y'] as const;
type TimeRange = (typeof timeRanges)[number];

const RANGE_DAYS: Record<TimeRange, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };

const DAY_MS = 86_400_000;

// Phase 55: WeightPoint + moving average + the chart itself are shared
// (src/lib/weightTrend.ts + src/components/shared/WeightTrendChart.tsx) —
// the client dashboard mini-chart renders the same pieces.

interface MacroSlice {
  name: string;
  value: number; // % of macro calories
  grams: number;
  color: string;
}

interface PersonalRecord {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
}

/**
 * Heatmap cell intensity scale (derived from sessions):
 *  -1   padding cell — outside the 90-day window or a future day
 *   0   no session that day
 *   0.25 a session was scheduled on a past day but never completed
 *   1   at least one completed session that day (multiple sessions still cap at 1)
 * Cancelled/other statuses count as no session.
 */
interface HeatCell {
  level: number;
  label: string;
}

interface SummaryStats {
  thisMonth: number;
  totalLiftedKg: number;
  avgRpe: number | null;
  trainingDaysPct: number;
}

const MUSCLE_PALETTE = ['var(--azfit-primary)', 'var(--azfit-secondary)', 'var(--azfit-accent)', 'var(--warning)', 'var(--azfit-accent-light)', 'var(--success)', 'var(--danger)'];

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* ------------------------------------------------------------------ */
/*  Heatmap color                                                      */
/* ------------------------------------------------------------------ */

function heatmapColor(level: number, isDark: boolean): string {
  if (level === -1) return 'transparent';
  if (level === 0) return isDark ? 'var(--dark-elevated)' : 'var(--light-elevated)';
  if (level < 1) return 'rgba(132,204,22,0.25)';
  return 'var(--success)';
}

/* ------------------------------------------------------------------ */
/*  Shared small components                                            */
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

function SectionLoading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 size={22} className="animate-spin" style={{ color: '#00AEEF' }} />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon size={28} style={{ color: 'var(--light-text-muted)' }} />
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'var(--light-text-muted)' }}>
        {message}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart tooltips                                                     */
/* ------------------------------------------------------------------ */

function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={tooltipStyle()}>
      <p className="text-[11px] font-medium" style={{ color: 'var(--light-text-muted)' }}>Week of {label}</p>
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SummaryStats>({ thisMonth: 0, totalLiftedKg: 0, avgRpe: null, trainingDaysPct: 0 });
  const [weightRows, setWeightRows] = useState<WeightPoint[]>([]);
  const [macros, setMacros] = useState<MacroSlice[] | null>(null);
  const [targetCalories, setTargetCalories] = useState<number | null>(null);
  const [volumeWeeks, setVolumeWeeks] = useState<Record<string, string | number>[]>([]);
  const [volumeMuscles, setVolumeMuscles] = useState<{ key: string; color: string }[]>([]);
  const [volumeTotal, setVolumeTotal] = useState(0);
  const [heatmap, setHeatmap] = useState<HeatCell[][]>([]);
  const [consistencyPct, setConsistencyPct] = useState(0);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  // Timestamp of the data load, used as "now" for range filtering so render
  // stays pure (react-hooks/purity forbids Date.now() during render).
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Use a microtask to avoid synchronous setState in effect
  useEffect(() => {
    const timeoutId = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  /* ── Real data loading (Phase 33B) ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      // The user's clients row scopes body_composition (client_id = clients.id).
      // A trainer with no clients row simply gets the weight empty state.
      const { data: clientRow, error: clientError } = user.email
        ? await supabase
            .from('clients')
            .select('id, trainer_id')
            .eq('email', user.email)
            .maybeSingle()
        : { data: null, error: null };

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const windowStart = new Date(todayStart.getTime() - 89 * DAY_MS);

      const [sessionsRes, entriesRes, targetsRes, bodyRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, status, starts_at')
          .eq('client_id', user.id)
          .gte('starts_at', windowStart.toISOString()),
        supabase
          .from('workout_log_entries')
          .select('id, exercise_id, exercise_name, reps_per_set, weight_per_set, rpe_per_set, created_at')
          .eq('client_id', user.id),
        supabase
          .from('nutrition_targets')
          .select('calories, protein_g, carbs_g, fats_g')
          .eq('user_id', user.id)
          .maybeSingle(),
        clientRow
          ? supabase
              .from('body_composition')
              .select('recorded_at, weight_kg')
              .eq('client_id', clientRow.id)
              .not('weight_kg', 'is', null)
              .order('recorded_at', { ascending: true })
          : Promise.resolve({ data: [] as { recorded_at: string; weight_kg: number | null }[], error: null }),
      ]);
      if (cancelled) return;

      const firstError =
        clientError ?? sessionsRes.error ?? entriesRes.error ?? targetsRes.error ?? bodyRes.error;
      if (firstError) setError(firstError.message);

      const sessions = sessionsRes.data ?? [];
      const entries = entriesRes.data ?? [];

      /* ── Summary stats ── */
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const completedThisMonth = sessions.filter(
        (s) => s.status === 'completed' && new Date(s.starts_at) >= monthStart,
      );
      const trainedDays = new Set(completedThisMonth.map((s) => dayKey(new Date(s.starts_at))));

      let totalLifted = 0;
      const rpeValues: number[] = [];
      for (const e of entries) {
        e.weight_per_set.forEach((w, i) => {
          totalLifted += w * (e.reps_per_set[i] ?? 0);
        });
        rpeValues.push(...e.rpe_per_set);
      }

      setStats({
        thisMonth: completedThisMonth.length,
        totalLiftedKg: Math.round(totalLifted),
        avgRpe: rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null,
        trainingDaysPct: Math.round((trainedDays.size / now.getDate()) * 100),
      });

      /* ── Weight series (chronological) ── */
      setWeightRows(
        (bodyRes.data ?? [])
          .filter((r): r is { recorded_at: string; weight_kg: number } => r.weight_kg != null)
          .map((r) => ({ date: r.recorded_at, weight: r.weight_kg })),
      );

      /* ── Macro split from nutrition targets ── */
      const targets = targetsRes.data;
      if (targets) {
        const protein = targets.protein_g ?? 0;
        const carbs = targets.carbs_g ?? 0;
        const fats = targets.fats_g ?? 0;
        const macroCalories = protein * 4 + carbs * 4 + fats * 9;
        if (macroCalories > 0) {
          setMacros([
            { name: 'Protein', value: Math.round(((protein * 4) / macroCalories) * 100), grams: protein, color: 'var(--azfit-primary)' },
            { name: 'Carbs', value: Math.round(((carbs * 4) / macroCalories) * 100), grams: carbs, color: 'var(--azfit-secondary)' },
            { name: 'Fats', value: Math.round(((fats * 9) / macroCalories) * 100), grams: fats, color: 'var(--warning)' },
          ]);
          setTargetCalories(targets.calories ?? macroCalories);
        }
      }

      /* ── Weekly volume by primary muscle (last 4 weeks, Mon-start) ── */
      const exerciseIds = [...new Set(entries.map((e) => e.exercise_id))];
      const muscleMap = new Map<string, string>();
      if (exerciseIds.length > 0) {
        const { data: libRows } = await supabase
          .from('exercise_library')
          .select('id, primary_muscle')
          .in('id', exerciseIds);
        if (cancelled) return;
        for (const r of libRows ?? []) muscleMap.set(r.id, r.primary_muscle);
      }

      const monday = new Date(todayStart);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const weekStarts: number[] = [];
      for (let w = 3; w >= 0; w--) weekStarts.push(monday.getTime() - w * 7 * DAY_MS);

      const weekBuckets = weekStarts.map(() => new Map<string, number>());
      const muscleTotals = new Map<string, number>();
      for (const e of entries) {
        const t = new Date(e.created_at).getTime();
        const wi = weekStarts.findIndex((start) => t >= start && t < start + 7 * DAY_MS);
        if (wi === -1) continue;
        const vol = e.weight_per_set.reduce((s, w, i) => s + w * (e.reps_per_set[i] ?? 0), 0);
        if (vol <= 0) continue;
        const muscle = muscleMap.get(e.exercise_id) ?? 'Other';
        weekBuckets[wi].set(muscle, (weekBuckets[wi].get(muscle) ?? 0) + vol);
        muscleTotals.set(muscle, (muscleTotals.get(muscle) ?? 0) + vol);
      }

      const muscles = [...muscleTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key], i) => ({ key, color: MUSCLE_PALETTE[i % MUSCLE_PALETTE.length] }));
      setVolumeMuscles(muscles);
      setVolumeWeeks(
        weekStarts.map((start, wi) => {
          const row: Record<string, string | number> = {
            week: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          };
          for (const m of muscles) row[m.key] = Math.round(weekBuckets[wi].get(m.key) ?? 0);
          return row;
        }),
      );
      setVolumeTotal(Math.round([...muscleTotals.values()].reduce((a, b) => a + b, 0)));

      /* ── Consistency heatmap (last 90 days) ── */
      const dayStatus = new Map<string, 'completed' | 'scheduled'>();
      for (const s of sessions) {
        const key = dayKey(new Date(s.starts_at));
        if (s.status === 'completed') {
          dayStatus.set(key, 'completed');
        } else if (s.status === 'scheduled' && dayStatus.get(key) !== 'completed') {
          dayStatus.set(key, 'scheduled');
        }
      }

      const leadPad = (windowStart.getDay() + 6) % 7; // Monday-first columns
      const cells: HeatCell[] = [];
      for (let i = 0; i < leadPad; i++) cells.push({ level: -1, label: '' });
      for (let d = 0; d < 90; d++) {
        const date = new Date(windowStart.getTime() + d * DAY_MS);
        const status = dayStatus.get(dayKey(date));
        const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (status === 'completed') {
          cells.push({ level: 1, label: `${dateLabel}: Completed` });
        } else if (status === 'scheduled' && date.getTime() < todayStart.getTime()) {
          cells.push({ level: 0.25, label: `${dateLabel}: Scheduled` });
        } else {
          cells.push({ level: 0, label: `${dateLabel}: Rest` });
        }
      }
      while (cells.length % 7 !== 0) cells.push({ level: -1, label: '' });
      const grid: HeatCell[][] = [];
      for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
      setHeatmap(grid);
      setConsistencyPct(
        Math.round(([...dayStatus.values()].filter((v) => v === 'completed').length / 90) * 100),
      );

      /* ── Personal records (max single-set weight per exercise) ── */
      const best = new Map<string, PersonalRecord>();
      for (const e of entries) {
        e.weight_per_set.forEach((w, i) => {
          const current = best.get(e.exercise_name);
          if (!current || w > current.weight) {
            best.set(e.exercise_name, {
              exercise: e.exercise_name,
              weight: w,
              reps: e.reps_per_set[i] ?? 0,
              date: e.created_at,
            });
          }
        });
      }
      setPrs([...best.values()].sort((a, b) => b.weight - a.weight).slice(0, 6));

      setLoadedAt(Date.now());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Weight series for the selected range + 3-point moving average ── */
  const filteredWeightData = useMemo(() => {
    const cutoff = loadedAt - RANGE_DAYS[timeRange] * DAY_MS;
    const inRange = weightRows.filter((p) => new Date(p.date).getTime() >= cutoff);
    return withMovingAverage(inRange);
  }, [timeRange, weightRows, loadedAt]);

  const summaryStats = [
    { value: String(stats.thisMonth), label: 'This Month', icon: Dumbbell, color: 'var(--azfit-primary)' },
    { value: `${stats.totalLiftedKg.toLocaleString()} kg`, label: 'Total Lifted', icon: Weight, color: 'var(--azfit-secondary)' },
    { value: stats.avgRpe === null ? '—' : stats.avgRpe.toFixed(1), label: 'Avg RPE', icon: Gauge, color: 'var(--warning)' },
    { value: `${stats.trainingDaysPct}%`, label: 'Training Days', icon: Target, color: 'var(--success)' },
  ];

  const latestWeight = filteredWeightData.length > 0 ? filteredWeightData[filteredWeightData.length - 1].weight : null;
  const weightDelta =
    filteredWeightData.length >= 2
      ? +(filteredWeightData[filteredWeightData.length - 1].weight - filteredWeightData[0].weight).toFixed(1)
      : null;

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
              {loading ? (
                <Loader2 size={18} className="mt-2 animate-spin" style={{ color: stat.color }} />
              ) : (
                <span
                  className="mt-2 text-lg font-bold"
                  style={{ color: stat.color, textShadow: 'var(--text-shadow-dark)' }}
                >
                  {stat.value}
                </span>
              )}
              <span
                className="mt-0.5 text-[11px] font-medium"
                style={{ color: 'var(--light-text-muted)' }}
              >
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {error && (
          <p className="mb-6 text-center text-xs" style={{ color: 'var(--warning)' }}>
            Some analytics couldn't be loaded ({error}).
          </p>
        )}

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
              {latestWeight !== null && !loading && (
                <div className="flex items-center gap-3">
                  <span
                    className="text-lg font-bold"
                    style={{ color: 'var(--azfit-primary)', textShadow: 'var(--text-shadow-dark)' }}
                  >
                    {latestWeight} kg
                  </span>
                  {weightDelta !== null && (
                    <span
                      className="flex items-center gap-0.5 text-xs font-semibold"
                      style={{ color: 'var(--light-text-muted)' }}
                    >
                      {weightDelta > 0 ? <TrendingUp size={12} /> : weightDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Chart */}
            {loading ? (
              <SectionLoading />
            ) : filteredWeightData.length < 2 ? (
              <EmptyState
                icon={Scale}
                message={
                  weightRows.length === 0
                    ? 'No weight data yet — log your first measurement'
                    : 'Not enough measurements in this range — try a wider one'
                }
              />
            ) : (
              <WeightTrendChart
                data={filteredWeightData}
                height={window?.innerWidth >= 1024 ? 360 : 300}
              />
            )}
          </motion.div>

          {/* Row 2: Macro Donut */}
          <div className="flex flex-col gap-6 lg:flex-row">
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
                {targetCalories !== null && !loading && (
                  <span
                    className="text-lg font-bold"
                    style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                  >
                    {targetCalories.toLocaleString()} kcal target
                  </span>
                )}
              </div>

              {loading ? (
                <SectionLoading />
              ) : !macros ? (
                <EmptyState
                  icon={PieChart}
                  message="No nutrition targets set yet — your macro split will appear here once targets exist"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  {/* Donut Chart */}
                  <div style={{ width: '100%', maxWidth: 240, height: 220 }}>
                    <ResponsiveContainer>
                      <RePieChart>
                        <Pie
                          data={macros}
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
                          {macros.map((entry) => (
                            <Cell key={`macro-${entry.name}`} fill={entry.color} />
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
                        {(targetCalories ?? 0).toLocaleString()}
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
                    {macros.map((macro) => (
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
              )}
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
              {volumeTotal > 0 && !loading && (
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--azfit-secondary)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  Last 4 wks: {volumeTotal.toLocaleString()} kg
                </span>
              )}
            </div>

            {loading ? (
              <SectionLoading />
            ) : volumeMuscles.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                message="No workout volume logged in the last 4 weeks — complete a workout to see it here"
              />
            ) : (
              <div style={{ width: '100%', height: window?.innerWidth >= 1024 ? 320 : 280 }}>
                <ResponsiveContainer>
                  <BarChart data={volumeWeeks} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    {volumeMuscles.map((m, idx) => (
                      <Bar
                        key={m.key}
                        dataKey={m.key}
                        stackId="a"
                        fill={m.color}
                        radius={idx === volumeMuscles.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        animationDuration={600}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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
              {!loading && (
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--success)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  {consistencyPct}% consistency
                </span>
              )}
            </div>

            {loading ? (
              <SectionLoading />
            ) : (
              <>
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
                  {heatmap.map((week, wi) => (
                    <div key={wi} className="flex gap-1">
                      {week.map((day, di) => (
                        <div
                          key={di}
                          className="h-7 w-7 rounded transition-transform duration-150 hover:scale-110 lg:h-8 lg:w-8"
                          style={{
                            backgroundColor: heatmapColor(day.level, isDark),
                            cursor: day.level >= 0 ? 'pointer' : 'default',
                          }}
                          title={day.label}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-3">
                  {[
                    { label: 'Rest', level: 0 },
                    { label: 'Scheduled', level: 0.25 },
                    { label: 'Completed', level: 1 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1">
                      <div
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: heatmapColor(item.level, isDark) }}
                      />
                      <span className="text-[11px] font-medium" style={{ color: 'var(--light-text-muted)' }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
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
              {!loading && (
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                >
                  {prs.length} Records
                </span>
              )}
            </div>

            {loading ? (
              <SectionLoading />
            ) : prs.length === 0 ? (
              <EmptyState
                icon={Trophy}
                message="No personal records yet — complete a workout to set your first PRs"
              />
            ) : (
              /* Table */
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
                    </tr>
                  </thead>
                  <tbody>
                    {prs.map((pr, i) => (
                      <motion.tr
                        key={pr.exercise}
                        initial={{ opacity: 0, x: -20 }}
                        animate={mounted ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.5 + i * 0.08, duration: 0.4, ease: easeDefault }}
                        className="border-b transition-colors duration-150 hover:bg-[var(--light-elevated)]"
                        style={{ borderColor: 'var(--card-border)', height: 56 }}
                      >
                        <td className="px-3 py-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                          >
                            {pr.exercise}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className="font-mono text-sm font-bold"
                            style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}
                          >
                            {pr.weight} kg
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
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
