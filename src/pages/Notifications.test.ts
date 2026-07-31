// Phase 33A Fix 1 — Notifications settings persistence must never crash.
import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings } from "@/pages/Notifications";

const KEY = "azfit_notification_settings";

const POISONED = [
  {
    id: "workout_reminder",
    label: "Workout Reminder",
    description: "Time for your workout!",
    icon: { displayName: "Dumbbell" }, // the real production poison shape
    enabled: false,
    time: "08:30",
  },
  {
    id: "rest_day",
    label: "Rest Day Tip",
    description: "Rest day tomorrow — stretch!",
    icon: { displayName: "Moon" },
    enabled: true,
  },
];

describe("Notifications settings persistence (Phase 33A)", () => {
  beforeEach(() => localStorage.removeItem(KEY));

  it("round-trips enabled/time and never stores icons", () => {
    const defaults = loadSettings();
    const modified = defaults.map((s) =>
      s.id === "workout_reminder" ? { ...s, enabled: false, time: "06:15" } : s
    );
    saveSettings(modified);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.every((s: Record<string, unknown>) => !("icon" in s))).toBe(true);
    const loaded = loadSettings();
    expect(loaded.find((s) => s.id === "workout_reminder")).toMatchObject({ enabled: false, time: "06:15" });
    expect(loaded.find((s) => s.id === "rest_day")?.enabled).toBe(true);
  });

  it("survives the poisoned payload: valid component icons, no throw, values preserved", () => {
    localStorage.setItem(KEY, JSON.stringify(POISONED));
    let loaded: ReturnType<typeof loadSettings> | undefined;
    expect(() => { loaded = loadSettings(); }).not.toThrow();
    expect(loaded).toBeDefined();
    for (const s of loaded!) {
      // real lucide components are functions or memo objects with $$typeof;
      // the poison junk ({displayName:'X'}) has neither
      const valid =
        typeof s.icon === "function" ||
        (typeof s.icon === "object" && s.icon !== null && "$$typeof" in s.icon);
      expect(valid).toBe(true);
    }
    expect(loaded!.find((s) => s.id === "workout_reminder")).toMatchObject({ enabled: false, time: "08:30" });
  });

  it("drops unknown saved ids and falls back to defaults for missing ones", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "deleted_setting", enabled: false },
        { id: "weight_log", enabled: false, time: "09:00" },
      ])
    );
    const loaded = loadSettings();
    expect(loaded.find((s) => s.id === "deleted_setting")).toBeUndefined();
    expect(loaded.length).toBe(5); // the DEFAULT_SETTINGS set
    expect(loaded.find((s) => s.id === "weight_log")).toMatchObject({ enabled: false, time: "09:00" });
    // untouched defaults keep their values
    expect(loaded.find((s) => s.id === "workout_reminder")?.enabled).toBe(true);
  });

  it("empty/corrupt payloads fall back to defaults", () => {
    localStorage.setItem(KEY, "not json{");
    expect(loadSettings().length).toBe(5);
    localStorage.setItem(KEY, "[]");
    expect(loadSettings().length).toBe(5);
  });
});
