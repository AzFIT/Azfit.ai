import { describe, it, expect } from "vitest";
import {
  buildSessionUpdate,
  wizardTypeToEventType,
  eventTypeToWizardType,
} from "./sessionUpdate";

describe("buildSessionUpdate (edit path)", () => {
  it("maps date+startTime/endTime to ISO instants (local round-trip)", () => {
    const out = buildSessionUpdate({
      date: "2026-09-01",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(new Date(out.startsAt!).getTime()).toBe(new Date("2026-09-01T09:00").getTime());
    expect(new Date(out.endsAt!).getTime()).toBe(new Date("2026-09-01T10:00").getTime());
  });

  it("maps a full wizard edit (date, times, type, notes) into one payload", () => {
    const out = buildSessionUpdate({
      date: "2026-09-02",
      startTime: "14:30",
      endTime: "15:15",
      type: "session",
      description: "Focus: squats",
    });
    expect(out.type).toBe("session");
    expect(out.notes).toBe("Focus: squats");
    expect(new Date(out.endsAt!).getTime() - new Date(out.startsAt!).getTime()).toBe(45 * 60_000);
  });

  it("omits fields that were not edited", () => {
    expect(buildSessionUpdate({ title: "New title" })).toEqual({ title: "New title" });
    expect(buildSessionUpdate({})).toEqual({});
  });

  it("ignores startTime without a date (no half-built instants)", () => {
    const out = buildSessionUpdate({ startTime: "09:00" });
    expect(out.startsAt).toBeUndefined();
    expect(out.endsAt).toBeUndefined();
  });

  it("passes status/location through (null location preserved)", () => {
    const out = buildSessionUpdate({ status: "completed", location: null });
    expect(out.status).toBe("completed");
    expect(out.location).toBeNull();
  });
});

describe("session-type vocabulary mapping", () => {
  it("wizard → event types", () => {
    expect(wizardTypeToEventType("session")).toBe("session");
    expect(wizardTypeToEventType("reminder")).toBe("assessment");
    expect(wizardTypeToEventType("blocked")).toBe("blocked");
    expect(wizardTypeToEventType("returning")).toBe("check-in");
  });

  it("event → wizard types round-trip", () => {
    for (const w of ["session", "reminder", "blocked", "returning"]) {
      expect(eventTypeToWizardType(wizardTypeToEventType(w))).toBe(w);
    }
  });

  it("unknown values fall back to the plain session type", () => {
    expect(wizardTypeToEventType("nonsense")).toBe("session");
    expect(eventTypeToWizardType("1-on-1")).toBe("session");
  });
});
