import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, Dumbbell, TrendingUp, Users, Calendar, Flame, BarChart3, Clock, Award } from 'lucide-react';

// Demo data - static sample data for preview
const demoStats = [
  { label: 'Active Clients', value: '24', icon: Users, change: '+3 this week', color: '#0D9488' },
  { label: 'Workouts Logged', value: '156', icon: Dumbbell, change: 'This month', color: '#06B6D4' },
  { label: 'Avg Session', value: '52m', icon: Clock, change: 'Per workout', color: '#8B5CF6' },
  { label: 'Completion Rate', value: '87%', icon: TrendingUp, change: '+5% vs last month', color: '#10B981' },
];

const demoRecentWorkouts = [
  { client: 'Sarah M.', exercise: 'Leg Day', date: 'Today, 9:30 AM', duration: '45 min', intensity: 'High' },
  { client: 'Marcus T.', exercise: 'Upper Body', date: 'Today, 8:00 AM', duration: '60 min', intensity: 'Medium' },
  { client: 'Alex K.', exercise: 'HIIT Cardio', date: 'Yesterday', duration: '30 min', intensity: 'High' },
  { client: 'Jessica R.', exercise: 'Full Body', date: 'Yesterday', duration: '50 min', intensity: 'Medium' },
];

const demoUpcoming = [
  { client: 'Sarah M.', time: '2:00 PM', type: 'Personal Training', status: 'confirmed' },
  { client: 'Marcus T.', time: '4:30 PM', type: 'Form Check', status: 'pending' },
  { client: 'Alex K.', time: '6:00 PM', type: 'Nutrition Review', status: 'confirmed' },
];

export default function DemoDashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: '#0F172A' }}>
      {/* Demo Banner */}
      <div 
        className="sticky top-0 z-50 px-4 py-2 text-center text-sm font-medium"
        style={{ backgroundColor: '#0D9488', color: 'white' }}
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
      <header className="border-b px-6 py-4" style={{ borderColor: '#1E293B', backgroundColor: '#0F172A' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
              style={{ color: '#94A3B8' }}
            >
              <ArrowLeft size={16} />
              Back to home
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full" style={{ backgroundColor: 'rgba(13, 148, 136, 0.2)' }} />
            <span className="text-sm font-medium text-white">Demo Coach</span>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-white">Welcome back, Coach!</h1>
          <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
            Here's what's happening with your clients today
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {demoStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border p-5"
              style={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm" style={{ color: '#94A3B8' }}>{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs" style={{ color: '#64748B' }}>{stat.change}</p>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <stat.icon size={20} style={{ color: stat.color }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Workouts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border p-5"
            style={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Workouts</h2>
              <BarChart3 size={18} style={{ color: '#94A3B8' }} />
            </div>
            <div className="space-y-3">
              {demoRecentWorkouts.map((workout) => (
                <div
                  key={workout.client + workout.exercise}
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{workout.client}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{workout.exercise}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white">{workout.duration}</p>
                    <span
                      className="mt-1 inline-block rounded px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: workout.intensity === 'High' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                        color: workout.intensity === 'High' ? '#F87171' : '#EAB308',
                      }}
                    >
                      {workout.intensity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border p-5"
            style={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Today's Schedule</h2>
              <Calendar size={18} style={{ color: '#94A3B8' }} />
            </div>
            <div className="space-y-3">
              {demoUpcoming.map((session) => (
                <div
                  key={session.client + session.time}
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: session.status === 'confirmed' ? '#10B981' : '#F59E0B',
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{session.client}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{session.type}</p>
                    </div>
                  </div>
                  <span className="text-sm text-white">{session.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 rounded-xl border p-6 text-center"
          style={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
        >
          <Flame size={32} className="mx-auto mb-3" style={{ color: '#0D9488' }} />
          <h3 className="text-lg font-semibold text-white">Ready to manage your clients?</h3>
          <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
            Sign up for free and get access to AI program building, nutrition tracking, and more.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => navigate('/signup')}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: '#0D9488' }}
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg border px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ borderColor: '#475569', backgroundColor: 'transparent' }}
            >
              Sign In
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
