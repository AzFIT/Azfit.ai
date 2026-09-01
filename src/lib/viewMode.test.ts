import { describe, it, expect, beforeEach } from "vitest";
import {
  isViewMode,
  readWizardViewMode,
  writeWizardViewMode,
  tileGridClass,
  rowGridClass,
  VIEW_MODES,
} from "./viewMode";

describe("viewMode persistence (wizardView.* localStorage)", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a valid mode per page", () => {
    writeWizardViewMode("goal", "list");
    writeWizardViewMode("method", "details");
    expect(readWizardViewMode("goal")).toBe("list");
    expect(readWizardViewMode("method")).toBe("details");
    // pages are independent
    expect(readWizardViewMode("phases")).toBe("medium");
  });

  it("falls back to medium on missing/invalid/corrupt values", () => {
    expect(readWizardViewMode("goal")).toBe("medium");
    localStorage.setItem("wizardView.goal", "huge");
    expect(readWizardViewMode("goal")).toBe("medium");
    localStorage.setItem("wizardView.goal", "large");
    expect(readWizardViewMode("goal")).toBe("large");
  });

  it("validates the mode vocabulary", () => {
    for (const m of VIEW_MODES) expect(isViewMode(m)).toBe(true);
    expect(isViewMode("LARGE")).toBe(false);
    expect(isViewMode(null)).toBe(false);
    expect(isViewMode(3)).toBe(false);
  });
});

describe("grid classes per mode", () => {
  it("tile grids: large = 1 col mobile, medium = current 3-col, list/details = single column", () => {
    expect(tileGridClass("large")).toContain("grid-cols-1");
    expect(tileGridClass("large")).not.toContain("lg:grid-cols-3");
    expect(tileGridClass("medium")).toContain("lg:grid-cols-3");
    expect(tileGridClass("small")).toContain("lg:grid-cols-4");
    expect(tileGridClass("list")).toContain("grid-cols-1");
    expect(tileGridClass("details")).toContain("grid-cols-1");
  });

  it("row layouts: only large gets a 2-col card grid", () => {
    expect(rowGridClass("large")).toContain("lg:grid-cols-2");
    for (const m of ["medium", "small", "list", "details"] as const) {
      expect(rowGridClass(m)).not.toContain("lg:grid-cols-2");
    }
  });
});
