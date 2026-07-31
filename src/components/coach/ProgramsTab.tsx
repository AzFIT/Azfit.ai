import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Calendar, Clock, Edit, UserPlus, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { Database } from '@/types/supabase';

/**
 * Coach dashboard programs tab (Phase 33B) — real trainer-scoped programs.
 * The fabricated completion-rate bar, client counts and per-program colors
 * were REMOVED: no honest data source for them exists. The assigned client
 * name comes from a separate clients lookup (the programs table has no
 * typed FK relationship for an embedded join).
 */
type ProgramRow = Pick<
  Database['public']['Tables']['programs']['Row'],
  | 'id'
  | 'name'
  | 'status'
  | 'duration_weeks'
  | 'frequency_per_week'
  | 'created_at'
  | 'client_id'
>;

const PROGRAM_STATUS: Record<
  ProgramRow['status'],
  { label: string; color: string; bg: string }
> = {
  draft: { label: 'Draft', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  active: { label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  completed: { label: 'Completed', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  archived: { label: 'Archived', color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function ProgramsTab() {
  const [programList, setProgramList] = useState<ProgramRow[]>([]);
  const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const trainerId = userData.user?.id;
      if (!trainerId) {
        if (!cancelled) {
          setProgramList([]);
          setLoading(false);
        }
        return;
      }
      const [programsRes, clientsRes] = await Promise.all([
        supabase
          .from('programs')
          .select('id, name, status, duration_weeks, frequency_per_week, created_at, client_id')
          .eq('trainer_id', trainerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('id, full_name')
          .eq('trainer_id', trainerId),
      ]);
      if (cancelled) return;
      const firstError = programsRes.error ?? clientsRes.error;
      if (firstError) {
        setError(firstError.message);
      } else {
        setClientNames(
          new Map((clientsRes.data ?? []).map((c) => [c.id, c.full_name])),
        );
        setProgramList(programsRes.data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin" style={{ color: '#00AEEF' }} />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-4 text-center text-xs" style={{ color: '#F59E0B' }}>
        Couldn't load programs ({error}).
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {programList.map((program, i) => {
        const status = PROGRAM_STATUS[program.status];
        const assignedName = program.client_id
          ? clientNames.get(program.client_id) ?? 'Unassigned'
          : 'Unassigned';
        return (
          <motion.div
            key={program.id}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="group overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            {/* Status color header strip */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: status.color }}
            />

            <div className="p-5">
              {/* Program Name + Status */}
              <div className="flex items-center gap-2">
                <h3
                  className="min-w-0 truncate text-lg font-bold"
                  style={{ color: 'var(--page-text)' }}
                >
                  {program.name}
                </h3>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: status.bg,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
              </div>

              {/* Stats Row */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  <Calendar size={13} />
                  {program.duration_weeks} weeks
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  <Clock size={13} />
                  {program.frequency_per_week} days/week
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  <Users size={13} />
                  {assignedName}
                </span>
              </div>

              {/* Created date */}
              <p
                className="mt-2 text-[11px]"
                style={{ color: 'var(--light-text-muted)' }}
              >
                Created {formatDate(program.created_at)}
              </p>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
                <button
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-[0.95]"
                  style={{ color: 'var(--light-text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--light-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Edit size={13} />
                  Edit
                </button>
                <button
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 active:scale-[0.95]"
                  style={{
                    color: '#0D9488',
                    border: '1px solid rgba(13,148,136,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <UserPlus size={13} />
                  Assign
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}

      {programList.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            minHeight: 240,
          }}
        >
          <ClipboardList size={32} style={{ color: 'var(--light-text-muted)' }} />
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--light-text-muted)' }}
          >
            No programs yet
          </p>
        </div>
      )}

      {/* Create New Program CTA Card */}
      <motion.button
        custom={programList.length}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 transition-all duration-200 hover:shadow-md active:scale-[0.98]"
        style={{
          borderColor: 'rgba(13, 148, 136, 0.35)',
          backgroundColor: 'rgba(13, 148, 136, 0.03)',
          minHeight: 240,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.06)';
          e.currentTarget.style.borderColor = 'rgba(13,148,136,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.03)';
          e.currentTarget.style.borderColor = 'rgba(13,148,136,0.35)';
        }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
        >
          <Plus size={24} style={{ color: '#0D9488' }} />
        </div>
        <span
          className="text-sm font-semibold"
          style={{ color: '#0D9488' }}
        >
          Create New Program
        </span>
        <span
          className="text-center text-xs"
          style={{ color: 'var(--light-text-muted)' }}
        >
          Build a custom training program for your clients
        </span>
      </motion.button>
    </div>
  );
}
