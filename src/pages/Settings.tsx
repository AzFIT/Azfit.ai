import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import LogoHomeButton from '@/components/LogoHomeButton';
import {
  Palette,
  Ruler,
  Bell,
  Watch,
  Download,
  Lock,
  LogOut,
  Trash2,
  Sun,
  Moon,
  Layers,
  Phone,
  Calendar,
  User,
  Edit3,
  CheckCircle2,
  Circle,
  Activity,
  Scale,
  Dumbbell,
  Apple,
  Send,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import IconTile, { type IconTileTone } from '@/components/ui/IconTile';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { hasAiKey, saveAiKey, clearAiKey } from '@/services/aiConfig';
import { toast } from 'sonner';
import { GOAL_TYPE_LABELS, goalLabel, type ClientGoalRow, type ClientGoalType } from '@/lib/clientGoals';
import { formatDate } from '@/lib/utils';
import {
  getPushState,
  subscribePush,
  unsubscribePush,
  sendTestPush,
  type PushState,
} from '@/lib/push';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPES,
  clearQuietHours,
  normalizeNotificationPrefs,
  setNotificationType,
  setQuietHours,
  type NotificationPrefs,
} from '@/lib/notificationPrefs';
import { applyUiVariant, currentUiVariant, persistUiVariant, type UiVariant } from '@/lib/uiVariant';
import { UiVariantSaveController } from '@/lib/uiVariantSave';
import type { Json } from '@/types/supabase';

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const childFade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

