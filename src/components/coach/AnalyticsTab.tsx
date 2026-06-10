import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Trophy, Star } from 'lucide-react';
import { retentionData, weeklyRevenueData, fitnessScoreDistribution } from './data';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export default function AnalyticsTab() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Top Row: Retention + Revenue + Satisfaction */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Client Retention */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border p-4 lg:p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: '#0D9488' }} />
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--page-text)' }}
            >
              Client Retention
            </span>
          </div>
          <div
            className="mt-1 text-3xl font-extrabold"
            style={{ color: '#0D9488', textShadow: 'var(--text-shadow-glow)' }}
          >
            94%
          </div>
          <div className="mt-3 h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={retentionData}>
                <defs>
                  <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--light-text-muted)' }}
                  axisLine={{ stroke: 'var(--card-border)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[80, 100]}
                  tick={{ fontSize: 11, fill: 'var(--light-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: 'var(--page-text)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#0D9488"
                  strokeWidth={2}
                  fill="url(#retentionGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Revenue Overview */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border p-4 lg:p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--page-text)' }}
            >
              Revenue This Month
            </span>
          </div>
          <div
            className="mt-1 text-3xl font-extrabold"
            style={{ color: '#06B6D4', textShadow: 'var(--text-shadow-glow)' }}
          >
            $12,450
          </div>
          <div className="mt-3 h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyRevenueData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: 'var(--light-text-muted)' }}
                  axisLine={{ stroke: 'var(--card-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--light-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: 'var(--page-text)',
                  }}
                  formatter={(value: number) => [`$${value}`, 'Revenue']}
                />
                <Bar
                  dataKey="revenue"
                  fill="#06B6D4"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Client Satisfaction */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border p-4 lg:p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Star size={18} style={{ color: '#F59E0B' }} />
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--page-text)' }}
            >
              Client Satisfaction
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-3">
            {/* Gauge visualization using SVG */}
            <div className="relative h-[100px] w-[180px]">
              <svg viewBox="0 0 180 100" className="h-full w-full">
                {/* Background arc */}
                <path
                  d="M 20 90 A 70 70 0 0 1 160 90"
                  fill="none"
                  stroke="var(--light-elevated)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Fill arc */}
                <motion.path
                  d="M 20 90 A 70 70 0 0 1 160 90"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="220"
                  initial={{ strokeDashoffset: 220 }}
                  animate={{ strokeDashoffset: 220 - 220 * 0.96 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <div
                  className="text-3xl font-extrabold"
                  style={{ color: '#F59E0B', textShadow: 'var(--text-shadow-glow)' }}
                >
                  4.8
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  out of 5
                </div>
              </div>
            </div>
          </div>

          {/* Distribution */}
          <div className="mt-2 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-2">
                <span
                  className="w-3 text-[11px] font-medium"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  {star}
                </span>
                <Star
                  size={10}
                  fill="#F59E0B"
                  stroke="#F59E0B"
                />
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--light-elevated)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        star >= 4 ? '#84CC16' : star === 3 ? '#F59E0B' : '#F87171',
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        star === 5
                          ? '70%'
                          : star === 4
                            ? '22%'
                            : star === 3
                              ? '6%'
                              : star === 2
                                ? '2%'
                                : '0%',
                    }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Second Row: Score Distribution + Top Program */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Fitness Score Distribution */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border p-4 lg:p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--page-text)' }}
          >
            Fitness Score Distribution
          </h3>
          <div className="flex items-center justify-center py-4">
            <div className="h-[180px] w-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fitnessScoreDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {fitnessScoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: 'var(--page-text)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="ml-4 space-y-2">
              {fitnessScoreDistribution.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: 'var(--light-text-secondary)' }}
                  >
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Top Performing Program */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border p-4 lg:p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--page-text)' }}
          >
            Top Performing Program
          </h3>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
            >
              <Trophy size={28} style={{ color: '#0D9488' }} />
            </div>
            <div>
              <div
                className="text-lg font-bold"
                style={{ color: 'var(--page-text)' }}
              >
                Strength Builder
              </div>
              <div
                className="text-xs"
                style={{ color: 'var(--light-text-muted)' }}
              >
                12-week progressive overload
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Completion', value: '94%', color: '#0D9488' },
              { label: 'Clients', value: '8', color: '#06B6D4' },
              { label: 'Revenue', value: '$4,800', color: '#8B5CF6' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'var(--light-elevated)' }}
              >
                <div
                  className="text-lg font-bold"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between">
              <span
                className="text-[11px] font-medium"
                style={{ color: 'var(--light-text-secondary)' }}
              >
                vs Last Month
              </span>
              <span
                className="text-[11px] font-bold"
                style={{ color: '#84CC16' }}
              >
                +12%
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--light-elevated)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#84CC16' }}
                initial={{ width: 0 }}
                animate={{ width: '78%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
