 
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown, TrendingUp, Plus, Trash2, Edit3, X,
  Weight, Target, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/* ── Types ─────────────────────────────────────────────── */

interface BioEntry {
  id: string;
  date: string;
  weight: number;
  bodyFatPercentage?: number;
  measurements?: Record<string, number>;
  photo?: string;
  notes?: string;
}

/* ── Storage Helpers ───────────────────────────────────── */

const STORAGE_KEY = 'azfit_bio_history';
const PROFILE_KEY = 'azfit_client_profile';

function getHistory(): BioEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(entries: BioEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function getProfile(): { weight: number; goalWeight: number; bodyFatPercentage?: number } | null {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
}

/* ── Main Component ────────────────────────────────────── */

export default function BioPrintPage() {
  const [history, setHistory] = useState<BioEntry[]>(getHistory);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const profile = getProfile();
  const sorted = useMemo(() => [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [history]);
  const first = sorted[sorted.length - 1];
  const latest = sorted[0];

  const stats = useMemo(() => {
    if (!latest) return null;
    const startWeight = first?.weight || profile?.weight || latest.weight;
    const goalWeight = profile?.goalWeight || startWeight;
    const totalChange = latest.weight - startWeight;
    const daysSince = first ? Math.floor((new Date(latest.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const weeklyRate = daysSince > 0 ? totalChange / (daysSince / 7) : 0;
    const remaining = goalWeight - latest.weight;
    const weeksToGoal = weeklyRate !== 0 ? Math.abs(remaining / weeklyRate) : 0;

    return {
      currentWeight: latest.weight,
      totalChange,
      daysSince,
      weeklyRate,
      weeksToGoal: weeksToGoal > 0 && weeksToGoal < 500 ? weeksToGoal : null,
      startWeight,
      goalWeight,
    };
  }, [latest, first, profile]);

  const weightData = useMemo(() =>
    [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((e) => ({
      date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: e.weight,
      goal: profile?.goalWeight,
    })), [history, profile]);

  const bfData = useMemo(() =>
    [...history].filter((e) => e.bodyFatPercentage).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((e) => ({
      date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bf: e.bodyFatPercentage,
    })), [history]);

  const handleSave = useCallback((entry: BioEntry) => {
    setHistory((prev) => {
      const next = editingId
        ? prev.map((e) => (e.id === editingId ? entry : e))
        : [...prev, entry];
      saveHistory(next);
      return next;
    });
    setShowModal(false);
    setEditingId(null);
  }, [editingId]);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Delete this entry?')) return;
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  return (
    <div className="min-h-[100dvh] pb-20" style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Bio Print Tracker</h1>

        {/* Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Weight} label="Current" value={`${stats.currentWeight} kg`} />
            <StatCard
              icon={stats.totalChange <= 0 ? TrendingDown : TrendingUp}
              label="Total Change"
              value={`${stats.totalChange > 0 ? '+' : ''}${stats.totalChange.toFixed(1)} kg`}
              color={stats.totalChange <= 0 ? '#22C55E' : '#EF4444'}
            />
            <StatCard icon={Clock} label="Days Since Start" value={`${stats.daysSince}`} />
            <StatCard icon={Target} label="Est. Weeks to Goal" value={stats.weeksToGoal ? `${Math.round(stats.weeksToGoal)}` : '—'} />
          </div>
        )}

        {/* Charts */}
        {weightData.length > 1 && (
          <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Weight Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00AEEF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="weight" stroke="#00AEEF" fill="url(#weightGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {bfData.length > 1 && (
          <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Body Fat % Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bfData}>
                <defs>
                  <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="bf" stroke="#8B5CF6" fill="url(#bfGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History Table */}
        <div className="mb-6 rounded-2xl border" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>History</h3>
            <Button
              onClick={() => { setEditingId(null); setShowModal(true); }}
              size="sm"
              className="gap-1"
              style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
            >
              <Plus className="h-3.5 w-3.5" /> Log Entry
            </Button>
          </div>
          {sorted.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No entries yet. Log your first measurement!</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {sorted.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {new Date(entry.date).toLocaleDateString()} • {entry.weight} kg
                    </p>
                    {entry.bodyFatPercentage && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>BF: {entry.bodyFatPercentage}%</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(entry.id); setShowModal(true); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-800"
                    >
                      <Edit3 className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Entry Modal */}
      <AnimatePresence>
        {showModal && (
          <LogEntryModal
            entry={editingId ? history.find((e) => e.id === editingId) : undefined}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditingId(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Components ────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--card-border)' }}>
      <Icon className="mb-1 h-4 w-4" style={{ color: color || '#00AEEF' }} />
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function LogEntryModal({ entry, onSave, onClose }: { entry?: BioEntry; onSave: (e: BioEntry) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    date: entry?.date || new Date().toISOString().split('T')[0],
    weight: entry?.weight || 0,
    bodyFatPercentage: entry?.bodyFatPercentage || undefined as number | undefined,
    measurements: entry?.measurements || {} as Record<string, number>,
    notes: entry?.notes || '',
  });

  const handleSubmit = () => {
    onSave({
      id: entry?.id || crypto.randomUUID(),
      date: form.date,
      weight: form.weight,
      bodyFatPercentage: form.bodyFatPercentage,
      measurements: form.measurements,
      notes: form.notes,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg rounded-t-2xl p-6 lg:rounded-2xl"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {entry ? 'Edit Entry' : 'Log Entry'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-800"><X className="h-5 w-5" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" value={form.weight || ''} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Body Fat %</Label>
              <Input type="number" value={form.bodyFatPercentage || ''} onChange={(e) => setForm({ ...form, bodyFatPercentage: Number(e.target.value) || undefined })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="min-h-[60px] w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <Button onClick={handleSubmit} className="mt-4 w-full" style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}>
          {entry ? 'Update' : 'Save'} Entry
        </Button>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{children}</p>;
}
