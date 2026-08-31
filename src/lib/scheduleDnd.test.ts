import { describe, it, expect } from "vitest";
import {
  SLOT_INCREMENT_MIN,
  snapMinutesToSlot,
  minutesToTimeString,
  movedSessionTimes,
  dropAllowed,
} from "./scheduleDnd";

describe("snapMinutesToSlot", () => {
  it("snaps to the nearest 30-minute slot (half rounds up)", () => {
    expect(snapMinutesToSlot(9 * 60 + 10)).toBe(9 * 60); // 09:10 → 09:00
    expect(snapMinutesToSlot(9 * 60 + 15)).toBe(9 * 60 + 30); // 09:15 → 09:30
    expect(snapMinutesToSlot(9 * 60 + 44)).toBe(9 * 60 + 30); // 09:44 → 09:30
    expect(snapMinutesToSlot(9 * 60 + 45)).toBe(10 * 60); // 09:45 → 10:00
  });

  it("defaults to the 30-minute Book-Session increment", () => {
    expect(SLOT_INCREMENT_MIN).toBe(30);
    expect(snapMinutesToSlot(61)).toBe(60);
  });

  it("guards non-finite input", () => {
    expect(snapMinutesToSlot(NaN)).toBe(0);
  });
});

describe("minutesToTimeString", () => {
  it("formats HH:MM and clamps into the day", () => {
    expect(minutesToTimeString(0)).toBe("00:00");
    expect(minutesToTimeString(570)).toBe("09:30");
    expect(minutesToTimeString(-30)).toBe("00:00");
    expect(minutesToTimeString(25 * 60)).toBe("23:59");
  });
});

describe("movedSessionTimes", () => {
  it("moves date+start while preserving the duration", () => {
    const out = movedSessionTimes({ startTime: "09:00", endTime: "10:30" }, "2026-09-02", "14:00");
    const start = new Date(out.startsAt);
    const end = new Date(out.endsAt);
    expect(start.getTime()).toBe(new Date("2026-09-02T14:00").getTime());
    expect((end.getTime() - start.getTime()) / 60_000).toBe(90);
  });

  it("keeps a 45-minute duration on a cross-day move", () => {
    const out = movedSessionTimes({ startTime: "18:15", endTime: "19:00" }, "2026-09-05", "07:30");
    expect((new Date(out.endsAt).getTime() - new Date(out.startsAt).getTime()) / 60_000).toBe(45);
  });
});

describe("dropAllowed", () => {
  it("allows anything when no template applies", () => {
    expect(dropAllowed(undefined, "2026-09-02", "25:00", "26:00")).toBe(true);
  });

  it("requires BOTH start and end inside the window", () => {
    const onlyMornings = (_d: string, t: string) => t <= "12:00";
    expect(dropAllowed(onlyMornings, "2026-09-02", "09:00", "10:00")).toBe(true);
    expect(dropAllowed(onlyMornings, "2026-09-02", "11:30", "12:30")).toBe(false);
  });
});
