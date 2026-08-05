import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingDown, TrendingUp, Plus, Trash2, Edit3, X,
  Weight, Target, Clock, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useBodyComposition, type BodyCompositionRow, type SkinfoldAssessmentRow, type HistoryItem } from "@/components/bodycomp/useBodyComposition";
import { AssessmentWizard } from "@/components/bodycomp/AssessmentWizard";
import {
  calculateBMR,
  calculateBMRKatchMcArdle,
  calculateTDEE,
  calculateMacros,
  suggestPresetByBodyFat,
  activityLabel,
  ACTIVITY_LEVELS,
  type ActivityLevelKey,
} from "@/lib/tdee";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { getOnboardingData } from "@/lib/storage";

/* ── Types ─────────────────────────────────────────────── */

interface LogForm {
  recorded_at: string;
  weight_kg: string;
  body_fat_percentage: string;
  chest_cm: string;
  waist_cm: string;
  hips_cm: string;
  arms_cm: string;
  thighs_cm: string;
  notes: string;
}

interface ClientProfileSnapshot {
  activity_level?: string;
  gender?: "male" | "female" | "other" | null;
  height_cm?: number | null;
  date_of_birth?: string | null;
  weight_kg?: number | null;
}

/* ── Main Component ────────────────────────────────────── */

