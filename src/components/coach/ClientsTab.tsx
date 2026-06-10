import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  MessageSquare,
  UserCircle,
  ClipboardList,
  Filter,
} from 'lucide-react';
import { clients, type Client } from './data';

const filterOptions = ['All', 'Active', 'Away', 'New'] as const;

function ComplianceBadge({ rate }: { rate: number }) {
  let bg: string;
  let color: string;
  if (rate >= 80) {
    bg = 'rgba(132, 204, 22, 0.15)';
    color = '#84CC16';
  } else if (rate >= 50) {
    bg = 'rgba(245, 158, 11, 0.15)';
    color = '#F59E0B';
  } else {
    bg = 'rgba(248, 113, 113, 0.15)';
    color = '#F87171';
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {rate}%
    </span>
  );
}

function StatusDot({ status }: { status: Client['status'] }) {
  const color =
    status === 'active' ? '#84CC16' : status === 'away' ? '#F59E0B' : '#0D9488';
  return (
    <span
      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
      style={{
        backgroundColor: color,
        borderColor: 'var(--card-bg)',
      }}
    />
  );
}

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

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.goal.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === 'All' || c.status === filter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

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
            className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-all focus:border-[var(--azfit-primary)] focus:ring-[3px] focus:ring-[rgba(13,148,136,0.15)]"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--page-text)',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
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
                    ? 'rgba(13, 148, 136, 0.15)'
                    : 'transparent',
                color:
                  filter === opt
                    ? '#0D9488'
                    : 'var(--light-text-muted)',
                border:
                  filter === opt
                    ? '1px solid rgba(13, 148, 136, 0.3)'
                    : '1px solid var(--card-border)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client, i) => (
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
            {/* Top row: Avatar + Info + Actions */}
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative h-16 w-16 shrink-0 lg:h-20 lg:w-20">
                <img
                  src={client.avatar}
                  alt={client.name}
                  className="h-full w-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-full text-lg font-bold"
                  style={{
                    backgroundColor: 'var(--light-elevated)',
                    color: 'var(--azfit-primary)',
                  }}
                >
                  {client.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <StatusDot status={client.status} />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className="truncate text-sm font-semibold"
                    style={{ color: 'var(--page-text)' }}
                  >
                    {client.name}
                  </h3>
                  {client.status === 'new' && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0 text-[10px] font-bold"
                      style={{
                        backgroundColor: 'rgba(13, 148, 136, 0.15)',
                        color: '#0D9488',
                      }}
                    >
                      NEW
                    </span>
                  )}
                </div>
                <p
                  className="text-xs"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  {client.age} yrs · {client.goal}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <ComplianceBadge rate={client.compliance} />
                  <span
                    className="text-[11px]"
                    style={{ color: 'var(--light-text-muted)' }}
                  >
                    {client.lastActive}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--light-text-secondary)' }}
                >
                  Progress
                </span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: '#0D9488' }}
                >
                  {client.progress}%
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--light-elevated)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: '#0D9488' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${client.progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-3 flex items-center gap-1 border-t pt-2.5" style={{ borderColor: 'var(--card-border)' }}>
              <button
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-[0.95]"
                style={{ color: '#0D9488' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.08)';
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
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-12"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <Search size={32} style={{ color: 'var(--light-text-muted)' }} />
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: 'var(--light-text-muted)' }}
          >
            No clients found
          </p>
        </div>
      )}
    </div>
  );
}
