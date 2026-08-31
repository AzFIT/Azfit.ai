import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  MessageSquare,
  UserCircle,
  ClipboardList,
  Filter,
  Plus,
  Loader2,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clientStatusMeta } from '@/lib/clientStatus';
import { formatDate } from '@/lib/utils';
import QuickAddClientModal from '@/components/QuickAddClientModal';
import type { Database } from '@/types/supabase';

/**
 * Coach dashboard clients tab (Phase 33B) — real trainer-scoped clients only.
 * All fabricated metrics (fitness score, streak, compliance, weight change,
 * progress, last active, next session) were REMOVED: no honest data source
 * for them exists.
 */
type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  | 'id'
  | 'full_name'
  | 'email'
  | 'status'
  | 'fitness_goal'
  | 'experience_level'
  | 'created_at'
>;

const filterOptions = ['All', 'Active', 'Inactive', 'Paused', 'Trial'] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function ClientsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>('All');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [clientList, setClientList] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const trainerId = userData.user?.id;
      if (!trainerId) {
        if (!cancelled) {
          setClientList([]);
          setLoading(false);
        }
        return;
      }
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('id, full_name, email, status, fitness_goal, experience_level, created_at')
        .eq('trainer_id', trainerId)
        .neq('status', 'archived')
        .order('full_name');
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setClientList(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return clientList.filter((c) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !search ||
        c.full_name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.fitness_goal ?? '').toLowerCase().includes(term);
      const matchesFilter =
        filter === 'All' || c.status === filter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [clientList, search, filter]);

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-[320px]">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--light-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-all focus:border-[var(--azfit-primary)] focus:ring-[3px] focus:ring-[color-mix(in srgb, var(--azfit-primary) 15%, transparent)]"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--page-text)',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--azfit-primary)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0B7A75]"
          >
            <Plus size={14} />
            Add Client
          </button>
          <Filter
            size={16}
            style={{ color: 'var(--light-text-muted)' }}
          />
          {filterOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-[0.95]"
              style={{
                backgroundColor:
                  filter === opt
                    ? 'color-mix(in srgb, var(--azfit-primary) 15%, transparent)'
                    : 'transparent',
                color:
                  filter === opt
                    ? 'var(--azfit-primary)'
                    : 'var(--light-text-muted)',
                border:
                  filter === opt
                    ? '1px solid color-mix(in srgb, var(--azfit-primary) 3%, transparent)'
                    : '1px solid var(--card-border)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: '#00AEEF' }} />
        </div>
      ) : error ? (
        <p className="py-4 text-center text-xs" style={{ color: '#F59E0B' }}>
          Couldn't load clients ({error}).
        </p>
      ) : (
        <>
          {/* Client Grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((client, i) => {
              const meta = clientStatusMeta(client.status);
              return (
                <motion.div
                  key={client.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className="rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                  }}
                >
                  {/* Top row: Avatar + Info */}
                  <div className="flex items-start gap-3">
                    {/* Avatar: initials + status dot */}
                    <div className="relative h-16 w-16 shrink-0 lg:h-20 lg:w-20">
                      <div
                        className="flex h-full w-full items-center justify-center rounded-full text-lg font-bold"
                        style={{
                          backgroundColor: 'var(--light-elevated)',
                          color: 'var(--azfit-primary)',
                        }}
                      >
                        {client.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <span
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
                        style={{
                          backgroundColor: meta.color,
                          borderColor: 'var(--card-bg)',
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className="truncate text-sm font-semibold"
                          style={{ color: 'var(--page-text)' }}
                        >
                          {client.full_name}
                        </h3>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: meta.bg,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p
                        className="truncate text-xs"
                        style={{ color: 'var(--light-text-muted)' }}
                      >
                        {client.email}
                      </p>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: 'var(--light-text-muted)' }}
                      >
                        {client.fitness_goal ?? 'No goal set'}
                        {client.experience_level
                          ? ` · ${client.experience_level[0].toUpperCase()}${client.experience_level.slice(1)}`
                          : ''}
                      </p>
                      <p
                        className="mt-1 text-[11px]"
                        style={{ color: 'var(--light-text-muted)' }}
                      >
                        Client since {formatDate(client.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-3 flex items-center gap-1 border-t pt-2.5" style={{ borderColor: 'var(--card-border)' }}>
                    <button
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-[0.95]"
                      style={{ color: 'var(--azfit-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--azfit-primary) 08%, transparent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <MessageSquare size={14} />
                      Message
                    </button>
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
                      <UserCircle size={14} />
                      Profile
                    </button>
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
                      <ClipboardList size={14} />
                      Program
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border py-12"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              {clientList.length === 0 ? (
                <>
                  <Users size={32} style={{ color: 'var(--light-text-muted)' }} />
                  <p
                    className="mt-2 text-sm font-medium"
                    style={{ color: 'var(--light-text-muted)' }}
                  >
                    No clients yet
                  </p>
                </>
              ) : (
                <>
                  <Search size={32} style={{ color: 'var(--light-text-muted)' }} />
                  <p
                    className="mt-2 text-sm font-medium"
                    style={{ color: 'var(--light-text-muted)' }}
                  >
                    No clients found
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Quick Add Client Modal */}
      <QuickAddClientModal
        open={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />
    </div>
  );
}
