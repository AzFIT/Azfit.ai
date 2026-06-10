import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/useTheme';

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
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
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
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: device.iconBg }}
        >
          <div style={{ color: device.iconColor }}>{device.icon}</div>
        </div>
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
  const isDark = theme === 'dark';

  /* ---- units state ---- */
  const [weightUnit, setWeightUnit] = useState('kg');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [tempUnit, setTempUnit] = useState('\u00B0C');

  /* ---- notifications state ---- */
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [coachMessages, setCoachMessages] = useState(true);
  const [achievementAlerts, setAchievementAlerts] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [mealReminders, setMealReminders] = useState(false);
  const [appUpdates, setAppUpdates] = useState(false);

  /* ---- connected devices ---- */
  const devices: DeviceItem[] = [
    {
      name: 'Apple Watch Series 9',
      type: 'Smartwatch',
      connected: true,
      lastSync: '2 min ago',
      icon: <Watch size={20} />,
      iconBg: 'rgba(13,148,136,0.1)',
      iconColor: 'var(--azfit-primary)',
    },
    {
      name: 'Withings Scale',
      type: 'Smart Scale',
      connected: true,
      lastSync: '1 hr ago',
      icon: <Scale size={20} />,
      iconBg: 'rgba(6,182,212,0.1)',
      iconColor: 'var(--azfit-secondary)',
    },
    {
      name: 'MyFitnessPal',
      type: 'Fitness App',
      connected: false,
      lastSync: '3 days ago',
      icon: <Activity size={20} />,
      iconBg: 'rgba(139,92,246,0.1)',
      iconColor: 'var(--azfit-accent)',
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
          backgroundImage: 'url(/azfit-bg-2.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
        }}
      >
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
                <img
                  src="./avatar-alex.jpg"
                  alt="Alex Chen"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div
                  className="flex h-full w-full items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: 'var(--light-elevated)', color: 'var(--azfit-primary)' }}
                >
                  AC
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
                    Alex Chen
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: 'var(--azfit-primary)' }}>
                    Premium Member
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--light-text-secondary)' }}>
                    alex.chen@email.com
                  </p>
                  <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--light-text-muted)' }}>
                    Member since March 2025
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
              { icon: <Phone size={16} />, label: 'Phone', value: '+1 (555) 123-4567' },
              { icon: <Calendar size={16} />, label: 'Birth Date', value: 'March 15, 1997' },
              { icon: <Ruler size={16} />, label: 'Height', value: '178 cm' },
              { icon: <User size={16} />, label: 'Gender', value: 'Male' },
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

          {/* Goal Tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {['Strength', 'Muscle Gain'].map((goal) => (
              <span
                key={goal}
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: goal === 'Strength' ? 'rgba(13,148,136,0.15)' : 'rgba(139,92,246,0.15)',
                  color: goal === 'Strength' ? 'var(--azfit-primary)' : 'var(--azfit-accent)',
                  textShadow: 'var(--text-shadow-dark)',
                }}
              >
                {goal}
              </span>
            ))}
            <button
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--light-elevated)]"
              style={{ color: 'var(--light-text-muted)' }}
              type="button"
            >
              + Add Goal
            </button>
          </div>
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

          {/* Theme Preview */}
          <div className="mt-4 flex gap-3">
            {/* Light preview */}
            <button
              onClick={() => { if (isDark) toggleTheme(); }}
              className="flex-1 overflow-hidden rounded-xl border-2 transition-all duration-200"
              style={{
                borderColor: !isDark ? 'var(--azfit-primary)' : 'var(--light-border)',
                boxShadow: !isDark ? '0 0 0 3px rgba(13,148,136,0.15)' : 'none',
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
                boxShadow: isDark ? '0 0 0 3px rgba(13,148,136,0.15)' : 'none',
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
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: 'rgba(13,148,136,0.15)', color: 'var(--azfit-primary)' }}
            >
              3 active
            </span>
          </div>

          {/* Master toggles */}
          <ToggleRow
            label="Push Notifications"
            description="Enable push notifications on this device"
            checked={pushEnabled}
            onCheckedChange={setPushEnabled}
          />
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
