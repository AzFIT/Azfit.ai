// Phase 91 — privacy reveal hooks over the module store in @/lib/privacyReveal.

import { useEffect, useSyncExternalStore } from "react";
import {
  isPrivacyRevealed,
  setPrivacyRevealed,
  subscribePrivacyReveal,
} from "@/lib/privacyReveal";

/** Live privacy-reveal flag shared by the app-bar eye and blurred cards. */
export function usePrivacyRevealed(): boolean {
  return useSyncExternalStore(subscribePrivacyReveal, isPrivacyRevealed);
}

/**
 * Auto re-blur: while `enabled && revealed`, any pointer/keyboard activity
 * resets an `autoReblurSec` idle timer; when it fires, the blur re-engages.
 * DOCUMENTED RESET EVENTS: pointerdown, wheel, touchstart, keydown (covers
 * mouse, trackpad, touch, and keyboard use without per-mousemove churn).
 * `autoReblurSec` null (or privacy off) = never auto re-blur. Reveal also
 * resets to blurred whenever privacy is disabled.
 */
export function useAutoReblur(
  enabled: boolean,
  revealed: boolean,
  autoReblurSec: number | null
): void {
  useEffect(() => {
    if (!enabled) {
      setPrivacyRevealed(false);
      return;
    }
    if (!revealed || autoReblurSec === null) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPrivacyRevealed(false), autoReblurSec * 1000);
    };
    const onActivity = () => arm();

    arm();
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, onActivity));
    };
  }, [enabled, revealed, autoReblurSec]);
}
