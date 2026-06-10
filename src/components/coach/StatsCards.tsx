import { motion } from 'framer-motion';
import { Users, Target, Calendar, TrendingUp } from 'lucide-react';

const stats = [
  {
    label: 'Total Clients',
    value: '24',
    sublabel: '+3 this month',
    icon: Users,
    color: '#0D9488',
  },
  {
    label: 'Active Programs',
    value: '8',
    sublabel: '92% compliance',
    icon: Target,
    color: '#84CC16',
  },
  {
    label: 'Sessions This Week',
    value: '42',
    sublabel: 'Scheduled',
    icon: Calendar,
    color: '#06B6D4',
  },
  {
    label: 'Avg Client Progress',
    value: '78%',
    sublabel: 'Upward trend',
    icon: TrendingUp,
    color: '#8B5CF6',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function StatsCards() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <Icon size={18} style={{ color: stat.color }} />
              <span
                className="text-[11px] font-medium lg:text-xs"
                style={{ color: 'var(--light-text-muted)' }}
              >
                {stat.label}
              </span>
            </div>
            <div
              className="mt-2 text-2xl font-extrabold lg:text-[30px]"
              style={{ color: stat.color, textShadow: 'var(--text-shadow-glow)' }}
            >
              {stat.value}
            </div>
            <div
              className="mt-0.5 text-[11px] lg:text-xs"
              style={{ color: 'var(--light-text-muted)' }}
            >
              {stat.sublabel}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
