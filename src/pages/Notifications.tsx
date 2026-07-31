import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bell, BellRing, Droplets, Dumbbell, Scale,
  Moon, Flame, Clock,
} from 'lucide-react';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  time?: string;
}

const DEFAULT_SETTINGS: NotificationSetting[] = [
  { id: 'workout_reminder', label: 'Workout Reminder', description: 'Time for your workout!', icon: Dumbbell, enabled: true, time: '07:00' },
  { id: 'rest_day', label: 'Rest Day Tip', description: 'Rest day tomorrow — stretch!', icon: Moon, enabled: true },
  { id: 'streak_alert', label: 'Streak Milestone', description: 'You\'ve hit a new streak!', icon: Flame, enabled: true },
  { id: 'weight_log', label: 'Weekly Weigh-in', description: 'Log your weight', icon: Scale, enabled: true, time: '08:00' },
  { id: 'water_reminder', label: 'Hydration Reminder', description: 'Don\'t forget to drink water', icon: Droplets, enabled: false, time: '14:00' },
];

const STORAGE_KEY = 'azfit_notification_settings';

/* eslint-disable react-refresh/only-export-components */
// Phase 33A Fix 1: persist ONLY plain data (id/enabled/time) — never the icon
// component. Loading merges saved values onto DEFAULT_SETTINGS by id, which
// auto-repairs pre-fix poisoned payloads (icons serialized as junk objects).
export function saveSettings(settings: NotificationSetting[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(settings.map((s) => ({ id: s.id, enabled: s.enabled, time: s.time })))
  );
}

export function loadSettings(): NotificationSetting[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as unknown;
      if (Array.isArray(saved) && saved.length > 0) {
        return DEFAULT_SETTINGS.map((def) => {
          const entry = saved.find(
            (s): s is { id: string; enabled?: unknown; time?: unknown } =>
              typeof s === 'object' && s !== null && (s as { id?: unknown }).id === def.id
          );
          return {
            ...def,
            enabled: typeof entry?.enabled === 'boolean' ? entry.enabled : def.enabled,
            time: typeof entry?.time === 'string' ? entry.time : def.time,
          };
        });
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}
/* eslint-enable react-refresh/only-export-components */

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<NotificationSetting[]>(loadSettings);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [testSent, setTestSent] = useState<string | null>(null);

  // Check notification permission on mount using a timeout to avoid setState in effect
  useState(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  });

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const toggleSetting = (id: string) => {
    setSettings((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const updateTime = (id: string, time: string) => {
    setSettings((prev) => prev.map((s) => s.id === id ? { ...s, time } : s));
  };

  const sendTest = (setting: NotificationSetting) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      requestPermission();
      return;
    }
    new Notification('AzFIT', {
      body: setting.description,
      icon: '/AzFIT_LOGO_Transparent.png',
    });
    setTestSent(setting.id);
    setTimeout(() => setTestSent(null), 2000);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--page-text)' }}>
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--light-text-muted)' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--page-text)' }}>
            <BellRing className="w-5 h-5 text-[#00AEEF]" />
            Notifications
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Permission Banner */}
        {permission !== 'granted' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-300 font-medium">Enable Push Notifications</p>
              <p className="text-xs text-amber-400/70">Get reminders for workouts, hydration, and milestones</p>
            </div>
            <button
              onClick={requestPermission}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors"
            >
              Enable
            </button>
          </div>
        )}

        {/* Settings List */}
        <div className="space-y-3">
          {settings.map((setting) => (
            <motion.div
              key={setting.id}
              layout
              className="rounded-2xl border p-4"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={
                    setting.enabled
                      ? { backgroundColor: 'rgba(0,174,239,0.1)', color: '#00AEEF' }
                      : { backgroundColor: 'var(--light-elevated)', color: 'var(--light-text-muted)' }
                  }
                >
                  <setting.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--page-text)' }}>{setting.label}</h3>
                  <p className="text-xs" style={{ color: 'var(--light-text-secondary)' }}>{setting.description}</p>
                </div>
                <button
                  onClick={() => toggleSetting(setting.id)}
                  className="w-12 h-7 rounded-full transition-colors relative"
                  style={{ backgroundColor: setting.enabled ? '#00AEEF' : 'var(--card-border)' }}
                >
                  <motion.div
                    animate={{ x: setting.enabled ? 20 : 2 }}
                    className="absolute top-1 w-5 h-5 rounded-full bg-white shadow"
                  />
                </button>
              </div>

              {setting.enabled && setting.time !== undefined && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 flex items-center gap-3"
                  style={{ borderTop: '1px solid var(--card-border)' }}
                >
                  <Clock className="w-4 h-4" style={{ color: 'var(--light-text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--light-text-secondary)' }}>Time:</span>
                  <input
                    type="time"
                    value={setting.time}
                    onChange={(e) => updateTime(setting.id, e.target.value)}
                    className="px-2 py-1 rounded-lg text-sm focus:outline-none focus:border-[#00AEEF]"
                    style={{ backgroundColor: 'var(--page-bg)', border: '1px solid var(--card-border)', color: 'var(--page-text)' }}
                  />
                  <button
                    onClick={() => sendTest(setting)}
                    className="ml-auto text-xs text-[#00AEEF] hover:underline"
                  >
                    {testSent === setting.id ? 'Sent!' : 'Test'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
