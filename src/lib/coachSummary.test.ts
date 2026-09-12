import { describe, it, expect } from "vitest";
import {
  localWeekWindow,
  inWindow,
  inactiveClients,
  sessionsThisWeek,
  remainingToday,
  weekCompliance,
  complianceDelta,
  needsAttentionSummary,
  onTrackSummary,
  type SummaryClient,
  type SummarySession,
  type CompletedLog,
} from "./coachSummary";

const NOW = new Date(2026, 8, 9, 15, 0, 0); // Wednesday 9 Sep 2026, 15:00 local
const WEEK = localWeekWindow(0, NOW); // Mon 7 Sep 00:00 – Mon 14 Sep 00:00
const LAST_WEEK = localWeekWindow(1, NOW); // Mon 31 Aug – Mon 7 Sep

const iso = (d: Date) => d.toISOString();

const roster: SummaryClient[] = [
  { id: "c1", fullName: "Amy Gregg", status: "active", profileId: "p1" },
  { id: "c2", fullName: "Ben Sabre", status: "active", profileId: "p2" },
  { id: "c3", fullName: "Cat Dee", status: "trial", profileId: null }, // account-less
];

function sess(partial: Partial<SummarySession> & { startsAt: Date }): SummarySession {
  return {
    client_id: null,
    client_record_id: null,
    status: "scheduled",
    ...partial,
    starts_at: iso(partial.startsAt),
  };
}

describe("localWeekWindow / inWindow", () => {
  it("is Monday-start, local, 7 days", () => {
    expect(WEEK.start.getDay()).toBe(1);
    expect(WEEK.end.getTime() - WEEK.start.getTime()).toBe(7 * 86400000);
    expect(WEEK.start.getDate()).toBe(7);
    expect(LAST_WEEK.start.getDate()).toBe(31);
  });

  it("inWindow is start-inclusive, end-exclusive", () => {
    expect(inWindow(iso(WEEK.start), WEEK)).toBe(true);
    expect(inWindow(iso(new Date(WEEK.end.getTime() - 1)), WEEK)).toBe(true);
    expect(inWindow(iso(WEEK.end), WEEK)).toBe(false);
  });
});

describe("inactiveClients — the Coach-brief signal (completed_at, 7d)", () => {
  it("flags clients with no completed log in 7+ days, first names only", () => {
    const logs: CompletedLog[] = [
      { client_id: "c1", completed_at: iso(new Date(NOW.getTime() - 2 * 86400000)) }, // Amy trained 2d ago
      { client_id: "c2", completed_at: iso(new Date(NOW.getTime() - 9 * 86400000)) }, // Ben: 9d ago → inactive
      // Cat: never (no logs)
    ];
    const out = inactiveClients(roster, logs, NOW);
    expect(out).toEqual([
      { id: "c2", firstName: "Ben" },
      { id: "c3", firstName: "Cat" },
    ]);
  });

  it("empty roster → empty", () => {
    expect(inactiveClients([], [], NOW)).toEqual([]);
  });

  it("everyone trained → empty (positive state downstream)", () => {
    const logs: CompletedLog[] = roster.map((c) => ({
      client_id: c.id,
      completed_at: iso(NOW),
    }));
    expect(inactiveClients(roster, logs, NOW)).toEqual([]);
  });
});

describe("sessionsThisWeek / remainingToday", () => {
  const sessions = [
    sess({ client_id: "p1", status: "completed", startsAt: new Date(2026, 8, 8, 9) }),
    sess({ client_id: "p1", status: "scheduled", startsAt: new Date(2026, 8, 9, 18) }), // later today
    sess({ client_record_id: "c3", status: "cancelled", startsAt: new Date(2026, 8, 10, 10) }),
    sess({ client_id: "p1", status: "scheduled", startsAt: new Date(2026, 8, 12, 10) }),
    sess({ client_id: "p1", status: "scheduled", startsAt: new Date(2026, 8, 15, 10) }), // next week
    sess({ client_id: "p1", status: "requested", startsAt: new Date(2026, 8, 11, 10) }),
  ];

  it("counts non-cancelled in-window sessions (requested on the books)", () => {
    expect(sessionsThisWeek(sessions, WEEK)).toBe(4); // excludes cancelled + next week
  });

  it("remainingToday counts future scheduled sessions on today's local day", () => {
    expect(remainingToday(sessions, NOW)).toBe(1); // 18:00 later today
    expect(remainingToday(sessions, new Date(2026, 8, 9, 19, 0, 0))).toBe(0); // after it started
  });
});

