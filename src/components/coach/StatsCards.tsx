import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Target, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Coach dashboard stat cards (Phase 33B) — real trainer-scoped aggregates.
 * "Avg Client Progress" was REMOVED: no honest data source for it exists.
 */
interface CoachStats {
  activeClients: number;
  activePrograms: number;
  sessionsThisMonth: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function StatsCards() {
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const trainerId = userData.user?.id;
      if (!trainerId) {
        if (!cancelled) {
          setStats({ activeClients: 0, activePrograms: 0, sessionsThisMonth: 0 });
          setLoading(false);
        }
        return;
      }
      const monthStart = new Date();
      monthStart.setDate(1);
      const [clientsRes, programsRes, sessionsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'active'),
        supabase
          .from('programs')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'active'),
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .gte('starts_at', monthStart.toISOString()),
      ]);
      if (cancelled) return;
      const firstError = clientsRes.error ?? programsRes.error ?? sessionsRes.error;
      if (firstError) {
        setError(firstError.message);
      } else {
        setStats({
          activeClients: clientsRes.count ?? 0,
          activePrograms: programsRes.count ?? 0,
          sessionsThisMonth: sessionsRes.count ?? 0,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: 'Active Clients', value: stats?.activeClients ?? 0, sublabel: 'status: active', icon: Users, color: 'var(--azfit-primary)' },
    { label: 'Active Programs', value: stats?.activePrograms ?? 0, sublabel: 'assigned to clients', icon: Target, color: '#84CC16' },
    { label: 'Sessions This Month', value: stats?.sessionsThisMonth ?? 0, sublabel: 'all statuses', icon: Calendar, color: '#06B6D4' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={20} className="animate-spin" style={{ color: '#00AEEF' }} />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-4 text-center text-xs" style={{ color: '#F59E0B' }}>
        Couldn't load stats ({error}).
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
      {cards.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <Icon size={18} style={{ color: stat.color }} />
              <span
                className="text-[11px] font-medium lg:text-xs"
                style={{ color: 'var(--light-text-muted)' }}
              >
                {stat.label}
              </span>
            </div>
            <div
              className="mt-2 text-2xl font-extrabold lg:text-[30px]"
              style={{ color: stat.color, textShadow: 'var(--text-shadow-glow)' }}
            >
              {stat.value}
            </div>
            <div
              className="mt-0.5 text-[11px] lg:text-xs"
              style={{ color: 'var(--light-text-muted)' }}
            >
              {stat.sublabel}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
