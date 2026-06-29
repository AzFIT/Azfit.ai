import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Mail, ChevronDown, Check,
  LayoutDashboard, Dumbbell, Apple, MessageCircle, ArrowRight,
} from 'lucide-react';
import { saveClient } from '@/lib/storage';
import type { StoredClient } from '@/lib/storage';
import { useNavigate } from 'react-router';

/**
 * ═══════════════════════════════════════════════════════════════
 * QuickAddClientModal — Streamlined 3-field client creation
 * Phase 3: Client Management UX Enhancement
 * ═══════════════════════════════════════════════════════════════
 *
 * Two-state modal: Input form → Success panel with smart routing.
 * Uses AnimatePresence for fluid transitions between states.
 */

export interface QuickAddClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (client: StoredClient) => void;
}

/* ─── Status options ─── */

const STATUS_OPTIONS: { value: StoredClient['status']; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

/* ─── Main Component ─── */

export default function QuickAddClientModal({ open, onClose, onSuccess }: QuickAddClientModalProps) {
  const navigate = useNavigate();

  /* Form state */
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<StoredClient['status']>('active');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Success state */
  const [createdClient, setCreatedClient] = useState<StoredClient | null>(null);

  /* ── Reset form on open ── */
  const handleClose = () => {
    setFullName('');
    setEmail('');
    setStatus('active');
    setErrors({});
    setCreatedClient(null);
    setShowStatusDropdown(false);
    onClose();
  };

  /* ── Validate & save ── */
  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email address';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const client: StoredClient = {
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fullName: fullName.trim(),
      email: email.trim(),
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveClient(client);
    onSuccess?.(client);

    // Transition to success state
    setTimeout(() => {
      setIsSubmitting(false);
      setCreatedClient(client);
    }, 400);
  };

  /* ── Smart routing actions ── */
  const routingActions = createdClient
    ? [
        {
          id: 'profile',
          icon: User,
          title: 'Go to Client Profile',
          description: 'View full detailed profile page',
          route: `/client/${createdClient.id}`,
        },
        {
          id: 'dashboard',
          icon: LayoutDashboard,
          title: `Set up [${createdClient.fullName}]'s Client Dashboard`,
          description: 'Configure the specific dashboard view they will see when they sign up.',
          route: `/client/${createdClient.id}?tab=overview`,
        },
        {
          id: 'program',
          icon: Dumbbell,
          title: 'Assign Workout Program',
          description: 'Routes to program builder for this client',
          route: `/program-builder?clientId=${createdClient.id}`,
        },
        {
          id: 'nutrition',
          icon: Apple,
          title: 'Set Nutrition Targets',
          description: 'Routes to nutrition planner / macro page',
          route: `/nutrition?clientId=${createdClient.id}`,
        },
        {
          id: 'message',
          icon: MessageCircle,
          title: 'Send Welcome Message',
          description: 'Routes to messaging',
          route: `/client/${createdClient.id}?tab=notes`,
        },
      ]
    : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
        className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {!createdClient ? (
            /* ═══ INPUT FORM ═══ */
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400 mb-1">
                    New Client
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Quick Add Client
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: '' })); }}
                      placeholder="John Doe"
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-all ${
                        errors.fullName ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                      placeholder="john.doe@email.com"
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-all ${
                        errors.email ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* Status */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Status
                  </label>
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white hover:border-[#0D9488] transition-colors"
                  >
                    <span className="capitalize">{status}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showStatusDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setStatus(opt.value); setShowStatusDropdown(false); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <span className="capitalize">{opt.label}</span>
                            {status === opt.value && (
                              <Check className="w-4 h-4 text-[#0D9488]" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0D9488] hover:bg-[#0B7A75] text-white disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </motion.div>
          ) : (
            /* ═══ SUCCESS PANEL ═══ */
            <motion.div
              key="success"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              {/* Success Header */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0D9488]/10 mb-4"
                >
                  <Check className="w-8 h-8 text-[#0D9488]" strokeWidth={3} />
                </motion.div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  Success! Client [{createdClient.fullName}] Created
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  What's next for {createdClient.fullName}?
                </p>
              </div>

              {/* Action Cards */}
              <div className="space-y-2.5">
                {routingActions.map((action, index) => (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.06, duration: 0.35 }}
                    onClick={() => {
                      navigate(action.route);
                      handleClose();
                    }}
                    className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-[#0D9488]/30 hover:bg-[#0D9488]/[0.03] dark:hover:bg-[#0D9488]/[0.05] transition-all group text-left"
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                      <action.icon className="w-5 h-5 text-[#0D9488]" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0D9488] transition-colors">
                        {action.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {action.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </motion.button>
                ))}
              </div>

              {/* Close */}
              <button
                onClick={handleClose}
                className="w-full mt-4 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Close and stay on this page
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