describe("weekCompliance — zero-scheduled excluded from denominator", () => {
  it("computes completed ÷ scheduled over eligible clients only", () => {
    const sessions = [
      // Amy: 2 scheduled 1 completed
      sess({ client_record_id: "c1", status: "scheduled", startsAt: new Date(2026, 8, 8, 9) }),
      sess({ client_record_id: "c1", status: "completed", startsAt: new Date(2026, 8, 9, 9) }),
      sess({ client_record_id: "c1", status: "scheduled", startsAt: new Date(2026, 8, 10, 9) }),
      // Ben: 1 completed only → eligible, all completed
      sess({ client_record_id: "c2", status: "completed", startsAt: new Date(2026, 8, 8, 10) }),
      // Cat: zero scheduled → EXCLUDED (even though she'd drag the % down as 0/0)
    ];
    const r = weekCompliance(sessions, roster, WEEK);
    expect(r.scheduled).toBe(4);
    expect(r.completed).toBe(2);
    expect(r.pct).toBe(50);
  });

  it("account-less ownership falls back to profileId via clientId", () => {
    const sessions = [
      sess({ client_id: "p1", status: "completed", startsAt: new Date(2026, 8, 8, 9) }),
      sess({ client_id: "p2", status: "scheduled", startsAt: new Date(2026, 8, 8, 11) }),
    ];
    const r = weekCompliance(sessions, roster, WEEK);
    expect(r).toEqual({ pct: 50, completed: 1, scheduled: 2 });
  });

  it("cancelled sessions never count toward the denominator", () => {
    const sessions = [
      sess({ client_record_id: "c1", status: "cancelled", startsAt: new Date(2026, 8, 8, 9) }),
      sess({ client_record_id: "c1", status: "scheduled", startsAt: new Date(2026, 8, 9, 9) }),
    ];
    const r = weekCompliance(sessions, roster, WEEK);
    expect(r.scheduled).toBe(1);
  });

  it("nothing scheduled at all → honest null, not 0%", () => {
    const r = weekCompliance([], roster, WEEK);
    expect(r.pct).toBeNull();
    expect(r.scheduled).toBe(0);
  });
});

describe("complianceDelta", () => {
  it("null when either week has no base", () => {
    expect(complianceDelta({ pct: null, completed: 0, scheduled: 0 }, { pct: 50, completed: 1, scheduled: 2 })).toBeNull();
    expect(complianceDelta({ pct: 50, completed: 1, scheduled: 2 }, { pct: null, completed: 0, scheduled: 0 })).toBeNull();
  });

  it("real +/- % vs last week", () => {
    expect(complianceDelta({ pct: 75, completed: 3, scheduled: 4 }, { pct: 50, completed: 2, scheduled: 4 })).toBe(50);
    expect(complianceDelta({ pct: 25, completed: 1, scheduled: 4 }, { pct: 50, completed: 2, scheduled: 4 })).toBe(-50);
  });
});

describe("needsAttentionSummary", () => {
  it("counts at_risk + needs_attention, names top 3 (at_risk first, stable order)", () => {
    const health = [
      { name: "Zed", status: "needs_attention" },
      { name: "Amy", status: "at_risk" },
      { name: "Bob", status: "on_track" },
      { name: "Cal", status: "at_risk" },
      { name: "Dan", status: "needs_attention" },
      { name: "Eli", status: "deload" },
    ];
    const s = needsAttentionSummary(health);
    expect(s.count).toBe(4);
    expect(s.topNames).toEqual(["Amy", "Cal", "Dan"]); // at_risk first, then name A→Z
  });

  it("no flagged clients → count 0, empty names", () => {
    expect(needsAttentionSummary([{ name: "Amy", status: "on_track" }])).toEqual({ count: 0, topNames: [] });
  });
});

describe("onTrackSummary", () => {
  it("counts exactly on_track; deload is not on-track", () => {
    const health = [
      { name: "A", status: "on_track" },
      { name: "B", status: "deload" },
      { name: "C", status: "at_risk" },
    ];
    expect(onTrackSummary(health, 4)).toEqual({ onTrack: 1, total: 4 });
  });
});
