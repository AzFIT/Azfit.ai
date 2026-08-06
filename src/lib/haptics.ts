/* ═══════════════════════════════════════════════════════════════════
   Rest-timer haptics (Phase 49, Item 3) — localStorage toggle +
   feature-detected navigator.vibrate. No schema, no deps.
   ═══════════════════════════════════════════════════════════════════ */

const HAPTICS_KEY = "azfit_rest_haptics";

/** Default ON; persisted per device. */
export function hapticsEnabled(): boolean {
  try {
    const v = localStorage.getItem(HAPTICS_KEY);
    return v === null ? true : v === "1";
  } catch {
    return false;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Vibrate only when the platform supports it and the toggle is on. */
export function safeVibrate(pattern: number | number[]): boolean {
  if (!hapticsEnabled()) return false;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  return navigator.vibrate(pattern);
}
