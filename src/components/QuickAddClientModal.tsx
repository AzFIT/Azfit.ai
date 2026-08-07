import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Mail, Phone, ChevronDown, Check,
  LayoutDashboard, Dumbbell, Apple, MessageCircle, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import ClientIntakeWizard from '@/components/ClientIntakeWizard';
import type { Database } from '@/types/supabase';
import { CLIENT_STATUSES, CLIENT_STATUS_VALUES } from '@/lib/clientStatus';
import { GOAL_TYPE_LABELS } from '@/lib/clientGoals';
import { EQUIPMENT_OPTIONS, type ClientGoalType } from '@/lib/trialIntake';

/**
 * ═══════════════════════════════════════════════════════════════
 * QuickAddClientModal — Supabase-backed client creation + edit
 * ═══════════════════════════════════════════════════════════════
 */

export interface QuickAddClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  clientToEdit?: Database["public"]["Tables"]["clients"]["Row"] | null;
}

type DbClient = Database["public"]["Tables"]["clients"]["Row"];
type DbClientStatus = DbClient["status"];

/* ─── Status options (fed from shared client status metadata) ─── */

const STATUS_OPTIONS: { value: DbClientStatus; label: string }[] =
  CLIENT_STATUS_VALUES.map((v) => ({ value: v, label: CLIENT_STATUSES[v].label }));

/* ─── Main Component ─── */

