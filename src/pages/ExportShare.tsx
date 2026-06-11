import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, FileSpreadsheet, FileText, Share2,
  Calendar as CalendarIcon, TrendingUp, Dumbbell, Flame,
  CheckCircle2, Copy,
} from 'lucide-react';
import {
  exportWorkoutsToCSV,
  exportNutritionToCSV,
  generatePDFReportHTML,
  downloadCSV,
  downloadPDFReport,
  generateShareCanvas,
  downloadImage,
  generateICalEvent,
  downloadICS,
  type ReportData,
} from '@/lib/exportUtils';

/* ── Storage Loaders ───────────────────────────────────── */

function loadWorkoutLogs() {
  try { return JSON.parse(localStorage.getItem('azfit_workout_logs') || '[]'); } catch { return []; }
}

function loadNutritionLogs() {
  try { return JSON.parse(localStorage.getItem('azfit_nutrition_log') || '[]'); } catch { return []; }
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem('azfit_client_profile') || 'null'); } catch { return null; }
}

function loadBioHistory() {
  try { return JSON.parse(localStorage.getItem('azfit_bio_history') || '[]'); } catch { return []; }
}

function loadScheduleEvents() {
  try { return JSON.parse(localStorage.getItem('azfit_schedule_events') || '[]'); } catch { return []; }
}

/* ── Main Component ────────────────────────────────────── */

