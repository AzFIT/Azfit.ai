import { describe, expect, it } from "vitest";
import { countBadge } from "./panelBadges";

describe("countBadge", () => {
  it("pluralizes for count > 1", () => {
    expect(countBadge(2, "session remaining", "sessions remaining")).toEqual({
      text: "2 sessions remaining",
      tone: "neutral",
    });
  });

  it("singular for count === 1", () => {
    expect(countBadge(1, "session remaining", "sessions remaining")).toEqual({
      text: "1 session remaining",
      tone: "neutral",
    });
  });

  it("hides the badge for zero and negatives (honest data)", () => {
    expect(countBadge(0, "set this week", "sets this week")).toBeNull();
    expect(countBadge(-3, "set this week", "sets this week")).toBeNull();
  });

  it("hides the badge for non-finite input", () => {
    expect(countBadge(NaN, "set this week", "sets this week")).toBeNull();
    expect(countBadge(Infinity, "set this week", "sets this week")).toBeNull();
  });

  it("carries the requested tone through", () => {
    expect(countBadge(3, "client at risk", "clients at risk", "danger")?.tone).toBe(
      "danger"
    );
  });
});
