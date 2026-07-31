import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

/**
 * Coach dashboard analytics tab (Phase 33B) — honest empty state.
 * All previous charts (retention, revenue, satisfaction, fitness score
 * distribution, top program) were fabricated: the schema has no payments,
 * retention tracking, or fitness scores to derive them from. Analytics
 * return here once real client activity data exists.
 */
export default function AnalyticsTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-2xl border px-6 py-16 text-center"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(0, 174, 239, 0.12)' }}
      >
        <BarChart3 size={28} style={{ color: '#00AEEF' }} />
      </div>
      <h3
        className="mt-4 text-base font-semibold"
        style={{ color: 'var(--page-text)' }}
      >
        No analytics yet
      </h3>
      <p
        className="mt-1 max-w-sm text-sm"
        style={{ color: 'var(--light-text-muted)' }}
      >
        Analytics populate from real client activity — there's nothing to show yet.
      </p>
    </motion.div>
  );
}
