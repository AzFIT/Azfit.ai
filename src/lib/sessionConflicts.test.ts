import { describe, it, expect } from "vitest";
import { findSessionConflicts, generateWeeklyOccurrences } from "./sessionConflicts";
import type { Session } from "@/hooks/useSessions";

function makeSession(
  id: string,
  trainerId: string,
  clientId: string,
  startsAt: string,
  endsAt: string,
  status: Session["status"] = "scheduled",
  type = "1-on-1",
  title = "Session"
): Session {
  return {
    id,
    trainerId,
    clientId,
    title,
    type,
    status,
    startsAt,
    endsAt,
    location: null,
    notes: null,
    createdAt: new Date().toISOString(),
  };
}

describe("findSessionConflicts", () => {
  it("returns empty when no sessions overlap", () => {
    const existing = [makeSession("s1", "t1", "c1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c2",
      startsAt: "2026-07-22T12:00:00Z",
      endsAt: "2026-07-22T13:00:00Z",
    });
    expect(conflicts).toHaveLength(0);
  });

  it("detects trainer double-booking", () => {
    const existing = [makeSession("s1", "t1", "c1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c2",
      startsAt: "2026-07-22T10:30:00Z",
      endsAt: "2026-07-22T11:30:00Z",
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("s1");
  });

  it("detects client already booked elsewhere", () => {
    const existing = [makeSession("s1", "t2", "c1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c1",
      startsAt: "2026-07-22T10:30:00Z",
      endsAt: "2026-07-22T11:30:00Z",
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("s1");
  });

  it("treats blocked time as a conflict", () => {
    const existing = [makeSession("b1", "t1", "t1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z", "scheduled", "blocked", "Blocked")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c1",
      startsAt: "2026-07-22T10:30:00Z",
      endsAt: "2026-07-22T11:30:00Z",
    });
    expect(conflicts).toHaveLength(1);
  });

  it("excludes cancelled sessions", () => {
    const existing = [makeSession("s1", "t1", "c1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z", "cancelled")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c2",
      startsAt: "2026-07-22T10:30:00Z",
      endsAt: "2026-07-22T11:30:00Z",
    });
    expect(conflicts).toHaveLength(0);
  });

  it("excludes the session being edited", () => {
    const existing = [makeSession("s1", "t1", "c1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c1",
      startsAt: "2026-07-22T10:00:00Z",
      endsAt: "2026-07-22T11:00:00Z",
      excludeId: "s1",
    });
    expect(conflicts).toHaveLength(0);
  });

  it("requires actual overlap (touching edges do not conflict)", () => {
    const existing = [makeSession("s1", "t1", "c1", "2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z")];
    const conflicts = findSessionConflicts(existing, {
      trainerId: "t1",
      clientId: "c2",
      startsAt: "2026-07-22T11:00:00Z",
      endsAt: "2026-07-22T12:00:00Z",
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe("generateWeeklyOccurrences", () => {
  it("generates weekly occurrences with same duration", () => {
    const base = {
      trainerId: "t1",
      clientId: "c1",
      title: "PT",
      type: "1-on-1",
      status: "scheduled" as const,
      startsAt: "2026-07-22T10:00:00Z",
      endsAt: "2026-07-22T11:00:00Z",
      location: null,
      notes: null,
    };
    const occurrences = generateWeeklyOccurrences(base, 3);
    expect(occurrences).toHaveLength(3);
    expect(new Date(occurrences[1].startsAt).getTime()).toBe(
      new Date("2026-07-29T10:00:00Z").getTime()
    );
    const dur0 = new Date(occurrences[0].endsAt).getTime() - new Date(occurrences[0].startsAt).getTime();
    const dur1 = new Date(occurrences[1].endsAt).getTime() - new Date(occurrences[1].startsAt).getTime();
    expect(dur1).toBe(dur0);
  });
});
