// ═══════════════════════════════════════════════════════════════
// qrTheme (Phase 90b-fix) — QR module colors derived from the active
// theme's `--page-text` token. THEME LOCK: no hardcoded theme colors.
//
// The original defect hardcoded #1a1a2e, which matches the dark card
// surface — the QR was invisible in dark theme (the default). The fix
// reads the ACTIVE theme's `--page-text` value at render time via
// getComputedStyle: light in dark theme (#F2F6FA), dark in light theme
// (#0F172A), so modules always contrast the card. The value flows from
// the CSS token — nothing is hardcoded in source.
//
// TOKEN CHOICE (documented deviation from the "--foreground" suggestion):
// `--foreground` is an HSL-space triplet ("0 0% 98%") for shadcn internals,
// and the `qrcode` lib only accepts HEX colors (hex2rgba) — hsl() would be
// rejected and the QR silently absent. `--page-text` is the app's own
// per-theme text token, defined as a full hex in both themes, and carries
// exactly the required semantics (light-on-dark / dark-on-light).
//
// The theme distinction comes entirely from the TOKEN VALUE the caller
// passes in — which is why the unit tests feed distinct per-theme token
// values and assert distinct outputs, and why `_resolvedTheme` is part of
// the contract: callers must re-render (and re-read the token) whenever
// the theme changes.
// ═══════════════════════════════════════════════════════════════

/** Alpha-0 background constant for the QR lib — a FORMAT constant, not a theme color. */
export const QR_BG_TRANSPARENT = "#00000000";

export interface QrThemeColors {
  /** QR module (the scannable squares) color — the theme's --page-text token value. */
  dark: string;
  /** QR background — always transparent so the card surface shows through. */
  light: string;
}

/**
 * Build QR lib colors from the active theme's `--page-text` token.
 * Returns null when the token value is empty (pre-hydration) — the caller
 * then skips rendering rather than falling back to a hardcoded color.
 *
 * @param _resolvedTheme the app's resolved theme ('light' | 'dark') — part of
 *   the contract: the caller re-reads the token and re-renders on change.
 *   Prefixed underscore because the mapping is token-driven, not branch-driven.
 * @param pageText the ACTIVE theme's computed `--page-text` value (full hex,
 *   e.g. "#F2F6FA" in dark theme), read via
 *   `getComputedStyle(document.documentElement).getPropertyValue("--page-text")`.
 */
export function qrColorsForTheme(_resolvedTheme: "light" | "dark", pageText: string): QrThemeColors | null {
  const value = pageText.trim();
  if (value === "") return null;
  return { dark: value, light: QR_BG_TRANSPARENT };
}