export default function QuickAddClientModal({
  open,
  onClose,
  onSuccess,
  clientToEdit,
}: QuickAddClientModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* Form state */
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<DbClientStatus>('active');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Phase 53: multi-goal + equipment editing (edit mode only) */
  const [goalTypes, setGoalTypes] = useState<ClientGoalType[]>([]);
  const [existingGoalRows, setExistingGoalRows] = useState<{ id: string; goal_type: ClientGoalType; custom_label: string | null }[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  /* Success state */
  const [createdClient, setCreatedClient] = useState<DbClient | null>(null);

  /* ── Reset/prefill on open ── */
  useEffect(() => {
    if (!open) return;
    if (clientToEdit) {
      setFullName(clientToEdit.full_name || '');
      setEmail(clientToEdit.email || '');
      setPhone(clientToEdit.phone || '');
      setStatus(clientToEdit.status);
      // Phase 53: equipment — column first, legacy intake_profile mirror as fallback
      const legacy = (clientToEdit.intake_profile as { equipment?: unknown } | null)?.equipment;
      setEquipment(clientToEdit.equipment_access ?? (Array.isArray(legacy) ? (legacy as string[]) : []));
      // Phase 53: goals — canonical store is client_goals rows
      setGoalTypes([]);
      setExistingGoalRows([]);
      supabase
        .from('client_goals')
        .select('id, goal_type, custom_label')
        .eq('client_id', clientToEdit.id)
        .then(({ data }) => {
          const rows = (data as { id: string; goal_type: ClientGoalType; custom_label: string | null }[] | null) ?? [];
          setExistingGoalRows(rows);
          setGoalTypes(rows.filter((r) => r.goal_type !== 'custom').map((r) => r.goal_type));
        });
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setStatus('active');
      setGoalTypes([]);
      setExistingGoalRows([]);
      setEquipment([]);
    }
    setCreatedClient(null);
    setErrors({});
    setShowStatusDropdown(false);
  }, [open, clientToEdit]);

  const handleClose = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setGoalTypes([]);
    setExistingGoalRows([]);
    setEquipment([]);
    setErrors({});
    setCreatedClient(null);
    setShowStatusDropdown(false);
    onClose();
  };

  /* ── Validate & save ── */
  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email address';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!user) {
      toast.error('You must be signed in');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      status,
    };

    try {
      if (clientToEdit) {
        // Phase 53: keep fitness_goal (first selected goal) + equipment_access
        // (+ legacy intake_profile.equipment mirror) consistent with the chips.
        const customLabels = existingGoalRows.filter((r) => r.goal_type === 'custom' && r.custom_label).map((r) => r.custom_label as string);
        const intakeProfile = {
          ...((clientToEdit.intake_profile as Record<string, unknown> | null) ?? {}),
          equipment,
        };
        const { error } = await supabase
          .from('clients')
          .update({
            ...payload,
            fitness_goal: goalTypes[0] ?? customLabels[0] ?? null,
            equipment_access: equipment,
            intake_profile: intakeProfile,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientToEdit.id)
          .eq('trainer_id', user.id);

        if (error) throw error;

        // Reconcile client_goals rows: add newly selected types, remove
        // deselected non-custom rows. Custom-labeled rows are preserved
        // (managed via the Overview goals dialog).
        const toAdd = goalTypes.filter((t) => !existingGoalRows.some((r) => r.goal_type === t));
        const toRemove = existingGoalRows.filter((r) => r.goal_type !== 'custom' && !goalTypes.includes(r.goal_type));
        if (toAdd.length) {
          await supabase.from('client_goals').insert(toAdd.map((t) => ({ client_id: clientToEdit.id, goal_type: t })));
        }
        if (toRemove.length) {
          await supabase.from('client_goals').delete().in('id', toRemove.map((r) => r.id));
        }

        setCreatedClient({ ...clientToEdit, ...payload });
        toast.success('Client updated');
        onSuccess?.();
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert({ ...payload, trainer_id: user.id })
          .select()
          .single();

        if (error) throw error;
        setCreatedClient(data);
        toast.success('Client created');
        onSuccess?.();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error((clientToEdit ? 'Failed to update client: ' : 'Failed to create client: ') + message);
      setIsSubmitting(false);
      return;
    }

    setTimeout(() => {
      setIsSubmitting(false);
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
          title: `Set up [${createdClient.full_name}]'s Client Dashboard`,
          description: 'Configure the specific dashboard view they will see when they sign up.',
          route: `/client/${createdClient.id}?tab=overview`,
        },
        {
          id: 'program',
          icon: Dumbbell,
          title: 'Assign Workout Program',
          description: 'Routes to program builder for this client',
          route: `/ai-program-builder?clientId=${createdClient.id}`,
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

  // New-client flow uses the 5-step intake wizard; editing keeps the quick form
  if (!clientToEdit) {
    return <ClientIntakeWizard open={open} onClose={onClose} onSuccess={onSuccess} />;
  }

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
                    {clientToEdit ? 'Edit Client' : 'New Client'}
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {clientToEdit ? 'Edit Client' : 'Quick Add Client'}
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

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Phone <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-all"
                    />
                  </div>
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
                    <span className="capitalize">{STATUS_OPTIONS.find((o) => o.value === status)?.label || status}</span>
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

                {/* Goals (Phase 53 — multi-select, client_goals rows) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Goals <span className="text-slate-400 font-normal">(multi-select — first selected is primary)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(GOAL_TYPE_LABELS) as ClientGoalType[])
                      .filter((t) => t !== 'custom')
                      .map((t) => {
                        const active = goalTypes.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setGoalTypes((p) => (active ? p.filter((x) => x !== t) : [...p, t]))}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                              active
                                ? 'border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#0D9488]/50'
                            }`}
                          >
                            {GOAL_TYPE_LABELS[t]}
                          </button>
                        );
                      })}
                    {existingGoalRows
                      .filter((r) => r.goal_type === 'custom' && r.custom_label)
                      .map((r) => (
                        <span
                          key={r.id}
                          title="Custom goal — managed from the client's Overview tab"
                          className="px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-500 dark:text-slate-400"
                        >
                          {r.custom_label}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Equipment (Phase 53 — multi-select, equipment_access) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Available equipment
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([...EQUIPMENT_OPTIONS, ...equipment])].map((eq) => {
                      const active = equipment.includes(eq);
                      return (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => setEquipment((p) => (active ? p.filter((x) => x !== eq) : [...p, eq]))}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                            active
                              ? 'border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#0D9488]/50'
                          }`}
                        >
                          {eq}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
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
                  {isSubmitting ? 'Saving...' : (clientToEdit ? 'Save Changes' : 'Save Client')}
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
                  Success! Client [{createdClient.full_name}] {clientToEdit ? 'Updated' : 'Created'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  What's next for {createdClient.full_name}?
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
