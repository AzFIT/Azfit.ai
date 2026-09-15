/* ═══════════════════════════════════════════════════════════════
   Phase 95 — app-fired "Achievement Unlocked" push (Phase 87 wiring).

   Flow: useAchievements tracks the previously-unlocked id set in a
   ref; when a NEW unlock appears (and we're NOT in a 90e view-as
   override), each new achievement is pushed once:
     1. Client-side prefs gate (profiles.notifications toggle off →
        skip entirely — no log row, no send).
     2. INSERT notification_log (user_id, 'achievement_unlocked',
        ref_key) ON CONFLICT DO NOTHING — the UNIQUE key makes the
        whole pipeline idempotent across devices/sessions. No row
        inserted → another path already handled it → skip the send.
     3. sendPushToSelf(..., type: 'achievement_unlocked') — the
        deployed send-push enforces the same toggle + quiet hours
        server-side (belt and braces; the client gate is the fast path).

   Semantics: the log row is written BEFORE the send (RLS grants no
   UPDATE), so a send failure can never produce a duplicate
   notification later — at-most-once, never at-least-once.
   ═══════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { sendPushToSelf } from '@/lib/push';
import { normalizeNotificationPrefs } from '@/lib/notificationPrefs';
import type { Achievement } from '@/lib/achievements';

export const ACHIEVEMENT_PUSH_TYPE = 'achievement_unlocked';

/** Stable idempotency key for the notification_log row. */
export function achievementRefKey(achievementId: string): string {
  return `achievement:${achievementId}`;
}

/**
 * Pure diff: achievements newly unlocked compared to the previous
 * unlocked-id set. `prev === null` means "first observation" (initial
 * load) — nothing is "new" then; pre-existing unlocks never re-notify.
 */
export function newUnlocks(
  prev: ReadonlySet<string> | null,
  next: readonly Achievement[],
): Achievement[] {
  if (prev === null) return [];
  return next.filter((a) => a.unlocked && !prev.has(a.id));
}

/** Fire the push pipeline for one batch of newly unlocked achievements. */
export async function notifyNewAchievements(
  userId: string,
  fresh: readonly Achievement[],
): Promise<void> {
  if (fresh.length === 0) return;

  // Client-side prefs gate (fast path — server enforces it too).
  const { data: profile } = await supabase
    .from('profiles')
    .select('notifications')
    .eq('id', userId)
    .maybeSingle();
  const prefs = normalizeNotificationPrefs(
    (profile as { notifications?: unknown } | null)?.notifications,
  );
  if (!prefs.types[ACHIEVEMENT_PUSH_TYPE]) return;

  for (const a of fresh) {
    // Idempotency: log first. A conflict means this achievement was
    // already notified (another device/session won) — skip the send.
    const { error: logError } = await supabase.from('notification_log').insert({
      user_id: userId,
      type: ACHIEVEMENT_PUSH_TYPE,
      ref_key: achievementRefKey(a.id),
      sent_at: new Date().toISOString(),
    });
    // 23505 unique_violation → already logged; anything else → skip
    // this one but keep going (never half-crash the loop).
    if (logError) continue;

    await sendPushToSelf(
      'Achievement unlocked',
      `You earned "${a.title}" — ${a.description}`,
      '/#/dashboard',
      ACHIEVEMENT_PUSH_TYPE,
    ).catch(() => {
      // At-most-once: the log row already exists, so a failed send is
      // never retried (documented semantics). Silent by design.
    });
  }
}
