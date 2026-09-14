import { describe, expect, it } from "vitest";
import { isSensitiveCard } from "./privacySensitivity";

describe("isSensitiveCard — Phase 91 documented classification", () => {
  it("classifies the four sensitive cards", () => {
    expect(isSensitiveCard("needs-attention")).toBe(true); // top-3 names
    expect(isSensitiveCard("client-compliance")).toBe(true);
    expect(isSensitiveCard("active-clients-roster")).toBe(true); // names
    expect(isSensitiveCard("avg-compliance")).toBe(true);
  });

  it("classifies aggregate cards as non-sensitive", () => {
    expect(isSensitiveCard("active-clients")).toBe(false); // Phase 90 summary count
    expect(isSensitiveCard("sessions-week")).toBe(false); // bare count
    expect(isSensitiveCard("today")).toBe(false);
    expect(isSensitiveCard("weekly-volume")).toBe(false);
    expect(isSensitiveCard("coach-brief")).toBe(false);
  });

  it("unknown ids are non-sensitive by default (fail open, never over-blur)", () => {
    expect(isSensitiveCard("not-a-card")).toBe(false);
  });
});
