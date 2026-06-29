import { usePWA } from '@/lib/registerSW';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ═══════════════════════════════════════════════════════════════
 * OfflineBanner — Subtle connectivity indicator
 * Phase 2: The "Gym Wi-Fi" Fix
 * ═══════════════════════════════════════════════════════════════
 *
 * Shows a non-intrusive banner when the user goes offline.
 * Auto-hides when connection returns. Includes retry button
 * for queued data.
 */

export interface OfflineBannerProps {
  pendingCount?: number;
  onRetry?: () => void;
}

export default function OfflineBanner({ pendingCount = 0, onRetry }: OfflineBannerProps) {
  const { isOffline } = usePWA();

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[100] bg-amber-500/95 backdrop-blur-sm border-b border-amber-600/50"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-950" aria-hidden="true" />
              <span className="text-sm font-semibold text-amber-950">
                Offline — Data will sync when connection returns
              </span>
              {pendingCount > 0 && (
                <span className="text-xs font-medium bg-amber-600/30 text-amber-950 px-1.5 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </div>

            {onRetry && pendingCount > 0 && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/20 hover:bg-amber-950/30 text-amber-950 text-xs font-semibold transition-colors"
                aria-label="Retry syncing queued data"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
