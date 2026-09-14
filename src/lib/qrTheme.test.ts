// Phase 90b-fix — qrColorsForTheme: token-derived, distinct per theme, never hardcoded.
import { describe, it, expect } from "vitest";
import { qrColorsForTheme, QR_BG_TRANSPARENT } from "./qrTheme";

// Real per-theme `--page-text` values from src/index.css.
const LIGHT_TEXT = "#0F172A"; // light theme --page-text (dark text)
const DARK_TEXT = "#F2F6FA"; // dark theme --page-text (light text)

describe("qrColorsForTheme", () => {
  it("passes the token value through as the module color", () => {
    expect(qrColorsForTheme("dark", DARK_TEXT)).toEqual({ dark: DARK_TEXT, light: QR_BG_TRANSPARENT });
    expect(qrColorsForTheme("light", LIGHT_TEXT)).toEqual({ dark: LIGHT_TEXT, light: QR_BG_TRANSPARENT });
  });

  it("returns DISTINCT module colors per theme (token-driven, not constants)", () => {
    const dark = qrColorsForTheme("dark", DARK_TEXT);
    const light = qrColorsForTheme("light", LIGHT_TEXT);
    expect(dark).not.toBeNull();
    expect(light).not.toBeNull();
    expect(dark!.dark).not.toBe(light!.dark);
    // The original bug: modules ≈ card bg in dark theme. Assert inversion.
    expect(dark!.dark).toBe(DARK_TEXT); // light modules in dark theme
    expect(light!.dark).toBe(LIGHT_TEXT); // dark modules in light theme
  });

  it("never hardcodes a theme color — output is exactly the passed token", () => {
    const token = "#123456";
    const out = qrColorsForTheme("light", token);
    expect(out!.dark).toBe(token);
    expect(out!.dark).not.toBe(LIGHT_TEXT);
    expect(out!.dark).not.toBe(DARK_TEXT);
  });

  it("returns null on an empty token instead of falling back to a hardcoded color", () => {
    expect(qrColorsForTheme("dark", "")).toBeNull();
    expect(qrColorsForTheme("dark", "   ")).toBeNull();
  });

  it("trims whitespace around the token value", () => {
    expect(qrColorsForTheme("dark", `  ${DARK_TEXT}  `)!.dark).toBe(DARK_TEXT);
  });

  it("background is always the transparent format constant", () => {
    expect(qrColorsForTheme("dark", DARK_TEXT)!.light).toBe(QR_BG_TRANSPARENT);
    expect(qrColorsForTheme("light", LIGHT_TEXT)!.light).toBe(QR_BG_TRANSPARENT);
  });
});
