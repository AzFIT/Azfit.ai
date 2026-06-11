import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Trophy, Flame, TrendingUp, Medal, Crown,
  Dumbbell, Clock, Users, Share2, CheckCircle2,
} from 'lucide-react';

/* ── Mock Data (would come from backend in real app) ───── */

const MOCK_LEADERS = [
  { rank: 1, name: 'Alex M.', volume: 48500, workouts: 12, streak: 8, avatar: 'AM', color: '#F59E0B' },
  { rank: 2, name: 'Sarah K.', volume: 46200, workouts: 11, streak: 6, avatar: 'SK', color: '#94A3B8' },
  { rank: 3, name: 'Mike R.', volume: 43800, workouts: 10, streak: 5, avatar: 'MR', color: '#B45309' },
  { rank: 4, name: 'You', volume: 41200, workouts: 10, streak: 4, avatar: 'YO', color: '#00AEEF', isYou: true },
  { rank: 5, name: 'Jessica T.', volume: 38900, workouts: 9, streak: 3, avatar: 'JT', color: '#8B5CF6' },
  { rank: 6, name: 'David L.', volume: 36500, workouts: 9, streak: 2, avatar: 'DL', color: '#22C55E' },
  { rank: 7, name: 'Emma W.', volume: 34100, workouts: 8, streak: 2, avatar: 'EW', color: '#EC4899' },
  { rank: 8, name: 'Chris B.', volume: 32800, workouts: 8, streak: 1, avatar: 'CB', color: '#06B6D4' },
];

const ACHIEVEMENTS = [
  { id: 'volume_50k', label: '50K Club', desc: 'Lift 50,000kg in a week', icon: Dumbbell, unlocked: false },
  { id: 'streak_7', label: 'Week Warrior', desc: '7-day workout streak', icon: Flame, unlocked: true },
  { id: 'workouts_50', label: 'Half Century', desc: 'Complete 50 workouts', icon: Trophy, unlocked: true },
  { id: 'early_bird', label: 'Early Bird', desc: '5 workouts before 7am', icon: Clock, unlocked: false },
];

type LeaderboardTab = 'volume' | 'streak' | 'workouts';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LeaderboardTab>('volume');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');

  const sorted = useMemo(() => {
    const key = tab === 'volume' ? 'volume' : tab === 'streak' ? 'streak' : 'workouts';
    return [...MOCK_LEADERS].sort((a, b) => (b[key as keyof typeof b] as number) - (a[key as keyof typeof a] as number));
  }, [tab]);

  const yourRank = sorted.findIndex((l) => l.isYou) + 1;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#00AEEF]" />
              Leaderboard
            </h1>
          </div>
          <button className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Period Toggle */}
        <div className="flex items-center justify-center gap-1 bg-slate-800/50 rounded-xl p-1">
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                period === p ? 'bg-[#00AEEF] text-[#0B1120]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {p === 'all' ? 'All Time' : `This ${p}`}
            </button>
          ))}
        </div>

        {/* Your Rank Card */}
        <div className="bg-[#00AEEF]/10 border border-[#00AEEF]/30 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#00AEEF]/20 flex items-center justify-center text-xl font-bold text-[#00AEEF]">
              #{yourRank}
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">Your Ranking</p>
              <p className="text-lg font-bold text-white">Top {Math.round((yourRank / MOCK_LEADERS.length) * 100)}%</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#00AEEF]">{(MOCK_LEADERS.find((l) => l.isYou)?.volume || 0).toLocaleString()}</p>
              <p className="text-xs text-slate-400">kg volume</p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'volume' as LeaderboardTab, label: 'Volume', icon: TrendingUp },
            { id: 'streak' as LeaderboardTab, label: 'Streaks', icon: Flame },
            { id: 'workouts' as LeaderboardTab, label: 'Workouts', icon: Dumbbell },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/30'
                  : 'bg-slate-800/30 text-slate-400 border border-transparent hover:border-slate-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        <div className="space-y-2">
          {sorted.map((leader, i) => (
            <motion.div
              key={leader.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                leader.isYou
                  ? 'bg-[#00AEEF]/10 border-[#00AEEF]/30'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Rank */}
              <div className="w-8 text-center">
                {i === 0 ? <Crown className="w-5 h-5 text-amber-400 mx-auto" /> :
                 i === 1 ? <Medal className="w-5 h-5 text-slate-400 mx-auto" /> :
                 i === 2 ? <Medal className="w-5 h-5 text-amber-700 mx-auto" /> :
                 <span className="text-sm font-bold text-slate-500">{i + 1}</span>}
              </div>

              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: leader.color + '40', border: `2px solid ${leader.color}` }}
              >
                {leader.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {leader.name} {leader.isYou && <span className="text-[#00AEEF]">(You)</span>}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>{leader.workouts} workouts</span>
                  <span>{leader.streak} day streak</span>
                </div>
              </div>

              {/* Value */}
              <div className="text-right">
                <p className="text-sm font-bold text-white">
                  {tab === 'volume' ? `${(leader.volume / 1000).toFixed(1)}k` :
                   tab === 'streak' ? `${leader.streak}d` :
                   leader.workouts}
                </p>
                <p className="text-[10px] text-slate-500">
                  {tab === 'volume' ? 'kg' : tab === 'streak' ? 'streak' : 'sessions'}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Achievements */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Achievements</h3>
          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((ach) => (
              <div
                key={ach.id}
                className={`p-4 rounded-xl border ${
                  ach.unlocked
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-900/50 border-slate-800 opacity-50'
                }`}
              >
                <ach.icon className={`w-6 h-6 mb-2 ${ach.unlocked ? 'text-amber-400' : 'text-slate-600'}`} />
                <p className={`text-sm font-semibold ${ach.unlocked ? 'text-amber-300' : 'text-slate-500'}`}>{ach.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{ach.desc}</p>
                {ach.unlocked && (
                  <div className="flex items-center gap-1 mt-2">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400">Unlocked</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Anonymous Note */}
        <p className="text-center text-xs text-slate-600 flex items-center justify-center gap-1">
          <Users className="w-3 h-3" />
          Leaderboard is anonymous. Your real name is never shared.
        </p>
      </div>
    </div>
  );
}
