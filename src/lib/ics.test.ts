import { describe, it, expect } from "vitest";
import { generateICS, generateICSBundle, toUTCDateTime, escapeICS, icsFilename } from "./ics";

describe("toUTCDateTime", () => {
  it("converts ISO strings to UTC datetime format", () => {
    expect(toUTCDateTime("2026-07-22T10:00:00Z")).toBe("20260722T100000Z");
    expect(toUTCDateTime("2026-07-22T10:00:00+08:00")).toBe("20260722T020000Z");
  });
});

describe("escapeICS", () => {
  it("escapes special characters per RFC 5545", () => {
    expect(escapeICS("PT, lower body")).toBe("PT\\, lower body");
    expect(escapeICS("Gym; pool")).toBe("Gym\\; pool");
    expect(escapeICS("Line 1\nLine 2")).toBe("Line 1\\nLine 2");
  });
});

describe("generateICS", () => {
  it("produces a valid VCALENDAR with a single VEVENT", () => {
    const ics = generateICS({
      id: "sess-123",
      title: "PT, lower body",
      startsAt: "2026-07-22T10:00:00Z",
      endsAt: "2026-07-22T11:00:00Z",
      location: "Gym; pool",
      notes: "Focus on squats,\nleg press",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:sess-123@azfit");
    expect(ics).toContain("DTSTART:20260722T100000Z");
    expect(ics).toContain("DTEND:20260722T110000Z");
    expect(ics).toContain("SUMMARY:PT\\, lower body");
    expect(ics).toContain("LOCATION:Gym\\; pool");
    expect(ics).toContain("DESCRIPTION:Focus on squats\\,\\nleg press");
  });

  it("omits optional fields when not provided", () => {
    const ics = generateICS({
      id: "sess-456",
      title: "Session",
      startsAt: "2026-07-22T10:00:00Z",
      endsAt: "2026-07-22T11:00:00Z",
    });
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });
});

describe("generateICSBundle", () => {
  it("bundles multiple events into one VCALENDAR", () => {
    const ics = generateICSBundle([
      {
        id: "sess-1",
        title: "A",
        startsAt: "2026-07-22T10:00:00Z",
        endsAt: "2026-07-22T11:00:00Z",
      },
      {
        id: "sess-2",
        title: "B",
        startsAt: "2026-07-23T10:00:00Z",
        endsAt: "2026-07-23T11:00:00Z",
      },
    ]);
    const events = ics.match(/BEGIN:VEVENT/g) || [];
    expect(events).toHaveLength(2);
    expect(ics).toContain("UID:sess-1@azfit");
    expect(ics).toContain("UID:sess-2@azfit");
  });
});

describe("icsFilename", () => {
  it("uses the session date in filename", () => {
    expect(icsFilename("2026-07-28T10:00:00Z")).toBe("azfit-session-2026-07-28.ics");
  });
});