export default function ExportSharePage() {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  const profile = loadProfile();
  const workoutLogs = loadWorkoutLogs();
  const nutritionLogs = loadNutritionLogs();
  const bioHistory = loadBioHistory();
  const scheduleEvents = loadScheduleEvents();

  const reportData: ReportData = useMemo(() => {
    const totalVolume = workoutLogs.reduce((sum: number, w: { totalVolume?: number }) => sum + (w.totalVolume || 0), 0);
    const avgDuration = workoutLogs.length > 0
      ? workoutLogs.reduce((sum: number, w: { durationSeconds?: number }) => sum + (w.durationSeconds || 0), 0) / workoutLogs.length / 60
      : 0;
    const firstWeight = bioHistory[0]?.weight || profile?.weight || 0;
    const latestWeight = bioHistory[bioHistory.length - 1]?.weight || profile?.weight || 0;
    const firstBF = bioHistory[0]?.bodyFatPercentage || profile?.bodyFatPercentage || 0;
    const latestBF = bioHistory[bioHistory.length - 1]?.bodyFatPercentage || profile?.bodyFatPercentage || 0;

    return {
      clientName: profile?.name || 'AzFIT User',
      dateRange: 'Last 30 Days',
      totalWorkouts: workoutLogs.length,
      totalVolume,
      avgDuration: Math.round(avgDuration),
      weightChange: latestWeight - firstWeight,
      bodyFatChange: latestBF - firstBF,
      streakDays: calculateStreak(workoutLogs),
      topExercises: getTopExercises(workoutLogs),
      weeklySummary: getWeeklySummary(workoutLogs),
    };
  }, [workoutLogs, bioHistory, profile]);

  /* ── Export Handlers ─────────────────────────────────── */

  const handleExportWorkoutsCSV = () => {
    setGenerating('workout-csv');
    const data = workoutLogs.map((w: { startTime?: string; workoutName?: string; exercises?: { name?: string }[]; totalSets?: number; totalVolume?: number; durationSeconds?: number }) => ({
      date: w.startTime ? new Date(w.startTime).toLocaleDateString() : '',
      workoutName: w.workoutName || 'Workout',
      exercises: w.exercises?.map((e: { name?: string }) => e.name).join(', ') || '',
      sets: w.totalSets || 0,
      volume: w.totalVolume || 0,
      duration: Math.round((w.durationSeconds || 0) / 60),
    }));
    const csv = exportWorkoutsToCSV(data);
    downloadCSV(csv, `azfit-workouts-${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => setGenerating(null), 800);
  };

  const handleExportNutritionCSV = () => {
    setGenerating('nutrition-csv');
    const data = nutritionLogs.map((e: { date?: string; totals?: { calories?: number; protein?: number; fats?: number; carbs?: number }; waterIntake?: number }) => ({
      date: e.date || '',
      calories: e.totals?.calories || 0,
      protein: e.totals?.protein || 0,
      fats: e.totals?.fats || 0,
      carbs: e.totals?.carbs || 0,
      water: e.waterIntake || 0,
    }));
    const csv = exportNutritionToCSV(data);
    downloadCSV(csv, `azfit-nutrition-${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => setGenerating(null), 800);
  };

  const handleExportPDF = () => {
    setGenerating('pdf');
    const html = generatePDFReportHTML(reportData);
    downloadPDFReport(html, `azfit-report-${new Date().toISOString().split('T')[0]}.pdf`);
    setTimeout(() => setGenerating(null), 1000);
  };

  const handleGenerateShareImage = async () => {
    setGenerating('share');
    const data = {
      clientName: profile?.name || 'AzFIT User',
      workoutsThisWeek: workoutLogs.filter((w: { startTime?: string }) => {
        const date = new Date(w.startTime || '');
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return date > weekAgo;
      }).length,
      totalVolume: reportData.totalVolume,
      streak: reportData.streakDays,
      quote: 'Consistency is the key to transformation. Every rep counts.',
    };
    const imageUrl = await generateShareCanvas(data);
    downloadImage(imageUrl, 'azfit-share.png');
    setShareUrl(imageUrl);
    setGenerating(null);
  };

  const handleExportCalendar = () => {
    setGenerating('calendar');
    const nextWeek = scheduleEvents.filter((e: { date?: string }) => {
      const eventDate = new Date(e.date || '');
      const now = new Date();
      const weekLater = new Date(); weekLater.setDate(weekLater.getDate() + 7);
      return eventDate >= now && eventDate <= weekLater;
    });

    if (nextWeek.length > 0) {
      const event = nextWeek[0];
      const start = new Date(`${event.date}T${event.startTime}`);
      const end = new Date(`${event.date}T${event.endTime}`);
      const ics = generateICalEvent({
        title: event.title || 'AzFIT Session',
        start,
        end,
        description: event.description || '',
      });
      downloadICS(ics, `azfit-schedule-${event.date}.ics`);
    }
    setTimeout(() => setGenerating(null), 800);
  };

  /* ── Render ──────────────────────────────────────────── */

  const exportCards = [
    {
      id: 'workout-csv',
      icon: FileSpreadsheet,
      title: 'Workout Log CSV',
      desc: 'Export all workout sessions with exercises, sets, volume, and duration',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      action: handleExportWorkoutsCSV,
    },
    {
      id: 'nutrition-csv',
      icon: FileSpreadsheet,
      title: 'Nutrition Log CSV',
      desc: 'Export daily nutrition entries with macros and calorie totals',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      action: handleExportNutritionCSV,
    },
    {
      id: 'pdf',
      icon: FileText,
      title: 'Progress Report PDF',
      desc: 'Generate a comprehensive PDF report with stats, charts, and summaries',
      color: 'text-[#00AEEF]',
      bg: 'bg-[#00AEEF]/10',
      action: handleExportPDF,
    },
    {
      id: 'share',
      icon: Share2,
      title: 'Social Share Image',
      desc: 'Generate an Instagram-ready image with your weekly stats',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      action: handleGenerateShareImage,
    },
    {
      id: 'calendar',
      icon: CalendarIcon,
      title: 'Export to Calendar',
      desc: 'Download .ics file to import sessions into Google/Apple Calendar',
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      action: handleExportCalendar,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-[#00AEEF]" />
            Export & Share
          </h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Preview */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Your Progress Snapshot</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill icon={Dumbbell} label="Workouts" value={reportData.totalWorkouts.toString()} color="#00AEEF" />
            <StatPill icon={TrendingUp} label="Volume" value={`${(reportData.totalVolume / 1000).toFixed(1)}k kg`} color="#22C55E" />
            <StatPill icon={Flame} label="Streak" value={`${reportData.streakDays} days`} color="#F59E0B" />
            <StatPill icon={CheckCircle2} label="Avg Duration" value={`${reportData.avgDuration}m`} color="#8B5CF6" />
          </div>
        </div>

        {/* Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exportCards.map((card) => (
            <motion.button
              key={card.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={card.action}
              disabled={generating === card.id}
              className="text-left p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-600 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                  {generating === card.id ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                      style={{ color: card.color.replace('text-', '') }}
                    />
                  ) : (
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#00AEEF] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
                </div>
                <Download className="w-4 h-4 text-slate-600 group-hover:text-[#00AEEF] transition-colors shrink-0 mt-1" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Share Preview */}
        {shareUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Share Image Preview</h3>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <img src={shareUrl} alt="Share preview" className="w-64 h-64 rounded-xl object-contain bg-slate-950" />
              <div className="space-y-2">
                <button
                  onClick={() => downloadImage(shareUrl, `azfit-share-${Date.now()}.png`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] text-sm font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Data URL
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function StatPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <div>
        <p className="text-[10px] text-slate-500 uppercase">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function calculateStreak(logs: { startTime?: string }[]): number {
  if (logs.length === 0) return 0;
  const dates = [...new Set(logs.map((w) => new Date(w.startTime || '').toDateString()))].sort();
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 2) streak++; else break;
  }
  return streak;
}

function getTopExercises(logs: { exercises?: { name?: string; sets?: { load?: number; reps?: number }[] }[] }[]) {
  const volumes: Record<string, number> = {};
  logs.forEach((w) => {
    w.exercises?.forEach((ex) => {
      const name = ex.name || 'Unknown';
      const vol = (ex.sets || []).reduce((s: number, set: { load?: number; reps?: number }) => s + (set.load || 0) * (set.reps || 0), 0);
      volumes[name] = (volumes[name] || 0) + vol;
    });
  });
  return Object.entries(volumes)
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);
}

function getWeeklySummary(logs: { startTime?: string; totalVolume?: number }[]) {
  const weeks: Record<string, { workouts: number; volume: number }> = {};
  logs.forEach((w) => {
    const date = new Date(w.startTime || '');
    const weekKey = `Week ${getWeekNumber(date)}`;
    if (!weeks[weekKey]) weeks[weekKey] = { workouts: 0, volume: 0 };
    weeks[weekKey].workouts++;
    weeks[weekKey].volume += w.totalVolume || 0;
  });
  return Object.entries(weeks).map(([week, data]) => ({ week, ...data })).slice(-4);
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
