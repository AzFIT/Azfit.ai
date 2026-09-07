import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, Dumbbell, TrendingUp, Users, Calendar, Flame, BarChart3, Clock, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import IconTile, { type IconTileTone } from '@/components/ui/IconTile';

// ═══════════════════════════════════════════════════════════════
// DemoDashboard (Phase 76) — the PUBLIC /demo page. Every number on
// this page comes from demo_dashboard_stats() (SECURITY DEFINER RPC
// hard-scoped to the demo trainer — see supabase/demo-dashboard-stats.sql).
// No fabricated stats; sections with no data get an honest empty
// state. Pulse tokens only (both themes), IconTile stat icons.
// ═══════════════════════════════════════════════════════════════

interface DemoSessionToday {
  start_time: string;
  title: string;
  status: string;
  client: string;
}

interface DemoRecentCompleted {
  starts_at: string;
  title: string;
  duration_min: number;
  client: string;
}

interface DemoStats {
  active_clients: number;
  workouts_this_month: number;
  avg_session_minutes: number | null;
  completed_this_month: number;
  scheduled_this_month: number;
  sessions_today: DemoSessionToday[];
  recent_completed: DemoRecentCompleted[];
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

function statusTone(status: string): string {
  if (status === 'completed') return 'var(--success)';
  if (status === 'scheduled') return 'var(--azfit-primary)';
  return 'var(--light-text-muted)';
}

export default function DemoDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('demo_dashboard_stats');
      if (cancelled) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      setStats(data as DemoStats);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Completion rate only exists when this month has completed sessions —
  // honest data rule: an underivable tile is dropped (3-stat grid).
  const completionRate =
    stats && stats.completed_this_month + stats.scheduled_this_month > 0 && stats.completed_this_month > 0
      ? Math.round((stats.completed_this_month / (stats.completed_this_month + stats.scheduled_this_month)) * 100)
      : null;

  const statTiles: { label: string; value: string; icon: typeof Users; tone: IconTileTone; sub: string }[] = stats
    ? [
        { label: 'Active Clients', value: String(stats.active_clients), icon: Users, tone: 'brand', sub: 'On the roster' },
        { label: 'Workouts Logged', value: String(stats.workouts_this_month), icon: Dumbbell, tone: 'accent', sub: 'This month' },
        {
          label: 'Avg Session',
          value: stats.avg_session_minutes != null ? `${stats.avg_session_minutes}m` : '—',
          icon: Clock,
          tone: 'success',
          sub: stats.avg_session_minutes != null ? 'Per completed session' : 'No completed sessions yet',
        },
        ...(completionRate != null
          ? [{ label: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, tone: 'warn' as IconTileTone, sub: 'This month' }]
          : []),
      ]
    : [];

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--page-text)' }}>
      {/* Demo Banner (behavior unchanged) */}
      <div
        className="sticky top-0 z-50 px-4 py-2 text-center text-sm font-medium"
        style={{ backgroundColor: 'var(--azfit-primary)', color: 'white' }}
      >
        <div className="flex items-center justify-center gap-2">
          <Award size={16} />
          <span>Demo Mode — Preview the AzFIT Dashboard</span>
          <button
            onClick={() => navigate('/login')}
            className="ml-4 underline hover:no-underline"
          >
            Sign in for full access
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="border-b px-6 py-4" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--page-bg)' }}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--light-text-muted)' }}
          >
            <ArrowLeft size={16} />
            Back to home
          </button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full" style={{ background: 'linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--page-text)' }}>Demo Coach</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* Welcome */}
        <motion.div {...fadeUp(0)} className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--page-text)' }}>Welcome back, Coach!</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--light-text-secondary)' }}>
            Here's what's happening with your clients today — real demo data, not mock numbers.
          </p>
        </motion.div>

        {/* Stats Grid — skeleton while loading, honest values after */}
        {failed ? (
          <div className="mb-8 rounded-xl border p-5 text-sm" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--light-text-secondary)' }}>
            Demo stats are unavailable right now — the live preview data couldn't be loaded.
          </div>
        ) : stats === null ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
            ))}
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {statTiles.map((stat, i) => (
              <motion.div
                key={stat.label}
                {...fadeUp(i * 0.08)}
                className="rounded-xl border p-5"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--light-text-secondary)' }}>{stat.label}</p>
                    <p className="stat-numeral mt-1 text-2xl" style={{ color: 'var(--page-text)' }}>{stat.value}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--light-text-muted)' }}>{stat.sub}</p>
                  </div>
                  <IconTile icon={stat.icon} size="md" tone={stat.tone} />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent completed sessions (real) */}
          <motion.div
            {...fadeUp(0.3)}
            className="rounded-xl border p-5"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--page-text)' }}>Recent Sessions</h2>
              <BarChart3 size={18} style={{ color: 'var(--light-text-muted)' }} />
            </div>
            <div className="space-y-3">
              {stats === null ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--page-bg)' }} />
                ))
              ) : stats.recent_completed.length === 0 ? (
                <p className="py-6 text-center text-xs" style={{ color: 'var(--light-text-muted)' }}>
                  No completed sessions yet — they'll appear here once the demo coach wraps one up.
                </p>
              ) : (
                stats.recent_completed.map((s) => (
                  <div
                    key={s.starts_at + s.title}
                    className="flex items-center justify-between rounded-lg p-3"
                    style={{ backgroundColor: 'var(--page-bg)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--page-text)' }}>{s.client}</p>
                      <p className="text-xs" style={{ color: 'var(--light-text-muted)' }}>{s.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: 'var(--page-text)' }}>{s.duration_min} min</p>
                      <span
                        className="mt-1 inline-block rounded px-2 py-0.5 text-xs"
                        style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}
                      >
                        Completed
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Today's schedule (real) */}
          <motion.div
            {...fadeUp(0.38)}
            className="rounded-xl border p-5"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--page-text)' }}>Today's Schedule</h2>
              <Calendar size={18} style={{ color: 'var(--light-text-muted)' }} />
            </div>
            <div className="space-y-3">
              {stats === null ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--page-bg)' }} />
                ))
              ) : stats.sessions_today.length === 0 ? (
                <p className="py-6 text-center text-xs" style={{ color: 'var(--light-text-muted)' }}>
                  No sessions scheduled today — a genuine rest day on the demo calendar.
                </p>
              ) : (
                stats.sessions_today.map((s) => (
                  <div
                    key={s.start_time + s.client}
                    className="flex items-center justify-between rounded-lg p-3"
                    style={{ backgroundColor: 'var(--page-bg)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusTone(s.status) }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--page-text)' }}>{s.client}</p>
                        <p className="text-xs" style={{ color: 'var(--light-text-muted)' }}>{s.title}</p>
                      </div>
                    </div>
                    <span className="text-sm" style={{ color: 'var(--page-text)' }}>{s.start_time}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* CTA Section (behavior unchanged) */}
        <motion.div
          {...fadeUp(0.46)}
          className="mt-8 rounded-xl border p-6 text-center"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <Flame size={32} className="mx-auto mb-3" style={{ color: 'var(--azfit-primary)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--page-text)' }}>Ready to manage your clients?</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--light-text-secondary)' }}>
            Sign up for free and get access to AI program building, nutrition tracking, and more.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => navigate('/signup')}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--azfit-primary), var(--azfit-accent))' }}
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg border px-6 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
              style={{ borderColor: 'var(--card-border)', backgroundColor: 'transparent', color: 'var(--page-text)' }}
            >
              Sign In
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
