import { describe, it, expect } from "vitest";
import { buildCoachBrief, dataCompleteness, confidenceLevel, type BriefClientInput } from "./coachBrief";

const client = (over: Partial<BriefClientInput>): BriefClientInput => ({
  id: "c1",
  name: "Alex",
  checkinDue: false,
  workoutsThisWeek: 2,
  workoutsLastWeek: 2,
  daysSinceLastWorkout: 2,
  hasActiveProgram: true,
  creditsRemaining: null,
  ...over,
});

describe("buildCoachBrief rules", () => {
  it("quiet roster → empty array (honest 'All caught up')", () => {
    expect(buildCoachBrief({ sessionsToday: 0, clients: [client({})] })).toEqual([]);
  });

  it("missed check-in → warning → /check-ins", () => {
    const out = buildCoachBrief({ sessionsToday: 0, clients: [client({ checkinDue: true })] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ severity: "warning", action: { route: "/check-ins" } });
  });

  it("adherence drop → warning, only when last week had activity", () => {
    const drop = buildCoachBrief({ sessionsToday: 0, clients: [client({ workoutsThisWeek: 0, workoutsLastWeek: 3 })] });
    expect(drop.some((i) => i.id.startsWith("drop-"))).toBe(true);
    const noBaseline = buildCoachBrief({ sessionsToday: 0, clients: [client({ workoutsThisWeek: 0, workoutsLastWeek: 0 })] });
    expect(noBaseline).toEqual([]);
  });

  it("no workout in 7+ days (or never) → alert → /messages", () => {
    const seven = buildCoachBrief({ sessionsToday: 0, clients: [client({ daysSinceLastWorkout: 9 })] });
    expect(seven[0]).toMatchObject({ severity: "alert", action: { route: "/messages" } });
    const never = buildCoachBrief({ sessionsToday: 0, clients: [client({ daysSinceLastWorkout: null })] });
    expect(never[0].severity).toBe("alert");
    const six = buildCoachBrief({ sessionsToday: 0, clients: [client({ daysSinceLastWorkout: 6 })] });
    expect(six).toEqual([]);
  });

  it("no active program → info → builder with clientId", () => {
    const out = buildCoachBrief({ sessionsToday: 0, clients: [client({ hasActiveProgram: false })] });
    expect(out[0]).toMatchObject({ severity: "info", action: { route: "/ai-program-builder?clientId=c1" } });
  });

  it("credits <= 1 → info → schedule tab; no package → nothing", () => {
    const low = buildCoachBrief({ sessionsToday: 0, clients: [client({ creditsRemaining: 1 })] });
    expect(low[0].action.route).toBe("/client/c1?tab=schedule");
    expect(buildCoachBrief({ sessionsToday: 0, clients: [client({ creditsRemaining: 5 })] })).toEqual([]);
  });

  it("sessions today → info summary → /schedule", () => {
    const out = buildCoachBrief({ sessionsToday: 2, clients: [client({})] });
    expect(out[0]).toMatchObject({ severity: "info", action: { route: "/schedule" } });
  });

  it("severity ordering + max 5", () => {
    const busy: BriefClientInput[] = Array.from({ length: 4 }, (_, i) =>
      client({ id: `c${i}`, name: `C${i}`, daysSinceLastWorkout: 10, checkinDue: true, hasActiveProgram: false, creditsRemaining: 0, workoutsThisWeek: 0, workoutsLastWeek: 2 }),
    );
    const out = buildCoachBrief({ sessionsToday: 1, clients: busy });
    expect(out.length).toBe(5);
    const order = out.map((i) => i.severity);
    expect(order).toEqual([...order].sort((a, b) => ({ alert: 0, warning: 1, info: 2 })[a] - ({ alert: 0, warning: 1, info: 2 })[b]));
    expect(out.filter((i) => i.severity === "alert").length).toBeGreaterThan(0);
  });
});

describe("dataCompleteness + confidenceLevel", () => {
  it("percent of roster with recent activity", () => {
    expect(
      dataCompleteness([
        client({ daysSinceLastWorkout: 2 }),
        client({ daysSinceLastWorkout: 10, checkinDue: true }),
        client({ daysSinceLastWorkout: null, checkinDue: true }),
        client({ daysSinceLastWorkout: 30, checkinDue: true }),
      ]),
    ).toBe(25);
  });
  it("empty roster → 0", () => {
    expect(dataCompleteness([])).toBe(0);
  });
  it("level thresholds", () => {
    expect(confidenceLevel(70)).toBe("High");
    expect(confidenceLevel(69)).toBe("Medium");
    expect(confidenceLevel(39)).toBe("Low");
  });
});