export default function BioPrintPage() {
  const navigate = useNavigate();
  const { user, isTrainer } = useAuth();
  const {
    hasClientRecord,
    loading,
    bodyComposition,
    history,
    latestBodyComposition,
    latestBodyFatPct,
    latestWeightKg,
    saveBodyComposition,
    deleteBodyComposition,
    deleteAssessment,
  } = useBodyComposition();

  // Phase 33D Fix 7: trainers have no client record of their own — give them
  // a useful landing (client picker → client's Bio History tab) instead of
  // the client-centric dead end.
  const [trainerClients, setTrainerClients] = useState<{ id: string; full_name: string }[]>([]);
  useEffect(() => {
    if (!isTrainer || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("trainer_id", user.id)
        .neq("status", "archived")
        .order("full_name");
      if (!cancelled) setTrainerClients(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [isTrainer, user?.id]);

  const [showLogModal, setShowLogModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientProfileSnapshot>({});

  /* ── Fetch client profile for TDEE defaults ──────────────────────── */
  useEffect(() => {
    // Phase 43 Fix 3: trainers land on the client picker — they have no
    // clients row of their own, so skip this lookup entirely (it 406'd).
    if (!user?.email || isTrainer) return;

    let cancelled = false;
    const fetchProfile = async () => {
      // activity_level lives in intake_profile (no such top-level column —
      // the old select 400'd); maybeSingle: users without a clients row
      // get null instead of a 406.
      const { data } = await supabase
        .from("clients")
        .select("intake_profile, gender, height_cm, date_of_birth, weight_kg")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled && data) {
        const ip = data.intake_profile as { activity_level?: string } | null;
        setProfile({
          activity_level: ip?.activity_level,
          gender: data.gender,
          height_cm: data.height_cm,
          date_of_birth: data.date_of_birth,
          weight_kg: data.weight_kg,
        });
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.email, isTrainer]);

  /* ── Goal weight fallback ──────────────────────────────────────────── */
  const goalWeight = useMemo(() => {
    const legacy = getOnboardingData()?.goalWeight;
    if (legacy && legacy > 0) return legacy;
    const sorted = [...bodyComposition].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    return sorted[0]?.weight_kg || latestWeightKg || 0;
  }, [bodyComposition, latestWeightKg]);

  /* ── Stats ─────────────────────────────────────────────────────────── */
  const sortedAsc = useMemo(
    () => [...bodyComposition].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
    [bodyComposition]
  );
  const first = sortedAsc[0];
  const latest = latestBodyComposition;

  const stats = useMemo(() => {
    if (!latest) return null;
    const startWeight = first?.weight_kg || goalWeight || latest.weight_kg || 0;
    const currentWeight = latest.weight_kg || startWeight;
    const totalChange = currentWeight - startWeight;
    const daysSince = first ? Math.floor((new Date(latest.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const weeklyRate = daysSince > 0 ? totalChange / (daysSince / 7) : 0;
    const remaining = goalWeight - currentWeight;
    const weeksToGoal = weeklyRate !== 0 ? Math.abs(remaining / weeklyRate) : 0;

    return {
      currentWeight,
      totalChange,
      daysSince,
      weeklyRate,
      weeksToGoal: weeksToGoal > 0 && weeksToGoal < 500 ? weeksToGoal : null,
      startWeight,
      goalWeight,
    };
  }, [latest, first, goalWeight]);

  /* ── Chart data ────────────────────────────────────────────────────── */
  const weightData = useMemo(() =>
    sortedAsc.map((e) => ({
      date: new Date(e.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      weight: e.weight_kg,
      goal: goalWeight,
    })), [sortedAsc, goalWeight]);

  const bfData = useMemo(() =>
    sortedAsc
      .filter((e) => e.body_fat_percentage != null)
      .map((e) => ({
        date: new Date(e.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        bf: e.body_fat_percentage,
      })), [sortedAsc]);

  /* ── Handlers ──────────────────────────────────────────────────────── */
  const handleSaveLog = useCallback(
    async (form: LogForm) => {
      const payload = {
        recorded_at: form.recorded_at ? new Date(form.recorded_at).toISOString() : new Date().toISOString(),
        weight_kg: parseFloat(form.weight_kg) || null,
        body_fat_percentage: parseFloat(form.body_fat_percentage) || null,
        chest_cm: parseFloat(form.chest_cm) || null,
        waist_cm: parseFloat(form.waist_cm) || null,
        hips_cm: parseFloat(form.hips_cm) || null,
        arms_cm: parseFloat(form.arms_cm) || null,
        thighs_cm: parseFloat(form.thighs_cm) || null,
        notes: form.notes || null,
      };

      await saveBodyComposition(payload, editingId || undefined);
      setShowLogModal(false);
      setEditingId(null);
    },
    [saveBodyComposition, editingId]
  );

  const handleDelete = useCallback(async (item: HistoryItem) => {
    if (!confirm("Delete this entry?")) return;
    if (item.kind === "body_composition") {
      await deleteBodyComposition(item.id);
    } else {
      await deleteAssessment(item.id);
    }
  }, [deleteBodyComposition, deleteAssessment]);

  const openEdit = useCallback((item: HistoryItem) => {
    if (item.kind !== "body_composition") return;
    setEditingId(item.id);
    setShowLogModal(true);
  }, []);

  /* ── Empty state when no client record ─────────────────────────────── */
  if (!hasClientRecord && !loading) {
    if (isTrainer) {
      // Trainer landing: pick a client to view their Bio History
      return (
        <div className="min-h-[100dvh] pb-20" style={{ backgroundColor: "var(--page-bg)" }}>
          <div className="mx-auto max-w-4xl px-4 py-6">
            <h1 className="mb-6 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bio Print Tracker</h1>
            <div className="rounded-2xl border p-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="mb-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Bio Print data lives on each client's profile.
              </p>
              <p className="mb-4 text-sm" style={{ color: "var(--light-text-muted)" }}>
                Pick a client to open their Bio History tab, or add a new client from the Clients page.
              </p>
              {trainerClients.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>No clients yet — add your first client from the Clients page.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {trainerClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/client/${c.id}?tab=bio`)}
                      className="rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all hover:border-[#00AEEF]/60"
                      style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}
                    >
                      {c.full_name}
                      <span className="mt-0.5 block text-[11px]" style={{ color: "#00AEEF" }}>Open Bio History →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-[100dvh] pb-20" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="mb-6 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bio Print Tracker</h1>
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--card-border)" }}>
            <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Your trainer needs to add you as a client first
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Once your trainer creates your client profile, your body composition and assessment data will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-20" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bio Print Tracker</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => { setEditingId(null); setShowLogModal(true); }}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Log Entry
            </Button>
            <Button
              onClick={() => setShowWizard(true)}
              size="sm"
              className="gap-1"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              <Plus className="h-3.5 w-3.5" /> New Assessment
            </Button>
          </div>
        </div>

        {loading && bodyComposition.length === 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800" />
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-2xl bg-slate-800" />
          </div>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Weight} label="Current" value={`${stats.currentWeight.toFixed(1)} kg`} />
                <StatCard
                  icon={stats.totalChange <= 0 ? TrendingDown : TrendingUp}
                  label="Total Change"
                  value={`${stats.totalChange > 0 ? "+" : ""}${stats.totalChange.toFixed(1)} kg`}
                  color={stats.totalChange <= 0 ? "#22C55E" : "#EF4444"}
                />
                <StatCard icon={Clock} label="Days Since Start" value={`${stats.daysSince}`} />
                <StatCard icon={Target} label="Est. Weeks to Goal" value={stats.weeksToGoal ? `${Math.round(stats.weeksToGoal)}` : "—"} />
              </div>
            )}

            {/* TDEE Card */}
            {latestBodyFatPct != null && latestWeightKg != null && (
              <TDEECard
                bodyFatPct={latestBodyFatPct}
                weightKg={latestWeightKg}
                heightCm={profile.height_cm}
                age={profile.date_of_birth ? calculateAge(profile.date_of_birth) : undefined}
                gender={profile.gender || undefined}
                defaultActivity={(profile.activity_level as ActivityLevelKey) || "moderate"}
              />
            )}

            {/* Charts */}
            {weightData.length > 1 && (
              <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="mb-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Weight Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={weightData}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00AEEF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="weight" stroke="#00AEEF" fill="url(#weightGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {bfData.length > 1 && (
              <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="mb-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Body Fat % Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={bfData}>
                    <defs>
                      <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="bf" stroke="#8B5CF6" fill="url(#bfGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* History */}
            <div className="mb-6 rounded-2xl border" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>History</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => { setEditingId(null); setShowLogModal(true); }}
                    size="sm"
                    variant="outline"
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Log Entry
                  </Button>
                  <Button
                    onClick={() => setShowWizard(true)}
                    size="sm"
                    className="gap-1"
                    style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
                  >
                    <Plus className="h-3.5 w-3.5" /> New Assessment
                  </Button>
                </div>
              </div>
              {history.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No entries yet. Log your first measurement or start a skinfold assessment!</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                  {history.map((item) => (
                    <HistoryRow key={`${item.kind}-${item.id}`} item={item} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Log Entry Modal */}
      <AnimatePresence>
        {showLogModal && (
          <LogEntryModal
            entry={editingId ? bodyComposition.find((e) => e.id === editingId) : undefined}
            onSave={handleSaveLog}
            onClose={() => { setShowLogModal(false); setEditingId(null); }}
          />
        )}
      </AnimatePresence>

      {/* Assessment Wizard */}
      <AssessmentWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSaved={() => setShowWizard(false)}
      />
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
      <Icon className="mb-1 h-4 w-4" style={{ color: color || "#00AEEF" }} />
      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function HistoryRow({
  item,
  onEdit,
  onDelete,
}: {
  item: HistoryItem;
  onEdit: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
}) {
  const date = new Date(item.date).toLocaleDateString();

  if (item.kind === "assessment") {
    const data = item.data as SkinfoldAssessmentRow;
    return (
      <div className="flex items-center justify-between p-3">
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {date} • <span className="rounded bg-[rgba(139,92,246,0.15)] px-1.5 py-0.5 text-xs" style={{ color: "#8B5CF6" }}>{data.protocol.toUpperCase()}</span>
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sum: {data.sum_mm?.toFixed(1)} mm
            {data.body_fat_pct != null ? ` • BF: ${data.body_fat_pct.toFixed(1)}%` : ""}
            {data.weight_kg != null ? ` • Weight: ${data.weight_kg.toFixed(1)} kg` : ""}
          </p>
        </div>
        <button
          onClick={() => onDelete(item)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
      </div>
    );
  }

  const data = item.data as BodyCompositionRow;
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {date} • {data.weight_kg != null ? `${data.weight_kg.toFixed(1)} kg` : "—"}
        </p>
        {data.body_fat_percentage != null && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>BF: {data.body_fat_percentage.toFixed(1)}%</p>
        )}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onEdit(item)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-800"
        >
          <Edit3 className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}

function LogEntryModal({
  entry,
  onSave,
  onClose,
}: {
  entry?: BodyCompositionRow;
  onSave: (form: LogForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<LogForm>({
    recorded_at: entry ? new Date(entry.recorded_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    weight_kg: entry?.weight_kg?.toString() || "",
    body_fat_percentage: entry?.body_fat_percentage?.toString() || "",
    chest_cm: entry?.chest_cm?.toString() || "",
    waist_cm: entry?.waist_cm?.toString() || "",
    hips_cm: entry?.hips_cm?.toString() || "",
    arms_cm: entry?.arms_cm?.toString() || "",
    thighs_cm: entry?.thighs_cm?.toString() || "",
    notes: entry?.notes || "",
  });

  const handleSubmit = () => onSave(form);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-lg rounded-t-2xl p-6 lg:rounded-2xl"
        style={{ backgroundColor: "var(--card-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {entry ? "Edit Entry" : "Log Entry"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-800"><X className="h-5 w-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.recorded_at} onChange={(e) => setForm({ ...form, recorded_at: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
            </div>
            <div>
              <Label>Body Fat %</Label>
              <Input type="number" step="0.1" value={form.body_fat_percentage} onChange={(e) => setForm({ ...form, body_fat_percentage: e.target.value })} />
            </div>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--text-muted)" }}>Tape measurements (cm)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <TapeInput label="Chest" value={form.chest_cm} onChange={(v) => setForm({ ...form, chest_cm: v })} />
              <TapeInput label="Waist" value={form.waist_cm} onChange={(v) => setForm({ ...form, waist_cm: v })} />
              <TapeInput label="Hips" value={form.hips_cm} onChange={(v) => setForm({ ...form, hips_cm: v })} />
              <TapeInput label="Arms" value={form.arms_cm} onChange={(v) => setForm({ ...form, arms_cm: v })} />
              <TapeInput label="Thighs" value={form.thighs_cm} onChange={(v) => setForm({ ...form, thighs_cm: v })} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="min-h-[60px] w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <Button onClick={handleSubmit} className="mt-4 w-full" style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}>
          {entry ? "Update" : "Save"} Entry
        </Button>
      </motion.div>
    </motion.div>
  );
}

function TapeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(e.target.value)} placeholder="cm" />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

function TDEECard({
  bodyFatPct,
  weightKg,
  heightCm,
  age,
  gender,
  defaultActivity,
}: {
  bodyFatPct: number;
  weightKg: number;
  heightCm?: number | null;
  age?: number;
  gender?: "male" | "female" | "other" | null;
  defaultActivity?: ActivityLevelKey | string;
}) {
  const [method, setMethod] = useState<"mifflin" | "katch">("katch");
  const [activity, setActivity] = useState<ActivityLevelKey>((defaultActivity as ActivityLevelKey) || "moderate");

  const bmr = useMemo(() => {
    if (method === "katch") return calculateBMRKatchMcArdle(bodyFatPct, weightKg);
    if (heightCm && age && gender && gender !== "other") return calculateBMR(weightKg, heightCm, age, gender);
    return 0;
  }, [method, bodyFatPct, weightKg, heightCm, age, gender]);

  const tdee = useMemo(() => calculateTDEE(bmr, activity), [bmr, activity]);
  const preset = useMemo(() => suggestPresetByBodyFat(bodyFatPct), [bodyFatPct]);
  const macros = useMemo(() => calculateMacros(tdee, preset), [tdee, preset]);

  return (
    <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: "var(--card-border)" }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4" style={{ color: "#00AEEF" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Your TDEE</h3>
        </div>
        <div className="flex rounded-lg border p-0.5 text-[10px]" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={() => setMethod("katch")}
            className={`rounded px-2 py-1 ${method === "katch" ? "bg-[rgba(0,174,239,0.15)]" : ""}`}
            style={{ color: method === "katch" ? "#00AEEF" : "var(--text-muted)" }}
          >
            Katch-McArdle
          </button>
          <button
            onClick={() => setMethod("mifflin")}
            className={`rounded px-2 py-1 ${method === "mifflin" ? "bg-[rgba(0,174,239,0.15)]" : ""}`}
            style={{ color: method === "mifflin" ? "#00AEEF" : "var(--text-muted)" }}
          >
            Mifflin-St Jeor
          </button>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Activity level</label>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value as ActivityLevelKey)}
          className="w-full rounded-xl border bg-transparent px-2 py-2 text-sm outline-none"
          style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
        >
          {Object.keys(ACTIVITY_LEVELS).map((key) => (
            <option key={key} value={key}>{activityLabel(key)}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>BMR</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{Math.round(bmr)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal</p>
        </div>
        <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--card-border)", background: "linear-gradient(135deg, rgba(0, 174, 239, 0.1), rgba(139, 92, 246, 0.1))" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>TDEE</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{Math.round(tdee)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal</p>
        </div>
      </div>

      <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Macros — {preset.name}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{preset.protein}%P / {preset.fats}%F / {preset.carbs}%C</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MacroPill label="Protein" value={Math.round(macros.protein)} unit="g" color="#22C55E" />
          <MacroPill label="Fats" value={Math.round(macros.fats)} unit="g" color="#F59E0B" />
          <MacroPill label="Carbs" value={Math.round(macros.carbs)} unit="g" color="#8B5CF6" />
        </div>
      </div>

      {method === "mifflin" && (!heightCm || !age || !gender || gender === "other") && (
        <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
          Complete your height, age and gender in your client profile to use Mifflin-St Jeor.
        </p>
      )}
    </div>
  );
}

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: "var(--card-border)" }}>
      <p className="text-xs font-bold" style={{ color }}>{value}{unit}</p>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}