/* ------------------------------------------------------------------ */
/*  Segmented Control                                                  */
/* ------------------------------------------------------------------ */

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="relative flex h-8 items-center rounded-full p-[3px]"
      style={{ backgroundColor: 'var(--light-elevated)' }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="relative z-10 flex-1 rounded-full px-3 py-0.5 font-mono text-xs font-semibold transition-colors duration-200"
          style={{
            color: value === opt ? '#FFFFFF' : 'var(--light-text-secondary)',
            textShadow: value === opt ? 'none' : 'var(--text-shadow-dark)',
          }}
          type="button"
        >
          {opt}
        </button>
      ))}
      {/* Sliding indicator */}
      <motion.div
        layoutId="segment-indicator"
        className="absolute top-[3px] h-[calc(100%-6px)] rounded-full"
        style={{ backgroundColor: 'var(--azfit-primary)' }}
        initial={false}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        animate={{
          left: `${(options.indexOf(value) / options.length) * 100}%`,
          width: `${100 / options.length}%`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Row                                                         */
/* ------------------------------------------------------------------ */

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${disabled ? 'opacity-40' : ''}`}
      style={{ borderBottom: '1px solid var(--light-border)' }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: 'var(--azfit-primary)' }}>
            {icon}
          </div>
        )}
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
            {label}
          </p>
          {description && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--light-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Device Row                                                         */
/* ------------------------------------------------------------------ */

interface DeviceItem {
  name: string;
  type: string;
  connected: boolean;
  lastSync: string;
  icon: LucideIcon;
  tone: IconTileTone;
}

function DeviceRow({ device }: { device: DeviceItem }) {
  return (
    <motion.div
      variants={childFade}
      className="flex items-center justify-between py-3"
      style={{
        borderBottom: '1px solid var(--light-border)',
        opacity: device.connected ? 1 : 0.7,
      }}
    >
      <div className="flex items-center gap-3">
        <IconTile icon={device.icon} size="md" tone={device.tone} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
            {device.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--light-text-muted)' }}>{device.type}</span>
            <span className="text-xs" style={{ color: 'var(--light-text-muted)' }}>--</span>
            <span className="text-xs font-mono" style={{ color: 'var(--light-text-muted)' }}>{device.lastSync}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {device.connected ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: 'var(--success)' }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: 'var(--success)' }}
              />
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Connected</span>
          </>
        ) : (
          <>
            <Circle size={10} style={{ color: 'var(--light-text-muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--light-text-muted)' }}>Disconnected</span>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings Page                                                 */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { logout, user, isTrainer } = useAuth();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  /* ---- Phase 97a: AI Assistant key (trainer-owned, presence-only) ---- */
  const [aiKey, setAiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiHasKey, setAiHasKey] = useState<boolean | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    if (!isTrainer) return;
    let cancelled = false;
    void hasAiKey().then((has) => {
      if (!cancelled) setAiHasKey(has);
    });
    return () => { cancelled = true; };
  }, [isTrainer]);

  const handleAiSave = useCallback(async () => {
    if (!aiKey.trim()) {
      toast.error('Paste your API key first');
      return;
    }
    setAiSaving(true);
    try {
      await saveAiKey(
        aiKey.trim(),
        aiBaseUrl.trim() || 'https://api.openai.com/v1',
        aiModel.trim() || 'gpt-4o-mini',
      );
      setAiKey(''); // never keep key material in state longer than needed
      setAiHasKey(true);
      toast.success('AI key saved');
    } catch (err) {
      toast.error('Could not save key: ' + (err instanceof Error ? err.message : 'unknown error'));
    } finally {
      setAiSaving(false);
    }
  }, [aiKey, aiBaseUrl, aiModel]);

  const handleAiClear = useCallback(async () => {
    setAiSaving(true);
    try {
      await clearAiKey();
      setAiHasKey(false);
      toast.success('AI key removed');
    } catch (err) {
      toast.error('Could not remove key: ' + (err instanceof Error ? err.message : 'unknown error'));
    } finally {
      setAiSaving(false);
    }
  }, []);

  /* ---- Phase 33B: real profile identity + goals ---- */
  const [clientRow, setClientRow] = useState<{
    id: string;
    created_at: string;
    phone: string | null;
    date_of_birth: string | null;
    height_cm: number | null;
    gender: string | null;
  } | null>(null);
  const [goals, setGoals] = useState<ClientGoalRow[]>([]);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from('clients')
        .select('id, created_at, phone, date_of_birth, height_cm, gender')
        .eq('email', user.email)
        .maybeSingle();
      if (cancelled) return;
      setClientRow(row ?? null);
      if (row) {
        const { data: g } = await supabase
          .from('client_goals')
          .select('*')
          .eq('client_id', row.id)
          .eq('is_achieved', false)
          .order('created_at');
        if (!cancelled) setGoals(g ?? []);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const addGoal = useCallback(async (goalType: ClientGoalType) => {
    if (!clientRow) return;
    const { error } = await supabase.from('client_goals').insert({ client_id: clientRow.id, goal_type: goalType });
    if (error) {
      // RLS: only trainers manage goals — be honest about it
      toast.error("Couldn't add the goal — your coach manages goals");
      return;
    }
    toast.success('Goal added');
    setGoalPickerOpen(false);
    const { data: g } = await supabase
      .from('client_goals')
      .select('*')
      .eq('client_id', clientRow.id)
      .eq('is_achieved', false)
      .order('created_at');
    setGoals(g ?? []);
  }, [clientRow]);

  const displayName = user?.full_name?.trim() || user?.email || '';
  const initials = displayName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

  /* ---- units state ---- */
  const [weightUnit, setWeightUnit] = useState('kg');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [tempUnit, setTempUnit] = useState('\u00B0C');

  /* ---- notifications state ---- */
  const [pushState, setPushState] = useState<PushState>({
    supported: false,
    permission: 'unsupported',
    subscribed: false,
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const pushEnabled = pushState.subscribed;
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [coachMessages, setCoachMessages] = useState(true);
  const [achievementAlerts, setAchievementAlerts] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [mealReminders, setMealReminders] = useState(false);
  const [appUpdates, setAppUpdates] = useState(false);

  /* ---- push state load ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await getPushState();
      if (!cancelled) setPushState(state);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePushToggle = useCallback(
    async (enabled: boolean) => {
      if (pushBusy) return;
      setPushBusy(true);
      try {
        if (enabled) {
          const res = await subscribePush();
          if (res.ok) {
            toast.success('Push notifications enabled on this device');
          } else if (res.error === 'denied') {
            toast.error('Notifications are blocked — reset the permission in your browser site settings');
          } else {
            toast.error(res.error || 'Could not enable push notifications');
          }
        } else {
          const res = await unsubscribePush();
          if (res.ok) toast.success('Push notifications disabled');
          else toast.error(res.error || 'Could not disable push notifications');
        }
      } finally {
        setPushState(await getPushState());
        setPushBusy(false);
      }
    },
    [pushBusy],
  );

  const handleTestPush = useCallback(async () => {
    if (!user?.id || testSending) return;
    setTestSending(true);
    try {
      const result = await sendTestPush(user.id);
      toast.success(`Test push sent (delivered: ${result.sent}, failed: ${result.failed}, pruned: ${result.pruned})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test push failed — is the send-push function deployed?');
    } finally {
      setTestSending(false);
    }
  }, [user?.id, testSending]);

  /* ---- Phase 94: notification preferences (profiles.notifications JSONB) ----
     Master on/off lives in push_subscriptions (the toggle above); these prefs
     govern WHICH alert types a subscribed device receives + quiet hours.
     Server-side enforcement ships with the Phase 95 triggers; stored now. */
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => ({
    ...DEFAULT_NOTIFICATION_PREFS,
    types: { ...DEFAULT_NOTIFICATION_PREFS.types },
  }));
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false);

  /* ---- Phase 92c: card style variant (profiles.ui_variant; NULL/'default'
     = classic, 'metal' = Pulse Metal opt-in finish). Phase 92c-fix: the
     save runs through UiVariantSaveController — a click before the row
     read resolves is QUEUED (persisted exactly once when the read lands)
     instead of being dropped by the disabled gate, and the persist uses
     fetch keepalive so the Phase 33A SW-controllerchange reload can never
     silently abort it. Control, html attribute, and DB move together;
     any failure reverts control + attribute and toasts loudly. ---- */
  const [cardVariant, setCardVariant] = useState<UiVariant>(() => currentUiVariant());
  const variantCtrlRef = useRef(new UiVariantSaveController(currentUiVariant()));

  const persistVariant = useCallback(
    async (variant: UiVariant) => {
      const ctrl = variantCtrlRef.current;
      if (!user?.id) {
        const revert = ctrl.saveFailed();
        setCardVariant(revert);
        applyUiVariant(revert === 'metal' ? 'metal' : null);
        toast.error('Could not save card style — you are not signed in');
        return;
      }
      const res = await persistUiVariant(user.id, variant, async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      });
      if (res.ok) {
        ctrl.saveSucceeded();
      } else {
        // Revert BOTH the control and the attribute — they never diverge.
        const revert = ctrl.saveFailed();
        setCardVariant(revert);
        applyUiVariant(revert === 'metal' ? 'metal' : null);
        console.error('ui_variant save failed:', res.error);
        toast.error('Could not save card style — reverted to the previous style');
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('ui_variant')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const ctrl = variantCtrlRef.current;
      if (error) {
        // Read failure must never block the control (the save path does
        // not depend on the read) and must never wipe the current look.
        ctrl.readFailed();
        console.error('ui_variant read failed:', error.message);
      } else {
        const queued = ctrl.readResolved(data?.ui_variant === 'metal' ? 'metal' : 'default');
        setCardVariant(ctrl.value);
        applyUiVariant(ctrl.value === 'metal' ? 'metal' : null);
        // A click landed before the read: persist it now, exactly once.
        if (queued) void persistVariant(queued);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, persistVariant]);

  const handleCardVariantChange = useCallback(
    (next: UiVariant) => {
      const ctrl = variantCtrlRef.current;
      const toSave = ctrl.select(next);
      // Control and attribute always move together, even for queued clicks.
      setCardVariant(ctrl.value);
      applyUiVariant(ctrl.value === 'metal' ? 'metal' : null);
      if (toSave) void persistVariant(toSave);
    },
    [persistVariant],
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('notifications')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setNotifPrefs(normalizeNotificationPrefs(data?.notifications));
        setNotifPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const saveNotifPrefs = useCallback(
    async (next: NotificationPrefs) => {
      if (!user?.id || next === notifPrefs) return;
      const prev = notifPrefs;
      setNotifPrefs(next); // optimistic; reverted on failure (never half-saved)
      const { error } = await supabase
        .from('profiles')
        .update({ notifications: next as unknown as Json })
        .eq('id', user.id);
      if (error) {
        setNotifPrefs(prev);
        toast.error('Could not save notification preferences');
      }
    },
    [user?.id, notifPrefs],
  );

  /* ---- connected devices ---- */
  const devices: DeviceItem[] = [
    {
      name: 'Apple Watch Series 9',
      type: 'Smartwatch',
      connected: true,
      lastSync: '2 min ago',
      icon: Watch,
      tone: 'brand',
    },
    {
      name: 'Withings Scale',
      type: 'Smart Scale',
      connected: true,
      lastSync: '1 hr ago',
      icon: Scale,
      tone: 'brand',
    },
    {
      name: 'MyFitnessPal',
      type: 'Fitness App',
      connected: false,
      lastSync: '3 days ago',
      icon: Activity,
      tone: 'accent',
    },
  ];

  /* ---- export handlers ---- */
  const handleExport = useCallback((type: string) => {
    const csv = `${type} data export...`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azfit-${type.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-[100dvh] pb-20" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* ====== Decorative Header ====== */}
      <div
        className="relative h-40 w-full overflow-hidden"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}azfit-bg-2.png)`, // Phase 43 Fix 4: absolute path 404'd under the /Azfit.ai/ subpath
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
        }}
      >
        {/* Phase 96a: AzFIT logo → dashboard (chip keeps it readable over the image) */}
        <div
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border px-1.5"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <LogoHomeButton />
        </div>
        {/* Overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, rgba(15,23,42,0.3), rgba(15,23,42,1))'
              : 'linear-gradient(to bottom, rgba(15,23,42,0.2), rgba(248,250,252,1))',
          }}
        />
        {/* Title */}
        <div className="absolute bottom-0 left-0 p-4">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-3xl font-bold text-white"
            style={{ textShadow: 'var(--text-shadow-hero)' }}
          >
            Settings
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-1 text-sm"
            style={{ color: 'rgba(255,255,255,0.8)', textShadow: 'var(--text-shadow-hero)' }}
          >
            Manage your profile and preferences
          </motion.p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {/* ====== Profile Card ====== */}
        <motion.div
          {...fadeUp}
          className="relative -mt-10 rounded-2xl border p-5 shadow-lg"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          {/* Avatar row */}
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
              className="relative"
            >
              <div
                className="h-20 w-20 overflow-hidden rounded-full border-2"
                style={{ borderColor: 'var(--azfit-primary)' }}
              >
                <div
                  className="flex h-full w-full items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: 'var(--light-elevated)', color: 'var(--azfit-primary)' }}
                >
                  {initials || '?'}
                </div>
              </div>
              <button
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-md transition-transform duration-100 active:scale-90"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--azfit-primary)',
                }}
                type="button"
              >
                <Edit3 size={12} />
              </button>
            </motion.div>

            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                    {displayName || '—'}
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: 'var(--azfit-primary)' }}>
                    {isTrainer ? 'Trainer' : 'Client'}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--light-text-secondary)' }}>
                    {user?.email || '—'}
                  </p>
                  <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--light-text-muted)' }}>
                    {clientRow ? `Member since ${formatDate(clientRow.created_at)}` : 'Member since —'}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-all duration-200 hover:bg-[var(--azfit-primary)] hover:text-white active:scale-[0.97]"
                  style={{
                    borderColor: 'var(--azfit-primary)',
                    color: 'var(--azfit-primary)',
                    textShadow: 'var(--text-shadow-dark)',
                  }}
                  type="button"
                  onClick={() => toast.info('Profile editing coming soon')}
                >
                  <Edit3 size={12} />
                  Edit
                </button>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="mt-4 grid grid-cols-2 gap-3"
          >
            {[
              { icon: <Phone size={16} />, label: 'Phone', value: clientRow?.phone || 'Not set' },
              { icon: <Calendar size={16} />, label: 'Birth Date', value: clientRow?.date_of_birth ? formatDate(clientRow.date_of_birth) : 'Not set' },
              { icon: <Ruler size={16} />, label: 'Height', value: clientRow?.height_cm ? `${clientRow.height_cm} cm` : 'Not set' },
              { icon: <User size={16} />, label: 'Gender', value: clientRow?.gender ? clientRow.gender.charAt(0).toUpperCase() + clientRow.gender.slice(1) : 'Not set' },
            ].map((item) => (
              <motion.div key={item.label} variants={childFade} className="flex items-center gap-2.5">
                <div style={{ color: 'var(--light-text-muted)' }}>{item.icon}</div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--light-text-muted)' }}>
                    {item.label}
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                    {item.value}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Goal Tags (real client_goals when the user has a clients row) */}
          {clientRow && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {goals.map((goal) => (
                <span
                  key={goal.id}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--azfit-primary) 15%, transparent)',
                    color: 'var(--azfit-primary)',
                    textShadow: 'var(--text-shadow-dark)',
                  }}
                >
                  {goalLabel(goal)}
                </span>
              ))}
              {goals.length === 0 && (
                <span className="text-xs" style={{ color: 'var(--light-text-muted)' }}>No goals set yet</span>
              )}
              <div className="relative">
                <button
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--light-elevated)]"
                  style={{ color: 'var(--light-text-muted)' }}
                  type="button"
                  onClick={() => setGoalPickerOpen((s) => !s)}
                >
                  + Add Goal
                </button>
                {goalPickerOpen && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border py-1 shadow-lg"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    {(Object.keys(GOAL_TYPE_LABELS) as ClientGoalType[]).map((gt) => (
                      <button
                        key={gt}
                        type="button"
                        onClick={() => addGoal(gt)}
                        className="w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--light-elevated)]"
                        style={{ color: 'var(--page-text)' }}
                      >
                        {GOAL_TYPE_LABELS[gt]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ====== Appearance Section ====== */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          {/* Section header */}
          <div className="mb-4 flex items-center gap-2.5">
            <Palette size={20} style={{ color: 'var(--azfit-primary)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
              Appearance
            </h3>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--light-border)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isDark ? <Moon size={20} style={{ color: 'var(--azfit-accent)' }} /> : <Sun size={20} style={{ color: 'var(--warning)' }} />}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                  Dark Mode
                </p>
                <p className="text-xs" style={{ color: 'var(--light-text-muted)' }}>
                  Switch between light and dark themes
                </p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={toggleTheme} />
          </div>

          {/* Phase 92c: Card style — opt-in "Pulse Metal" brushed-metal finish */}
          <div
            className="flex items-center justify-between gap-3 py-3"
            style={{ borderBottom: '1px solid var(--light-border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ color: 'var(--azfit-primary)' }}
              >
                <Layers size={16} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                  Card style
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--light-text-muted)' }}>
                  Pulse Metal is a brushed-metal finish trial — Default keeps the classic look
                </p>
              </div>
            </div>
            <div
              className="flex shrink-0 rounded-lg border p-0.5"
              style={{ borderColor: 'var(--light-border)' }}
              role="group"
              aria-label="Card style"
            >
              {(['default', 'metal'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={cardVariant === v}
                  onClick={() => handleCardVariantChange(v)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: cardVariant === v ? 'var(--azfit-primary)' : 'transparent',
                    color: cardVariant === v ? '#FFFFFF' : 'var(--page-text)',
                  }}
                >
                  {v === 'default' ? 'Default' : 'Pulse Metal'}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Preview */}
          <div className="mt-4 flex gap-3">
            {/* Light preview */}
            <button
              onClick={() => { if (isDark) toggleTheme(); }}
              className="flex-1 overflow-hidden rounded-xl border-2 transition-all duration-200"
              style={{
                borderColor: !isDark ? 'var(--azfit-primary)' : 'var(--light-border)',
                boxShadow: !isDark ? '0 0 0 3px color-mix(in srgb, var(--azfit-primary) 15%, transparent)' : 'none',
                opacity: isDark ? 0.6 : 1,
              }}
              type="button"
            >
              <div className="h-16 p-2" style={{ backgroundColor: '#F8FAFC' }}>
                <div className="h-2 w-12 rounded" style={{ backgroundColor: '#E2E8F0' }} />
                <div className="mt-2 h-2 w-20 rounded" style={{ backgroundColor: '#CBD5E1' }} />
              </div>
              <div className="border-t px-2 py-1.5 text-center font-mono text-[10px]" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }}>
                Light
              </div>
            </button>

            {/* Dark preview */}
            <button
              onClick={() => { if (!isDark) toggleTheme(); }}
              className="flex-1 overflow-hidden rounded-xl border-2 transition-all duration-200"
              style={{
                borderColor: isDark ? 'var(--azfit-primary)' : 'var(--light-border)',
                boxShadow: isDark ? '0 0 0 3px color-mix(in srgb, var(--azfit-primary) 15%, transparent)' : 'none',
                opacity: !isDark ? 0.6 : 1,
              }}
              type="button"
            >
              <div className="h-16 p-2" style={{ backgroundColor: '#0F172A' }}>
                <div className="h-2 w-12 rounded" style={{ backgroundColor: '#334155' }} />
                <div className="mt-2 h-2 w-20 rounded" style={{ backgroundColor: '#64748B' }} />
              </div>
              <div className="border-t px-2 py-1.5 text-center font-mono text-[10px]" style={{ backgroundColor: '#1E293B', borderColor: '#475569', color: '#F8FAFC' }}>
                Dark
              </div>
            </button>
          </div>
        </motion.div>

        {/* ====== Units Section ====== */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Ruler size={20} style={{ color: 'var(--azfit-secondary)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
              Units
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>Weight</span>
              <div className="w-32">
                <SegmentedControl options={['kg', 'lbs']} value={weightUnit} onChange={setWeightUnit} />
              </div>
            </div>
            <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--light-border)', paddingTop: 12 }}>
              <span className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>Distance</span>
              <div className="w-32">
                <SegmentedControl options={['km', 'miles']} value={distanceUnit} onChange={setDistanceUnit} />
              </div>
            </div>
            <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--light-border)', paddingTop: 12 }}>
              <span className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>Temperature</span>
              <div className="w-32">
                <SegmentedControl options={['\u00B0C', '\u00B0F']} value={tempUnit} onChange={setTempUnit} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ====== AI Assistant Section (Phase 97a, trainer only) ====== */}
        {isTrainer && (
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.17 }}
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Bot size={20} style={{ color: 'var(--azfit-primary)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
              AI Assistant
            </h3>
          </div>

          <p className="mb-4 text-xs" style={{ color: 'var(--light-text-muted)' }}>
            Connect your own OpenAI-compatible API key (OpenAI or Moonshot/Kimi) to power the
            client quick-log chat. Your key is stored encrypted-in-isolation server-side and is
            never shown back — only its presence.
          </p>

          {/* Presence + key input */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                API key
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: aiHasKey ? 'color-mix(in srgb, var(--azfit-primary) 15%, transparent)' : 'var(--light-border)',
                  color: aiHasKey ? 'var(--azfit-primary)' : 'var(--light-text-muted)',
                }}
              >
                {aiHasKey === null ? '…' : aiHasKey ? 'Key saved ········' : 'No key set'}
              </span>
            </div>
            <input
              type="password"
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              placeholder={aiHasKey ? 'Paste a new key to replace' : 'Paste your API key (sk-…)'}
              autoComplete="off"
              className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--light-border)',
                color: 'var(--page-text)',
              }}
              aria-label="AI API key"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder="Base URL (default https://api.openai.com/v1)"
                autoComplete="off"
                className="min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--light-border)',
                  color: 'var(--page-text)',
                }}
                aria-label="AI base URL"
              />
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="Model (default gpt-4o-mini)"
                autoComplete="off"
                className="min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--light-border)',
                  color: 'var(--page-text)',
                }}
                aria-label="AI model"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleAiSave()}
                disabled={aiSaving || !aiKey.trim()}
                className="flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--azfit-primary)', color: '#FFFFFF' }}
              >
                {aiSaving ? 'Saving…' : 'Save key'}
              </button>
              {aiHasKey && (
                <button
                  type="button"
                  onClick={() => void handleAiClear()}
                  disabled={aiSaving}
                  className="flex min-h-[44px] items-center justify-center rounded-lg border px-4 text-sm font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--light-border)', color: 'var(--page-text)' }}
                >
                  Clear key
                </button>
              )}
            </div>
          </div>
        </motion.div>
        )}

        {/* ====== Notifications Section ====== */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Bell size={20} style={{ color: 'var(--azfit-accent)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
              Notifications
            </h3>
          </div>

          {/* Master toggles */}
          <ToggleRow
            label="Push Notifications"
            description={
              !pushState.supported
                ? 'Push is not supported in this browser'
                : pushState.permission === 'granted'
                  ? 'Permission: granted'
                  : pushState.permission === 'denied'
                    ? 'Permission: blocked by browser'
                    : 'Permission: not asked yet'
            }
            checked={pushEnabled}
            onCheckedChange={handlePushToggle}
            disabled={!pushState.supported || pushBusy || pushState.permission === 'denied'}
          />
          {pushState.permission === 'denied' && (
            <p className="py-2 text-xs" style={{ color: 'var(--warning)' }}>
              Notifications are blocked for this site. To enable them, reset the
              permission in your browser&apos;s site settings, then toggle again.
            </p>
          )}
          {pushEnabled && (
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--light-border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: 'var(--azfit-primary)' }}>
                  <Send size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                    Send test notification
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--light-text-muted)' }}>
                    Delivered via the send-push edge function
                  </p>
                </div>
              </div>
              <button
                onClick={handleTestPush}
                disabled={testSending}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-all duration-200 hover:bg-[var(--azfit-primary)] hover:text-white active:scale-[0.97] disabled:opacity-50"
                style={{
                  borderColor: 'var(--azfit-primary)',
                  color: 'var(--azfit-primary)',
                  textShadow: 'var(--text-shadow-dark)',
                }}
                type="button"
              >
                <Send size={12} />
                {testSending ? 'Sending…' : 'Send test'}
              </button>
            </div>
          )}
          {/* Phase 94 — per-type prefs + quiet hours (persisted server-side in
              profiles.notifications; enforced at send time when Phase 95
              triggers ship). Only meaningful while push is enabled. */}
          {pushEnabled && notifPrefsLoaded && (
            <div className="pt-1">
              <p
                className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--light-text-muted)' }}
              >
                Alert preferences
              </p>
              {NOTIFICATION_TYPES.map((t) => (
                <ToggleRow
                  key={t.id}
                  label={t.label}
                  description={t.description}
                  checked={notifPrefs.types[t.id]}
                  onCheckedChange={(v) => void saveNotifPrefs(setNotificationType(notifPrefs, t.id, v))}
                />
              ))}
              <div
                className="flex flex-wrap items-center justify-between gap-2 py-3"
                style={{ borderBottom: '1px solid var(--light-border)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                    Quiet hours
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--light-text-muted)' }}>
                    {notifPrefs.quietHours
                      ? `Alerts held ${notifPrefs.quietHours.from}–${notifPrefs.quietHours.to} (enforced when triggers ship)`
                      : 'No quiet hours set'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    aria-label="Quiet hours from"
                    value={notifPrefs.quietHours?.from ?? ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const to = notifPrefs.quietHours?.to ?? '07:00';
                      void saveNotifPrefs(setQuietHours(notifPrefs, e.target.value, to));
                    }}
                    className="h-8 w-[5.5rem] rounded-md border border-[var(--card-border)] bg-[var(--page-bg)] px-2 text-xs text-[var(--page-text)]"
                  />
                  <span className="text-xs" style={{ color: 'var(--light-text-muted)' }}>to</span>
                  <input
                    type="time"
                    aria-label="Quiet hours to"
                    value={notifPrefs.quietHours?.to ?? ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const from = notifPrefs.quietHours?.from ?? '21:00';
                      void saveNotifPrefs(setQuietHours(notifPrefs, from, e.target.value));
                    }}
                    className="h-8 w-[5.5rem] rounded-md border border-[var(--card-border)] bg-[var(--page-bg)] px-2 text-xs text-[var(--page-text)]"
                  />
                  {notifPrefs.quietHours && (
                    <button
                      type="button"
                      onClick={() => void saveNotifPrefs(clearQuietHours(notifPrefs))}
                      className="h-8 rounded-md border px-2 text-[11px] font-medium"
                      style={{ borderColor: 'var(--card-border)', color: 'var(--light-text-muted)' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <ToggleRow
            label="Email Notifications"
            description="Receive email updates and summaries"
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
          />

          {/* Divider */}
          <div className="my-2" />

          {/* Individual toggles */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<Dumbbell size={16} />}
                label="Workout Reminders"
                description="Daily reminder to log your workout"
                checked={workoutReminders}
                onCheckedChange={setWorkoutReminders}
                disabled={!pushEnabled}
              />
            </motion.div>
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<Calendar size={16} />}
                label="Weekly Progress Report"
                description="Weekly progress report every Monday"
                checked={weeklySummary}
                onCheckedChange={setWeeklySummary}
                disabled={!emailEnabled}
              />
            </motion.div>
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<CheckCircle2 size={16} />}
                label="New PR Celebrations"
                description="Celebrate when you earn badges"
                checked={achievementAlerts}
                onCheckedChange={setAchievementAlerts}
                disabled={!pushEnabled}
              />
            </motion.div>
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<User size={16} />}
                label="Coach Messages"
                description="Notifications when your coach reaches out"
                checked={coachMessages}
                onCheckedChange={setCoachMessages}
                disabled={!pushEnabled}
              />
            </motion.div>
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<Bell size={16} />}
                label="Streak Alerts"
                description="Warn when your streak is about to break"
                checked={streakAlerts}
                onCheckedChange={setStreakAlerts}
                disabled={!pushEnabled}
              />
            </motion.div>
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<Apple size={16} />}
                label="Meal Reminders"
                description="Reminders to log your meals"
                checked={mealReminders}
                onCheckedChange={setMealReminders}
                disabled={!pushEnabled}
              />
            </motion.div>
            <motion.div variants={childFade}>
              <ToggleRow
                icon={<Download size={16} />}
                label="App Updates"
                description="Get notified about new app features"
                checked={appUpdates}
                onCheckedChange={setAppUpdates}
                disabled={!pushEnabled}
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ====== Connected Devices Section ====== */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.25 }}
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Watch size={20} style={{ color: 'var(--azfit-primary)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
                Connected Devices
              </h3>
            </div>
            <button
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-all duration-200 hover:bg-[var(--azfit-primary)] hover:text-white active:scale-[0.97]"
              style={{
                borderColor: 'var(--azfit-primary)',
                color: 'var(--azfit-primary)',
                textShadow: 'var(--text-shadow-dark)',
              }}
              type="button"
              onClick={() => toast.info('Device connection coming soon')}
            >
              + Connect Device
            </button>
          </div>

          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
          >
            {devices.map((device) => (
              <DeviceRow key={device.name} device={device} />
            ))}
          </motion.div>
        </motion.div>

        {/* ====== Data Export Section ====== */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.3 }}
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Download size={20} style={{ color: 'var(--azfit-secondary)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--page-text)', textShadow: 'var(--text-shadow-dark)' }}>
              Data Export
            </h3>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleExport('all-data')}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-mono text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--azfit-primary)', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              type="button"
            >
              <Download size={16} />
              Export All Data
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('workouts')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs font-semibold transition-all duration-200 hover:bg-[var(--azfit-primary)] hover:text-white active:scale-[0.97]"
                style={{
                  borderColor: 'var(--azfit-primary)',
                  color: 'var(--azfit-primary)',
                  textShadow: 'var(--text-shadow-dark)',
                }}
                type="button"
              >
                <Dumbbell size={14} />
                Export Workouts (CSV)
              </button>
              <button
                onClick={() => handleExport('nutrition')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs font-semibold transition-all duration-200 hover:bg-[var(--azfit-primary)] hover:text-white active:scale-[0.97]"
                style={{
                  borderColor: 'var(--azfit-primary)',
                  color: 'var(--azfit-primary)',
                  textShadow: 'var(--text-shadow-dark)',
                }}
                type="button"
              >
                <Apple size={14} />
                Export Nutrition (CSV)
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====== Account Actions Section ====== */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.35 }}
          className="mt-6 space-y-3 px-1 pb-8"
        >
          <button
            onClick={() => toast.info('Password change coming soon')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 font-mono text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
            style={{
              borderColor: 'var(--azfit-primary)',
              color: 'var(--azfit-primary)',
              textShadow: 'var(--text-shadow-dark)',
            }}
            type="button"
          >
            <Lock size={16} />
            Change Password
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                toast.info('Account deletion coming soon');
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-3 font-mono text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            style={{
              backgroundColor: 'var(--danger)',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
            type="button"
          >
            <Trash2 size={16} />
            Delete Account
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-3 font-mono text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
            style={{
              color: 'var(--danger)',
              textShadow: 'var(--text-shadow-dark)',
            }}
            type="button"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </motion.div>
      </div>
    </div>
  );
}
