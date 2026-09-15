/* Phase 94 — notificationPrefs unit tests (pure reducer + quiet-hours math). */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPES,
  clearQuietHours,
  isQuietHoursTime,
  normalizeNotificationPrefs,
  setNotificationType,
  setQuietHours,
  type NotificationPrefs,
} from "./notificationPrefs";

describe("normalizeNotificationPrefs", () => {
  it("NULL / undefined / garbage → defaults (all types on, no quiet hours)", () => {
    for (const raw of [null, undefined, 42, "x", []]) {
      const p = normalizeNotificationPrefs(raw);
      expect(p).toEqual(DEFAULT_NOTIFICATION_PREFS);
    }
  });

  it("empty object → defaults", () => {
    expect(normalizeNotificationPrefs({})).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("explicit false is preserved across all five types", () => {
    const p = normalizeNotificationPrefs({
      types: {
        session_reminder: false,
        checkin_due: false,
        missed_workout: false,
        streak_at_risk: false,
        achievement_unlocked: false,
      },
    });
    expect(Object.values(p.types).every((v) => v === false)).toBe(true);
  });

  it("unknown type ids are dropped (not leaked into the result)", () => {
    const p = normalizeNotificationPrefs({
      types: { bogus_type: false, session_reminder: false },
    });
    expect(Object.keys(p.types).sort()).toEqual(NOTIFICATION_TYPES.map((t) => t.id).sort());
    expect(p.types.session_reminder).toBe(false);
    expect(p.types.checkin_due).toBe(true);
  });

  it("non-boolean type values are ignored (default on)", () => {
    const p = normalizeNotificationPrefs({ types: { session_reminder: "no", checkin_due: 0 } });
    expect(p.types.session_reminder).toBe(true);
    expect(p.types.checkin_due).toBe(true);
  });

  it("valid quiet hours are kept; malformed shapes are nulled", () => {
    expect(normalizeNotificationPrefs({ quietHours: { from: "21:00", to: "07:00" } }).quietHours)
      .toEqual({ from: "21:00", to: "07:00" });
    for (const bad of [
      { from: "21:00" },
      { from: "9pm", to: "7am" },
      { from: "25:00", to: "07:00" },
      { from: "21:60", to: "07:00" },
      { from: "07:00", to: "07:00" }, // all-day is a mistake, not a window
      "21:00-07:00",
      null,
    ]) {
      expect(normalizeNotificationPrefs({ quietHours: bad }).quietHours).toBeNull();
    }
  });

  it("returns a fresh object (no shared references with defaults)", () => {
    const a = normalizeNotificationPrefs(null);
    const b = normalizeNotificationPrefs(null);
    a.types.session_reminder = false;
    expect(b.types.session_reminder).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFS.types.session_reminder).toBe(true);
  });
});

describe("setNotificationType", () => {
  it("toggles immutably", () => {
    const p: NotificationPrefs = normalizeNotificationPrefs(null);
    const next = setNotificationType(p, "streak_at_risk", false);
    expect(next.types.streak_at_risk).toBe(false);
    expect(p.types.streak_at_risk).toBe(true);
  });
});

describe("setQuietHours / clearQuietHours", () => {
  const p = normalizeNotificationPrefs(null);

  it("accepts a valid window immutably", () => {
    const next = setQuietHours(p, "22:30", "06:15");
    expect(next.quietHours).toEqual({ from: "22:30", to: "06:15" });
    expect(p.quietHours).toBeNull();
  });

  it("rejects malformed / equal windows (returns prefs unchanged)", () => {
    for (const [f, t] of [["22:30", "bad"], ["bad", "06:15"], ["08:00", "08:00"], ["24:00", "01:00"]] as const) {
      expect(setQuietHours(p, f, t)).toBe(p);
    }
  });

  it("clearQuietHours nulls the window", () => {
    const withQh = setQuietHours(p, "21:00", "07:00");
    expect(clearQuietHours(withQh).quietHours).toBeNull();
  });
});

describe("isQuietHoursTime", () => {
  const overnight = { from: "21:00", to: "07:00" };
  const daytime = { from: "12:00", to: "14:00" };
  const at = (h: number, m = 0) => new Date(2026, 8, 15, h, m);

  it("null quiet hours → never quiet", () => {
    expect(isQuietHoursTime(null, at(23))).toBe(false);
  });

  it("overnight window wraps midnight", () => {
    expect(isQuietHoursTime(overnight, at(21, 0))).toBe(true); // boundary in
    expect(isQuietHoursTime(overnight, at(23, 59))).toBe(true);
    expect(isQuietHoursTime(overnight, at(0, 0))).toBe(true);
    expect(isQuietHoursTime(overnight, at(6, 59))).toBe(true);
    expect(isQuietHoursTime(overnight, at(7, 0))).toBe(false); // boundary out
    expect(isQuietHoursTime(overnight, at(12))).toBe(false);
    expect(isQuietHoursTime(overnight, at(20, 59))).toBe(false);
  });

  it("daytime window does not wrap", () => {
    expect(isQuietHoursTime(daytime, at(11, 59))).toBe(false);
    expect(isQuietHoursTime(daytime, at(12, 0))).toBe(true);
    expect(isQuietHoursTime(daytime, at(13, 30))).toBe(true);
    expect(isQuietHoursTime(daytime, at(14, 0))).toBe(false);
  });

  it("from === to is treated as never quiet (defensive)", () => {
    expect(isQuietHoursTime({ from: "08:00", to: "08:00" }, at(8))).toBe(false);
  });
});
