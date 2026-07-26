/**
 * Web Push foundation (Phase 24A)
 * Browser Push API → push_subscriptions table. Sending happens in the
 * send-push edge function (Phase 24A write-only; deploy separately).
 */

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** base64url → Uint8Array (for applicationServerKey) */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  /** Browser subscription exists AND a matching row is saved for this user */
  subscribed: boolean;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false };
  }

  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint)
          .maybeSingle();
        subscribed = !!data;
      }
    }
  } catch {
    subscribed = false;
  }

  return { supported: true, permission: Notification.permission, subscribed };
}

/**
 * Get the existing service worker registration (registered by registerSW).
 * Never registers a second SW — returns null when none is active yet
 * (e.g. dev mode, where registerSW is intentionally skipped).
 */
async function getExistingRegistration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // Registration happens on window load in prod — give it a short window.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
}

export async function subscribePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Push is not supported in this browser' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'VAPID public key is not configured' };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: 'Not signed in' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      error: permission === 'denied' ? 'denied' : 'Notification permission was not granted',
    };
  }

  const reg = await getExistingRegistration();
  if (!reg) {
    return {
      ok: false,
      error: 'Service worker is not active (disabled in dev — test on the deployed site)',
    };
  }

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        subscription: sub.toJSON() as unknown as Json,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Subscription failed' };
  }
}

export async function unsubscribePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Push is not supported in this browser' };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await sub.unsubscribe().catch(() => {});
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unsubscribe failed' };
  }
}

export interface SendPushResult {
  sent: number;
  failed: number;
  pruned: number;
}

/** Calls the send-push edge function (must be deployed separately). */
export async function sendTestPush(userId: string): Promise<SendPushResult> {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: { user_id: userId, title: 'AzFIT', body: 'Push is working!', url: '/#/dashboard' },
  });
  if (error) throw new Error(error.message || 'send-push failed (is the edge function deployed?)');
  return data as SendPushResult;
}
