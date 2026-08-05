import { describe, it, expect } from "vitest";
import {
  weekWindow,
  inWindow,
  attentionRank,
  sortDigestRows,
  summarizeRows,
  type DigestRowInput,
} from "@/lib/weeklyDigest";

const NOW = new Date(2026, 7, 5, 15, 30); // Wed Aug 5 2026 (week starts Mon Aug 3)

const row = (over: Partial<DigestRowInput> = {}): DigestRowInput => ({
  checkinThisWeek: true,
  weightDelta: null,
  workoutsCompleted: 2,
  sessionsScheduled: 2,
  daysLogged: 3,
  kcalPct: 90,
  hasProgram: true,
  ...over,
});

describe("weekWindow + inWindow (Phase 45)", () => {
  it("offset 0 = current Mon–Sun; offset 1 = previous", () => {
    const w0 = weekWindow(0, NOW);
    expect(w0.start.getDate()).toBe(3); // Aug 3
    expect(w0.end.getDate()).toBe(10); // exclusive
    const w1 = weekWindow(1, NOW);
    expect(w1.start.getDate()).toBe(27); // Jul 27
    expect(w1.end.getDate()).toBe(3);
  });

  it("inWindow honors exact boundaries (inclusive start, exclusive end)", () => {
    const w = weekWindow(0, NOW);
    expect(inWindow(new Date(2026, 7, 3, 0, 0, 0), w)).toBe(true);
    expect(inWindow(new Date(2026, 7, 9, 23, 59), w)).toBe(true);
    expect(inWindow(new Date(2026, 7, 10, 0, 0, 0), w)).toBe(false);
    expect(inWindow("2026-07-27T12:00:00", w)).toBe(false);
    expect(inWindow("2026-07-27T12:00:00", weekWindow(1, NOW))).toBe(true);
  });
});

describe("attentionRank (Phase 45)", () => {
  it("priority order: no check-in > no workouts > no logs > no program > ok", () => {
    expect(attentionRank(row({ checkinThisWeek: false }))).toBe(0);
    expect(attentionRank(row({ workoutsCompleted: 0 }))).toBe(1);
    expect(attentionRank(row({ daysLogged: 0 }))).toBe(2);
    expect(attentionRank(row({ hasProgram: false }))).toBe(3);
    expect(attentionRank(row())).toBe(4);
  });

  it("first failing category wins (check-in beats everything)", () => {
    expect(
      attentionRank(row({ checkinThisWeek: false, workoutsCompleted: 0, daysLogged: 0, hasProgram: false })),
    ).toBe(0);
    expect(attentionRank(row({ workoutsCompleted: 0, daysLogged: 0 }))).toBe(1);
  });
});

describe("sortDigestRows (Phase 45)", () => {
  it("needs-attention first, alphabetical within a rank", () => {
    const rows = [
      { name: "Zed", ...row() },
      { name: "Bob", ...row({ checkinThisWeek: false }) },
      { name: "Amy", ...row({ checkinThisWeek: false }) },
      { name: "Cal", ...row({ daysLogged: 0 }) },
    ];
    expect(sortDigestRows(rows).map((r) => r.name)).toEqual(["Amy", "Bob", "Cal", "Zed"]);
  });

  it("does not mutate the input", () => {
    const rows = [{ name: "B", ...row() }, { name: "A", ...row() }];
    const snapshot = [...rows];
    sortDigestRows(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("summarizeRows (Phase 45)", () => {
  it("computes the header strip from the same rows", () => {
    const s = summarizeRows([
      row({ checkinThisWeek: false, workoutsCompleted: 3, daysLogged: 0 }),
      row({ workoutsCompleted: 2 }),
      row({ workoutsCompleted: 0, daysLogged: 1 }),
    ]);
    expect(s).toEqual({ checkedIn: 2, total: 3, workoutsCompleted: 5, loggedAny: 2 });
  });

  it("empty roster → zeros", () => {
    expect(summarizeRows([])).toEqual({ checkedIn: 0, total: 0, workoutsCompleted: 0, loggedAny: 0 });
  });
});
