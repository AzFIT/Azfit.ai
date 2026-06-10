import { motion } from 'framer-motion';
import { Plus, Users, Calendar, Clock, Edit, UserPlus } from 'lucide-react';
import { programs } from './data';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function ProgramsTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {programs.map((program, i) => (
        <motion.div
          key={program.id}
          custom={i}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="group overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          {/* Color header strip */}
          <div
            className="h-1 w-full"
            style={{ backgroundColor: program.color }}
          />

          <div className="p-5">
            {/* Program Name */}
            <h3
              className="text-lg font-bold"
              style={{ color: 'var(--page-text)' }}
            >
              {program.name}
            </h3>

            {/* Description */}
            <p
              className="mt-1 line-clamp-2 text-sm leading-relaxed"
              style={{ color: 'var(--light-text-secondary)' }}
            >
              {program.description}
            </p>

            {/* Stats Row */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className="flex items-center gap-1 text-[11px] font-medium"
                style={{ color: 'var(--light-text-muted)' }}
              >
                <Calendar size={13} />
                {program.duration}
              </span>
              <span
                className="flex items-center gap-1 text-[11px] font-medium"
                style={{ color: 'var(--light-text-muted)' }}
              >
                <Clock size={13} />
                {program.frequency}
              </span>
              <span
                className="flex items-center gap-1 text-[11px] font-medium"
                style={{ color: 'var(--light-text-muted)' }}
              >
                <Users size={13} />
                {program.clients} clients
              </span>
            </div>

            {/* Completion Rate */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--light-text-secondary)' }}
                >
                  Completion Rate
                </span>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: program.color }}
                >
                  {program.completionRate}%
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--light-elevated)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: program.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${program.completionRate}%` }}
                  transition={{
                    duration: 0.8,
                    ease: 'easeOut',
                    delay: i * 0.08,
                  }}
                />
              </div>
            </div>

            {/* Created date */}
            <p
              className="mt-2 text-[11px]"
              style={{ color: 'var(--light-text-muted)' }}
            >
              Created {program.createdDate}
            </p>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
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
                <Edit size={13} />
                Edit
              </button>
              <button
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 active:scale-[0.95]"
                style={{
                  color: '#0D9488',
                  border: '1px solid rgba(13,148,136,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <UserPlus size={13} />
                Assign
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Create New Program CTA Card */}
      <motion.button
        custom={programs.length}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 transition-all duration-200 hover:shadow-md active:scale-[0.98]"
        style={{
          borderColor: 'rgba(13, 148, 136, 0.35)',
          backgroundColor: 'rgba(13, 148, 136, 0.03)',
          minHeight: 240,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.06)';
          e.currentTarget.style.borderColor = 'rgba(13,148,136,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(13,148,136,0.03)';
          e.currentTarget.style.borderColor = 'rgba(13,148,136,0.35)';
        }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
        >
          <Plus size={24} style={{ color: '#0D9488' }} />
        </div>
        <span
          className="text-sm font-semibold"
          style={{ color: '#0D9488' }}
        >
          Create New Program
        </span>
        <span
          className="text-center text-xs"
          style={{ color: 'var(--light-text-muted)' }}
        >
          Build a custom training program for your clients
        </span>
      </motion.button>
    </div>
  );
}
