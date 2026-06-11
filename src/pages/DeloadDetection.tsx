import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Brain, TrendingDown, TrendingUp, Activity,
  Battery, BatteryWarning, BatteryCharging, CheckCircle2,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

interface ReadinessEntry {
  date: string;
  sleep: number; // hours
  soreness: number; // 1-10
  energy: number; // 1-10
  stress: number; // 1-10
  motivation: number; // 1-10
  hrv?: number; // optional
}

/* ── Storage ───────────────────────────────────────────── */

const STORAGE_KEY = 'azfit_readiness_scores';
const WORKOUT_KEY = 'azfit_workout_logs';

function loadReadiness(): ReadinessEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveReadiness(entries: ReadinessEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadWorkouts() {
  try { return JSON.parse(localStorage.getItem(WORKOUT_KEY) || '[]'); } catch { return []; }
}

/* ── Main Component ────────────────────────────────────── */

export default function DeloadDetectionPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ReadinessEntry[]>(loadReadiness);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [sleep, setSleep] = useState(7);
  const [soreness, setSoreness] = useState(3);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(3);
  const [motivation, setMotivation] = useState(7);
  const [hrv, setHrv] = useState('');

  const workouts = loadWorkouts();

  // Calculate readiness score (0-100)
  const latestScore = useMemo(() => {
    if (entries.length === 0) return null;
    const latest = entries[entries.length - 1];
    return calculateScore(latest);
  }, [entries]);

  const scoreHistory = useMemo(() => {
    return entries.map((e) => ({
      date: e.date,
      score: calculateScore(e),
    }));
  }, [entries]);

  const trend = useMemo(() => {
    if (scoreHistory.length < 3) return 'neutral';
    const recent = scoreHistory.slice(-3).reduce((s, e) => s + e.score, 0) / 3;
    const previous = scoreHistory.slice(-6, -3).reduce((s, e) => s + e.score, 0) / 3;
    if (recent < previous - 10) return 'declining';
    if (recent > previous + 5) return 'improving';
    return 'stable';
  }, [scoreHistory]);

  const deloadRecommended = useMemo(() => {
    if (!latestScore) return false;
    // Recommend deload if score < 50 or declining trend with score < 60
    if (latestScore < 50) return true;
    if (trend === 'declining' && latestScore < 60) return true;
    // Also check if 3+ weeks of hard training without deload
    const hardWeeks = countHardTrainingWeeks(workouts);
    if (hardWeeks >= 3 && latestScore < 65) return true;
    return false;
  }, [latestScore, trend, workouts]);

  const handleSubmit = () => {
    const entry: ReadinessEntry = {
      date: new Date().toISOString().split('T')[0],
      sleep,
      soreness,
      energy,
      stress,
      motivation,
      hrv: hrv ? parseInt(hrv) : undefined,
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveReadiness(updated);
    setShowForm(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#00AEEF]" />
            Recovery & Deload
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Score Card */}
        {latestScore !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-6 ${getScoreBg(latestScore)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Readiness Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(latestScore)}`}>{latestScore}</p>
                <p className="text-xs text-slate-400 mt-1">out of 100</p>
              </div>
              <div className="text-right">
                {latestScore >= 70 ? <BatteryCharging className="w-12 h-12 text-emerald-400" /> :
                 latestScore >= 50 ? <Battery className="w-12 h-12 text-amber-400" /> :
                 <BatteryWarning className="w-12 h-12 text-red-400" />}
                <p className={`text-xs font-medium mt-1 ${getScoreColor(latestScore)}`}>
                  {latestScore >= 70 ? 'Ready to Train' : latestScore >= 50 ? 'Moderate Fatigue' : 'High Fatigue'}
                </p>
              </div>
            </div>

            {/* Trend */}
            <div className="mt-4 flex items-center gap-2">
              {trend === 'improving' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> :
               trend === 'declining' ? <TrendingDown className="w-4 h-4 text-red-400" /> :
               <Activity className="w-4 h-4 text-slate-400" />}
              <span className={`text-xs ${
                trend === 'improving' ? 'text-emerald-400' :
                trend === 'declining' ? 'text-red-400' : 'text-slate-400'
              }`}>
                Trend: {trend}
              </span>
            </div>
          </motion.div>
        )}

        {/* Deload Alert */}
        {deloadRecommended && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5"
          >
            <div className="flex items-start gap-3">
              <BatteryWarning className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-400">Deload Recommended</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your readiness score and training volume suggest you need a recovery week.
                  Reduce volume by 40-50% but maintain intensity.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-[10px] font-medium">-40% Volume</span>
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-[10px] font-medium">Keep Intensity</span>
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-[10px] font-medium">Extra Sleep</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Log Readiness Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold text-sm transition-colors"
        >
          {showForm ? 'Cancel' : 'Log Daily Readiness'}
        </button>

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-300">How are you feeling today?</h3>

            <SliderField label="Sleep (hours)" value={sleep} min={0} max={12} step={0.5} onChange={setSleep} />
            <SliderField label="Muscle Soreness" value={soreness} min={1} max={10} onChange={setSoreness} lowGood />
            <SliderField label="Energy Level" value={energy} min={1} max={10} onChange={setEnergy} />
            <SliderField label="Stress Level" value={stress} min={1} max={10} onChange={setStress} lowGood />
            <SliderField label="Motivation" value={motivation} min={1} max={10} onChange={setMotivation} />

            <div>
              <label className="text-xs text-slate-400 mb-1 block">HRV (optional)</label>
              <input
                type="number"
                value={hrv}
                onChange={(e) => setHrv(e.target.value)}
                placeholder="e.g. 55"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00AEEF]"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B1120] font-bold text-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Entry
            </button>
          </motion.div>
        )}

        {/* History */}
        {entries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">History</h3>
            <div className="space-y-2">
              {[...entries].reverse().slice(0, 7).map((entry, i) => {
                const score = calculateScore(entry);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                      score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {score}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-400">{entry.date}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">Sleep {entry.sleep}h</span>
                        <span className="text-[10px] text-slate-500">Energy {entry.energy}/10</span>
                        <span className="text-[10px] text-slate-500">Soreness {entry.soreness}/10</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {entries.length === 0 && !showForm && (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Track Your Recovery</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Log daily readiness scores to get personalized deload recommendations and avoid overtraining.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Slider Field ──────────────────────────────────────── */

function SliderField({
  label, value, min, max, step = 1, onChange, lowGood,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; lowGood?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const color = lowGood
    ? value <= 3 ? 'bg-emerald-500' : value <= 6 ? 'bg-amber-500' : 'bg-red-500'
    : value >= 7 ? 'bg-emerald-500' : value >= 4 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-white">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color.replace('bg-', '')} ${pct}%, #1e293b ${pct}%)`,
        }}
      />
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function calculateScore(entry: ReadinessEntry): number {
  // Sleep: 8h = 100, <5h = 0
  const sleepScore = Math.min(100, Math.max(0, (entry.sleep / 8) * 100));
  // Soreness: 1 = 100, 10 = 0 (inverted)
  const sorenessScore = Math.min(100, Math.max(0, ((11 - entry.soreness) / 10) * 100));
  // Energy: 10 = 100, 1 = 0
  const energyScore = (entry.energy / 10) * 100;
  // Stress: 1 = 100, 10 = 0 (inverted)
  const stressScore = Math.min(100, Math.max(0, ((11 - entry.stress) / 10) * 100));
  // Motivation: 10 = 100, 1 = 0
  const motivationScore = (entry.motivation / 10) * 100;

  const avg = (sleepScore + sorenessScore + energyScore + stressScore + motivationScore) / 5;
  return Math.round(avg);
}

function countHardTrainingWeeks(workouts: { startTime?: string }[]): number {
  const weeks = new Set<string>();
  workouts.forEach((w) => {
    const date = new Date(w.startTime || '');
    const week = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    weeks.add(week);
  });
  return weeks.size;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
