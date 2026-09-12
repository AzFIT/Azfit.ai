import { describe, it, expect } from "vitest";
import { computeAchievements, longestWeekRun, weekKeyFor, type AchievementInputs } from "./achievements";

const TODAY = "2026-09-11"; // Friday
const WK = (back: number) => {
  const d = new Date(2026, 8, 11);
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY: AchievementInputs = {
  todayKey: TODAY,
  completedSessionsAllTime: 0,
  sessionDates: [],
  planItems: [],
  habitDates: [],
  checkinDates: [],
  waterWeeks: null,
  waterTarget: null,
};

function withOverrides(p: Partial<AchievementInputs>): AchievementInputs {
  return { ...EMPTY, ...p };
}

const byId = (list: ReturnType<typeof computeAchievements>) => new Map(list.map((a) => [a.id, a]));

describe("weekKeyFor / longestWeekRun", () => {
  it("maps any weekday to its Monday-start week key", () => {
    expect(weekKeyFor("2026-09-11")).toBe("2026-09-07"); // Fri → Mon
    expect(weekKeyFor("2026-09-07")).toBe("2026-09-07"); // Mon stays
    expect(weekKeyFor("2026-09-13")).toBe("2026-09-07"); // Sun → that week's Mon
  });

  it("counts only CONSECUTIVE weeks", () => {
    expect(longestWeekRun([])).toBe(0);
    expect(longestWeekRun(["2026-09-07", "2026-09-08"])).toBe(1); // same week
    expect(longestWeekRun(["2026-08-31", "2026-09-07", "2026-09-14"])).toBe(3);
    expect(longestWeekRun(["2026-08-31", "2026-09-14"])).toBe(1); // gap week
  });
});

describe("computeAchievements", () => {
  it("empty client unlocks NOTHING and invents no progress", () => {
    const list = computeAchievements(EMPTY);
    expect(list.length).toBeGreaterThanOrEqual(7);
    expect(list.every((a) => !a.unlocked)).toBe(true);
    expect(list.every((a) => a.progress === null)).toBe(true);
    expect(list.every((a) => a.evidence === null)).toBe(true);
  });

  it("every achievement has a unique id and requirement text", () => {
    const list = computeAchievements(EMPTY);
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
    expect(list.every((a) => a.requirement.length > 0)).toBe(true);
  });

  it("first session unlocks First Steps with real evidence", () => {
    const m = byId(computeAchievements(withOverrides({ completedSessionsAllTime: 1 })));
    expect(m.get("first-steps")?.unlocked).toBe(true);
    expect(m.get("first-steps")?.evidence).toBe("1 session completed");
    const m5 = byId(computeAchievements(withOverrides({ completedSessionsAllTime: 5 })));
    expect(m5.get("first-steps")?.evidence).toBe("5 sessions completed");
  });

  it("streak boundary: 7-day streak unlocks at exactly 7, not 6", () => {
    const six = [0, 1, 2, 3, 4, 5].map(WK); // 6 consecutive days ending today
    const m6 = byId(computeAchievements(withOverrides({ habitDates: six })));
    expect(m6.get("streak-3")?.unlocked).toBe(true);
    expect(m6.get("streak-7")?.unlocked).toBe(false);
    expect(m6.get("streak-7")?.progress).toBe("6 days — longest streak");

    const seven = [0, 1, 2, 3, 4, 5, 6].map(WK);
    const m7 = byId(computeAchievements(withOverrides({ habitDates: seven })));
    expect(m7.get("streak-7")?.unlocked).toBe(true);
    expect(m7.get("streak-7")?.evidence).toBe("7 days longest streak in your window");
    expect(m7.get("streak-14")?.unlocked).toBe(false);
  });

  it("multiple simultaneous unlocks", () => {
    const list = computeAchievements(
      withOverrides({
        completedSessionsAllTime: 3,
        sessionDates: [WK(0), WK(1)],
        habitDates: [0, 1, 2, 3, 4, 5, 6, 7].map(WK), // 8-day streak
        checkinDates: ["2026-08-24", "2026-08-31", "2026-09-07"], // 3-week run
        waterWeeks: [{ weekStartKey: "2026-09-07", values: [3, 3, 3, 3, 3, null, null] }],
        waterTarget: 3,
      }),
    );
    const m = byId(list);
    expect(m.get("first-steps")?.unlocked).toBe(true);
    expect(m.get("streak-3")?.unlocked).toBe(true);
    expect(m.get("streak-7")?.unlocked).toBe(true);
    expect(m.get("hydration-hero")?.unlocked).toBe(true);
    expect(m.get("checkin-regular")?.unlocked).toBe(false);
    expect(m.get("checkin-regular")?.progress).toBe("3 weeks in a row — best run");
    expect(m.get("streak-14")?.unlocked).toBe(false);
  });

  it("check-in regular unlocks at 4 consecutive weeks", () => {
    const m = byId(
      computeAchievements(
        withOverrides({ checkinDates: ["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"] }),
      ),
    );
    expect(m.get("checkin-regular")?.unlocked).toBe(true);
    expect(m.get("checkin-regular")?.evidence).toBe("4 weeks check-in run");
  });

  it("plan finisher: 100% week unlocks; partial week shows real progress only", () => {
    const perfect = byId(
      computeAchievements(
        withOverrides({
          planItems: [
            { date: "2026-08-31", done: true },
            { date: "2026-09-02", done: false }, // EARLIER week partial
            { date: "2026-09-07", done: true },
            { date: "2026-09-08", done: true }, // this week 100%
          ],
        }),
      ),
    );
    expect(perfect.get("plan-finisher")?.unlocked).toBe(true);

    const partial = byId(
      computeAchievements(
        withOverrides({
          planItems: [
            { date: "2026-09-07", done: true },
            { date: "2026-09-08", done: false },
          ],
        }),
      ),
    );
    expect(partial.get("plan-finisher")?.unlocked).toBe(false);
    expect(partial.get("plan-finisher")?.progress).toBe("1 of 2 this week");
  });

  it("hydration hero needs a numeric water habit; locked shows nothing fake without one", () => {
    const noHabit = byId(computeAchievements(EMPTY));
    expect(noHabit.get("hydration-hero")?.progress).toBeNull();

    const short = byId(
      computeAchievements(
        withOverrides({
          waterWeeks: [
            { weekStartKey: "2026-09-07", values: [3, 3, 3, 3, null, null, null] }, // 4 days
          ],
          waterTarget: 3,
        }),
      ),
    );
    expect(short.get("hydration-hero")?.unlocked).toBe(false);
    expect(short.get("hydration-hero")?.progress).toBe("4 days in your best week");

    const met = byId(
      computeAchievements(
        withOverrides({
          waterWeeks: [{ weekStartKey: "2026-09-07", values: [3, 3, 3, 3, 3, 2, null] }],
          waterTarget: 3,
        }),
      ),
    );
    expect(met.get("hydration-hero")?.unlocked).toBe(true);
  });

  it("consistency crown: 20+ active days; partial shows real count", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => WK(i));
    const m = byId(computeAchievements(withOverrides({ habitDates: twenty })));
    expect(m.get("consistency-crown")?.unlocked).toBe(true);
    expect(m.get("consistency-crown")?.evidence).toBe("20 active days in 12 weeks");

    const ten = Array.from({ length: 10 }, (_, i) => WK(i));
    const m10 = byId(computeAchievements(withOverrides({ habitDates: ten })));
    expect(m10.get("consistency-crown")?.unlocked).toBe(false);
    expect(m10.get("consistency-crown")?.progress).toBe("10 of 20 days");
  });
});
